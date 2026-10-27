# Pont dashboard ↔ système de tickets Sentinel

Ajoute `ticket_dashboard.py` dans `bot/cogs/` (à côté de `ticket.py`). Rien n'est remplacé.

Variables d'environnement sur dishost :
- `SENTINEL_API_URL` = `https://api.sentineldashboard.site`
- `SENTINEL_BOT_KEY` = la même valeur que le secret `BOT_API_KEY` du Worker

Le bot envoie chaque minute un instantané (réglages, types, panneaux) et applique toutes les 10 s les changements faits sur /manage, avec les validations du système de tickets.
