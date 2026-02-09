# DEPLOY-SEO-CHECKLIST

Stand: 2026-02-09  
Geltungsbereich: Release auf GitHub Hosting (`www.bembelracingteam.de`)

## 1. SEO-Basis vor dem Release
- [ ] Es wird geprüft, dass alle Canonical-URLs auf `https://www.bembelracingteam.de/...` verweisen.
- [ ] Es wird geprüft, dass `sitemap.xml` nur indexierbare Seiten enthält.
- [ ] Es wird geprüft, dass `robots.txt` die Sitemap referenziert und nicht indexierbare Bereiche sperrt (`/admin-leads`, `/api/`, `/404.html`).
- [ ] Es wird geprüft, dass `404.html` mit `noindex` ausgeliefert wird.
- [ ] Es wird geprüft, dass alle Open-Graph- und Twitter-Bildpfade auf erreichbare Dateien zeigen (insbesondere `assets/img/og-cover.jpg`).
- [ ] Es wird geprüft, dass alle referenzierten Bilddateien vorhanden sind (insbesondere Sponsor-Logos).
- [ ] Es wird geprüft, dass JSON-LD-Blöcke in `index.html`, `team.html` und `sponsoring-anfrage.html` valide sind.
- [ ] Es wird geprüft, dass `lastmod` in `sitemap.xml` bei inhaltlichen Änderungen aktualisiert wird.
- [ ] Es wird geprüft, dass `feed.xml` bei inhaltlichen Änderungen (`lastBuildDate`, `pubDate`) aktualisiert wird.

## 2. Lokale technische Prüfung vor dem Push
- [ ] Es wird geprüft, dass keine Node-Syntaxfehler vorliegen (falls `server.js` genutzt wird).

```powershell
node --check server.js
```

- [ ] Es wird geprüft, dass keine fehlenden lokalen Referenzen in HTML-Dateien vorhanden sind.

```powershell
@'
const fs=require('node:fs');
const path=require('node:path');
const pages=['index.html','team.html','sponsoring-anfrage.html','admin-leads.html','404.html'];
const attr=/\b(?:src|href)=\"([^\"]+)\"/g;
const missing=[];
for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  for(const m of html.matchAll(attr)){
    const ref=m[1];
    if(!ref||ref.startsWith('#')||ref.startsWith('http://')||ref.startsWith('https://')||ref.startsWith('mailto:')||ref.startsWith('tel:')||ref.startsWith('data:')) continue;
    const clean=ref.split('?')[0].split('#')[0];
    if(!clean||clean.endsWith('/')) continue;
    const local=path.resolve(path.dirname(page), clean.replace(/^\//,''));
    if(!fs.existsSync(local)) missing.push(`${page} -> ${ref}`);
  }
}
if(missing.length===0){ console.log('NO_MISSING_REFERENCES'); }
else { console.log('MISSING_REFERENCES'); for(const item of missing) console.log(item); process.exitCode=1; }
'@ | node -
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
