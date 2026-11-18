# NFC: Rotary knob

A tag can start not just one album but a **whole artist cover**: all albums of an artist in the library, a **folder of the SD card** or a **folder on the NAS**. The tag then plays **one** album of it, and with the **rotary knob** (KY-040) you switch through the others.

## Assigning a tag to an artist cover

1. In the library open the **artist** (or the folder), not a single album. It has to have at least two albums.
2. Tap **NFC tag** and lay on the tag (just as for an album, see [Linking a tag to an album](nfc-tag-zuordnen.md)).

The tag carries the name of the artist cover. The first time it is laid on, it plays the **first album** of the list (sorted by name).

## Which album plays when the tag is laid on

On the **Assigned tags** page ([Assigned tags](nfc-zugeordnete-tags.md)) the tile of such a tag has a **drop-down list**: **Album when the tag is laid on**. Choose the album the tag is to play when it is laid on. The list shows all albums of the artist cover; what is no longer on the box is missing.

## Choosing another album with the rotary knob

After such a tag is laid on, the rotary knob takes over the choice of the album for a while:

| You | The box |
| --- | --- |
| **turn right** | goes to the **next** album of the list (after the last comes the first) |
| **turn left** | goes to the **previous** album |
| **press the button** | **plays** the album the knob is on |

The knob **changes nothing** about the tag: the next time it is laid on, it plays the album from the drop-down list again.

A press **before** you have turned does not choose anything: it does what the button does otherwise (see [Rotary knob and button](../hardware/drehregler.md)). If nobody turns, the choice ends after the set time and the knob sets the **volume** again. Every turn starts the time anew.

## OLED display

If the [OLED display](oled.md) is connected, turning shows **in the information area** the artist (or folder) and below it the **name** of the album the knob is on, with its place in the list ("< 2/12 >"). Long names scroll. The status bar and the bottom row with the time stay, they show what is still playing. A press on the button plays the album, and the display shows the **normal player picture** again.

## Settings

**Settings › NFC extension › Rotary knob**. Below the settings are the **connections of the rotary knob** (pins A, B and button, plus the step size and the function of the button), which are also under **Settings › Rotary knob**: you set them here or there, it is the same setting.

| Setting | Effect |
| --- | --- |
| **Rotary knob chooses the album** | Off: the rotary knob only sets the volume, as before. |
| **Active after laying on (seconds)** | A slider from **0 to 120 seconds** (default 20): for this long after laying on, and after each turn, the knob chooses albums, then it sets the volume again. **0** means **always active**: the knob chooses albums until you choose one with the button or lay on another tag. The OLED display then shows the name for up to five minutes after the last turn. |

## What it takes

- The **rotary knob** is set up: its pins are on this page or under **Settings › Rotary knob** ([Rotary knob and button](../hardware/drehregler.md)).
- Its **button** has a **pin of its own**. GPIO 10, the default, belongs to an NFC reader on the SPI connection: the button does nothing there. Choose another pin in the settings of the rotary knob. The function of the button can be **Off**; as long as the NFC extension has the knob, it uses it all the same.
- The artist cover has **at least two** albums. With a single one there is nothing to choose.

## If it does not work

- The knob still sets the volume: the time after laying on is over (lay the tag on again), **Rotary knob chooses the album** is off, or the artist cover has only one album.
- The button chooses nothing: you have to **turn** first; and the pin of the button must not be one of an NFC reader.
- The drop-down list is missing in the tile: the box could not read the albums (the NAS is not reachable, the folder is gone). It comes back when the albums can be read.
