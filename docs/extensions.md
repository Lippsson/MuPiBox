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
`/home/dietpi/.mupibox/data/extensions/<id>/`; welche Extensions an sind, steht in `…/extensions/state.json`
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
  "resources": {},
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
- `settings`: was die Extension speichert (Typen `boolean`, `string`, `number`, `secret`; optional `pattern`, `options`: die erlaubten Werte eines `string` oder `number`, und `min`/`max` für ein `number`). Der Kern prüft und
  speichert die Werte (`~/.mupibox/data/extensions/settings/<id>.json`); `secret`-Werte gibt er nie zurück, nur ob es einen gibt
  (`<key>Set`). `legacy`: ein Wert der Konfiguration (`mupibox.cdLookup`), der bei der Installation einmal übernommen wird.
- `ui`: die Karte der Extension auf der Seite „Erweiterungen“ der Webapp: Titel, Hilfetext und die Felder (je ein Eintrag aus
  `settings`; `dep` = ein Schalter, von dem das Feld abhängt; `choices`: `[{ value, label }]` für eine Einstellung mit `options`, sie
  erscheint als Auswahl und wird sofort gespeichert). `type: "lookup"` (mit `search: "/api/ext/<id>/<name>"`, nur für ein `string`): ein Suchfeld; die Route des API-Teils bekommt `?q=` und
  antwortet mit `[{ label, values }]`, ein Tipp auf einen Treffer speichert dessen `values` (Einstellungen der Extension).
  Secrets haben einen eigenen „Speichern“-Knopf. Hat die Extension einen
  Display-Teil, lädt das Display nach dem Speichern der Einstellungen neu.
- `system`: was bei der Installation als root eingerichtet wird. **Nur diese vier Arten, jede geprüft:**
  - `udev`: `{ name, file }` – die Regel-Datei aus dem Paket kommt als `99-mpx-<id>….rules` nach `/etc/udev/rules.d/`. Erlaubt
    sind nur Vergleiche (`KERNEL`, `SUBSYSTEM`, `ATTRS{…}` …) und die Zuweisungen `MODE`, `GROUP`, `OWNER`, `TAG`, `SYMLINK`;
    `RUN`, `PROGRAM`, `IMPORT` und `ENV{…}=` lehnt der Kern ab.
  - `units`: `{ name, file }` – systemd-Dienste und -Timer aus dem Paket (höchstens vier). Der Name beginnt mit `mpx-<id>` und endet auf
    `.service` oder `.timer`; die Datei (`units/…`) kommt nach `/etc/systemd/system/`. **Jede Unit muss auch in `resources.services` mit
    `"provides": true` stehen** (damit der Test sie kennt). Die Datei darf nur wenige einfache Schlüssel enthalten (`[Unit]`: Description,
    After, Before, Wants, Requires; `[Service]`: Type, ExecStart…, Restart, RestartSec, WorkingDirectory, Environment, Timeout…, StandardOutput/Error,
    SyslogIdentifier, Nice, KillMode; `[Timer]`: OnCalendar, OnBootSec …, Persistent; `[Install]`: `WantedBy=multi-user.target|timers.target`),
    Programme mit absolutem Pfad (`@EXT_DIR@` = der Ordner der Extension), ohne die Präfixe `+`/`!` und ohne Zeilenfortsetzung. `User`, `Group`,
    Capabilities und alles andere lehnt der Kern ab. Ein Dienst läuft **nicht** als root: der Kern legt ein Drop-in `10-mupibox.conf` mit
    `User=dietpi` und `NoNewPrivileges=yes` dazu. Nach der Installation werden die Units eingeschaltet und (neu) gestartet; beim Ausschalten der
    Extension gestoppt, beim Entfernen samt Dateien gelöscht (ebenso Units, die eine neue Version nicht mehr hat).
  - `groups`: der Benutzer `dietpi` kommt in diese Gruppen; erlaubt nur `cdrom`, `audio`, `video`, `plugdev`.
  - `packages`: Debian-Pakete (`apt-get install`), Namen nach `^[a-z0-9][a-z0-9+.-]{1,60}$`; die Webapp zeigt sie vor
    der Installation.
  Beim Entfernen nimmt der Kern genau das wieder weg, was er angelegt hat (Regel-Dateien und Units; Gruppen und Pakete bleiben, weil
  andere sie brauchen können).
