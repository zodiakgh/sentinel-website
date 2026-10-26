# Sentinel ticket module

`sentinel_tickets.py` is a discord.py 2.x cog. The dashboard (`/manage?guild=ID`) saves the ticket
settings; the cog reads them from the Worker and runs the tickets (open, claim, close, transcript, logs).

1. `pip install aiohttp discord.py` (already there for most bots).
2. Set `SENTINEL_BOT_KEY` to the same value as the `BOT_API_KEY` secret of the Cloudflare Worker
   (and optionally `SENTINEL_API_URL`, default `https://api.sentineldashboard.site`).
3. Copy `sentinel_tickets.py` next to your bot and load it: `await bot.load_extension("sentinel_tickets")`.
4. Give the bot: View Channels, Manage Channels, Send Messages, Embed Links, Attach Files, Read Message History.
5. In the dashboard: choose the panel channel and category, pick support roles, press **Post the panel in Discord**.

Settings changes apply within ~30 seconds. The ticket counter is kept in `sentinel_tickets_state.json`.
