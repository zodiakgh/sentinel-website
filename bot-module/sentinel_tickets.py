"""
Sentinel ticket module (discord.py 2.x cog).

The website dashboard stores the ticket settings; this cog reads them from the Worker
and runs the tickets. Buttons are posted by the dashboard ("Post the panel in Discord"),
so nothing has to be registered per server: the cog answers any button whose custom_id
starts with "sentinel:ticket:".

Setup
  1. Environment variables (or edit the two constants below):
       SENTINEL_API_URL = https://api.sentineldashboard.site
       SENTINEL_BOT_KEY = the same value as the BOT_API_KEY secret in the Cloudflare Worker
  2. In your bot:   await bot.load_extension("sentinel_tickets")
     (or put this file in your cogs folder and load it like your other cogs)
  3. Bot permissions needed: View Channels, Manage Channels, Send Messages, Embed Links,
     Attach Files, Read Message History. Give it access to the panel channel and the category.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import re
import time
from pathlib import Path

import aiohttp
import discord
from discord.ext import commands

API_URL = os.environ.get("SENTINEL_API_URL", "https://api.sentineldashboard.site").rstrip("/")
BOT_KEY = os.environ.get("SENTINEL_BOT_KEY", "")
STATE_FILE = Path(os.environ.get("SENTINEL_TICKET_STATE", "sentinel_tickets_state.json"))
CACHE_SECONDS = 30
PREFIX = "sentinel:ticket:"
TOPIC_RE = re.compile(r"sentinel-ticket\|owner=(\d+)\|type=([a-z0-9_-]+)\|n=(\d+)")


def _slug(text: str, limit: int = 40) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", text.lower()).strip("-")[:limit] or "user"


class SentinelTickets(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self._cache: dict[int, tuple[float, dict]] = {}
        self._session: aiohttp.ClientSession | None = None
        self._lock = asyncio.Lock()

    async def cog_unload(self):
        if self._session:
            await self._session.close()

    # ------------------------------------------------------------------ config + counter
    async def config(self, guild_id: int) -> dict:
        now = time.time()
        hit = self._cache.get(guild_id)
        if hit and now - hit[0] < CACHE_SECONDS:
            return hit[1]
        if self._session is None:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        try:
            async with self._session.get(f"{API_URL}/bot/guilds/{guild_id}/tickets", headers={"X-Sentinel-Key": BOT_KEY}) as r:
                data = await r.json() if r.status == 200 else {"enabled": False}
        except Exception:
            data = hit[1] if hit else {"enabled": False}
        self._cache[guild_id] = (now, data)
        return data

    def _next_number(self, guild_id: int) -> int:
        try:
            state = json.loads(STATE_FILE.read_text())
        except Exception:
            state = {}
        n = int(state.get(str(guild_id), 0)) + 1
        state[str(guild_id)] = n
        STATE_FILE.write_text(json.dumps(state))
        return n

    # ------------------------------------------------------------------ interactions
    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction):
        if interaction.type is not discord.InteractionType.component or not interaction.guild:
            return
        cid = str((interaction.data or {}).get("custom_id", ""))
        if not cid.startswith(PREFIX):
            return
        action, _, arg = cid[len(PREFIX):].partition(":")
        try:
            if action == "open":
                await self.open_ticket(interaction, arg)
            elif action == "close":
                await self.close_request(interaction)
            elif action == "confirm":
                await self.close_ticket(interaction)
            elif action == "cancel":
                await interaction.response.edit_message(content="Cancelled.", view=None)
            elif action == "claim":
                await self.claim(interaction)
        except discord.Forbidden:
            await self._say(interaction, "I don't have the permissions to do that. Ask an admin to check my role.")
        except Exception:
            await self._say(interaction, "Something went wrong. Please try again.")
            raise

    @staticmethod
    async def _say(interaction: discord.Interaction, text: str):
        if interaction.response.is_done():
            await interaction.followup.send(text, ephemeral=True)
        else:
            await interaction.response.send_message(text, ephemeral=True)

    def _is_staff(self, member: discord.Member, cfg: dict) -> bool:
        ids = {int(r) for r in cfg.get("supportRoleIds", [])}
        return member.guild_permissions.manage_channels or any(r.id in ids for r in member.roles)

    def _owner_of(self, channel: discord.abc.GuildChannel):
        m = TOPIC_RE.search(getattr(channel, "topic", "") or "")
        return (int(m.group(1)), m.group(2), int(m.group(3))) if m else None

    # ------------------------------------------------------------------ open
    async def open_ticket(self, interaction: discord.Interaction, type_id: str):
        guild, user = interaction.guild, interaction.user
        cfg = await self.config(guild.id)
        if not cfg.get("enabled"):
            return await self._say(interaction, "Tickets are turned off on this server.")
        ttype = next((t for t in cfg.get("types", []) if t["id"] == type_id), None)
        category = guild.get_channel(int(cfg.get("categoryId") or 0))
        if not ttype or not isinstance(category, discord.CategoryChannel):
            return await self._say(interaction, "Tickets aren't fully set up yet. Ask an admin to check the dashboard.")
        await interaction.response.defer(ephemeral=True)

        mine = [c for c in category.text_channels if (o := self._owner_of(c)) and o[0] == user.id]
        if len(mine) >= int(cfg.get("maxOpen", 1)):
            return await interaction.followup.send(f"You already have {len(mine)} open ticket(s): {mine[0].mention}", ephemeral=True)

        async with self._lock:
            number = self._next_number(guild.id)
        name = (cfg.get("namePattern") or "ticket-{number}").replace("{number}", f"{number:04d}").replace("{user}", _slug(user.name, 20)).replace("{type}", _slug(ttype["label"], 20))
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True, embed_links=True, attach_files=True, read_message_history=True),
            user: discord.PermissionOverwrite(view_channel=True, send_messages=True, attach_files=True, read_message_history=True),
        }
        for rid in cfg.get("supportRoleIds", []):
            role = guild.get_role(int(rid))
            if role:
                overwrites[role] = discord.PermissionOverwrite(view_channel=True, send_messages=True, attach_files=True, read_message_history=True, manage_messages=True)
        channel = await guild.create_text_channel(
            name[:90], category=category, overwrites=overwrites,
            topic=f"sentinel-ticket|owner={user.id}|type={ttype['id']}|n={number}", reason=f"Ticket opened by {user}")

        text = (cfg.get("welcome") or "Hello {user}!").replace("{user}", user.mention).replace("{type}", ttype["label"]).replace("{number}", f"{number:04d}")
        embed = discord.Embed(title=f"{ttype.get('emoji', '')} {ttype['label']}".strip(), description=text, color=discord.Color.blurple())
        view = discord.ui.View(timeout=None)
        view.add_item(discord.ui.Button(style=discord.ButtonStyle.danger, label="Close", emoji="🔒", custom_id=f"{PREFIX}close"))
        if cfg.get("claim"):
            view.add_item(discord.ui.Button(style=discord.ButtonStyle.secondary, label="Claim", emoji="🙋", custom_id=f"{PREFIX}claim"))
        pings = " ".join(f"<@&{r}>" for r in cfg.get("supportRoleIds", []))
        await channel.send(content=f"{user.mention} {pings}".strip(), embed=embed, view=view,
                           allowed_mentions=discord.AllowedMentions(users=[user], roles=True))
        await interaction.followup.send(f"Your ticket is ready: {channel.mention}", ephemeral=True)
        await self._log(guild, cfg, f"🎫 Ticket **#{number:04d}** ({ttype['label']}) opened by {user.mention} in {channel.mention}")

    # ------------------------------------------------------------------ claim / close
    async def claim(self, interaction: discord.Interaction):
        cfg = await self.config(interaction.guild.id)
        if not self._is_staff(interaction.user, cfg):
            return await self._say(interaction, "Only the support team can claim tickets.")
        await interaction.response.send_message(f"🙋 {interaction.user.mention} is taking care of this ticket.")

    async def close_request(self, interaction: discord.Interaction):
        cfg = await self.config(interaction.guild.id)
        owner = self._owner_of(interaction.channel)
        if not owner:
            return await self._say(interaction, "This isn't a ticket channel.")
        if interaction.user.id != owner[0] and not self._is_staff(interaction.user, cfg):
            return await self._say(interaction, "Only the ticket owner or the support team can close it.")
        if not cfg.get("confirmClose", True):
            return await self.close_ticket(interaction)
        view = discord.ui.View(timeout=60)
        view.add_item(discord.ui.Button(style=discord.ButtonStyle.danger, label="Yes, close", custom_id=f"{PREFIX}confirm"))
        view.add_item(discord.ui.Button(style=discord.ButtonStyle.secondary, label="Cancel", custom_id=f"{PREFIX}cancel"))
        await interaction.response.send_message("Close this ticket?", view=view, ephemeral=True)

    async def close_ticket(self, interaction: discord.Interaction):
        guild, channel = interaction.guild, interaction.channel
        cfg = await self.config(guild.id)
        owner = self._owner_of(channel)
        if not owner or (interaction.user.id != owner[0] and not self._is_staff(interaction.user, cfg)):
            return await self._say(interaction, "You can't close this ticket.")
        if interaction.response.is_done():
            await interaction.followup.send("Closing in 5 seconds…", ephemeral=True)
        else:
            await interaction.response.send_message("Closing in 5 seconds…")
        file = None
        if cfg.get("transcript"):
            lines = []
            async for m in channel.history(limit=1000, oldest_first=True):
                body = m.clean_content or ""
                if m.attachments:
                    body += " " + " ".join(a.url for a in m.attachments)
                if m.embeds and not body:
                    body = "[embed]"
                lines.append(f"[{m.created_at:%Y-%m-%d %H:%M}] {m.author}: {body}")
            file = discord.File(io.BytesIO("\n".join(lines).encode()), filename=f"{channel.name}.txt")
        await self._log(guild, cfg, f"🔒 Ticket **#{owner[2]:04d}** (<@{owner[0]}>) closed by {interaction.user.mention}", file)
        await asyncio.sleep(5)
        await channel.delete(reason=f"Ticket closed by {interaction.user}")

    async def _log(self, guild: discord.Guild, cfg: dict, text: str, file: discord.File | None = None):
        ch = guild.get_channel(int(cfg.get("logChannelId") or 0))
        if isinstance(ch, discord.TextChannel):
            try:
                await ch.send(text, file=file, allowed_mentions=discord.AllowedMentions.none())
            except discord.HTTPException:
                pass


async def setup(bot: commands.Bot):
    if not BOT_KEY:
        print("[sentinel_tickets] SENTINEL_BOT_KEY is empty: the module can't read the dashboard settings.")
    await bot.add_cog(SentinelTickets(bot))