- `resources` (**Pflicht**, `{}` heißt „braucht nichts“): was die Extension von der Box braucht. Sie sagt es **vorher**, die Box
  prüft es **vor** der Installation gegen das, was schon belegt ist.
  - `ports`: `[{ "port": 9000, "proto": "tcp", "purpose": "…" }]` – Ports, auf denen sie lauscht (ab 1024, `proto` tcp oder udp).
  - `gpio`: `[{ "pin": 17, "purpose": "…" }]` – GPIO-Pins (BCM-Nummer 2–27).
  - `services`: `[{ "name": "foo.service", "provides": true, "purpose": "…" }]` – systemd-Dienste (`.service`, `.socket`, `.timer`).
    `provides: true`: die Extension bringt den Dienst mit (z. B. über ein Paket), er darf noch nicht existieren; sonst (Standard)
    braucht sie ihn nur, er sollte da sein (fehlt er, ist es eine Warnung).

  **Der Test** (`app-api/extension-resources.ts`) vergleicht mit: dem Kern (seine Ports und die Pins der Konfiguration: Netzschalter/
  Shim, LED, Lüfter, Drehgeber und HAT, wenn eingeschaltet), der Boot-Konfiguration (`dtoverlay`/`dtparam`: Pins, I²C, SPI, Soundkarten),
  den anderen Extensions (auch ausgeschalteten), und – soweit die Box hineinsehen kann – dem, was jetzt läuft (`ss`: lauschende Ports,
  `gpioinfo`: belegte Pins, `systemctl`: vorhandene Dienste). Eine Kollision ist ein **Fehler**: die Webapp zeigt sie mit dem
  Verursacher an und installiert nichts (auch nicht beim Einschalten einer ausgeschalteten Extension). Ließ sich ein Teil nicht
  ansehen, steht eine **Warnung** da. Der Test läuft in der Webapp vor der Frage (`POST /api/app/extensions/check`) und
  noch einmal in der Installation selbst, mit dem Manifest des heruntergeladenen Pakets; das muss dasselbe sagen wie der Katalog.
  Bei einer neuen Version zählt, was die alte schon belegt, nicht als Kollision.

  Wichtig: Die Angabe wird gegen die Box **geprüft, nicht erzwungen** – eine Extension ist ein Programm des Benutzers `dietpi`
  (deshalb nur aus dem Katalog oder von Quellen, denen man vertraut).

## Katalog

`catalog.json` liegt im Repository (`extensions/catalog.json`, Adresse einstellbar: `mupibox.extensionCatalog`):

```json
[{ "id": "cd", "name": "USB-CD-Laufwerk", "version": "1.0.0", "description": "…", "hostApi": 1,
   "url": "https://raw.githubusercontent.com/<repo>/<branch>/extensions/dist/cd-1.0.0.mpx",
   "sha256": "…", "size": 12345, "system": { "udev": 1, "units": [], "groups": ["cdrom"], "packages": [] }, "resources": {} }]
```

Die Box lädt die Datei, prüft die Größe (höchstens 16 MB) und die SHA-256, prüft Dateinamen und Manifest, vergleicht es mit dem
Katalogeintrag (Id, Version, Systemschritte, `resources`) und testet die Ressourcen gegen die Box und installiert erst dann (Dateien, Regeln, Units, Gruppen, Pakete; danach starten
`server` und `spotify-control` neu, das Display lädt neu). Gebaut wird mit `node tools/mpx/pack.mjs <id>`:
das macht aus `extensions/<id>/` die `.mpx` in `extensions/dist/` und trägt Größe und Prüfsumme in den Katalog ein.

## Eigene Datei hochladen

Neben dem Katalog gibt es auf der Seite „Erweiterungen“ **„Datei hochladen“** für eine `.mpx` vom eigenen Rechner (höchstens 16 MB).
Die Box liest und prüft die Datei (`POST /api/app/extensions/upload`: Dateinamen, Manifest, Regeln – dieselben Prüfungen wie beim Katalog,
nur ohne Prüfsumme aus dem Katalog), installiert aber noch nichts: die App zeigt Name, Version, die Systemschritte und die SHA-256 und warnt,
dass eine Erweiterung ohne Schutz läuft. Erst nach dem „Installieren“ läuft die Installation (`POST …/install` mit dem Token der Prüfung,
zehn Minuten gültig).

## Installieren und entfernen

Webapp › Einstellungen › System › **Erweiterungen**: Karten wie auf der Erweiterungen-Seite eines Browsers (Suche, Details, Entfernen, Schalter an/aus);
was der Katalog bietet, steht mit „Installieren“ dahinter. Nur mit Anmeldung (Eltern). Nach einer Änderung starten Player, API und Display neu (eine Wiedergabe
bricht dabei ab; die Webapp sagt es vorher).

