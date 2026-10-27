"""Sentinel AutoMod V2 - Discord native AutoMod sync (``bot.cogs.automod_native``).

Adds ``/automod discord``: builds real Discord AutoMod rules from the Sentinel AutoMod configuration
(preview first, then confirm). Rules are named ``Sentinel: ...``; only those are ever edited or removed.
Blocked messages are recorded as incidents through ``on_automod_action_execution``
(needs ``intents.auto_moderation_execution = True``).

Loaded after ``automod.py`` (alphabetical order); it plugs the command into the existing /automod group.
"""
from __future__ import annotations

import logging
import secrets
import time
from typing import Any

import discord
from discord import app_commands
from discord.ext import commands

from .automod_views import ConfirmView, embed

log = logging.getLogger("sentinel.automod.native")

PREFIX = "Sentinel: "
KW_LIMIT, KW_LEN, RX_LIMIT, RX_LEN, ALLOW_LIMIT, MAX_ROLES, MAX_CHANNELS = 1000, 60, 10, 260, 100, 20, 50
INVITE_HOSTS = ("discord.gg/", "discord.com/invite/", "discordapp.com/invite/", "dsc.gg/", "invite.gg/", "discord.me/")
ALL_LINKS_RX = r"(?:https?://|www\.)\S+"
# rule key -> (Sentinel module, label shown in previews)
RULES = {
    "words": ("content", "Blocked words & phrases"), "invites": ("invites", "Server invites"),
    "links": ("links", "Links & scam domains"), "spam": ("antispam", "Spam"),
    "mentions": ("mentions", "Mass mentions"), "preset": ("content", "Discord word lists"),
}


def _cut(items: list[str], n: int) -> list[str]:
    out: list[str] = []
    for s in items:
        s = str(s).strip()[:n]
        if s and s not in out:
            out.append(s)
    return out


def _exempt(cfg: dict, *modules: str) -> tuple[list[int], list[int]]:
    roles = list(cfg["exemptions"]["global"]["roles"])
    chans = list(cfg["exemptions"]["global"]["channels"]) + list(cfg["exemptions"]["global"]["categories"])
    for m in modules:
        sc = cfg["exemptions"]["modules"].get(m) or {}
        roles += sc.get("roles", [])
        chans += sc.get("channels", []) + sc.get("categories", [])
    return list(dict.fromkeys(roles))[:MAX_ROLES], list(dict.fromkeys(chans))[:MAX_CHANNELS]


def plan_rules(cfg: dict, own_codes: set[str] | None = None, use_preset: bool = True) -> tuple[dict[str, dict], list[str]]:
    """Pure function: desired native rules {name: spec} and human notes about what can't be translated."""
    mods, notes = cfg["modules"], []
    out: dict[str, dict] = {}

    def add(name: str, key: str, kind: str, enabled: bool, modules: tuple[str, ...], **trigger: Any) -> None:
        roles, chans = _exempt(cfg, *modules)
        out[PREFIX + name] = {"key": key, "kind": kind, "enabled": enabled, "roles": roles, "channels": chans, "trigger": trigger}

    c = mods["content"]
    words = _cut([w if c["whole_word"] else f"*{w}*" for w in c["blocked_words"] + c["blocked_phrases"]], KW_LEN)
    rx = _cut(c["regex_rules"], RX_LEN)[:RX_LIMIT]
    allow = _cut(c["allowed_words"], KW_LEN)[:ALLOW_LIMIT]
    if words or rx:
        chunks = [words[i:i + KW_LIMIT] for i in range(0, len(words), KW_LIMIT)][:3] or [[]]
        for i, chunk in enumerate(chunks):
            add("Words" + (f" {i + 1}" if i else ""), "words", "keyword", c["enabled"], ("content",),
                keywords=chunk, regex=rx if i == 0 else [], allow=allow)
        if len(words) > KW_LIMIT * 3:
            notes.append(f"Only the first {KW_LIMIT * 3} blocked words fit in Discord rules; Sentinel still checks the rest.")
        if len(c["regex_rules"]) > RX_LIMIT:
            notes.append(f"Only {RX_LIMIT} regex rules fit in one Discord rule; Sentinel still checks the rest.")
        notes.append("Discord can't do leetspeak or stretched-letter matching; Sentinel's own filter keeps handling those.")
    i = mods["invites"]
    allowed = _cut([f"discord.gg/{x}" for x in i["allowed_codes"]] + ([f"discord.gg/{x}" for x in sorted(own_codes or ())] if i["allow_own_server"] else []), KW_LEN)[:ALLOW_LIMIT]
    add("Invites", "invites", "keyword", i["enabled"], ("invites",), keywords=[f"*{h}*" for h in INVITE_HOSTS], regex=[], allow=allowed)
    lk = mods["links"]
    scam_domains = mods["scam"]["blocked_domains"] if mods["scam"]["enabled"] else []
    domains = _cut([f"*{d.lstrip('*.')}*" for d in lk["blocked_domains"] + scam_domains], KW_LEN)[:KW_LIMIT] if lk["mode"] != "all" else []
    link_rx = [ALL_LINKS_RX] if lk["enabled"] and lk["mode"] == "all" else []
    if lk["mode"] == "allowlist" and lk["enabled"]:
        notes.append("Link allowlist mode can't be expressed in Discord rules (no 'allow only these'); Sentinel keeps enforcing it.")
    if domains or link_rx:
        add("Links", "links", "keyword", (lk["enabled"] and lk["mode"] != "allowlist") or bool(scam_domains), ("links", "scam"),
            keywords=domains, regex=link_rx, allow=[])
    sp = mods["antispam"]
    add("Spam", "spam", "spam", sp["enabled"], ("antispam",))
    mn = mods["mentions"]
    add("Mentions", "mentions", "mention", mn["enabled"], ("mentions",), limit=max(1, min(50, mn["max_user_mentions"] + mn["max_role_mentions"])))
    if use_preset:
        add("Discord word lists", "preset", "preset", True, ("content",), allow=_cut(c["allowed_words"], KW_LEN)[:1000])
    if not cfg["logging"]["channel"]:
        notes.append("No AutoMod log channel is set: rules will block messages but Discord won't post alerts (use /automod logs).")
    return out, notes


