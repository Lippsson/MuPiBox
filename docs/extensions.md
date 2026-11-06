# Extensions der MuPiBox – Entwickler-Doku

Stand: Entwurf für 5.1. Die Basis der MuPiBox bleibt, was sie ist; was zusätzlich dazukommt, kommt als **Extension**:
eine einzige Datei, die man (wie eine Chrome-Erweiterung) aus einem Katalog installiert und wieder entfernt. Die erste
Extension ist die **USB-CD-Anbindung** (`cd`), die zweite die **Uhr in der Kopfleiste** (`clock`).

## Die Datei: `<id>-<version>.mpx`

Ein ZIP (wie die `.wsz`-Skins) mit festen Namen:

| Datei | Wohin | Was |
|---|---|---|
| `manifest.json` | alle | Name, Version, Rechte, Einstellungen, Systemschritte (siehe unten) |
| `player.js` | Player (`spotify-control`, Node, CommonJS) | `exports.activate(host)` – Wiedergabe, Geräte, Routen |
| `api.js` | API (`server`, Node, CommonJS) | `exports.activate(host)` – Routen unter `/api/ext/<id>/`, Dienste |
| `display.js` | Display (Chromium, ES-Modul) | `export function activate(api)` – Tabs, Knöpfe, Anzeigen |
| `icon.svg`, weitere Dateien | alle | werden unter `/ext/<id>/…` ausgeliefert (Skripte nur `display.js` und was es lädt; `player.js`/`api.js` nie) |

Die Webapp der Eltern führt **keinen Code** einer Extension aus (sie läuft mit der Anmeldung der Eltern): die Einstellungen
beschreibt die Extension im Manifest (`ui`), die Webapp zeichnet sie.

Jeder Teil ist **optional**; eine Extension bringt nur mit, was sie braucht. Entpackt wird nach
`/home/dietpi/.mupibox/extensions/<id>/`; welche Extensions an sind, steht in `…/extensions/state.json`
(`{ "cd": { "version": "1.0.0", "enabled": true } }`). Ein defekter Teil legt nur seine Extension still (Fehler im Log),
nie den Kern.

## `manifest.json`

```json
{
  "id": "cd",
  "name": "USB-CD-Laufwerk",
  "version": "1.0.0",
  "description": "Audio-CDs vom USB-Laufwerk abspielen, mit Titelnamen und Cover aus dem Internet.",
  "hostApi": 1,
  "player": "player.js",
  "api": "api.js",
  "display": "display.js",
  "icon": "icon.svg",
  "settings": {
    "cdLookup": { "type": "boolean", "default": true, "legacy": "mupibox.cdLookup" },
    "discogsToken": { "type": "secret", "pattern": "^[A-Za-z0-9]{0,80}$", "legacy": "discogs.token" }
  },
  "system": {
    "udev": [{ "name": "99-mpx-cd.rules", "file": "99-mpx-cd.rules" }],
    "groups": ["cdrom"]
  },
  "ui": {
    "title": "Audio-CD",
    "help": "Text über der Karte …",
    "items": [
      { "key": "cdLookup", "label": "Titel und Cover im Internet suchen" },
      { "key": "discogsToken", "label": "Discogs-Token", "dep": "cdLookup", "help": "…" }
    ]
  }
}
```

- `hostApi`: die Nummer der Schnittstelle, für die die Extension geschrieben ist. Der Kern lädt keine Extension mit einer
  höheren Nummer als seiner eigenen.
- `settings`: was die Extension speichert (Typen `boolean`, `string`, `number`, `secret`, optional `pattern`). Der Kern prüft und
  speichert die Werte (`~/.mupibox/extensions/settings/<id>.json`); `secret`-Werte gibt er nie zurück, nur ob es einen gibt
  (`<key>Set`). `legacy`: ein Wert der Konfiguration (`mupibox.cdLookup`), der bei der Installation einmal übernommen wird.
- `ui`: die Karte der Extension auf der Seite „Erweiterungen“ der Webapp: Titel, Hilfetext und die Felder (je ein Eintrag aus
  `settings`; `dep` = ein Schalter, von dem das Feld abhängt). Secrets haben einen eigenen „Speichern“-Knopf.
