# DEPLOY-SEO-CHECKLIST

Stand: 2026-02-09  
Geltungsbereich: Release auf GitHub Hosting (`www.bembelracingteam.de`)

Hinweis: `404.html` ist Teil des automatischen `content:sync`-Flows; inhaltliche SEO-Angaben werden zentral in `content/site-content.json` gepflegt.

## 1. SEO-Basis vor dem Release
- [ ] Es wird geprüft, dass alle Canonical-URLs auf `https://www.bembelracingteam.de/...` verweisen.
- [ ] Es wird geprüft, dass `sitemap.xml` nur indexierbare Seiten enthält.
- [ ] Es wird geprüft, dass `robots.txt` die Sitemap referenziert und nicht indexierbare Bereiche sperrt (`/api/`, `/404.html`).
- [ ] Es wird geprüft, dass `404.html` mit `noindex` ausgeliefert wird.
- [ ] Es wird geprüft, dass alle Open-Graph- und Twitter-Bildpfade auf erreichbare Dateien zeigen (insbesondere `assets/img/og-cover.jpg`).
- [ ] Es wird geprüft, dass alle referenzierten Bilddateien vorhanden sind (insbesondere Sponsor-Logos).
- [ ] Es wird geprüft, dass JSON-LD-Blöcke in `index.html`, `team.html` und `sponsoring-anfrage.html` valide sind.
- [ ] Es wird geprüft, dass `lastmod` in `sitemap.xml` bei inhaltlichen Änderungen aktualisiert wird.
- [ ] Es wird geprüft, dass `feed.xml` bei inhaltlichen Änderungen (`lastBuildDate`, `pubDate`) aktualisiert wird.

## 2. Lokale technische Prüfung vor dem Push
- [ ] Content-Datei und Schema sind valide.
- [ ] Alle generierten Artefakte sind synchron.
- [ ] Syntax und lokale Referenzen sind ohne Fehler.

```powershell
npm run content:validate
npm run content:check
npm run verify
```

## 3. Live-Prüfung direkt nach dem Deploy
- [ ] Es wird geprüft, dass die Kernseiten auf Produktion mit HTTP `200` erreichbar sind.

```text
https://www.bembelracingteam.de/
https://www.bembelracingteam.de/team.html
https://www.bembelracingteam.de/sponsoring-anfrage.html
```

- [ ] Es wird geprüft, dass die SEO-Systemdateien mit HTTP `200` erreichbar sind.

```text
https://www.bembelracingteam.de/robots.txt
https://www.bembelracingteam.de/sitemap.xml
https://www.bembelracingteam.de/feed.xml
https://www.bembelracingteam.de/manifest.webmanifest
https://www.bembelracingteam.de/404.html
```

- [ ] Es wird geprüft, dass das OG-Bild und die Favicons erreichbar sind.

```text
https://www.bembelracingteam.de/assets/img/og-cover.jpg
https://www.bembelracingteam.de/assets/img/apple-touch-icon.png
https://www.bembelracingteam.de/assets/img/favicon-32x32.png
https://www.bembelracingteam.de/assets/img/favicon-192x192.png
```

## 4. Google Search Console je Release
- [ ] Im Menü `Indexierung > Sitemaps` wird der Status der Sitemap auf `Erfolgreich` geprüft.
- [ ] Im Menü `URL-Prüfung` werden geänderte Kern-URLs geprüft und bei Bedarf `Indexierung beantragen` ausgelöst.
- [ ] Im Menü `Indexierung > Seiten` wird geprüft, ob unerwartete `Nicht indexiert`-Muster vorliegen.
- [ ] Im Menü `Sicherheit & manuelle Maßnahmen` wird geprüft, dass keine Sicherheits- oder Manuell-Maßnahmen aktiv sind.
- [ ] Im Menü `Nutzerfreundlichkeit > Core Web Vitals` wird auf neue Verschlechterungen geprüft.
- [ ] Im Menü `Leistung` wird nach 7 bis 14 Tagen geprüft, ob Impressionen/Klicks auf Kernseiten erwartbar verlaufen.

## 5. Release-Freigabe
- [ ] Das Release wird erst freigegeben, wenn alle Punkte in Abschnitt 1 bis 4 abgehakt sind.
