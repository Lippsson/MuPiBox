# Installieren und verwalten

Die Seite **Einstellungen › System › Erweiterungen** zeigt die installierten Erweiterungen als Karten und dahinter, was der Katalog sonst noch bietet. Sie ist nur mit der Anmeldung der Eltern erreichbar.

## Aus dem Katalog installieren

1. Öffne **Einstellungen › System › Erweiterungen**. Die Box holt den Katalog aus dem Internet (GitHub).
2. Tippe bei der gewünschten Erweiterung auf **Installieren**.
3. Die App zeigt, **was die Erweiterung auf der Box einrichtet** (zum Beispiel Zugriffsrechte für ein Gerät, einen Dienst oder ein Paket) und **was sie braucht** (Ports, GPIO-Pins, Dienste). Bestätige.

Die Box lädt die Datei, prüft ihre Prüfsumme und installiert sie. Danach starten Player, Server und Display kurz neu. **Eine laufende Wiedergabe bricht dabei ab**; die App sagt das vorher.

> [!NOTE]
> Ist der Katalog nicht erreichbar, braucht die Box Internet. Die installierten Erweiterungen laufen auch ohne weiter.

## Der Test vor der Installation

Bevor etwas installiert wird, prüft die Box, ob das, was die Erweiterung braucht, noch frei ist: Ports, GPIO-Pins und Dienste. Verglichen wird mit der Box selbst (Ein-/Aus-Taster, LED, Lüfter, Drehregler, MuPiHAT), mit der Boot-Konfiguration (zum Beispiel der Soundkarte), mit den anderen Erweiterungen und mit dem, was gerade läuft.

Gibt es eine Überschneidung, wird **nichts installiert**, und die App nennt, wer den Port oder Pin belegt. Derselbe Test läuft, wenn du eine ausgeschaltete Erweiterung wieder einschaltest.

## Einstellungen einer Erweiterung

Über die Karte einer Erweiterung öffnest du ihre Details mit den Einstellungen. Schalter und Auswahlen werden sofort gespeichert, Textfelder mit **Speichern**.

Manche Erweiterungen haben eine **eigene Seite**: Sie steht dann unter **Einstellungen › System** direkt nach **Erweiterungen**, und die Karte führt mit **Zu den Einstellungen** dorthin. So ist es bei [Buttons & GPIO Input](buttons.md).

## Ein- und ausschalten, entfernen, aktualisieren

| Aktion | Wirkung |
| --- | --- |
| **Schalter auf der Karte** | schaltet die Erweiterung aus oder wieder ein. Ihre Einstellungen bleiben erhalten |
| **Entfernen** | löscht die Erweiterung. Die Box nimmt wieder weg, was sie für sie eingerichtet hat (Zugriffsregeln und Dienste; Gruppen und Pakete bleiben, weil andere sie brauchen können) |
| **Neue Version** | bietet der Katalog eine neuere Version, steht das auf der Karte. Schlägt eine Aktualisierung fehl, stellt die Box die vorige Version wieder her |

Auch hier starten Player, Server und Display kurz neu.

## Eigene Dateien: der Entwicklermodus

Eine Erweiterung ist eine einzige Datei mit der Endung `.mpx`. Normalerweise kommt sie aus dem Katalog. Wer selbst eine baut oder eine Datei aus anderer Quelle hat, schaltet auf der Seite den **Entwicklermodus** ein. Dann gibt es den Knopf **Datei hochladen**:

1. **Entwicklermodus** einschalten und die Warnung bestätigen.
2. **Datei hochladen** und die `.mpx`-Datei wählen (höchstens 16 MB).
3. Die Box prüft die Datei, installiert aber noch nichts: Die App zeigt Name, Version, was eingerichtet wird, und die Prüfsumme (SHA-256).
4. Mit **Installieren** bestätigen.

> [!WARNING]
> Eine Erweiterung kann auf der Box alles, auch als Administrator. Lade nur Dateien hoch, die du selbst gebaut hast oder deren Quelle du vertraust. Schalte den Entwicklermodus danach wieder aus.

Wie man eine Erweiterung baut, steht in der Richtlinie für Entwickler im Repository (`extensions/README.md`).

## Wenn etwas nicht klappt

- **„Es läuft gerade etwas anderes"**: Es wird schon eine Erweiterung installiert oder entfernt. Warte, bis das fertig ist.
- **Die Installation meldet eine Überschneidung**: Die App nennt den Port oder Pin und wer ihn belegt. Gib ihn dort frei (zum Beispiel den Lüfter auf einen anderen Pin legen) und versuche es noch einmal.
- **Eine Erweiterung fehlt im Katalog**: Nicht jede Erweiterung steht im Katalog. Eine `.mpx`-Datei aus anderer Quelle installierst du im Entwicklermodus.
