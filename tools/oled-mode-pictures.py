#!/usr/bin/env python3
"""The pictures above the buttons of "Anzeige beim Spielen" (Voll, Mix, Kompakt) on the OLED extension's page: what the display shows in
each mode, drawn by the extension's own render.py with the font of the box (DejaVu Sans Mono, tools/virtual-box/fonts) - so they cannot
differ from the display. Run it again after a change of a layout:

    python tools/oled-mode-pictures.py        ->  extensions/oled/images/mode-full.svg, mode-mix.svg, mode-lite.svg, status-bar.svg

(status-bar.svg: the top row of the full mode with all its symbols, in three rows that together show every symbol it can have.)

They are vector pictures: every point of the display is a square of the same size, whatever width the app shows the picture in (a picture
of points would have points of different sizes at a width that is no multiple of its own).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, '..', 'extensions', 'oled')
FONTS = os.path.join(HERE, 'virtual-box', 'fonts')
sys.path.insert(0, EXT)

import render  # noqa: E402

# (the box has this font from the system: the same file here)
render.FONT_CANDIDATES = (os.path.join(FONTS, 'DejaVuSansMono.ttf'),) + tuple(render.FONT_CANDIDATES)
render.BOLD_CANDIDATES = (os.path.join(FONTS, 'DejaVuSansMono-Bold.ttf'),) + tuple(render.BOLD_CANDIDATES)

BORDER = 3  # (in points of the display)
LIT = '#cceaff'
FRAME = '#141418'
# (a demo of the display: no battery, the speaker, the best wireless signal, a medium of the demo library)
STATE = {'view': 'play', 'title': 'Lieder vom Mond', 'artist': 'Lumi', 'album': 'Gute-Nacht-Lieder', 'playing': True, 'elapsed': 83, 'duration': 190,
         'track': 3, 'tracks': 7, 'volume': 40, 'wifi': 4, 'output': 'speaker', 'timeMode': 'up'}


def svg(image):
    """The picture (1 bit) as an SVG: the lit points as runs of squares in one path (no grid between the points: at the size the app shows it
    a point is a pixel or two, and a grid would only make some of them look smaller than others)."""
    image = image.convert('L')
    width, height = image.size
    pixels = image.load()
    runs = []
    for y in range(height):
        x = 0
        while x < width:
            if pixels[x, y]:
                start = x
                while x < width and pixels[x, y]:
                    x += 1
                runs.append('M%d %dh%dv1h-%dz' % (start, y, x - start, x - start))
            else:
                x += 1
    total_w, total_h = width + 2 * BORDER, height + 2 * BORDER
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" width="%d" height="%d">\n'
        '<rect x="%d" y="%d" width="%d" height="%d" rx="1.5" fill="%s"/>\n'
        '<rect width="%d" height="%d" fill="#000"/>\n'
        '<path fill="%s" d="%s"/>\n'
        '</svg>\n'
    ) % (-BORDER, -BORDER, total_w, total_h, total_w * 4, total_h * 4, -BORDER, -BORDER, total_w, total_h, FRAME, width, height, LIT, ''.join(runs))


# the top row of the full mode in three states that together show every symbol: wireless, battery, repeat (the whole list), shuffle,
# the volume with the speaker - the wired network, the headphones, the (i) of the network page - no wireless, Bluetooth, repeat of one track
STATUS_ROWS = (
    {'view': 'play', 'wifi': 4, 'battery': 80, 'repeat': 'all', 'shuffle': True, 'volume': 40, 'output': 'speaker'},
    {'view': 'info', 'lan': True, 'battery': 35, 'repeat': 'track', 'volume': 100, 'output': 'headphone', 'ssid': '', 'ip': '', 'version': ''},
    {'view': 'play', 'wifi': -1, 'battery': 5, 'shuffle': True, 'volume': 5, 'output': 'bluetooth'},
)


def status_bar_picture():
    """The three states of the top row, one above the other, as one picture."""
    from PIL import Image
    height, gap = 9, 5
    image = Image.new('1', (128, len(STATUS_ROWS) * height + (len(STATUS_ROWS) - 1) * gap), 0)
    for i, state in enumerate(STATUS_ROWS):
        screens = render.Screens(128, 64)
        row = screens.render({**STATE, 'mode': 'full', **state}, 0).crop((0, 0, 128, height))
        image.paste(row, (0, i * (height + gap)))
    return image


def main():
    target = os.path.join(EXT, 'images')
    with open(os.path.join(target, 'status-bar.svg'), 'w', encoding='utf8', newline='\n') as handle:
        handle.write(svg(status_bar_picture()))
    print('status-bar.svg')
    for mode in ('full', 'mix', 'lite'):
        screens = render.Screens(128, 64)
        with open(os.path.join(target, 'mode-%s.svg' % mode), 'w', encoding='utf8', newline='\n') as handle:
            handle.write(svg(screens.render({**STATE, 'mode': mode}, 0)))
        print('mode-%s.svg' % mode)


if __name__ == '__main__':
    main()
