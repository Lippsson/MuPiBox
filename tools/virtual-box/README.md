# Virtual MuPiBox

The real backend of the box (with the parents' app and the extensions) on your PC, a pretend player, and a **virtual OLED display**
whose picture you can look at, or fetch as a PNG, at any time. Changes show up in seconds - no deploy, no Pi.

    node tools/virtual-box/start.mjs

| What | Where |
| --- | --- |
| The virtual box (OLED picture, buttons for the player and the QR code, links) | http://localhost:8210 |
| The OLED picture as a PNG (the "screenshot") | http://localhost:8210/oled.png |
| Its state (on or off, contrast, size) | http://localhost:8210/oled.json |
| The parents' app (no real login needed in development) | http://localhost:8200/app/ |
| The manual | http://localhost:8200/manual/ |
| The pretend player (no sound; a small library, a clock that runs through the tracks) | http://localhost:5005 |

A screenshot of the OLED display from the command line:

    curl http://localhost:8210/oled.png -o oled.png

Options: `--ext oled,buttons,nfc,clock` (which extensions of `extensions/` are installed, default these four), `--reset` (start with
a fresh configuration: empties `src/backend-api/config/`), `--no-watch` (do not watch `extensions/`). Ends with Ctrl+C.

## What is real and what is pretend

- **Real:** the backend (`src/backend-api`, started with `tsx watch`: it starts again by itself when its code changes), the app
  (`src/mupi-app`, served from the sources - reload the page), the manual, the extensions' API parts, and everything of the OLED
  display above the chip: `logic.js` (what is shown), `render.py` (how it is drawn), the boot picture, sleeping, scrolling,
  contrast. The extension starts its driver as it does on the box.
- **Pretend:** the player (`tools/winamp-sandbox/server.mjs --player-only`), the chip - and with it all hardware: no GPIO, no NFC reader,
  no sound, no WLAN. The extensions that need such hardware start, but cannot do what they are for.
- **Not in it:** the display of the box (the Angular app in `src/frontend-box`). For that there is `tools/winamp-sandbox` (a built display
  against the pretend box) or `ng serve`.

## How it is made

`start.mjs` copies `extensions/<id>` into `src/backend-api/config/extensions/<id>` (that is where the backend looks in development; the
folder is ignored by git), writes `state.json` and starts the backend. For the OLED extension `oled.py` is replaced by
`oled_virtual.py`: it imports the real driver (copied as `oled_real.py`) and runs its loop, but the panel is a picture instead of an I2C
chip - `oled.png` and `oled.json` in `tools/virtual-box/.work/oled/`. So the extension, its settings and the real `render.py` are
exactly those of the box.

- Every change in `extensions/` is copied over and the backend starts again (a few seconds).
- Python: a virtual environment in `.work/venv` (with the system's Pillow); on Windows its `python.exe` is also there as `python3.exe`,
  because that is the name the extension starts.
- `fonts/`: DejaVu Sans Mono, the font the box draws the OLED with (`/usr/share/fonts` on the Pi; license in `fonts/LICENSE-DejaVu.txt`). A PC has
  none, and Pillow's own font would draw another picture - `oled_virtual.py` puts these first in `render.py`'s list of fonts.
- `require-shim.mjs`: the server loads the extensions with `require()`, which a module under `tsx` does not have.

## Sending a button press

The OLED's action "Adresse der Box zeigen" has a button on the virtual box's page. The same call from the command line:

    curl -X POST http://localhost:8210/address

For the player: `curl -X POST "http://localhost:8210/command?c=next"` (`pause`, `play`, `previous`, `stop`, `+5`, `-5`, `shuffleon`,
`repeaton`, `musicsearch/library/album/music:Radio Hits` ...).

Hinweis: Die Backend-Tests (`npm test` in `src/backend-api`) laufen im selben Ordner `src/backend-api/config` und schalten die Erweiterungen der virtuellen Box dabei ab („require is not defined“). Danach die virtuelle Box neu starten.