def _trigger(spec: dict) -> discord.AutoModTrigger:
    t, k = spec["trigger"], spec["kind"]
    if k == "keyword":
        return discord.AutoModTrigger(type=discord.AutoModRuleTriggerType.keyword, keyword_filter=t["keywords"] or None,
                                      regex_patterns=t["regex"] or None, allow_list=t["allow"] or None)
    if k == "spam":
        return discord.AutoModTrigger(type=discord.AutoModRuleTriggerType.spam)
    if k == "mention":
        return discord.AutoModTrigger(type=discord.AutoModRuleTriggerType.mention_spam, mention_limit=t["limit"], mention_raid_protection=True)
    return discord.AutoModTrigger(type=discord.AutoModRuleTriggerType.keyword_preset,
                                  presets=discord.AutoModPresets(profanity=True, sexual_content=True, slurs=True), allow_list=t["allow"] or None)


def _actions(log_channel: int, guild: discord.Guild) -> list[discord.AutoModRuleAction]:
    acts = [discord.AutoModRuleAction(type=discord.AutoModRuleActionType.block_message)]
    ch = guild.get_channel(log_channel) if log_channel else None
    if ch is not None:
        acts.append(discord.AutoModRuleAction(type=discord.AutoModRuleActionType.send_alert_message, channel_id=ch.id))
    return acts


def _describe(spec: dict) -> str:
    t, k = spec["trigger"], spec["kind"]
    if k == "keyword":
        return f"{len(t['keywords'])} keyword(s), {len(t['regex'])} regex"
    if k == "mention":
        return f"more than {t['limit']} mentions"
    return {"spam": "Discord's spam detection", "preset": "profanity, sexual content, slurs"}[k]


