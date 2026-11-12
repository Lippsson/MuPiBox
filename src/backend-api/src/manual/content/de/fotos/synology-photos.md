# Synology Photos

Auf einem Synology-NAS mit **Synology Photos** kann die Box Alben zeigen. Sie meldet sich mit einem eigenen Konto an und zeigt dessen Alben und alle Alben, die mit ihm geteilt sind.

## In DSM vorbereiten

Am besten legst du ein Konto nur für die Box an. Dann sieht sie nur, was du ausdrücklich mit ihr teilst.

1. In DSM unter **Systemsteuerung › Benutzer und Gruppe** ein Konto anlegen, zum Beispiel „mupibox“, **ohne** Zwei-Faktor-Anmeldung.
2. Beim Konto unter **Bearbeiten › Anwendungen** die App **Synology Photos** erlauben.
3. In Synology Photos ein Album öffnen, **Teilen** wählen und das Konto als **Betrachter** einladen. Ein öffentlicher Link ist nicht nötig.

## Verbinden

Unter **Bibliothek › Fotos › Foto-Dienst verbinden › Synology Photos** führt ein Assistent durch drei Schritte:

1. **Anmeldung**: die **DSM-Adresse** (wie im Browser, meist `https://192.168.1.10:5001`; ohne Angabe nimmt die Box https und Port 5001), **Benutzername** und **Passwort**.
2. **Test**: Nutzt das NAS sein eigenes, selbst ausgestelltes Zertifikat, zeigt die Box dessen Fingerabdruck. Vergleiche ihn mit dem im NAS bzw. im Browser über das Schloss-Symbol und tippe nur bei Übereinstimmung auf **Vertrauen und testen**. Danach zeigt der Test Konto, Alben, davon geteilte, und die Anzahl der Fotos und Videos.
3. **Alben**: die Alben anhaken und **Fertig**.

Das Passwort wird verschlüsselt auf der Box gespeichert und nie wieder angezeigt. Es gilt nur für die Adresse und das Konto, für die es eingegeben wurde. **Anmeldung ändern** auf der Seite von Synology Photos öffnet den Assistenten erneut. Wird das Zertifikat auf dem NAS erneuert, fragt die Box beim nächsten Test wieder nach.

| Meldung beim Test | Was tun |
| --- | --- |
| **Anmeldung abgelehnt** | Benutzername und Passwort prüfen, und ob das Konto aktiv ist |
| **Synology Photos nicht erlaubt** | dem Konto in DSM die App erlauben (siehe oben) |
| **Zweite Bestätigung verlangt** | ein Konto ohne Zwei-Faktor-Anmeldung nehmen |
| **Box von DSM gesperrt** | in DSM unter **Sicherheit › Schutz › Automatische Blockierung** die Adresse der Box wieder freigeben |
| **DSM nicht erreichbar** | Adresse, Port und Firewall prüfen; die Box muss DSM erreichen (nicht den WebDAV-Port) |

> [!NOTE]
> Lehnt DSM die Anmeldung ab, versucht es die Box mit denselben Daten 10 Minuten lang nicht erneut, damit DSM sie nicht sperrt. Nur **Verbindung testen** fragt sofort.

Clips liefert Synology Photos nur im Original, oft 4K vom Handy. Die Box wandelt sie deshalb selbst um, und **Videos gibt es nur mit „Fotos auf der Box speichern“**. Live zeigt sie nur die Fotos ([Foto-Dienste: speichern oder live](speichern-oder-live.md)).
