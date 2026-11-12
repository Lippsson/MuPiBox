# Users

With the extension **User**, several children share one box: every user has **their own settings** and **their own library**. It sets up nothing on the box.

## What each user has and what all share

| Each user's own | Shared by all |
| --- | --- |
| settings: theme, volumes, start page, playtime, quiet times and more | the Spotify login |
| the library with albums, resume positions and offline lists | Wi-Fi and network, NAS |
| the listening history | hardware: fan, battery, LEDs, rotary knob |
| the settings of the other extensions | the parent password and the name of the box |

## Adding users

After [installing](installieren.md) the extension, open the details of the card **User** under **Settings › System › Extensions**:

- **Add**: enter a name, choose under **Library** and tap **Add**. A new user starts with the settings of whoever adds them, and either with an **empty library** or a **copy of the library** of another user. The copy is independent afterwards: changes to one do not change the other.
- **Colour**: every user has a colour, which you can change in the list.
- **Switch**: switches to that user.
- **Delete**: puts the user with their settings and library into the **trash**. The list shows for every user how many entries their library has. The active user and the last user cannot be deleted.

### Trash

Deleted users are listed under **Trash** and can be **restored for 30 days**, with their settings and library. After that they are gone for good. If the name has been taken meanwhile, the restored user gets a number after it, “Standard (2)” for example. The trash is not part of the [backup](../wartung/backup.md).

> [!IMPORTANT]
> The user **Standard** has the library the box had before the extension. If it is deleted and not taken back from the trash, that library is gone. For a new user to get it, add them as a **copy of the library of “Standard”**.

## Switching

At the top of the display, a **dot in the user's colour** shows who is signed in. A tap on it opens the overview with the names; switching there works as set under **Switch on the display**.

When switching, **playback stops**, the box loads the other user's settings and library and **restarts briefly**. That takes about half a minute.

| Setting | Effect |
| --- | --- |
| **Switch on the display** | **Freely, with a tap**: a tap on a name switches (default). **By holding**: hold the name as long as the settings are opened on the display; a bar shows how long is left. **Only in the web app**: the dot only shows who is signed in |

Every user has their **own play time and quiet hours**, with today's count. Whoever switches to another user on the display goes on listening with that user's play time.

> [!TIP]
> If a child should not be able to switch to another child's user, choose **By holding** or **Only in the web app**. In the app, switching is protected by the parents' sign-in.

## Switching off or removing

The multi-user mode is an extension. Under **Settings › System › Extensions** it can be switched off or removed.

- The box keeps the settings and the library of the user who is **active at that moment**. To the box that is simply its library then; without the extension there are no users any more.
- The other users, their trash and the list stay on the card, also when the extension is removed. Installed or switched on again, everybody is back, and the active one is whoever was last, with whatever the box got into its library meanwhile.

> [!TIP]
> If a certain library should stay, switch to that user before switching the extension off.

## Good to know

- Because the Spotify login applies to all, one Spotify account is enough. Which albums and playlists appear on the box, however, each user decides in their own library.
- A [backup](../wartung/backup.md) keeps all users with their settings and libraries. A backup before adding the first user still does no harm.
