# Synology Photos

On a Synology NAS with **Synology Photos**, the box can show albums. It signs in with an account of its own and shows that account's albums and all albums shared with it.

## Preparing in DSM

Best create an account just for the box. Then it sees only what you share with it on purpose.

1. In DSM under **Control Panel › User & Group**, create an account, "mupibox" for example, **without** two-factor sign-in.
2. For the account, allow the app **Synology Photos** under **Edit › Applications**.
3. In Synology Photos, open an album, choose **Share** and invite the account as a **viewer**. A public link is not needed.

## Connecting

Under **Library › Photos › Connect a photo service › Synology Photos**, an assistant leads through three steps:

1. **Sign-in**: the **DSM address** (as in the browser, usually `https://192.168.1.10:5001`; without one the box takes https and port 5001), **Username** and **Password**.
2. **Test**: if the NAS uses its own, self-issued certificate, the box shows its fingerprint. Compare it with the one on the NAS or in the browser via the padlock, and only if they match tap **Trust and test**. Then the test shows the account, the albums, how many of them are shared, and the number of photos and videos.
3. **Albums**: tick the albums and tap **Done**.

The password is kept encrypted on the box and never shown again. It applies only to the address and the account it was entered for. **Change sign-in** on the Synology Photos page opens the assistant again. If the certificate is renewed on the NAS, the box asks again at the next test.

| Message in the test | What to do |
| --- | --- |
| **Sign-in refused** | check username and password, and whether the account is active |
| **Synology Photos not allowed** | allow the app for the account in DSM (see above) |
| **Second confirmation required** | use an account without two-factor sign-in |
| **Box blocked by DSM** | unblock the box's address in DSM under **Security › Protection › Auto Block** |
| **DSM not reachable** | check address, port and firewall; the box must reach DSM (not the WebDAV port) |

> [!NOTE]
> When DSM refuses the sign-in, the box does not try again with the same data for 10 minutes, so that DSM does not block it. Only **Test connection** asks at once.

Synology Photos gives clips only as their original, often 4K from a phone. So the box converts them itself, and **videos are there only with "Keep photos on the box"**. Live, it shows only the photos ([Photo services: keep or live](speichern-oder-live.md)).
