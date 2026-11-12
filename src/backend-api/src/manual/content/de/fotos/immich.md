# Immich

[Immich](https://immich.app) ist ein Fotodienst, den du selbst betreibst, etwa auf einem NAS oder Heimserver. Die Box zeigt deine Immich-Alben und alle Alben, die mit deinem Konto geteilt sind. Sie braucht Immich ab Version 1.106.

## API-Schlüssel anlegen

1. Immich im Browser öffnen und anmelden.
2. Oben rechts aufs Profilbild › **Kontoeinstellungen** › **API-Schlüssel** › **Neuer API-Schlüssel**.
3. Name „MuPiBox“ eingeben. Fragt Immich nach Rechten, nur diese anhaken: `album.read`, `asset.read` und `asset.view`. Mit `user.read` zeigt der Test zusätzlich deinen Kontonamen.
4. Den Schlüssel sofort kopieren: Immich zeigt ihn nur einmal.

## Verbinden

Unter **Bibliothek › Fotos › Foto-Dienst verbinden › Immich** führt ein Assistent durch vier Schritte:

1. **Adresse**: die Adresse deines Immich mit Port, zum Beispiel `http://192.168.1.20:2283`.
2. **Schlüssel**: den API-Schlüssel einfügen.
3. **Test**: Die Box prüft Server, Version, Schlüssel und Rechte und zeigt Konto, Alben und Anzahl der Fotos und Videos.
4. **Alben**: die Alben anhaken, die am Display erscheinen sollen, und **Fertig**.

Der Schlüssel wird verschlüsselt auf der Box gespeichert und nie wieder angezeigt. Er gilt nur für die Adresse, für die er eingegeben wurde.

| Meldung beim Test | Was tun |
| --- | --- |
| **Server nicht erreichbar** | Adresse und Port prüfen; die Box muss Immich im Heimnetz erreichen |
| **Schlüssel ungültig** | den ganzen Schlüssel kopieren, notfalls einen neuen anlegen |
| **Rechte fehlen** | einen Schlüssel mit `album.read`, `asset.read` und `asset.view` anlegen |
| **Immich-Version zu alt** | Immich aktualisieren |

Auf der Seite von Immich änderst du danach Alben, Abgleich, Zwischenspeicher, Adresse und Schlüssel. Ob die Box die Fotos speichert oder live holt, steht unter [Foto-Dienste: speichern oder live](speichern-oder-live.md).