class AutoModNative(commands.Cog):
    def __init__(self, bot: commands.Bot, core: Any) -> None:
        self.bot, self.core = bot, core
        self._rule_cache: dict[int, tuple[float, dict[int, str]]] = {}

    async def _own_codes(self, guild: discord.Guild) -> set[str]:
        try:
            return await self.core._own_invite_codes(guild)
        except Exception:  # noqa: BLE001
            return set()

    async def _existing(self, guild: discord.Guild) -> dict[str, discord.AutoModRule]:
        return {r.name: r for r in await guild.fetch_automod_rules() if r.name.startswith(PREFIX)}

    async def command(self, interaction: discord.Interaction, discord_word_lists: bool = True) -> None:
        if not await self.core._guard(interaction):
            return
        guild = interaction.guild
        if not guild.me.guild_permissions.manage_guild:
            await interaction.response.send_message(embed=embed("Missing permission", "Sentinel needs the Manage Server permission to manage Discord AutoMod rules.", "err"), ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        cfg = self.core.cfg(guild.id)
        try:
            existing = await self._existing(guild)
        except discord.HTTPException as exc:
            await interaction.followup.send(embed=embed("Discord error", f"Could not read the current AutoMod rules ({exc.status}).", "err"), ephemeral=True)
            return
        plan, notes = plan_rules(cfg, await self._own_codes(guild), discord_word_lists)
        lines = []
        for name, spec in plan.items():
            lines.append(f"{'~' if name in existing else '+'} **{name[len(PREFIX):]}** ({'on' if spec['enabled'] else 'off'}): {_describe(spec)}")
        stale = [n for n in existing if n not in plan]
        lines += [f"- **{n[len(PREFIX):]}**: will be removed (no longer needed)" for n in stale]
        text = "\n".join(lines) + ("\n\n" + "\n".join(f"- {n}" for n in notes) if notes else "")
        text += "\n\n`+` create, `~` update. Only rules named `Sentinel: ...` are touched. Blocked messages are logged to your AutoMod log channel."

        async def go() -> tuple[str, str]:
            made = upd = gone = 0
            errors: list[str] = []
            acts = _actions(cfg["logging"]["channel"], guild)
            for name, spec in plan.items():
                kw = dict(name=name, event_type=discord.AutoModRuleEventType.message_send, trigger=_trigger(spec), actions=acts,
                          enabled=spec["enabled"], exempt_roles=[discord.Object(r) for r in spec["roles"] if guild.get_role(r)],
                          exempt_channels=[discord.Object(c) for c in spec["channels"] if guild.get_channel(c)],
                          reason=f"Sentinel AutoMod sync by {interaction.user}")
                try:
                    rule = existing.get(name)
                    if rule:
                        kw.pop("event_type")
                        await rule.edit(**kw)
                        upd += 1
                    else:
                        await guild.create_automod_rule(**kw)
                        made += 1
                except discord.HTTPException as exc:
                    errors.append(f"{name[len(PREFIX):]}: {exc.text or exc.status}")
            for n in stale:
                try:
                    await existing[n].delete(reason="Sentinel AutoMod sync: rule no longer needed")
                    gone += 1
                except discord.HTTPException as exc:
                    errors.append(f"{n[len(PREFIX):]}: {exc.text or exc.status}")
            self._rule_cache.pop(guild.id, None)
            msg = f"Created {made}, updated {upd}, removed {gone} Discord AutoMod rule(s)."
            return ("warn", msg + "\n" + "\n".join(errors[:5])) if errors else ("ok", msg)

        await ConfirmView.ask(interaction, "Sync Sentinel AutoMod to Discord?", text[:3800], go)

    # -------------------------------------------------- incidents from native blocks
    async def _names(self, guild: discord.Guild) -> dict[int, str]:
        hit = self._rule_cache.get(guild.id)
        if hit and time.time() - hit[0] < 600:
            return hit[1]
        try:
            mp = {r.id: r.name for r in await guild.fetch_automod_rules() if r.name.startswith(PREFIX)}
        except discord.HTTPException:
            mp = hit[1] if hit else {}
        self._rule_cache[guild.id] = (time.time(), mp)
        return mp

    @commands.Cog.listener()
    async def on_automod_action_execution(self, execution: discord.AutoModAction) -> None:
        try:
            if execution.action.type is not discord.AutoModRuleActionType.block_message:
                return
            guild = execution.guild
            name = (await self._names(guild)).get(execution.rule_id)
            if name is None:
                return
            n = name[len(PREFIX):]
            key = "words" if n.startswith("Words") else "invites" if n == "Invites" else "links" if n == "Links" else "spam" if n == "Spam" \
                else "mentions" if n == "Mentions" else "preset"
            self.core.store.record_incident(guild.id, {
                "id": secrets.token_hex(4), "ts": time.time(), "module": RULES[key][0], "rule": f"native_{key}", "user": execution.user_id,
                "channel": execution.channel_id or 0, "action": "delete", "ok": True, "deleted": True,
                "detail": f"Blocked by Discord AutoMod ({n})"[:300], "link": key in ("invites", "links")})
        except Exception:  # noqa: BLE001
            log.exception("Could not record a native AutoMod block")


async def setup(bot: commands.Bot) -> None:
    core = bot.get_cog("AutoMod")
    if core is None:
        raise RuntimeError("automod_native needs the AutoMod cog: load cogs.automod first")
    if not bot.intents.auto_moderation_execution:
        log.warning("Intent auto_moderation_execution is off: native blocks won't appear in stats/incidents")
    cog = AutoModNative(bot, core)
    await bot.add_cog(cog)
    group = discord.utils.get(core.get_app_commands(), name="automod")

    @app_commands.describe(discord_word_lists="Also enable Discord's profanity / sexual content / slurs lists")
    async def discord_cmd(interaction: discord.Interaction, discord_word_lists: bool = True) -> None:
        await cog.command(interaction, discord_word_lists)

    group.add_command(app_commands.Command(name="discord", description="Sync Sentinel AutoMod to Discord's native AutoMod rules", callback=discord_cmd))
