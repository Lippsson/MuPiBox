# Touch-display Cover

Tillägget **Touch-display Cover** visar på en liten pekskärm bara ett **omslag**: efter starten det för den första artisten. En **svepning åt vänster eller höger** vrider omslaget som en **kub** till nästa eller föregående; bilden följer fingret. Ett **tryck** öppnar artisten (hennes eller hans album) eller, på ett album, **spelar det**. Med en **svepning uppåt med två fingrar** går man en nivå tillbaka (ett finger ensamt gör ingenting, så att ett barn inte hoppar tillbaka av misstag). En **svepning åt vänster eller höger med två fingrar** byter **kategori**: Allt, Musik, Ljudböcker, Övrigt, NAS, åt vänster till nästa, åt höger till föregående. Kategorier utan innehåll hoppas över. Kort står kategorins namn mitt på displayen, sedan visar den omslaget för den första artisten. Valet bevaras efter en omstart; ändrar man inställningen **Det som visas** gäller åter den.

Det som stöds är **Waveshare 2.8inch Capacitive Touch LCD** (240 × 320 punkter, displaychip ST7789, touchchip CST328) på **SPI- och I2C-anslutningen**, på **Raspberry Pi 4 och Pi 5**. Tillägget behöver paketen `python3-pil`, `python3-spidev` och `python3-lgpio`, som dess installation tar med.

Efter [installationen](installieren.md) står inställningarna under **Inställningar › Touch-display Cover**.

## Hur omslagen vrids

Omslagen på en nivå står som sidorna på en kropp direkt intill varandra, utan mellanrum. Upp till **fyra** omslag är det en **kub**: från ett omslag till nästa är det 90 grader. Vid **fler än fyra** omslag blir det en månghörning vars vinkel följer av antalet omslag (360 grader delat med antalet): vid åtta omslag är det 45 grader från ett till nästa. Ju fler omslag, desto planare står de och desto mindre välter de bort vid svepningen.

## Nivåerna

| Nivå | Vad displayen visar | Tryck | Svep uppåt med två fingrar |
| --- | --- | --- | --- |
| **Artister** | artistens omslag, ordnade efter namn som i boxens bibliotek | öppnar artistens album | gör ingenting |
| **Album** | omslaget för ett album av artisten | **spelar albumet** (kort visas en spelsymbol) | tillbaka till artisterna, vid samma artist |
| **Mapp i en mapp** (en serie på SD-kortet eller NAS) | seriens album | spelar albumet | en nivå tillbaka |

En post utan artist, till exempel en **spellista** eller en **radiokanal**, står genast på första nivån och **spelar** vid tryck. Det som visas är det som boxens bibliotek känner till: Spotify, poddar, radio, TIDAL, Jellyfin, Audible, mapparna på SD-kortet och NAS. En Spotify-post för en **hel artist** (inte för ett album) har här inget album att spela och utelämnas. Svepningen går i cirkel: efter det sista omslaget kommer det första igen. Där bara ett omslag finns vrids ingenting.

Ett omslag som fortfarande laddas ersätts först av artistens namn på en färg. Saknas ett omslag helt blir namnet kvar.

## Ansluta

Modulen sitter på SPI- och I2C-bussen på stiftlisten. Koppla med boxen avstängd:

| Modul | Raspberry Pi | Stift på stiftlisten |
| --- | --- | --- |
| VCC | 3,3 V | 1 |
| GND | Jord | 6 |
| LCD_DIN | GPIO 10 (SPI MOSI) | 19 |
| LCD_CLK | GPIO 11 (SPI SCLK) | 23 |
| LCD_CS | GPIO 7 (**CE1**) | 26 |
| LCD_DC | en ledig GPIO, till exempel GPIO 24 | 18 |
| LCD_RST | en ledig GPIO, till exempel GPIO 22 | 15 |
| LCD_BL | en ledig GPIO, till exempel GPIO 18 | 12 |
| TP_SDA | GPIO 2 (I2C SDA) | 3 |
| TP_SCL | GPIO 3 (I2C SCL) | 5 |
| TP_RST | en ledig GPIO, till exempel GPIO 17 | 11 |
| TP_INT | förblir ledig (tillägget frågar av touchchippet) | – |

