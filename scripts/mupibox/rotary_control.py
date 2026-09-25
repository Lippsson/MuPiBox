#!/usr/bin/python3
# Rotary encoder for the volume, with push button (KY-040 style).
#   GPIO 24 = encoder A (CLK), GPIO 26 = encoder B (DT), GPIO 10 = push button (to GND)
# Turning changes the volume by rotary.step percent per detent (the player keeps the max volume and the display in sync), the push button
# does what is chosen in the admin interface (rotary.button in mupiboxconfig.json, read again on every press).

import json
import queue
import threading
import time
import urllib.request

import RPi.GPIO as GPIO

CONFIG = "/etc/mupibox/mupiboxconfig.json"
PLAYER = "http://localhost:5005"
PIN_A = 24
PIN_B = 26
PIN_BUTTON = 10

# Gray code: previous state (A<<1|B) and new state -> +1 clockwise (A falls first while B is high, as on a KY-040),
# -1 counter clockwise, 0 bounce / invalid. A rotary turning the wrong way: swap the A and B wires.
TRANSITIONS = {
    (3, 1): 1, (1, 0): 1, (0, 2): 1, (2, 3): 1,
    (3, 2): -1, (2, 0): -1, (0, 1): -1, (1, 3): -1,
}
STEPS_PER_DETENT = 4

commands = queue.Queue()


def player(command):
    try:
        with urllib.request.urlopen("%s/%s?src=rotary" % (PLAYER, command), timeout=3) as response:
            return response.read()
    except Exception as error:
        print("player call %s failed: %s" % (command, error), flush=True)
        return None


def worker():
    while True:
        player(commands.get())


def rotary_config():
    try:
        with open(CONFIG) as file:
            return json.load(file).get("rotary", {})
    except Exception:
        return {}


def button_function():
    return rotary_config().get("button", "off")


def volume_step():
    # percent per detent (1..10), read again on every turn so a change in the admin interface takes effect at once
    try:
        return min(10, max(1, int(rotary_config().get("step", 5))))
    except (TypeError, ValueError):
        return 5


def playing():
    body = player("local")
    try:
        return bool(json.loads(body).get("playing"))
    except Exception:
        return False


def button_pressed():
    action = button_function()
    if action == "playpause":
        commands.put("pause" if playing() else "play")
    elif action == "next":
        commands.put("next")
    elif action == "ffwd":
        commands.put("seek+30")


def main():
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    for pin in (PIN_A, PIN_B, PIN_BUTTON):
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    threading.Thread(target=worker, daemon=True).start()

    state = (GPIO.input(PIN_A) << 1) | GPIO.input(PIN_B)
    accumulated = 0
    button_down = GPIO.input(PIN_BUTTON) == 0
    print("rotary control started (A=%d B=%d button=%d)" % (PIN_A, PIN_B, PIN_BUTTON), flush=True)

    # Polling instead of edge callbacks: no lost edges under load, and it survives GPIO libraries without callbacks
    while True:
        new_state = (GPIO.input(PIN_A) << 1) | GPIO.input(PIN_B)
        if new_state != state:
            accumulated += TRANSITIONS.get((state, new_state), 0)
            state = new_state
            if accumulated >= STEPS_PER_DETENT:
                commands.put("+%d" % volume_step())
                accumulated = 0
            elif accumulated <= -STEPS_PER_DETENT:
                commands.put("-%d" % volume_step())
                accumulated = 0
            if state == 3 and abs(accumulated) < STEPS_PER_DETENT:
                accumulated = 0  # resting position without a full detent: it was a bounce

        pressed = GPIO.input(PIN_BUTTON) == 0
        if pressed and not button_down:
            time.sleep(0.03)  # debounce
            if GPIO.input(PIN_BUTTON) == 0:
                button_down = True
                button_pressed()
        elif not pressed:
            button_down = False
        time.sleep(0.001)


if __name__ == "__main__":
    try:
        main()
    finally:
        GPIO.cleanup()
