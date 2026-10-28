(function() {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var gid = new URLSearchParams(location.search).get("guild") || "";
  var stateBox = document.getElementById("mg-state"), app = document.getElementById("mg-app"), title = document.getElementById("mg-title"), lead = document.getElementById("mg-lead");
  var UI = document.documentElement.lang === "fr" ? "fr" : "en";
  function T(en, fr) {
    return UI === "fr" ? fr : en;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== void 0 && text !== null) n.textContent = text;
    return n;
  }
  function show(msg2, cta) {
    stateBox.hidden = false;
    app.hidden = true;
    stateBox.textContent = msg2;
    if (cta) {
      stateBox.appendChild(document.createTextNode(" "));
      var a = el("a", "", cta[0]);
      a.href = cta[1];
      stateBox.appendChild(a);
    }
  }
  function api(path, body) {
    return fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" }, body: body ? JSON.stringify(body) : void 0 }).then(function(r) {
      return r.json().catch(function() {
        return {};
      }).then(function(j) {
        if (!r.ok) {
          var e = new Error(j.message || j.error || "Request failed");
          e.code = j.error;
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }
  if (!API) {
    lead.textContent = "";
    return show(T("The dashboard service is not configured yet.", "Le service du dashboard n'est pas encore configuré."));
  }
  if (!/^\d{15,25}$/.test(gid)) {
    lead.textContent = "";
    return show(T("No server selected.", "Aucun serveur sélectionné."), [T("Choose one in the dashboard", "Choisis-en un dans le dashboard"), "/dashboard"]);
  }
  var ROLES = [
    { key: "admin", en: "Admin", fr: "Admin", color: "#e74c3c", hoist: true, on: true, d: { en: "Manage the server (no Administrator flag)", fr: "Gère le serveur (sans le flag Administrateur)" } },
    { key: "mod", en: "Moderator", fr: "Modérateur", color: "#3498db", hoist: true, on: true, d: { en: "Kick, ban, timeout, clean chat", fr: "Expulser, bannir, mute, nettoyer le chat" } },
    { key: "helper", en: "Helper", fr: "Helper", color: "#2ecc71", hoist: true, on: false, d: { en: "Light moderation (delete messages)", fr: "Modération légère (supprimer des messages)" } },
    { key: "vip", en: "VIP", fr: "VIP", color: "#f1c40f", hoist: true, on: false, d: { en: "Priority speaker", fr: "Voix prioritaire" } },
    { key: "member", en: "Member", fr: "Membre", color: "#95a5a6", hoist: false, on: true, d: { en: "Default role for everyone who joins", fr: "Rôle de base de tous les membres" } },
    { key: "bots", en: "Bots", fr: "Bots", color: "#7289da", hoist: true, on: false, d: { en: "Role to give your bots", fr: "Rôle à donner à tes bots" } },
    { key: "muted", en: "Muted", fr: "Muet", color: "#5c5c5c", hoist: false, on: true, d: { en: "Can't talk or react anywhere", fr: "Ne peut ni parler ni réagir" } }
  ];
  var GROUPS = [
    {
      id: "info",
      on: true,
      open: true,
      icon: "📌",
      en: "Info",
      fr: "Infos",
      d: { en: "Rules, announcements, welcome", fr: "Règlement, annonces, bienvenue" },
      ch: [["📜", "rules", "règlement", "text", { ro: 1 }], ["📢", "announcements", "annonces", "announcement", { ro: 1 }], ["👋", "welcome", "bienvenue", "text", { ro: 1 }]]
    },
    {
      id: "chat",
      on: true,
      icon: "💬",
      en: "Chat",
      fr: "Discussion",
      d: { en: "General, media, memes, commands", fr: "Général, médias, mèmes, commandes" },
      ch: [["💬", "general", "général", "text"], ["🙋", "introductions", "présentations", "text"], ["🖼️", "media", "médias", "text"], ["😂", "memes", "mèmes", "text"], ["🤖", "commands", "commandes", "text"]]
    },
    {
      id: "voice",
      on: true,
      icon: "🔊",
      en: "Voice",
      fr: "Vocaux",
      d: { en: "Lounge, gaming, chill, AFK", fr: "Salon, gaming, détente, AFK" },
      ch: [["🔊", "Lounge", "Salon", "voice"], ["🎮", "Gaming 1", "Gaming 1", "voice"], ["🎮", "Gaming 2", "Gaming 2", "voice"], ["🛋️", "Chill", "Détente", "voice"], ["💤", "AFK", "AFK", "voice"]]
    },
    {
      id: "gaming",
      on: false,
      icon: "🎮",
      en: "Gaming",
      fr: "Gaming",
      d: { en: "Gaming chat, clips, find a team", fr: "Chat gaming, clips, recherche d'équipe" },
      ch: [["🎮", "gaming-chat", "chat-gaming", "text"], ["🎬", "clips", "clips", "text"], ["🔎", "looking-for-group", "recherche-equipe", "text"]]
    },
    {
      id: "music",
      on: false,
      icon: "🎵",
      en: "Music",
      fr: "Musique",
      d: { en: "Music commands + two music voice channels", fr: "Commandes musique + deux vocaux musique" },
      ch: [["🎵", "music-commands", "commandes-musique", "text"], ["🎶", "Music 1", "Musique 1", "voice"], ["🎶", "Music 2", "Musique 2", "voice"]]
    },
    {
      id: "creative",
      on: false,
      icon: "🎨",
      en: "Creative",
      fr: "Créations",
      d: { en: "Art, showcase, feedback", fr: "Art, vitrine, retours" },
      ch: [["🎨", "art", "art", "text"], ["✨", "showcase", "vitrine", "text"], ["💡", "feedback", "retours", "text"]]
    },
    {
      id: "community",
      on: false,
      icon: "🎉",
      en: "Community",
      fr: "Communauté",
      d: { en: "Events, polls, suggestions, stage", fr: "Évènements, sondages, suggestions, scène" },
      ch: [["📅", "events", "évènements", "text"], ["📊", "polls", "sondages", "text"], ["💭", "suggestions", "suggestions", "text"], ["🎙️", "Stage", "Scène", "stage"]]
    },
    {
      id: "giveaways",
      on: false,
      icon: "🎁",
      en: "Giveaways",
      fr: "Giveaways",
      d: { en: "A giveaways channel", fr: "Un salon giveaways" },
      ch: [["🎁", "giveaways", "giveaways", "text", { ro: 1 }]]
    },
    {
      id: "levels",
      on: false,
      icon: "📈",
      en: "Levels",
      fr: "Niveaux",
      d: { en: "Level-up and leaderboard channel", fr: "Salon des niveaux et du classement" },
      ch: [["📈", "level-ups", "niveaux", "text", { ro: 1 }]]
    },
    {
      id: "support",
      on: false,
      icon: "🎫",
      en: "Support",
      fr: "Support",
      d: { en: "Help forum, tickets, reports", fr: "Forum d'aide, tickets, signalements" },
      ch: [["❓", "help", "aide", "forum"], ["🎫", "tickets", "tickets", "text", { ro: 1 }], ["🚨", "report", "signalement", "text"]]
    },
    {
      id: "staff",
      on: true,
      staff: true,
      icon: "🛡️",
      en: "Staff",
      fr: "Staff",
      d: { en: "Private channels for your team", fr: "Salons privés pour ton équipe" },
      ch: [["💼", "staff-chat", "staff-chat", "text"], ["📋", "staff-notes", "notes-staff", "text"], ["🔊", "Staff voice", "Vocal staff", "voice"]]
    },
    {
      id: "logs",
      on: false,
      staff: true,
      icon: "📋",
      en: "Logs",
      fr: "Logs",
      d: { en: "Private moderation / message / member logs", fr: "Logs privés de modération, messages et membres" },
      ch: [["🔨", "mod-logs", "logs-modération", "text"], ["💬", "message-logs", "logs-messages", "text"], ["👥", "member-logs", "logs-membres", "text"], ["🔊", "voice-logs", "logs-vocal", "text"]]
    }
  ];
  var sel = { mode: "add", lang: UI, deco: "emoji", roles: {}, groups: {}, verify: false };
  ROLES.forEach(function(r) {
    sel.roles[r.key] = r.on;
  });
  GROUPS.forEach(function(g) {
    sel.groups[g.id] = g.on;
  });
  var plan = null, data = null, msg, treeBox;
  function nm(kind, emoji, text) {
    var t = text;
    if (sel.deco === "emoji" && emoji) t = emoji + "│" + t;
    return kind === "text" || kind === "announcement" || kind === "forum" ? t.toLowerCase().replace(/\s+/g, "-") : t;
  }
  function buildPlan() {
    var L = sel.lang, p = { roles: [], categories: [], gate: !!(sel.verify && sel.roles.member) };
    ROLES.forEach(function(r) {
      if (sel.roles[r.key]) p.roles.push({ key: r.key, name: r[L], color: r.color, hoist: r.hoist, mentionable: r.key === "mod" || r.key === "helper" });
    });
    var verify = sel.verify && sel.roles.member;
    GROUPS.forEach(function(g) {
      if (!sel.groups[g.id]) return;
      var chans = g.ch.map(function(c) {
        var o = c[4] || {};
        return { name: nm(c[3], c[0], c[L === "fr" ? 2 : 1]), type: c[3], readonly: !!o.ro, topic: "", slowmode: 0 };
      });
      if (g.id === "info" && verify) chans.unshift({ name: nm("text", "✅", L === "fr" ? "vérification" : "verify"), type: "text", readonly: true, topic: L === "fr" ? "Vérifie-toi ici pour accéder au serveur." : "Verify here to access the server.", slowmode: 0 });
      p.categories.push({ name: (sel.deco === "emoji" ? g.icon + " " : "") + g[L], access: g.staff ? "staff" : "public", open: !!g.open, roles: ["admin", "mod"], channels: chans });
    });
    plan = p;
  }
  function count() {
    var c = 0;
    plan.categories.forEach(function(x) {
      c += x.channels.length;
    });
    return { roles: plan.roles.length, cats: plan.categories.length, chans: c };
  }
  function section(name, hint) {
    var s = el("section", "mg-sec");
    s.appendChild(el("h2", "", name));
    if (hint) s.appendChild(el("p", "mg-hint", hint));
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) s.appendChild(arguments[i]);
    return s;
  }
  function check(label, hint, on, change) {
    var w = el("label", "mg-tg"), i = el("input");
    i.type = "checkbox";
    i.checked = !!on;
    i.addEventListener("change", function() {
      change(i.checked);
    });
    w.append(i, el("span", "", label));
    if (hint) w.append(el("small", "", hint));
    return w;
  }
  function radio(opts, cur, on) {
    var s = el("select");
    opts.forEach(function(o) {
      var op = el("option", "", o[1]);
      op.value = o[0];
      s.appendChild(op);
    });
    s.value = cur;
    s.addEventListener("change", function() {
      on(s.value);
    });
    return s;
  }
  function field(label, c, hint) {
    var f = el("div", "mg-f");
    f.append(el("label", "", label), c);
    if (hint) f.append(el("span", "mg-hint", hint));
    return f;
  }
  function say(t, err) {
    msg.textContent = t || "";
    msg.className = "mg-msg" + (err ? " err" : t ? " ok" : "");
  }
  var ICON = { text: "#", announcement: "📣", voice: "🔊", forum: "💬", stage: "🎙️" };
  function regen() {
    buildPlan();
    drawTree();
  }
  function drawTree() {
    while (treeBox.firstChild) treeBox.removeChild(treeBox.firstChild);
    var c = count();
    treeBox.appendChild(el("p", "mg-hint", T(c.roles + " roles · " + c.cats + " categories · " + c.chans + " channels", c.roles + " rôles · " + c.cats + " catégories · " + c.chans + " salons")));
    var rl = el("div", "mg-roles");
    plan.roles.forEach(function(r) {
      var chip = el("span", "mg-chip");
      chip.style.setProperty("--rc", r.color);
      var n = el("input");
      n.type = "text";
      n.value = r.name;
      n.maxLength = 50;
      n.className = "bd-in";
      n.addEventListener("input", function() {
        r.name = n.value;
      });
      var col = el("input");
      col.type = "color";
      col.value = r.color;
      col.className = "bd-col";
      col.addEventListener("input", function() {
        r.color = col.value;
        chip.style.setProperty("--rc", r.color);
      });
      chip.append(col, n);
      rl.appendChild(chip);
    });
    treeBox.appendChild(rl);
    plan.categories.forEach(function(cat, ci) {
      var box = el("div", "bd-cat"), head = el("div", "bd-row"), cn = el("input");
      cn.type = "text";
      cn.value = cat.name;
      cn.maxLength = 100;
      cn.className = "bd-in bd-catname";
      cn.addEventListener("input", function() {
        cat.name = cn.value;
      });
      var priv = el("span", "mg-hint", cat.access === "staff" ? "🔒 " + T("staff only", "staff seulement") : cat.open ? "🌐" : "");
      var up = btn("↑", function() {
        if (ci > 0) {
          swap(plan.categories, ci, ci - 1);
          drawTree();
        }
      }), dn = btn("↓", function() {
        if (ci < plan.categories.length - 1) {
          swap(plan.categories, ci, ci + 1);
          drawTree();
        }
      }), rm = btn("✕", function() {
        plan.categories.splice(ci, 1);
        drawTree();
      });
      head.append(cn, priv, up, dn, rm);
      box.appendChild(head);
      cat.channels.forEach(function(ch, hi) {
        var r = el("div", "bd-row bd-ch"), ty = radio([["text", "# text"], ["announcement", "📣 announce"], ["voice", "🔊 voice"], ["forum", "💬 forum"], ["stage", "🎙️ stage"]], ch.type, function(v) {
          ch.type = v;
        });
        var n = el("input");
        n.type = "text";
        n.value = ch.name;
        n.maxLength = 100;
        n.className = "bd-in";
        n.addEventListener("input", function() {
          ch.name = n.value;
        });
        var ro = check(T("read-only", "lecture seule"), "", ch.readonly, function(v) {
          ch.readonly = v;
        });
        r.append(ty, n, ro, btn("↑", function() {
          if (hi > 0) {
            swap(cat.channels, hi, hi - 1);
            drawTree();
          }
        }), btn("↓", function() {
          if (hi < cat.channels.length - 1) {
            swap(cat.channels, hi, hi + 1);
            drawTree();
          }
        }), btn("✕", function() {
          cat.channels.splice(hi, 1);
          drawTree();
        }));
        box.appendChild(r);
      });
      box.appendChild(btn(T("+ Add a channel", "+ Ajouter un salon"), function() {
        cat.channels.push({ name: "new-channel", type: "text", readonly: false, topic: "", slowmode: 0 });
        drawTree();
      }, "btn btn-sm"));
      treeBox.appendChild(box);
    });
    treeBox.appendChild(btn(T("+ Add a category", "+ Ajouter une catégorie"), function() {
      plan.categories.push({ name: "New category", access: "public", open: false, roles: ["admin", "mod"], channels: [] });
      drawTree();
    }, "btn btn-sm"));
  }
  function btn(t, fn, cls) {
    var b = el("button", cls || "btn btn-sm bd-mini", t);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function swap(a, i, j) {
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  function wait(id) {
    return new Promise(function(res, rej) {
      (function poll(n) {
        api("/dash/guild/" + gid).then(function(j) {
          var hit = (j.results || []).filter(function(r) {
            return r.id === id;
          })[0];
          if (hit) return hit.ok ? res(hit.info || "") : rej(new Error(hit.error || "The bot refused the plan."));
          if (n >= 60) return rej(new Error(T("The bot didn't answer in time. Make sure it's online with the latest ticket_dashboard.py; the request expires after 10 minutes.", "Le bot n'a pas répondu à temps. Vérifie qu'il est en ligne avec le dernier ticket_dashboard.py ; la demande expire après 10 minutes.")));
          setTimeout(function() {
            poll(n + 1);
          }, 3e3);
        }).catch(rej);
      })(0);
    });
  }
  function build() {
    while (app.firstChild) app.removeChild(app.firstChild);
    stateBox.hidden = true;
    app.hidden = false;
    msg = el("div", "mg-msg");
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");
    treeBox = el("div", "bd-tree");
    var langSel = radio([["en", "English"], ["fr", "Français"]], sel.lang, function(v) {
      sel.lang = v;
      regen();
    });
    var deco = radio([["emoji", T("Emojis in names (💬│general)", "Emojis dans les noms (💬│général)")], ["plain", T("Plain names", "Noms simples")]], sel.deco, function(v) {
      sel.deco = v;
      regen();
    });
    var md = radio([["add", T("Add to the server (keeps everything that exists)", "Ajouter au serveur (garde tout ce qui existe)")], ["reset", T("⚠ Reset: rebuild everything (deletes ALL current channels and roles)", "⚠ Tout refaire (supprime TOUS les salons et rôles actuels)")]], sel.mode, function(v) {
      sel.mode = v;
    });
    app.appendChild(section(T("Mode", "Mode"), T("“Reset” first creates the new layout, then deletes the old channels and roles (not bots' roles). Messages in deleted channels are lost for good.", "« Tout refaire » crée d'abord la nouvelle structure, puis supprime les anciens salons et rôles (pas ceux des bots). Les messages des salons supprimés sont perdus définitivement."), field(T("What should happen?", "Que faire ?"), md)));
    app.appendChild(section(T("Language & style", "Langue & style"), T("Channel and role names are generated in this language (English and French for now).", "Les noms des salons et rôles sont générés dans cette langue (anglais et français pour l'instant)."), field(T("Server language", "Langue du serveur"), langSel), field(T("Style", "Style"), deco)));
    var rg = el("div", "bd-grid");
    ROLES.forEach(function(r) {
      rg.appendChild(check(r[sel.lang], r.d[UI], sel.roles[r.key], function(v) {
        sel.roles[r.key] = v;
        regen();
      }));
    });
    app.appendChild(section(T("Roles & permissions", "Rôles & permissions"), T("Ready-made permissions. “Admin” gets management rights but not the Administrator flag; “Muted” is denied everywhere.", "Permissions prêtes à l'emploi. « Admin » reçoit les droits de gestion sans le flag Administrateur ; « Muet » est bloqué partout."), rg));
    var gg = el("div", "bd-grid");
    GROUPS.forEach(function(g) {
      gg.appendChild(check(g.icon + " " + g[sel.lang], g.d[UI], sel.groups[g.id], function(v) {
        sel.groups[g.id] = v;
        regen();
      }));
    });
    app.appendChild(section(T("Channels", "Salons"), T("Tick the sections you want. Tick none of the voice ones and you get a text-only server.", "Coche les sections voulues. Décoche les vocaux pour un serveur 100 % texte."), gg));
    app.appendChild(section(T("Security", "Sécurité"), null, check(T("Member gate (verification)", "Accès réservé aux membres (vérification)"), T("Everyone sees only the info section until they get the Member role — pair it with /verify. Needs the Member role.", "Tout le monde ne voit que les infos tant qu'il n'a pas le rôle Membre — à associer avec /verify. Nécessite le rôle Membre."), sel.verify, function(v) {
      sel.verify = v;
      regen();
    })));
    app.appendChild(section(T("Preview", "Aperçu"), T("Rename, reorder or remove anything. Changing a checkbox above regenerates this preview.", "Renomme, réordonne ou supprime ce que tu veux. Modifier une case ci-dessus régénère cet aperçu."), treeBox));
    var bar = el("div", "mg-bar"), go = el("button", "btn btn-primary", T("Build my server", "Créer mon serveur"));
    go.type = "button";
    go.addEventListener("click", function() {
      var c = count();
      if (!c.roles && !c.cats) return say(T("The plan is empty.", "Le plan est vide."), true);
      if (sel.mode === "reset") {
        var typed = prompt(T("This DELETES every current channel and role of “" + data.guild.name + "” and cannot be undone. Type the server name to confirm:", "Ceci SUPPRIME tous les salons et rôles actuels de « " + data.guild.name + " » et est irréversible. Tape le nom du serveur pour confirmer :"));
        if (typed === null || typed.trim() !== data.guild.name) return say(T("Cancelled: the name didn't match.", "Annulé : le nom ne correspond pas."), true);
      } else if (!confirm(T("Sentinel will ADD " + c.roles + " roles, " + c.cats + " categories and " + c.chans + " channels to “" + data.guild.name + "”. Nothing existing is deleted. Continue?", "Sentinel va AJOUTER " + c.roles + " rôles, " + c.cats + " catégories et " + c.chans + " salons à « " + data.guild.name + " ». Rien d'existant n'est supprimé. Continuer ?"))) return;
      go.disabled = true;
      say(T("Sent to the bot… building can take a minute.", "Envoyé au bot… la création peut prendre une minute."));
      api("/dash/guild/" + gid + "/tickets/op", { op: "server_build", data: { plan, mode: sel.mode } }).then(function(j) {
        return wait(j.id);
      }).then(function(info) {
        say("✅ " + (info || T("Done.", "Terminé.")));
      }).catch(function(e) {
        say(e.message, true);
      }).then(function() {
        go.disabled = false;
      });
    });
    bar.appendChild(go);
    app.append(bar, msg);
    regen();
  }
  api("/dash/guild/" + gid).then(function(j) {
    data = j;
    title.textContent = j.guild.name;
    lead.textContent = T("Server builder — create roles, channels and permissions in one go.", "Server builder — crée rôles, salons et permissions d'un coup.");
    document.title = j.guild.name + " — Server builder";
    build();
  }).catch(function(e) {
    lead.textContent = "";
    if (e.status === 401) show(T("Sign in to manage your servers.", "Connecte-toi pour gérer tes serveurs."), [T("Sign in", "Connexion"), "/account"]);
    else if (e.code === "bot_missing") show(T("Sentinel isn't in this server yet.", "Sentinel n'est pas encore dans ce serveur."), [T("Back to dashboard", "Retour au dashboard"), "/dashboard"]);
    else if (e.code === "link_discord" || e.code === "relink_discord") show(e.message, [T("Account page", "Page du compte"), "/account"]);
    else show(e.message || T("Could not load this server.", "Impossible de charger ce serveur."), [T("Back to dashboard", "Retour au dashboard"), "/dashboard"]);
  });
})();
