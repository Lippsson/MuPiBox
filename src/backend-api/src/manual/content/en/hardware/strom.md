# Battery, MuPiHAT and power button

Under **Settings › Battery & Power** you find everything about the power supply.

## Battery display

**Settings › Battery & Power › Battery** shows the charge level, the voltage and the history of the last 24 hours. The display shows the level in the status indicator.

### Charging and the time until full

While the battery charges, the charger holds the voltage up. From the voltage alone the battery would therefore be “full” at once. While charging, the box calculates differently:

- It remembers the level **from before the cable was plugged in** and adds the **charge that has gone in** (current times time). The percentage then rises with the charge instead of jumping to 100 % at once. Only when the charger chip declares the charge finished itself does it show 100 %.
- The **time until full** is shown under the percentage (“full in about 2 h 10 min”) and as a row of its own. It is the remaining charge divided by the current charging current. Towards the end, when the current slowly falls off (constant-voltage phase), it is calculated from the measured fall.
- If the charge was already running when the box (the service) started, it does not know the level from before. A note under the percentage then says the **starting value is only estimated from the voltage**. It is corrected at the change to the constant-voltage phase (about 85 %) and at the end of the charge.
- For the calculation the box needs the battery's **capacity**. For the ready-made profiles it reads the size from the name (for example “10.000mAh”). For a custom profile you enter it under **Charging › Capacity**. Without a capacity there is no time until full.

> [!NOTE]
> The time is an estimate. It changes with the charging current: if the box is running while it charges (display, music), less current is left for the battery and the time gets longer. An old battery holds less than printed. If the current becomes very small, the box names no time.

## MuPiHAT and battery profile

The **MuPiHAT** is a board with battery management that is plugged onto the Raspberry Pi. Under **MuPiHAT & battery profile** you set:

| Setting | Meaning |
| --- | --- |
| **MuPiHAT active** | switches the support on. Switching it also changes the sound card and restarts the box |
| **Battery** | the profile of your battery: Ansmann 2S1P, ENERpower 2S2P 10.000mAh, ENERpower 2S3P 15.000mAh, **USB-C operation (without battery)** or **Custom profile** |

Below it are the voltages of the chosen profile in millivolts. You can change them and apply them with **Save profile**; the MuPiHAT service restarts for this. If none of the profiles fits your battery, choose **Custom profile**. With **USB-C operation (without battery)** there are no voltages and no charge curve.

| Card | Value | Range |
| --- | --- | --- |
| **Charge curve** | **Empty**, **25 %**, **50 %**, **75 %**, **Full** (v_0 to v_100): the voltage at this charge level. The values rise from “Empty” to “Full” | 5000–9000 each |
| **Thresholds** | **Warning from**: from this voltage the box warns | 5500–8000 |
| **Thresholds** | **Shut down at**: from this voltage the box switches itself off. Must be below the warning | 5000–7500 |
| Charging | **Charge cutoff** (VREG, optional): the voltage at which charging ends. Empty = the charger chip's default | 6000–8400 |

> [!WARNING]
> **The charge cutoff (VREG) is safety-critical.** With two cells in series at most 8400 mV are allowed (4.2 V per cell). Higher damages the battery; the app does not accept a higher value. Change it only if you know what you are doing.

If the battery is empty, the box switches itself off, and the display first shows the “battery empty” picture ([Covers and themes](../bedienung/cover-und-themes.md)). With Telegram you also get a message when the battery is almost empty ([Telegram](../netzwerk/telegram.md)).

## Automatic shutdown

**Settings › Battery & Power › Automatic shutdown**: The box switches itself off when nobody is listening. Adjustable from 0 to 300 minutes in steps of five. **0 means never**, that is how it is set after installation. The box checks every 10 seconds whether something is playing.

## Power button and LED

With an **OnOff SHIM** (on/off button with status LED) you switch the box on and off cleanly. Under **Power switch and LED**:

| Setting | Effect |
| --- | --- |
| **Delay of the shutdown button** | how long you hold the button until the box goes off, 0 to 5 seconds (2 after installation). Applies after a restart |
| **LED pin (OnOffShim)** | the GPIO pin of the LED (13 after installation). Applies after a restart |
| **LED brightness normal** | brightness in operation, 0 to 100 % |
| **LED brightness dimmed** | brightness when dimmed, 0 to 100 % |

When switching off, the display shows the goodbye picture, a sound plays, and the LED fades out slowly. If music is playing, it is paused first.

If the box hangs when switching off and does not go off, read [The box hangs when shutting down](../fehlerbehebung/haengt-beim-ausschalten.md).
