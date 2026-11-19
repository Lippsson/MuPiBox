#!/usr/bin/env python3
"""The pictures above the buttons of "Anzeige beim Spielen" (Voll, Mix, Kompakt) on the OLED extension's page: what the display shows in
each mode, drawn by the extension's own render.py - so they cannot differ from the display. Run it again after a change of a layout:

    python tools/oled-mode-pictures.py        ->  extensions/oled/images/mode-full.png, mode-mix.png, mode-lite.png
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, '..', 'extensions', 'oled')
sys.path.insert(0, EXT)

from PIL import Image  # noqa: E402

import render  # noqa: E402

SCALE = 3
BORDER = 6
LIT = (204, 234, 255)
# (a demo of the display: no battery, the speaker, a medium of the demo library)
STATE = {'view': 'play', 'title': 'Lieder vom Mond', 'artist': 'Lumi', 'album': 'Gute-Nacht-Lieder', 'playing': True, 'elapsed': 83, 'duration': 190,
         'track': 3, 'tracks': 7, 'volume': 40, 'wifi': 3, 'output': 'speaker', 'timeMode': 'up'}


def dots(shot):
    shot = shot.convert('L')
    w, h = shot.size
    out = Image.new('RGB', (w * SCALE + 2 * BORDER, h * SCALE + 2 * BORDER), (20, 20, 24))
    out.paste(Image.new('RGB', (w * SCALE, h * SCALE), (0, 0, 0)), (BORDER, BORDER))
    px = out.load()
    for y in range(h):
        for x in range(w):
            if shot.getpixel((x, y)):
                for dy in range(1, SCALE):
                    for dx in range(1, SCALE):
                        px[BORDER + x * SCALE + dx, BORDER + y * SCALE + dy] = LIT
    return out


def main():
    target = os.path.join(EXT, 'images')
    for mode in ('full', 'mix', 'lite'):
        screens = render.Screens(128, 64)
        picture = dots(screens.render({**STATE, 'mode': mode}, 0))
        picture.save(os.path.join(target, 'mode-%s.png' % mode), optimize=True)
        print('mode-%s.png' % mode)


if __name__ == '__main__':
    main()
