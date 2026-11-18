# NFC: Drehregler

Ein Tag kann nicht nur ein Album starten, sondern ein **ganzes Artistcover**: alle Alben eines Interpreten in der Bibliothek, einen **Ordner der SD-Karte** oder einen **Ordner auf dem NAS**. Der Tag spielt dann **ein** Album davon, und mit dem **Drehregler** (KY-040) schaltest du durch die anderen.

## Einen Tag einem Artistcover zuordnen

1. Öffne in der Bibliothek den **Interpreten** (oder den Ordner), nicht ein einzelnes Album. Er muss mindestens zwei Alben haben.
2. Tippe **NFC-Tag** an und lege den Tag auf (genau wie bei einem Album, siehe [Tag mit einem Album verknüpfen](nfc-tag-zuordnen.md)).

Der Tag trägt den Namen des Artistcovers. Beim ersten Auflegen spielt das **erste Album** der Liste (nach Namen sortiert).

## Welches Album beim Auflegen spielt

Auf der Seite **Zugeordnete Tags** ([Zugeordnete Tags](nfc-zugeordnete-tags.md)) hat die Kachel eines solchen Tags eine **Auswahlliste**: **Album beim Auflegen**. Wähle dort das Album, das der Tag beim Auflegen spielen soll. Die Liste zeigt alle Alben des Artistcovers; was nicht mehr auf der Box ist, fehlt.

## Mit dem Drehregler ein anderes Album wählen

Nach dem Auflegen eines solchen Tags übernimmt der Drehregler für eine Weile die Wahl des Albums:

| Du | Die Box |
| --- | --- |
| **drehst nach rechts** | geht zum **nächsten** Album der Liste (nach dem letzten kommt das erste) |
| **drehst nach links** | geht zum **vorherigen** Album |
| **drückst den Taster** | **spielt** das Album, bei dem der Drehregler steht |

Der Drehregler **ändert dabei nichts** am Tag: Beim nächsten Auflegen spielt wieder das Album aus der Auswahlliste.

Ein Druck, **bevor** du gedreht hast, wählt nichts aus: Er tut, was der Taster sonst tut (siehe [Drehregler und Taster](../hardware/drehregler.md)). Dreht niemand, geht die Wahl nach der eingestellten Zeit zu Ende, und der Drehregler stellt wieder die **Lautstärke** ein. Jede Drehung startet die Zeit neu.

## OLED-Display

Ist das [OLED-Display](oled.md) angeschlossen, zeigt es beim Drehen **in den Informationen** den Interpreten (oder Ordner) und darunter den **Namen** des Albums, bei dem der Drehregler gerade steht, mit seinem Platz in der Liste („< 2/12 >“). Lange Namen laufen durch. Statusleiste und die Zeile unten mit der Zeit bleiben, sie zeigen, was gerade noch spielt. Ein Druck auf den Taster spielt das Album, und das Display zeigt wieder die **normale Anzeige des Players**.

## Einstellungen

**Einstellungen › NFC-Extension › Drehregler**. Unter den Einstellungen stehen die **Anschlüsse des Drehreglers** (die Pins A, B und Taster, dazu die Schrittweite und die Funktion des Tasters), die es auch unter **Einstellungen › Drehregler** gibt: Du stellst sie hier und dort an derselben Stelle ein.

| Einstellung | Wirkung |
| --- | --- |
| **Drehregler wählt das Album** | Aus: Der Drehregler stellt weiter nur die Lautstärke ein. |
| **Nach dem Auflegen aktiv (Sekunden)** | Ein Regler von **0 bis 120 Sekunden** (Vorgabe 20): so lange nach dem Auflegen und nach jedem Drehen wählt der Drehregler Alben, danach stellt er wieder die Lautstärke ein. **0** heißt **immer aktiv**: Der Drehregler wählt Alben, bis du eines mit dem Taster wählst oder einen anderen Tag auflegst. Das OLED-Display zeigt den Namen dann bis zu fünf Minuten nach dem letzten Drehen. |

## Was dafür nötig ist

- Der **Drehregler** ist eingerichtet: seine Pins stehen auf dieser Seite oder unter **Einstellungen › Drehregler** ([Drehregler und Taster](../hardware/drehregler.md)).
- Sein **Taster** hat einen **eigenen Pin**. GPIO 10, die Vorgabe, gehört bei einem NFC-Leser am SPI-Anschluss dem Leser: Dort bleibt der Taster ohne Wirkung. Wähle bei den Pins des Drehreglers einen anderen. Die Funktion des Tasters darf **Aus** sein; solange die NFC-Extension den Drehregler hat, benutzt sie ihn trotzdem.
- Das Artistcover hat **mindestens zwei** Alben. Mit einem einzigen gibt es nichts zu wählen.

## Wenn es nicht klappt

- Der Drehregler stellt weiter die Lautstärke ein: Die Zeit nach dem Auflegen ist um (Tag noch einmal auflegen), **Drehregler wählt das Album** ist aus, oder das Artistcover hat nur ein Album.
- Der Taster wählt nichts aus: Du musst zuerst **drehen**; und der Pin des Tasters darf nicht der eines NFC-Lesers sein.
- Die Auswahlliste fehlt in der Kachel: Die Box konnte die Alben nicht lesen (das NAS ist nicht erreichbar, der Ordner ist weg). Sie erscheint wieder, wenn die Alben gelesen werden können.
