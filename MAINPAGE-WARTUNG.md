# Mainpage Wartung

Alle regelmäßig anzupassenden Inhalte der Mainpage liegen zentral in:

- `assets/js/mainpage-config.js`

## Was dort gepflegt wird

- `hero`: Badge, Intro-Text, Statistikwerte
- `race`: Datum/Uhrzeit, Ort, Status, Event-Details, Roadmap
- `ticker`: Live-Ticker-Einträge
- `contact`: E-Mails, Instagram, Orts-Label
- `joinModal`: Texte und CTA im Mitmachen-Hinweis
- `raceCenter`: Summary, Feed-Updates und Polls

## Wichtige Formate

- `race.startLocal`: ISO-ähnlich, z. B. `2026-08-15T10:00:00`
- `raceCenter.feed[].at`: ISO-Datum mit Zeitzone, z. B. `2026-08-14T19:30:00+02:00`
- `race.roadmap[].state`: `done`, `active` oder leer

## Workflow

1. Nur `assets/js/mainpage-config.js` bearbeiten.
2. Im Browser prüfen, ob Countdown, Roadmap, Ticker und Race Center korrekt dargestellt sind.
3. Deploy wie gewohnt.