- `system`: was bei der Installation als root eingerichtet wird. **Nur diese drei Arten, jede geprüft:**
  - `udev`: `{ name, file }` – die Regel-Datei aus dem Paket kommt als `99-mpx-<id>….rules` nach `/etc/udev/rules.d/`. Erlaubt
    sind nur Vergleiche (`KERNEL`, `SUBSYSTEM`, `ATTRS{…}` …) und die Zuweisungen `MODE`, `GROUP`, `OWNER`, `TAG`, `SYMLINK`;
    `RUN`, `PROGRAM`, `IMPORT` und `ENV{…}=` lehnt der Kern ab.
  - `groups`: der Benutzer `dietpi` kommt in diese Gruppen; erlaubt nur `cdrom`, `audio`, `video`, `plugdev`.
  - `packages`: Debian-Pakete (`apt-get install`), Namen nach `^[a-z0-9][a-z0-9+.-]{1,60}$`; die Webapp zeigt sie vor
    der Installation.
  Beim Entfernen nimmt der Kern genau das wieder weg, was er angelegt hat (Regel-Dateien; Gruppen und Pakete bleiben, weil
  andere sie brauchen können).

## Katalog

`catalog.json` liegt im Repository (`extensions/catalog.json`, Adresse einstellbar: `mupibox.extensionCatalog`):

```json
[{ "id": "cd", "name": "USB-CD-Laufwerk", "version": "1.0.0", "description": "…", "hostApi": 1,
   "url": "https://raw.githubusercontent.com/<repo>/<branch>/extensions/dist/cd-1.0.0.mpx",
   "sha256": "…", "size": 12345, "system": { "udev": 1, "groups": ["cdrom"], "packages": [] } }]
```

Die Box lädt die Datei, prüft die Größe (höchstens 4 MB) und die SHA-256, prüft Dateinamen und Manifest, vergleicht es mit dem
Katalogeintrag (Id, Version, Systemschritte) und installiert erst dann (Dateien, Regeln, Gruppen, Pakete; danach starten
`server` und `spotify-control` neu, das Display lädt neu). Gebaut wird mit `node tools/mpx/pack.mjs <id>`:
das macht aus `extensions/<id>/` die `.mpx` in `extensions/dist/` und trägt Größe und Prüfsumme in den Katalog ein.

## Installieren und entfernen

Webapp › Einstellungen › **Erweiterungen**: der Katalog mit „Installieren“, darunter das Installierte mit Schalter
(an/aus) und „Entfernen“. Nur mit Anmeldung (Eltern). Nach einer Änderung starten Player, API und Display neu (eine Wiedergabe
bricht dabei ab; die Webapp sagt es vorher).

## Die Schnittstellen (`hostApi` 1)

### Player: `activate(host)`

- `host.id`, `host.dir`, `host.dataDir` (ein Ordner der Extension, der bei Updates bleibt), `host.version`, `host.log.debug/info/warn(text)`
- `host.settings.get(key, fallback)`, `host.settings.set(key, value)` – die Einstellungen der Extension (siehe `settings`)
- `host.config()` – die Konfiguration der Box (ohne Geheimnisse), gelesen
- `host.route(method, subpath, handler)` – Express-Route unter `/ext/<id>/<subpath>` des Players
- `host.on(event, fn)` – Ereignisse: `stop`, `finished` (Liste zu Ende), `track` (Titel gewechselt), `config` (Konfiguration geändert)
- `host.engine` – der Wiedergabeteil (mpv): `command([…])` (fragt mpv, wartet auf die Antwort), `playEntries([{ file, options }])`
  (die Liste ersetzen, der erste spielt), `setVolume(percent)`, `trackIndex()`
- `host.playback.stop()`, `host.playback.generation()` – die Wiedergabe anhalten; zählt bei jedem Start und Stopp hoch („ist es noch die, die ich meine?“)
- `host.meta()` – was der Player über die laufende Wiedergabe sagt (`currentMeta`); `host.setMeta({ … })` setzt erlaubte Felder
  (`album`, `path`, `totalTracks`, `currentTracknr`, `currentTrackname`)
