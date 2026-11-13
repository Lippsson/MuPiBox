# NFC reader

The **NFC reader** extension connects an **NFC reader** to the box. The first reader it supports is the **PN5180** (NXP) on the SPI port of the Raspberry Pi. It reads the **UID** of tags and cards when one comes close and when it is taken away. The settings show whether the reader is running and which tag was read last. What a tag starts (an album, say) comes next.

The PN5180 reads both worlds: **ISO 14443 A** (NTAG, MIFARE and most cards and stickers) and **ISO 15693** (ICODE, SLIX).

After the [installation](installieren.md) the settings are under **Settings › System › NFC-Reader**.

## Wiring

Wire with the box switched off. The PN5180 needs **both** supplies: **5 V** for the transmitter of the antenna and **3.3 V** for the logic. The signals are 3.3 V, no level shifter is needed.

| PN5180 | Raspberry Pi | Pin of the header |
| --- | --- | --- |
| 5V | 5 V | 2 |
| 3.3V | 3.3 V | 1 |
| GND | ground | 6 |
| SCK | GPIO 11 (SPI SCLK) | 23 |
| MOSI | GPIO 10 (SPI MOSI) | 19 |
| MISO | GPIO 9 (SPI MISO) | 21 |
| NSS | GPIO 8 (SPI CE0) | 24 |
| BUSY | GPIO 25 (suggestion) | 22 |
| RST | GPIO 23 (suggestion) | 16 |
| IRQ, GPIO, AUX, REQ | leave open | – |

The pins **SCK, MOSI, MISO and NSS** are fixed by the SPI port. You choose **BUSY and RST** in the settings; GPIO 25 and GPIO 23 are free on most boxes, and the choice locks pins that are taken. The PN5180 tells through BUSY when it is ready; it does not work without it. The IRQ pin is not needed, the extension asks the chip.

> [!WARNING]
> The box's **rotary encoder** uses GPIO 10 for its button, which is also MOSI of the SPI port. With the rotary encoder switched on the reader cannot be used.

Short wires help (up to about 15 cm), ideally with an extra ground wire. The labels differ from board to board: check the labels on yours, especially 5V and 3.3V. The whole header is shown in the appendix [GPIO assignment](../anhang/gpio.md).

## Switching SPI on

SPI is off on a fresh box. Switch it on

- in `dietpi-config` under **Advanced Options › SPI state**, or
- by adding the line `dtparam=spi=on` to `config.txt` (`/boot/firmware/config.txt`; older systems: `/boot/config.txt`).

Then **restart** the box. The device `/dev/spidev0.0` is there afterwards.

## Settings

| Setting | Effect |
| --- | --- |
| **Type** | **No reader** (default) or **PN5180** |
| **NSS on** | the chip select NSS is wired to: **CE0** (pin 24, default) or **CE1** (pin 26) |
| **GPIO pin BUSY**, **GPIO pin RST** | the pins for the two lines; two different ones |
| **Detect** | **Both** (default), only **ISO 14443 A** or only **ISO 15693** |

Every change takes effect at once. A restart is not needed.

## Status

The **Status** card at the top of the page shows how far the reader has come and updates itself:

| Display | Meaning |
| --- | --- |
| **Reader: Off** | no reader chosen |
| **Ready**, **Firmware PN5180 4.0** | the chip answers; the version number comes from the chip itself. Wiring and SPI are right |
| **Tag in the field** | a tag is on the reader right now |
| **Last tag** | the UID (for example `04:A1:B2:C3:D4:E5:F6`) and the kind of tag |

If the reader is not ready, **Note** says what to check:

| Note | What to do |
| --- | --- |
| Please choose the pins BUSY and RST | set two different pins |
| SPI is off: add dtparam=spi=on to config.txt, then restart | add `dtparam=spi=on` and restart (see above) |
| No access to the SPI bus | install the extension again, it sets the access rule for `/dev/spidev` |
| The packages python3-spidev and python3-lgpio are missing | install the extension again (it loads the packages) |
| The pins BUSY and RST cannot be used | another program holds the pin; choose another |
| BUSY does not react: check BUSY, RST and the power supply | check BUSY, RST and both supplies (5 V and 3.3 V) |
| The reader does not answer: check MISO, MOSI, SCK, NSS and the power supply | check the wires and ground, and whether the reader has both supplies |

The extension runs as a program in the background and starts itself again after an error, after a few seconds first, then more slowly. Messages are in the box's log (`pm2 logs server`, lines with `[nfc]`).
