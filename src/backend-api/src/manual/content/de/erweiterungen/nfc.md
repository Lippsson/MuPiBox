# NFC-Reader

Die Erweiterung **NFC-Reader** bringt einen **NFC-Leser** an die Box. Der erste unterstützte Leser ist der **PN5180** (NXP) am SPI-Anschluss des Raspberry Pi. Er liest die **UID** von Tags und Karten, im Moment der Annäherung wie beim Entfernen. Die Einstellungen zeigen an, ob der Leser läuft und welches Tag zuletzt gelesen wurde. Was ein Tag auslöst (zum Beispiel ein Album starten), kommt als Nächstes.

Der PN5180 liest beide Welten: **ISO 14443 A** (NTAG, MIFARE und die meisten Karten und Sticker) und **ISO 15693** (ICODE, SLIX).

Nach der [Installation](installieren.md) stehen die Einstellungen unter **Einstellungen › System › NFC-Reader**.

## Anschluss

Verdrahte bei ausgeschalteter Box. Der PN5180 braucht **beide** Versorgungen: **5 V** für die Sendestufe der Antenne und **3,3 V** für die Logik. Die Signale sind 3,3 V, ein Pegelwandler ist nicht nötig.

| PN5180 | Raspberry Pi | Pin der Stiftleiste |
| --- | --- | --- |
| 5V | 5 V | 2 |
| 3.3V | 3,3 V | 1 |
| GND | Masse | 6 |
| SCK | GPIO 11 (SPI SCLK) | 23 |
| MOSI | GPIO 10 (SPI MOSI) | 19 |
| MISO | GPIO 9 (SPI MISO) | 21 |
| NSS | GPIO 8 (SPI CE0) | 24 |
| BUSY | GPIO 25 (Vorschlag) | 22 |
| RST | GPIO 23 (Vorschlag) | 16 |
| IRQ, GPIO, AUX, REQ | frei lassen | – |

Die Pins **SCK, MOSI, MISO und NSS** hat der SPI-Anschluss fest. **BUSY und RST** wählst du in den Einstellungen selbst; GPIO 25 und GPIO 23 sind auf den meisten Boxen frei, die Auswahl sperrt Pins, die schon belegt sind. Der PN5180 meldet über BUSY, wann er bereit ist, ohne BUSY geht es nicht. Der IRQ-Anschluss wird nicht gebraucht, die Erweiterung fragt den Chip ab.

> [!WARNING]
> Der **Drehregler** der Box nutzt GPIO 10 für seinen Taster, das ist auch MOSI des SPI-Anschlusses. Mit eingeschaltetem Drehregler lässt sich der Leser nicht betreiben.

Kurze Leitungen helfen (bis etwa 15 cm), am besten mit einer zusätzlichen Masseleitung. Die Pinbeschriftung der Platinen unterscheidet sich: Prüfe die Beschriftung auf deiner, besonders bei 5V und 3.3V. Die ganze Leiste zeigt der Anhang [GPIO-Belegung](../anhang/gpio.md).

## SPI einschalten

Der SPI-Anschluss ist bei einer frischen Box aus. Einschalten:

- in `dietpi-config` unter **Advanced Options › SPI state**, oder
- die Zeile `dtparam=spi=on` in die `config.txt` eintragen (`/boot/firmware/config.txt`; ältere Systeme: `/boot/config.txt`).

Danach die Box **neu starten**. Dann gibt es das Gerät `/dev/spidev0.0`.

## Einstellen

| Einstellung | Wirkung |
| --- | --- |
| **Typ** | **Kein Leser** (Standard) oder **PN5180** |
| **NSS an** | der Chipselect, an dem NSS hängt: **CE0** (Pin 24, Standard) oder **CE1** (Pin 26) |
| **GPIO-Pin BUSY**, **GPIO-Pin RST** | die Pins für die beiden Leitungen; zwei verschiedene |
| **Erkennen** | **Beide** (Standard), nur **ISO 14443 A** oder nur **ISO 15693** |

Jede Änderung wirkt sofort. Ein Neustart ist nicht nötig.

## Zustand

Die Karte **Zustand** oben auf der Seite zeigt, wie weit der Leser ist, und aktualisiert sich selbst:

| Anzeige | Bedeutung |
| --- | --- |
| **Leser: Aus** | kein Leser gewählt |
| **Bereit**, **Firmware PN5180 4.0** | der Chip antwortet; die Versionsnummer kommt vom Chip selbst. Verdrahtung und SPI stimmen |
| **Tag im Feld** | ein Tag liegt gerade auf dem Leser |
| **Letzter Tag** | die UID (zum Beispiel `04:A1:B2:C3:D4:E5:F6`) und die Art des Tags |

Ist der Leser nicht bereit, steht unter **Hinweis**, was zu prüfen ist:

| Hinweis | Was tun |
| --- | --- |
| Bitte die Pins BUSY und RST wählen | zwei verschiedene Pins einstellen |
| SPI ist aus: dtparam=spi=on in der config.txt, dann neu starten | `dtparam=spi=on` eintragen und neu starten (siehe oben) |
| Kein Zugriff auf den SPI-Bus | die Erweiterung neu installieren, sie legt die Zugriffsregel für `/dev/spidev` an |
| Die Pakete python3-spidev und python3-lgpio fehlen | die Erweiterung neu installieren (sie lädt die Pakete) |
| Die Pins BUSY und RST lassen sich nicht belegen | ein anderes Programm hat den Pin; einen anderen wählen |
| BUSY reagiert nicht: BUSY, RST und die Stromversorgung prüfen | BUSY und RST und beide Versorgungen (5 V und 3,3 V) prüfen |
| Der Leser antwortet nicht: MISO, MOSI, SCK, NSS und die Stromversorgung prüfen | die Leitungen und die Masse prüfen, und ob der Leser beide Versorgungen hat |

Die Erweiterung läuft als Programm im Hintergrund und startet sich nach einem Fehler selbst wieder, zuerst nach wenigen Sekunden, dann langsamer. Meldungen stehen im Protokoll der Box (`pm2 logs server`, Zeilen mit `[nfc]`).
