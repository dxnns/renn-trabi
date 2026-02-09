# Admin Workspace (GitHub Pages / lokal)

Der Adminbereich unter `admin-leads.html` ist fuer eine statische GitHub-Pages-Website ausgelegt.

Wichtig:
- Es gibt **kein serverseitiges Lead-Inbox-System**.
- Kontakt- und Sponsoring-Formulare oeffnen den lokalen Mail-Client (`mailto:`).
- Der Adminbereich ist ein **lokales Browser-Tool** fuer Redaktion, Pflege und Mail-Workflow.

## Anmeldung

1. `admin-leads.html` im Browser oeffnen.
2. Bei der ersten Nutzung eine lokale PIN (mind. 8 Zeichen) setzen und bestaetigen.
3. Danach mit dieser PIN anmelden.
4. "Abmelden" beendet die lokale Session.
5. "PIN zuruecksetzen" entfernt die lokale PIN und startet den Setup-Prozess neu.

## Moeglichkeiten

1. Race-Center-Zusammenfassung pflegen:
- Status
- Letztes Update (Titel + Zeitpunkt)
- Naechster Meilenstein

2. Feed-Updates manuell verwalten:
- Kategorie (`technik`, `rennen`, `team`)
- Titel, Zeitpunkt, Text
- Eintrag als "Letztes Update" uebernehmen
- Eintrag loeschen

3. JSON Export / Import:
- Konfiguration als JSON kopieren oder herunterladen
- JSON importieren und lokal speichern

4. Mail-Workflow:
- Kontakt-/Sponsoring-Postfach direkt per `mailto:` oeffnen
- Antwortmail mit Vorlage vorbereiten und im lokalen Mail-Client starten

## GitHub-Pages-Workflow fuer echte Live-Aenderungen

Da GitHub Pages statisch ist, werden lokale Adminaenderungen nicht automatisch fuer alle Besucher live.

Fuer Live-Aenderungen:
1. Konfiguration im Adminbereich erstellen.
2. JSON exportieren.
3. JSON in die statische Datenquelle uebernehmen (z. B. als `window.BEMBEL_RACE_CENTER_DATA` oder in die bestehende manuelle Konfiguration).
4. Commit + Push ins Repository.

Erst danach sehen alle Besucher die aktualisierten Inhalte.
