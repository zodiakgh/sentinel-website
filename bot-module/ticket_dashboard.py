"""Sentinel dashboard bridge for the ticket system (``bot.cogs.ticket_dashboard``).

Drop this file next to ``ticket.py`` in ``bot/cogs``. It does NOT replace anything:

* every minute it sends the website a snapshot of each server's ticket settings, types and panels;
* every 10 seconds it asks the website for changes queued from the dashboard and applies them through
  the ticket system's own validation (``coerce``, ``core.update_settings``, ``db.*_type``, ``db.*_panel``,
  ``core.publish_panel``), then acknowledges them.

Environment variables (same host as the bot):
    SENTINEL_API_URL   e.g. https://api.sentineldashboard.site
    SENTINEL_BOT_KEY   same value as the Worker secret BOT_API_KEY
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from typing import Any

import aiohttp
import discord
from discord.ext import commands, tasks

from .ticket_core import TicketError
from .ticket_settings import SCHEMA, SettingError, coerce
from .ticket_utils import PRIORITIES, is_http_url, parse_color, valid_emoji

log = logging.getLogger("sentinel.ticket_dashboard")

API = os.environ.get("SENTINEL_API_URL", "").rstrip("/")
KEY = os.environ.get("SENTINEL_BOT_KEY", "")
MAX_TYPES, MAX_PANELS = 25, 25


def _s(v: Any) -> Any:
    """JSON-friendly: ids as strings (JavaScript can't hold 64-bit ints)."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return v
    if isinstance(v, int) and v > 2**31:
        return str(v)
    if isinstance(v, (list, tuple)):
        return [_s(x) for x in v]
    return v


def _hex(v: Any) -> str:
    return f"#{int(v):06X}" if isinstance(v, int) and not isinstance(v, bool) else "#2B2B2B"


def _id(v: Any) -> int | None:
    if v in (None, "", 0, "0"):
        return None
    n = int(v)
    if n <= 0:
        raise ValueError("bad id")
    return n


def _ids(v: Any, limit: int = 25) -> list[int]:
    return list(dict.fromkeys(int(x) for x in (v or [])))[:limit]


def _txt(v: Any, n: int) -> str:
    t = str(v or "").strip()
    if len(t) > n:
        raise TicketError("err.setting_text_long", max=n)
    return t


class TicketDashboard(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.http: aiohttp.ClientSession | None = None
        self._hash: dict[int, tuple[str, float]] = {}

    async def cog_load(self) -> None:
        if not API or not KEY:
            log.warning("SENTINEL_API_URL / SENTINEL_BOT_KEY not set: ticket dashboard bridge disabled")
            return
        self.http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20), headers={"X-Sentinel-Key": KEY})
        self.pull.start()
        self.push.start()

    async def cog_unload(self) -> None:
        self.pull.cancel()
        self.push.cancel()
        if self.http:
            await self.http.close()

    @property
    def core(self) -> Any:
        cog = self.bot.get_cog("Ticket")
        return getattr(cog, "core", None)

    # ---------------------------------------------------------------- snapshot
    def _t(self, lang: str, key: str) -> str:
        try:
            return self.core.translator.tl(None, lang, key)
        except Exception:  # noqa: BLE001
            return key

    def _schema(self) -> list[dict[str, Any]]:
        out = []
        for d in SCHEMA.values():
            if d.key.startswith("messages"):
                continue
            default = _hex(d.default) if d.kind == "color" else _s(d.default)
            out.append({"key": d.key, "section": d.section, "kind": d.kind, "default": default, "min": d.min, "max": d.max,
                        "maxlen": d.maxlen, "choices": list(d.choices), "channelTypes": list(d.channel_types),
                        "placeholders": list(d.placeholders),
                        "label": self._t("en", d.label_key), "labelFr": self._t("fr", d.label_key)})
        return out

    async def snapshot(self, guild: discord.Guild) -> dict[str, Any]:
        core = self.core
        st = core.settings(guild.id)
        values: dict[str, Any] = {}
        for d in SCHEMA.values():
            if d.key.startswith("messages"):
                continue
            v = st.get(d.key, d.default)
            values[d.key] = _hex(v) if d.kind == "color" else _s(v)
        types = []
        for t in await core.db.list_types(guild.id):
            types.append({"id": t["id"], "name": t["name"], "description": t.get("description") or "", "emoji": t.get("emoji") or "",
                          "enabled": bool(t["enabled"]), "askReason": bool(t["ask_reason"]), "categoryId": _s(t.get("category_id")),
                          "staffRoleIds": _s(t.get("staff_role_ids")), "notifyRoleIds": _s(t.get("notify_role_ids")),
                          "userLimit": t.get("user_limit") or 0, "defaultPriority": t.get("default_priority") or "",
                          "welcomeMessage": t.get("welcome_message") or "", "namingFormat": t.get("naming_format") or "",
                          "formFields": len(t.get("form") or [])})
        panels = []
        for p in await core.db.list_panels(guild.id):
            panels.append({"id": p["id"], "name": p["name"], "channelId": _s(p.get("channel_id")), "published": bool(p.get("message_id")),
                           "title": p.get("title") or "", "description": p.get("description") or "", "color": _hex(p["color"]) if isinstance(p.get("color"), int) else "",
                           "bannerUrl": p.get("banner_url") or "", "thumbnailUrl": p.get("thumbnail_url") or "", "footer": p.get("footer") or "",
                           "mode": p.get("mode") or "select", "placeholder": p.get("placeholder") or "", "buttonStyle": p.get("button_style") or "secondary",
                           "typeIds": list(p.get("type_ids") or []), "showTypes": bool(p.get("show_types"))})
        return {"guildName": guild.name, "limits": {"types": MAX_TYPES, "panels": MAX_PANELS}, "priorities": list(PRIORITIES),
                "schema": self._schema(), "values": values, "types": types, "panels": panels}

    async def push_guild(self, guild: discord.Guild, force: bool = False) -> None:
        snap = await self.snapshot(guild)
        digest = hashlib.sha1(json.dumps(snap, sort_keys=True, default=str).encode()).hexdigest()
        old = self._hash.get(guild.id)
        loop_time = asyncio.get_event_loop().time()
        if not force and old and old[0] == digest and loop_time - old[1] < 1800:
            return
        async with self.http.post(f"{API}/bot/guilds/{guild.id}/tickets/snapshot", json=snap) as r:  # type: ignore[union-attr]
            if r.status == 200:
                self._hash[guild.id] = (digest, loop_time)
            else:
                log.warning("Snapshot rejected for %s: HTTP %s", guild.id, r.status)

    @tasks.loop(seconds=60)
    async def push(self) -> None:
        if not self.core:
            return
        for guild in list(self.bot.guilds):
            try:
                await self.push_guild(guild)
            except Exception:  # noqa: BLE001
                log.exception("Snapshot failed for guild %s", guild.id)
            await asyncio.sleep(0.3)

    @push.before_loop
    async def _wait_push(self) -> None:
        await self.bot.wait_until_ready()
        await asyncio.sleep(15)  # let the ticket cog finish starting

    # ----------------------------------------------------------------- changes
    @tasks.loop(seconds=10)
    async def pull(self) -> None:
        if not self.core:
            return
        async with self.http.get(f"{API}/bot/tickets/pending") as r:  # type: ignore[union-attr]
            if r.status != 200:
                return
            data = await r.json()
        for item in data.get("items", []):
            guild = self.bot.get_guild(int(item["gid"]))
            results = []
            for op in item["ops"]:
                if guild is None:
                    results.append({"id": op["id"], "ok": False, "error": "Sentinel can't see this server."})
                    continue
                try:
                    await self.apply(guild, op["op"], op.get("data") or {})
                    results.append({"id": op["id"], "ok": True})
                except (TicketError, SettingError) as e:
                    try:
                        msg = self.core.translator.tl(guild.id, "en", e.key, **e.params)
                    except Exception:  # noqa: BLE001
                        msg = e.key
                    results.append({"id": op["id"], "ok": False, "error": msg})
                except (ValueError, TypeError, KeyError) as e:
                    results.append({"id": op["id"], "ok": False, "error": f"Invalid value ({e})."})
                except discord.HTTPException as e:
                    results.append({"id": op["id"], "ok": False, "error": f"Discord refused: {e.text or e.status}"})
                except Exception:  # noqa: BLE001
                    log.exception("Dashboard op failed")
                    results.append({"id": op["id"], "ok": False, "error": "Unexpected error, see the bot logs."})
            async with self.http.post(f"{API}/bot/tickets/ack", json={"gid": str(item["gid"]), "results": results}) as r2:  # type: ignore[union-attr]
                if r2.status != 200:
                    log.warning("Ack failed: HTTP %s", r2.status)
            if guild is not None:
                try:
                    await self.push_guild(guild, force=True)
                except Exception:  # noqa: BLE001
                    log.exception("Snapshot after change failed")

    @pull.before_loop
    async def _wait_pull(self) -> None:
        await self.bot.wait_until_ready()
        await asyncio.sleep(10)

    @pull.error
    async def _pull_error(self, exc: BaseException) -> None:
        log.warning("Dashboard poll failed: %s", exc)
        await asyncio.sleep(30)
        if not self.pull.is_running():
            self.pull.restart()

    # --------------------------------------------------------------- operations
    def _check_ids(self, guild: discord.Guild, channel: int | None = None, roles: list[int] | None = None) -> None:
        if channel and guild.get_channel(channel) is None:
            raise ValueError("unknown channel")
        for r in roles or []:
            if guild.get_role(r) is None:
                raise ValueError("unknown role")

    async def apply(self, guild: discord.Guild, op: str, d: dict[str, Any]) -> None:
        core = self.core
        gid = guild.id
        if op == "settings":
            changes: dict[str, Any] = {}
            for key, raw in (d.get("changes") or {}).items():
                if key not in SCHEMA or key.startswith("messages"):
                    raise ValueError(f"unknown setting {key}")
                value = coerce(SCHEMA[key], raw)
                kind = SCHEMA[key].kind
                if kind == "channel":
                    self._check_ids(guild, channel=value)
                elif kind == "roles":
                    self._check_ids(guild, roles=value)
                changes[key] = value
            if changes:
                await core.update_settings(gid, changes, None)
            return
        if op in ("type_create", "type_update"):
            data = self._type_data(guild, d)
            if op == "type_create":
                if await core.db.count_types(gid) >= MAX_TYPES:
                    raise TicketError("err.limit_types", max=MAX_TYPES)
                if not data.get("name"):
                    raise ValueError("a name is required")
                tid = await core.db.insert_type(gid, data)
                await core.db.add_audit(gid, None, "type_created", {"type": tid, "via": "dashboard"})
            else:
                tid = int(d["id"])
                if await core.db.get_type(gid, tid) is None:
                    raise ValueError("type not found")
                await core.db.update_type(gid, tid, data)
                await core.db.add_audit(gid, None, "type_updated", {"type": tid, "via": "dashboard"})
            await self._refresh(guild)
            return
        if op == "type_delete":
            tid = int(d["id"])
            if not await core.db.delete_type(gid, tid):
                raise ValueError("type not found")
            await core.db.add_audit(gid, None, "type_deleted", {"type": tid, "via": "dashboard"})
            await self._refresh(guild)
            return
        if op in ("panel_create", "panel_update"):
            data = await self._panel_data(guild, d)
            if op == "panel_create":
                if len(await core.db.list_panels(gid)) >= MAX_PANELS:
                    raise TicketError("err.limit_panels", max=MAX_PANELS)
                data.setdefault("name", "Support")
                pid = await core.db.insert_panel(gid, data)
                await core.db.add_audit(gid, None, "panel_created", {"panel": pid, "via": "dashboard"})
            else:
                pid = int(d["id"])
                if await core.db.get_panel(gid, pid) is None:
                    raise TicketError("err.panel_not_found")
                await core.db.update_panel(gid, pid, data)
                await core.db.add_audit(gid, None, "panel_updated", {"panel": pid, "via": "dashboard"})
            if d.get("publish"):
                await core.publish_panel(guild, pid, None)
            elif op == "panel_update":
                p = await core.db.get_panel(gid, pid)
                if p and p.get("message_id"):  # keep the live message in sync
                    await core.publish_panel(guild, pid, None)
            return
        if op == "panel_publish":
            await core.publish_panel(guild, int(d["id"]), None)
            return
        if op == "panel_delete":
            pid = int(d["id"])
            panel = await core.db.get_panel(gid, pid)
            if panel is None:
                raise TicketError("err.panel_not_found")
            if not await core.db.delete_panel(gid, pid):
                raise TicketError("err.panel_not_found")
            await core.db.add_audit(gid, None, "panel_deleted", {"panel": pid, "via": "dashboard"})
            return
        raise ValueError("unknown operation")

    async def _refresh(self, guild: discord.Guild) -> None:
        try:
            await self.core.refresh_public_panels(guild)
        except Exception:  # noqa: BLE001
            log.exception("Panel refresh failed after a dashboard change")

    def _type_data(self, guild: discord.Guild, d: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        if "name" in d:
            out["name"] = _txt(d["name"], 100)
        if "description" in d:
            out["description"] = _txt(d["description"], 100)
        if "emoji" in d:
            e = str(d["emoji"] or "").strip()
            if not valid_emoji(e):
                raise ValueError("invalid emoji")
            out["emoji"] = e
        for k, col in (("enabled", "enabled"), ("askReason", "ask_reason")):
            if k in d:
                out[col] = bool(d[k])
        if "categoryId" in d:
            cid = _id(d["categoryId"])
            if cid and not isinstance(guild.get_channel(cid), discord.CategoryChannel):
                raise ValueError("unknown category")
            out["category_id"] = cid
        for k, col in (("staffRoleIds", "staff_role_ids"), ("notifyRoleIds", "notify_role_ids")):
            if k in d:
                ids = _ids(d[k])
                self._check_ids(guild, roles=ids)
                out[col] = ids
        if "userLimit" in d:
            n = int(d["userLimit"] or 0)
            if not 0 <= n <= 50:
                raise ValueError("limit must be 0-50")
            out["user_limit"] = n
        if "defaultPriority" in d:
            p = str(d["defaultPriority"] or "")
            if p and p not in PRIORITIES:
                raise ValueError("bad priority")
            out["default_priority"] = p
        if "welcomeMessage" in d:
            out["welcome_message"] = _txt(d["welcomeMessage"], 1500)
        if "namingFormat" in d:
            out["naming_format"] = _txt(d["namingFormat"], 100)
        return out

    async def _panel_data(self, guild: discord.Guild, d: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        if "name" in d:
            out["name"] = _txt(d["name"], 60) or "Support"
        if "channelId" in d:
            cid = _id(d["channelId"])
            if cid and not isinstance(guild.get_channel(cid), discord.TextChannel):
                raise ValueError("unknown text channel")
            out["channel_id"] = cid
        for k, col, n in (("title", "title", 256), ("description", "description", 4000), ("footer", "footer", 256), ("placeholder", "placeholder", 100)):
            if k in d:
                out[col] = _txt(d[k], n)
        if "color" in d:
            c = parse_color(d["color"]) if str(d["color"] or "").strip() else None
            if str(d["color"] or "").strip() and c is None:
                raise SettingError("err.setting_color")
            out["color"] = c
        for k, col in (("bannerUrl", "banner_url"), ("thumbnailUrl", "thumbnail_url")):
            if k in d:
                u = str(d[k] or "").strip()
                if u and not is_http_url(u):
                    raise SettingError("err.setting_url")
                out[col] = u
        if "mode" in d:
            if d["mode"] not in ("select", "buttons"):
                raise ValueError("bad mode")
            out["mode"] = d["mode"]
        if "buttonStyle" in d:
            if d["buttonStyle"] not in ("primary", "secondary", "success", "danger"):
                raise ValueError("bad button style")
            out["button_style"] = d["buttonStyle"]
        if "showTypes" in d:
            out["show_types"] = bool(d["showTypes"])
        if "typeIds" in d:
            wanted = _ids(d["typeIds"])
            known = {t["id"] for t in await self.core.db.list_types(guild.id)}
            if any(i not in known for i in wanted):
                raise ValueError("unknown ticket type")
            out["type_ids"] = wanted
        return out


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(TicketDashboard(bot))