## Die Schnittstellen (`hostApi` 1 bis 5)

Die Nummer 5 (Taster) bringt im Manifest:

- den Einstellungstyp **`gpio`**: ein Pin, den der Benutzer wählt (`0` = keiner, sonst die BCM-Nummer 2–27; der Standardwert ist `0`, ohne
  `options`, `pattern`, `min`/`max`, `legacy`; höchstens 16 je Extension). Die Webapp zeigt eine Auswahl mit der Nummer am Pfostenstecker und
  sperrt, was schon belegt ist, mit dem Namen dessen, der den Pin hält (`GET /api/app/ext/<id>/gpio` → `{ pins: [{ pin, holders }], hints, blind }`;
  `hints` sind freie Pins, die ein ausgeschalteter Teil des Kerns bräuchte, die 26/24/10 des Drehreglers: wählbar, mit einem Hinweis in der Liste;
  der Kern, die Boot-Konfiguration, die anderen Extensions mit ihren `resources` und ihren gewählten Pins, und was `gpioinfo` als belegt meldet).
  Der Kern prüft beim Speichern noch einmal und antwortet mit 409 `gpio_taken` (`{ key, pin, holders }`) oder `gpio_twice` (derselbe Pin in zwei
  Feldern der Extension). Ein gewählter Pin zählt für alle anderen als belegt: im Ressourcentest anderer Extensions und in der Hardware-Seite des
  Kerns (Drehregler, LED, Lüfter lehnen einen Pin ab, den eine Extension hält).
- **`type: "heading"`** in `ui.items`: eine Zwischenüberschrift (`label`, optional `help` und `dep`; ohne `key`). Mit `hostApi` 5 sind bis zu
  80 Einträge erlaubt (vorher 20), und `dep` darf auch auf eine `gpio`-Einstellung zeigen (das Feld erscheint, sobald ein Pin gewählt ist).
  Ein Feld mit `choices` kann eine zweite Auswahl neben sich haben: **`extra`** = `{ key, label?, when, choices }` – `key` ist eine eigene
  Einstellung mit `options`, `choices` nennt jede davon, und die Auswahl (eine Liste rechts neben dem Feld) steht nur da, solange das Feld
  einen der Werte aus `when` hat (bei den Tastern: der Lautstärke-Schritt neben „Lauter“ und „Leiser“).
  Eine Überschrift und die Felder bis zur nächsten sind eine Gruppe. Mit **`rename`** (eine `string`-Einstellung) gibt der Benutzer der Gruppe
  einen Namen: die Überschrift ist dann ein Textfeld, `label` steht als Platzhalter darin. Mit **`optional`** (eine `boolean`-Einstellung) ist
  die Gruppe erst da, wenn man sie hinzufügt: aufeinanderfolgende Gruppen mit demselben `label` sind eine Reihe, unter der rechts ein
  „+ label“ steht, und jede hinzugefügte hat einen Knopf zum Entfernen (setzt den Schalter zurück, die Pins der Gruppe auf `0` und den Namen
  auf leer). Eine Gruppe mit gewähltem Pin wird immer gezeigt.
- **`ui.place: "system"`**: die Einstellungen sind eine eigene Seite unter Einstellungen › System › „Die Box“ (statt nur der Karte auf der Seite
  „Erweiterungen“; `GET /api/app/extensions/pages` nennt der Webapp die Seiten der eingeschalteten Extensions; `ui.heading` ist, was dort über
  der Karte der Einstellungen steht, wenn es nicht der Titel sein soll). Dazu **`ui.adopt`**: Seiten des
  Kerns, die auf dieser Seite mit erscheinen und an ihrem alten Ort verschwinden, solange die Extension eingeschaltet ist. Erlaubt ist bisher nur
  `"rotary"` („Drehregler und Taster“, sonst unter Einstellungen › Audio).
- im API-Teil `host.apiUrl` und `host.onSettings(fn)` (unten).

