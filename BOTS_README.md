# Ajouter un bot sur /bots

Modifie `bots.json`, ajoute un objet dans la liste `bots` :

```json
{
  "name": "Nom du bot",
  "tag": "Texte du petit badge (optionnel)",
  "category": "moderation",
  "image": "https://... ou /assets/img/bots/nom.png",
  "invite": "https://discord.com/oauth2/authorize?client_id=ID_DU_BOT",
  "url": "https://site-du-bot.com",
  "support": "https://discord.gg/xxxx",
  "description": "Description en anglais.",
  "descriptionFr": "Description en français.",
  "featured": false
}
```

- `image` : lien https ou fichier du site (ex. `/assets/img/bots/mon-bot.png`). Sans image, une pastille colorée avec l'initiale s'affiche.
- `invite`, `url`, `support` : tous optionnels ; le bouton n'apparaît que s'il y a un lien.
- `category` : moderation, utility, community, music, support, fun, games (ou une autre : elle apparaît quand même).
- `featured: true` met le bot en premier avec un cadre mis en avant.
