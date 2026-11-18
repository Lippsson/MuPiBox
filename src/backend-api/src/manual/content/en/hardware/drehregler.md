# Rotary knob and button

A **rotary knob with button** (rotary encoder in the style of the KY-040) makes the volume easy to reach for children's hands. You switch it on in the app under **Settings › Audio › Rotary knob and button**.

> [!NOTE]
> If the extension [Buttons & GPIO Input](../erweiterungen/buttons.md) is switched on, this setting is under **Settings › Buttons & GPIO Input** instead, as the card **Rotary knob**. With the extension you can also connect any number of further buttons.

## Connection

| Rotary knob connection | GPIO pin of the Raspberry Pi |
| --- | --- |
| A (CLK) | **26** (default) |
| B (DT) | **24** (default) |
| Button | **10** (default; the button switches to GND) |

The three pins are the default after installation. You can change them in the settings (see below), for example when a pin is already needed for something else. If the knob turns the wrong way, swap connections A and B.

## Settings

| Setting | Effect |
| --- | --- |
| **Rotary knob for the volume** | switches the knob on (after installation it is off) |
| **Step per detent** | how many percent each detent changes the volume, 1 to 10 (default 5) |
| **GPIO pin A (CLK)**, **GPIO pin B (DT)**, **GPIO pin (button)** | the pins the knob is connected to (see "Changing the pins") |
| **Function of the button (GPIO …)** | **Off**, **Play/Pause**, **Next track**, **Track selection (press to switch)** or **Fast-forward** |

The volume **maximum** (**Audio › Volume › Maximum (hearing protection)**) also applies to the knob: it never turns louder than allowed ([Sound and volume](sound.md)). The choice of button behaviour and the step size take effect at once. Switching the knob on and off restarts its service.

## Changing the pins

The three lists offer **only pins that suit the rotary knob and are free**: all pins of the header that nothing else uses. Not offered are pins of the box itself (power button, LED, fan, MuPiHAT), pins the boot configuration takes (for example I²C, SPI or the sound card), pins of extensions and pins a program holds right now. A pin that one of the three connections already has is no longer offered in the other two lists. The current pin always stays in its list.

A change takes effect at once: if the knob is running, the box restarts its service with the new pins. Rewire the knob first (best with the box switched off) or switch it off for a moment. Switching on checks the pins once more; if one has been taken meanwhile, the knob stays off and the app says who holds the pin. The LED and the fan do not offer the pins of a switched-on knob.

## The button

The rotary encoder takes the button's pin only while the button has a function; with **Off** it stays free for other things. If you choose a function later, the app checks whether the pin is still free. The rotary encoder never takes a pin of the SPI or I²C port (GPIO 10 with an NFC reader, say): the button then does nothing, the encoder itself keeps working.

| Function | One press |
| --- | --- |
| **Play/Pause** | pauses playback or starts it again |
| **Next track** | jumps to the next track |
| **Track selection (press to switch)** | switches the knob between **volume** and **track selection** (see below) |
| **Fast-forward** | jumps 30 seconds ahead |
| **Off** | does nothing |

### Choosing tracks with the knob

If **Track selection (press to switch)** is chosen, the button is a switch:

1. **First press**: the knob now chooses **tracks** instead of the volume. Each detent to the right jumps to the **next track**, each detent to the left to the **previous** one.
2. **Second press**: the knob sets the **volume** again.

Track selection also ends by itself: **10 seconds** after the last press or the last turn. Every turn starts the time again. So if you keep turning, you stay in track selection. The first press itself does not yet jump to the next track.

> [!TIP]
> This is handy for albums with many tracks: jump to the audiobook chapter without looking at the display, then with one press back to the volume.

## Further rotary knobs

Below the first knob there is **Add rotary knob**. Each further knob has a card of its own with:

| Setting | Effect |
| --- | --- |
| **Function of the knob** | **Volume** (each detent changes it by the set **step per detent**) or **Previous / next track** (clockwise the next track, counter-clockwise the previous one) |
| **GPIO pin A (CLK)**, **GPIO pin B (DT)**, **GPIO pin (button)** | the three pins of this knob |
| **Function of the button** | **Off**, **Play/Pause**, **Next track** or **Fast-forward** |
| **Remove knob** | deletes it; its pins are free again |

So you can have, say, one knob for the volume and a second only for the tracks. Up to **four more** are possible as long as enough GPIO pins are free. The lists show only pins nothing else uses, including no other knob. Changing the pins or removing a knob takes effect at once: the box restarts the service.

### Choosing albums with the NFC extension

Choosing **albums** after a tag on an **artist cover** is laid on is done by a knob of its own with its own pins, which you set up with the NFC extension (see [NFC: Rotary knob](../erweiterungen/nfc-drehregler.md)). It is only for that and does not disturb the knobs set here.

## If it does not react

- Is the **Rotary knob for the volume** switch on? The service only starts then.
- Check the wiring of the three pins (default 26, 24 and 10; the chosen ones are in the settings and in the [GPIO assignment](../anhang/gpio.md)).
- If the knob cannot be switched on and the app names a GPIO pin in use, a button of the extension [Buttons & GPIO Input](../erweiterungen/buttons.md) (or something else) has one of the three pins. Choose a free pin.
- A further knob does nothing: check its three pins and whether **Function of the knob** fits. The service never takes pins of the SPI or I²C port.
- The service is called `mupi_rotary` (it serves all knobs of this page).