Die Nummer 2 (Wetter) bringt zum Display `api.overlay`, `api.fetchApi` und im Manifest `lookup`, `options`, `min`/`max`. Ein Paket mit `hostApi: 1` läuft unverändert. Die Nummer 3 (Wetter 1.5) bringt im Manifest `type: "order"`: eine Liste, die man in der Webapp per Drag and Drop sortiert (`choices` = Namen und Beschriftungen, die Einstellung ist ein `string` mit den Namen, durch Komma getrennt; der Standardwert nennt jeden Eintrag einmal). Die Nummer 4 (Benutzer) bringt im Manifest `type: "roster"`: eine Liste, die die Extension selbst führt (Benutzer, zum Beispiel), mit den vier Adressen `list`, `add`, `remove` und `select` und einer fünften, `color`, wenn die Einträge eine Farbe haben, die man in der Webapp ändern kann (`{ id, color }`; die Liste nennt dazu `colors`; Routen mit Anmeldung unter `/api/ext/<id>/…`; ohne Einstellung, ohne `key`), und im API-Teil `host.updateConfig`, `host.paths` und `host.restartServices` (unten).

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
- `host.updateConfig(mutate)` (`hostApi` 4) – ändert die Konfiguration der Box (`mupiboxconfig.json`) unter ihrer Sperre: `mutate(cfg)` ändert das Objekt, das Ergebnis wird gespeichert. Gehört zu den Dingen, die nur eine Extension tun darf, der man vertraut.
- `host.paths` (`hostApi` 4) – `{ library, data, extensions }`: wo die Box ihre Bibliothek, ihre Daten und die Extensions hält
- `host.restartServices()` (`hostApi` 4) – startet Player und Server neu und lädt danach das Display; der API-Teil läuft im Server, also ist das das Letzte, was er tut
- `host.lockLibrary()` (`hostApi` 4) – nimmt die Sperren der Bibliothek (`data.json` und die Fortsetzen-Liste), wartet bis etwa 10 s und gibt eine Funktion zurück, die sie wieder freigibt (`null`: nicht zu bekommen). Solange sie gehalten werden, schreiben die App und der Smart Sync nicht in die Bibliothek. Wer danach `host.restartServices()` aufruft, behält sie: Sie enden mit dem Prozess des Servers.
- `host.apiUrl` (`hostApi` 5) – die Adresse des Servers selbst (für Routen des Kerns, etwa `/api/audio-output`)
- `host.onSettings(fn)` (`hostApi` 5) – `fn(settings)` wird aufgerufen, nachdem die Einstellungen der Extension gespeichert wurden; so stellt
  sich ein API-Teil um, ohne dass der Server neu startet (der Kern wartet höchstens drei Sekunden auf die Antwort)

Dazu liefert der Kern selbst: `GET /api/app/extensions` (Katalog und Installiertes), `POST /api/app/extensions/install|remove|enable`,
`GET/POST /api/app/ext/<id>/settings`, `GET /api/app/ext/<id>/info` (eine installierte Extension, wie in der Liste), `GET /api/app/ext/<id>/gpio`,
`GET /api/app/extensions/pages`, die Dateien der Extension unter `/ext/<id>/…` und `GET /api/ext/active` (die Liste für das Display).

### Display: `activate(api)` (ein ES-Modul, kein Angular nötig)

- `api.id`, `api.url(file)` (Adresse einer Datei der Extension), `api.apiUrl`, `api.fetch('/ext/<id>/…')` (GET beim Player, JSON oder `null`)
- `api.every(ms, fn)` – ruft `fn` regelmäßig auf; Fehler werden gefangen
- `api.settings()` – die Einstellungen der Extension (ohne Geheimnisse)
- `api.tabs.set({ id, src, visible, onSelect })` / `api.tabs.remove(id)` – ein Reiter nach den Kategorien (`src`: SVG der Extension)
- `api.header.add({ mount(host) })` – etwas in die Kopfzeile, rechts neben der Akkuanzeige. Die Statusanzeige gibt es auf mehreren
  Seiten (Startseite, Sperrbildschirm …): `mount` wird für jeden Platz mit einem leeren Element aufgerufen und gibt zurück, was den
  Platz wieder aufräumt (Zeitgeber, Beobachter). Farben erbt das Element (`currentColor`).
- `api.fetchApi('/…')` – GET auf den eigenen API-Teil (`/api/ext/<id>/…`), JSON oder `null`
- `api.overlay.open({ title, mount(content) })` / `api.overlay.close()` – eine Vollbild-Seite über dem Display mit Titelleiste und
  Zurück-Knopf; `mount` füllt den Inhalt und gibt zurück, was beim Schließen aufräumt. Immer nur eine Seite.
- `api.winamp.onEject(fn)` – der Auswurf-Knopf im Winamp-Fenster: gibt `fn()` `true` zurück, ist er erledigt, sonst öffnet er die Bibliothek
- `api.player.open(media)` – öffnet den Player mit diesem Album; `api.player.noResumeFolder(folder)` hält Alben dieses Ordners aus „Fortsetzen“ heraus

## Was der Kern selbst tut

