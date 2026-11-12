# Installing and managing

The page **Settings › System › Extensions** shows the installed extensions as cards and, after them, what else the catalog offers. You can only reach it when signed in as a parent.

## Installing from the catalog

1. Open **Settings › System › Extensions**. The box fetches the catalog from the internet (GitHub).
2. Tap **Install** on the extension you want.
3. The app shows **what the extension sets up on the box** (for example access rights for a device, a service or a package) and **what it needs** (ports, GPIO pins, services). Confirm.

The box downloads the file, checks its checksum and installs it. After that the player, the server and the display restart briefly. **Playback stops when that happens**; the app tells you beforehand.

> [!NOTE]
> If the catalog cannot be reached, the box needs the internet. Installed extensions keep running without it.

## The test before installing

Before anything is installed, the box checks whether what the extension needs is still free: ports, GPIO pins and services. It compares with the box itself (power button, LED, fan, rotary knob, MuPiHAT), with the boot configuration (for example the sound card), with the other extensions and with what is running right now.

If something clashes, **nothing is installed**, and the app says who holds the port or pin. The same test runs when you switch a switched-off extension back on.

## Settings of an extension

From the card of an extension you open its details with the settings. Switches and choices are saved at once, text fields with **Save**.

Some extensions have a **page of their own**: it is then listed under **Settings › System** right after **Extensions**, and the card leads there with **Go to the settings**. [Buttons & GPIO Input](buttons.md) is one of them.

## Switching on and off, removing, updating

| Action | Effect |
| --- | --- |
| **Switch on the card** | switches the extension off or on again. Its settings are kept |
| **Remove** | deletes the extension. The box takes away again what it set up for it (access rules and services; groups and packages stay, because others may need them) |
| **New version** | if the catalog has a newer version, the card says so. If an update fails, the box restores the version before |

Here too the player, the server and the display restart briefly.

## Your own files: developer mode

An extension is a single file ending in `.mpx`. Normally it comes from the catalog. If you build one yourself or have a file from another source, switch on **Developer mode** on the page. Then there is the button **Upload file**:

1. Switch on **Developer mode** and confirm the warning.
2. Tap **Upload file** and choose the `.mpx` file (16 MB at most).
3. The box checks the file but installs nothing yet: the app shows the name, the version, what is set up and the checksum (SHA-256).
4. Confirm with **Install**.

> [!WARNING]
> An extension can do anything on the box, also as administrator. Only upload files you built yourself or whose source you trust. Switch developer mode off again afterwards.

How to build an extension is described in the guideline for developers in the repository (`extensions/README.md`).

## If something does not work

- **"Something else is running right now"**: an extension is already being installed or removed. Wait until that is done.
- **The installation reports a clash**: the app names the port or pin and who holds it. Free it there (for example by moving the fan to another pin) and try again.
- **An extension is missing in the catalog**: not every extension is in the catalog. You install a `.mpx` file from another source in developer mode.
