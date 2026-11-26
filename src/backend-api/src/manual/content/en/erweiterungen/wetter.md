# Weather

The extension **Weather** shows the weather of a place as **dials** on the display: temperature, humidity, wind speed, wind direction, air pressure and rainfall. It sets up nothing on the box; the box gets the values from the internet.

## Setting it up

1. Install the extension under **Settings › System › Extensions** ([Installing and managing](installieren.md)).
2. Under **Settings**, open the page **Weather** and search for the name of your place under **Place**. Tap a result.

Once a place is chosen, the display shows the tab **Weather** at the top. A tap on it opens the dials: always two side by side, and a swipe brings the next ones. The back button in the title bar closes them again.

## Settings

The settings are on a page of their own, **Weather**, under **Settings**, in four cards: **Weather server and place**, **Refresh**, **Units** and **Look of the dials**.

| Setting | Effect |
| --- | --- |
| **Weather server** | **Open-Meteo** provides measured values of the last 24 hours and gusts. With **MET Norway (yr.no)** they are values of the weather model; the rain there is the forecast for the next 24 hours |
| **Place** | search for the name and tap a result |
| **Refresh every …** and **Unit** | how often the open weather view fetches new values, in seconds or minutes (every 10 seconds at least, default every 10 minutes) |
| **Temperature** | °C or °F |
| **Rain** | mm or inches |
| **Air pressure** | hPa, inHg, mb or kPa |
| **Wind speed** | km/h, m/s, mph or knots |
| **Order of the dials** | take a dial by its handle and move it to another place |
| **Frame**, **Background**, **Pointer shape**, **Pointer colour**, **Knob** and **Knob colour** | the [look of the dials](#look-of-the-dials) |

> [!NOTE]
> The weather servers provide new values only about once an hour, and the box asks them once a minute at most. A very short interval therefore does not make the view more accurate.

Both weather servers are free and need no account. The box asks them with the coordinates of the chosen place.

## Look of the dials

The dials are drawn by the **SteelSeries** library, and the names of the frames and backgrounds are those of its developers. With no choice made, the dials look as they always did: frame **Metal**, background **Beige**, pointer shape **1**, pointer colour **Red**, knob **Metal** in **Silver**. You choose in the card **Look of the dials**, and the change applies the next time you open the weather view.

**Frame:** Black Metal, Metal, Shiny Metal, Brass, Steel, Chrome, Gold, Anthracite, Tilted Gray, Tilted Black and Glossy Metal.

![The 11 frames](weather-frames.png)

**Background:** Dark Gray, Satin Gray, Light Gray, White, Black, Beige, Brown, Red, Green, Blue, Anthracite, Mud, Punched Sheet, Carbon, Stainless, Brushed Metal, Brushed Stainless and Turned.

![The 18 backgrounds](weather-backgrounds.png)

**Pointer shape:** 16 shapes, from **1** to **16**. It applies to the round dials; the wind direction keeps its two pointers, a red one for the current value and a blue one for the mean.

![The 16 pointer shapes](weather-pointers.png)

**Pointer colour:** Red, Green, Blue, Orange, Yellow, Cyan, Magenta, White, Gray, Black, Raith, Jug Green and Green LCD.

![The 13 pointer colours](weather-colours.png)

**Knob** and **Knob colour:** the knob in the middle of the dial, **Standard** or **Metal**, in **Black**, **Brass** or **Silver**.

![The knobs](weather-knobs.png)

## If no weather appears

- Is a **place** chosen? Without one there is no **Weather** tab.
- The place search and the values need the internet.
- Is the extension switched on under **Settings › System › Extensions**?