Der Kern bleibt ohne Extensions vollständig; ein Fehler in einer Extension (Ausnahme beim Laden, bei einem Ereignis, in einer Route)
wird gefangen, ins Log geschrieben und schaltet diese Extension in der Sitzung ab. Die Wiedergabe läuft weiter.
Extensions laufen als Programme des Benutzers `dietpi`, **ohne Schutzumgebung**: wer eine installiert, vertraut ihr. Deshalb
kommen sie nur aus dem Katalog, dessen Einträge Prüfsumme und Systemschritte angeben, und die Webapp zeigt vorher, was sie einrichten.

## Reihenfolge der Umsetzung

Fertig: Player (`src/backend-player/src/extensions.js`: Laden, `albums`-Quelle, Ereignisse), API (`app-api/extensions.ts`: Laden,
Einstellungen, Dateien, Installieren/Entfernen, Katalog), Display (`extension-host.service.ts`: Reiter, Auswurf, Player), Webapp (Seite
„Erweiterungen“), `tools/mpx/pack.mjs`, die CD-Anbindung als erste Extension (`extensions/cd/`). Die Uhr in der Kopfzeile ist die zweite
Extension (`extensions/clock/`, `api.header` im Display); sie ist nicht mehr im Kern. Die dritte ist das Wetter (`extensions/weather/`,
`hostApi` 2: `api.overlay`, `api.fetchApi`, `lookup`): Open-Meteo oder MET Norway, die Anzeigen sind die SteelSeries-Messuhren
(BSD-2, im Paket mitgeliefert). Die vierte sind die Benutzer (`extensions/users/`, `hostApi` 4): jeder Benutzer hat seine Einstellungen und seine Bibliothek, gewechselt wird am Display (rundes Zeichen in der Kopfzeile) oder in der Webapp; der Spotify-Login, WLAN, NAS und die Hardware sind für alle gleich. Beim Wechsel sichert die Extension den Stand des bisherigen Benutzers in ihrem Ordner, lädt den des neuen, und die Box startet neu.

Die fünfte sind die Taster (`extensions/buttons/`, „Buttons & GPIO Input“, `hostApi` 5, nur ein API-Teil): bis zu sechs einzelne Taster und zwei
Tasterpaare an frei wählbaren GPIO-Pins (gegen Masse, der interne Pull-up ist eingeschaltet). Am Anfang steht nur ein Taster da, weitere und die
Paare kommen mit „+“ dazu, und jeder kann einen eigenen Namen bekommen. Ein Taster hat eine Aktion für kurzes Drücken
(beim Loslassen) und wahlweise eine zweite für langes Drücken (sobald die Haltezeit erreicht ist: „Dual Action“). Ein Paar aus zwei Tastern a und b
hat sechs: kurz und lang, je für a, b und beide zusammen; mit „Wiederholen“ wiederholt sich die lange Aktion eines einzelnen Tasters, solange er
gehalten wird (nie die für beide). Die Aktionen: Play/Pause, weiter, zurück, von vorn (`replay`, neu im Player), lauter/leiser in wählbaren
Schritten, 30 s vor/zurück, Mischen, Ausgabegerät wechseln, Stopp, Ausschalten. Gelesen wird mit `gpiomon` (libgpiod 1 und 2), entprellt mit 25 ms;
die Logik (`logic.js`) ist ohne Hardware getestet (`node --test extensions/buttons/test/buttons.test.js`). Das Manifest wird erzeugt:
`node extensions/buttons/test/manifest-source.js --write`. Die Seite steht unter System › „Die Box“ und nimmt „Drehregler und Taster“ mit.

## Offen (für Foto/Immich, NFC)

Was eine Foto- oder Immich-Extension noch bräuchte (Ruhezustand im Display, eigene Nutzungsdauer, ein `lookup` ohne Suchwort) und was NFC
bräuchte (`spi`/`i2c`), steht mit dem Abgleich zu Waldemars Zweig `layout` in `docs/5.1-abstimmung.md`.
Dort steht auch, dass `EXT_DIR` (API und Player) beim Umzug auf die vier Ordner von 5.1 über `paths.ts` gehen soll.

## Eine Extension bauen

Die Richtlinien für Autoren (auf Englisch, mit Checkliste) stehen in [`extensions/README.md`](../extensions/README.md); die Webapp verlinkt sie auf der Seite „Erweiterungen“.

`extensions/<id>/` mit `manifest.json` und den Teilen, dann `node tools/mpx/pack.mjs <id>` (packt nach `extensions/dist/`, trägt den Katalog
ein) und beides einchecken. Tests der Extension (`extensions/<id>/test/*.test.js`) kommen nicht ins Paket: `node --test extensions/cd/test/*.test.js`.
