# Wetter

Die Erweiterung **Wetter** zeigt das Wetter eines Ortes als **Messuhren** auf dem Display: Temperatur, Luftfeuchte, Windstärke, Windrichtung, Luftdruck und Regenmenge. Sie richtet auf der Box nichts ein; die Werte holt die Box aus dem Internet.

## Einrichten

1. Installiere die Erweiterung unter **Einstellungen › System › Erweiterungen** ([Installieren und verwalten](installieren.md)).
2. Öffne die Details ihrer Karte und suche unter **Ort** nach dem Namen deines Ortes. Tippe einen Treffer an.

Ist ein Ort gewählt, zeigt das Display oben den Reiter **Wetter**. Ein Tipp darauf öffnet die Messuhren: immer zwei nebeneinander, mit Wischen kommst du zu den nächsten. Der Zurück-Knopf in der Titelleiste schließt sie wieder.

## Einstellungen

| Einstellung | Wirkung |
| --- | --- |
| **Wetterserver** | **Open-Meteo** liefert Messwerte der letzten 24 Stunden und Böen. Bei **MET Norway (yr.no)** sind es Werte des Wettermodells; der Regen ist dort die Vorhersage für die nächsten 24 Stunden |
| **Ort** | nach dem Namen suchen und einen Treffer antippen |
| **Aktualisieren alle …** und **Einheit** | wie oft die geöffnete Wetteranzeige neue Werte holt, in Sekunden oder Minuten (mindestens alle 10 Sekunden, Standard alle 10 Minuten) |
| **Temperatur** | °C oder °F |
| **Regen** | mm oder Zoll |
| **Luftdruck** | hPa, inHg, mb oder kPa |
| **Windstärke** | km/h, m/s, mph oder Knoten |
| **Reihenfolge der Uhren** | fasse eine Uhr am Griff an und schiebe sie an eine andere Stelle |
| **Rahmen**, **Hintergrund**, **Zeigerform**, **Zeigerfarbe**, **Knopf** und **Knopffarbe** | das [Aussehen der Uhren](#aussehen-der-uhren) |

> [!NOTE]
> Die Wetterserver liefern neue Werte nur etwa stündlich, und die Box fragt sie höchstens einmal pro Minute ab. Ein sehr kurzer Abstand macht die Anzeige also nicht genauer.

Beide Wetterserver sind kostenlos und brauchen keine Anmeldung. Die Box fragt sie mit den Koordinaten des gewählten Ortes.

## Aussehen der Uhren

Die Uhren zeichnet die Bibliothek **SteelSeries**, und die Namen der Rahmen und Hintergründe sind die ihrer Entwickler. Ohne Auswahl sehen die Uhren aus wie bisher: Rahmen **Metal**, Hintergrund **Beige**, Zeigerform **1**, Zeigerfarbe **Rot**, Knopf **Metall** in **Silber**. Gewählt wird in den Details der Karte, die Änderung gilt, sobald du die Wetteranzeige das nächste Mal öffnest.

**Rahmen:** Black Metal, Metal, Shiny Metal, Brass, Steel, Chrome, Gold, Anthracite, Tilted Gray, Tilted Black und Glossy Metal.

![Die 11 Rahmen](weather-frames.png)

**Hintergrund:** Dark Gray, Satin Gray, Light Gray, White, Black, Beige, Brown, Red, Green, Blue, Anthracite, Mud, Punched Sheet, Carbon, Stainless, Brushed Metal, Brushed Stainless und Turned.

![Die 18 Hintergründe](weather-backgrounds.png)

**Zeigerform:** 16 Formen, von **1** bis **16**. Sie gilt für die runden Uhren; die Windrichtung behält ihre zwei Zeiger, einen roten für den aktuellen Wert und einen blauen für den Mittelwert.

![Die 16 Zeigerformen](weather-pointers.png)

**Zeigerfarbe:** Rot, Grün, Blau, Orange, Gelb, Cyan, Magenta, Weiß, Grau, Schwarz, Raith, Jug Green und Green LCD.

![Die 13 Zeigerfarben](weather-colours.png)

**Knopf** und **Knopffarbe:** der Knopf in der Mitte der Uhr, **Standard** oder **Metall**, in **Schwarz**, **Messing** oder **Silber**.

![Die Knöpfe](weather-knobs.png)

## Wenn kein Wetter erscheint

- Ist ein **Ort** gewählt? Ohne Ort gibt es den Reiter **Wetter** nicht.
- Die Ortssuche und die Werte brauchen Internet.
- Ist die Erweiterung unter **Einstellungen › System › Erweiterungen** eingeschaltet?