- `host.albums.register(provider)` – eine **Quelle für Alben**, die keine Ordner sind. Ein `provider` hat
  `{ folder, play(), tracklist(), trackName(nr), progress(seconds, index), seek(percent, index), onStop(), onFinished() }`.
  `folder` ist der Name des „Ordners“, den das Display als `libraryPath` kennt (bei der CD `_audio_cd_`). Alles andere
  (Titelliste, Weiter/Zurück, Sprung, Mischen, Wiederholen, die Anzeige im Winamp) macht der Kern wie für jedes lokale Album.

### API: `activate(host)`

- `host.id`, `host.dir`, `host.dataDir`, `host.log`, `host.config()`, `host.settings()` (die Einstellungen als Objekt, mit Secrets – nur
  für den Code der Extension)
- `host.route('get' | 'post', '/sub', handler, { session: true })` – Route unter `/api/ext/<id>/sub`; ohne `session` für das Netz
  der Box, mit `session` nur mit der Anmeldung der Eltern (POST dann mit CSRF-Token). Fehler im Handler werden gefangen (500).
- `host.playerUrl` – die Adresse des Players

Dazu liefert der Kern selbst: `GET /api/app/extensions` (Katalog und Installiertes), `POST /api/app/extensions/install|remove|enable`,
`GET/POST /api/app/ext/<id>/settings`, die Dateien der Extension unter `/ext/<id>/…` und `GET /api/ext/active` (die Liste für das Display).

### Display: `activate(api)` (ein ES-Modul, kein Angular nötig)

- `api.id`, `api.url(file)` (Adresse einer Datei der Extension), `api.apiUrl`, `api.fetch('/ext/<id>/…')` (GET beim Player, JSON oder `null`)
- `api.every(ms, fn)` – ruft `fn` regelmäßig auf; Fehler werden gefangen
- `api.settings()` – die Einstellungen der Extension (ohne Geheimnisse)
- `api.tabs.set({ id, src, visible, onSelect })` / `api.tabs.remove(id)` – ein Reiter nach den Kategorien (`src`: SVG der Extension)
- `api.winamp.onEject(fn)` – der Auswurf-Knopf im Winamp-Fenster: gibt `fn()` `true` zurück, ist er erledigt, sonst öffnet er die Bibliothek
- `api.player.open(media)` – öffnet den Player mit diesem Album; `api.player.noResumeFolder(folder)` hält Alben dieses Ordners aus „Fortsetzen“ heraus

## Was der Kern selbst tut

Der Kern bleibt ohne Extensions vollständig; ein Fehler in einer Extension (Ausnahme beim Laden, bei einem Ereignis, in einer Route)
wird gefangen, ins Log geschrieben und schaltet diese Extension in der Sitzung ab. Die Wiedergabe läuft weiter.
Extensions laufen als Programme des Benutzers `dietpi`, **ohne Schutzumgebung**: wer eine installiert, vertraut ihr. Deshalb
kommen sie nur aus dem Katalog, dessen Einträge Prüfsumme und Systemschritte angeben, und die Webapp zeigt vorher, was sie einrichten.

## Reihenfolge der Umsetzung

Fertig: Player (`src/backend-player/src/extensions.js`: Laden, `albums`-Quelle, Ereignisse), API (`eltern/extensions.ts`: Laden,
Einstellungen, Dateien, Installieren/Entfernen, Katalog), Display (`extension-host.service.ts`: Reiter, Auswurf, Player), Webapp (Seite
„Erweiterungen“), `tools/mpx/pack.mjs`, die CD-Anbindung als erste Extension (`extensions/cd/`). Noch offen: die Uhr als zweite
Extension (`api.header` im Display).

## Eine Extension bauen

`extensions/<id>/` mit `manifest.json` und den Teilen, dann `node tools/mpx/pack.mjs <id>` (packt nach `extensions/dist/`, trägt den Katalog
ein) und beides einchecken. Tests der Extension (`extensions/<id>/test/*.test.js`) kommen nicht ins Paket: `node --test extensions/cd/test/*.test.js`.