> [!NOTE]
> Waveshare beskriver för CS stift 24 (CE0), för DC GPIO 25 och för RST GPIO 27. Det går inte ihop med en **NFC-läsare (PN5180)**, som behöver CE0 och GPIO 25 och 23. Därför ligger CS här på **CE1 (stift 26)**, och DC, RST, BL och TP_RST väljer du själv på lediga stift. Stiften ställer du in i appen: listan spärrar det som redan är upptaget och säger av vem.

I2C-bussen kan delas med andra enheter, till exempel en OLED-display; touchchippet har adressen **0x1A**.

Är SPI eller I2C fortfarande av visar kortet **Display** blocket **SPI** eller **I2C** som **Av**. Tryck på **Slå på SPI** och **Slå på I2C** och **starta om** sedan boxen.

## Inställningar

| Inställning | Betydelse |
| --- | --- |
| **Displayens CS-anslutning** | **CE1 · stift 26** (standard) eller **CE0 · stift 24**; NFC-läsaren upptar oftast CE0 |
| **GPIO-pin DC**, **RST** | krävs; olika stift, inte de för SPI- och I2C-anslutningen (2, 3, 7 till 11) |
| **GPIO-pin BL** | bakgrundsbelysningen: bara med den går displayen att **dämpa** och stänga av. Utan stift sitter BL på 3,3 V och displayen lyser alltid fullt |
| **GPIO-pin TP_RST** | reset för touchchippet; utan stift sitter TP_RST på 3,3 V |
| **Det som visas** | allt, bara musik, bara ljudböcker, bara ”Övrigt” eller bara NAS; på displayen växlar du med en svepning åt sidan med två fingrar |
| **Visa namn under omslaget** | skriver namnet i den svarta remsan under omslaget |
| **Rotation** | stående, liggande och de vridna lägena, om displayen sitter inbyggd på annat sätt |
| **Ljusstyrka**, **Display av efter** | som vid OLED-displayen; en beröring väcker en avstängd display (den gör annars ingenting) |
| **Mörkare på kvällen** | mörkare efter tiderna för ”Mörkare på kvällen” i displayens inställningar |
| **Touch** | **Byt axlar**, **spegla vänster och höger**, **spegla upp och ned**: behövs bara om en svepning räknas åt fel håll |

## Om det inte går

Raden **Display** på kortet säger vad som saknas:

| Meddelande | Vad du gör |
| --- | --- |
| **Välj pinnarna DC och RST** | välj två olika lediga stift |
| **SPI är av** / **I2C är av** | tryck på **Slå på SPI** / **Slå på I2C**, starta om boxen |
| **Ingen åtkomst till SPI-bussen** / **I2C-bussen** | starta om boxen en gång (regeln för åtkomsten blir då aktiv) |
| **Touchchippet svarar inte** | kontrollera SDA, SCL, TP_RST och strömförsörjningen; modulen finns i två utföranden, det som stöds är det med touchchippet **CST328** (det nyare med CST3530 inte) |
| **Pinnarna går inte att använda** | ett annat program har ett av stiften; välj ett annat |
| **Paketen … saknas** | installera tillägget om (det hämtar paketen) |

Förblir displayen vit eller svart fastän raden säger **Redo** stämmer oftast kopplingen av **DC**, **RST** eller **CS** inte, eller så står **CS** på fel SPI-enhet. Går en svepning åt fel håll hjälper kortet **Touch**.

> [!NOTE]
> Programmet för displayen är en egen implementation efter Waveshares uppgifter: Det skriver via `spidev` och `lgpio` och behöver varken `RPi.GPIO` eller `smbus`; det körs därför likadant på Pi 4 och Pi 5.
