# GitHub Pages Workflow Usecase

## Zielbild

Die Website wird als statische GitHub-Pages-Seite betrieben, mit einem klaren CI/CD-Fluss:

1. **Pull Request = Quality Gate**
2. **Merge auf `main`/`master` = automatisches, kontrolliertes Deploy**
3. **Taeglicher Betrieb = Health- und Link-Monitoring**

## Konkretes Usecase-Szenario

### Szenario: Renn-Update vor dem Event

1. Ein Teammitglied aktualisiert `assets/js/mainpage-config.js`, `index.html` und ggf. SEO-Dateien.
2. Beim Pull Request startet `verify`:
   - Content-Validierung und Sync-Drift-Check
   - Syntax-Checks
   - Referenz-Checks fuer lokale Assets/Links
   - Utility-Tests
   - Node-Matrix (20 + 22) fuer Zukunftssicherheit
3. Nach dem Merge startet `pages-deploy`:
   - erneutes Verify-Gate
   - Paketierung eines sauberen Pages-Artefakts (`dist/pages`)
   - Deployment via `actions/deploy-pages`
4. Danach prueft `pages-ops`:
   - taegliche Produktions-Health-Checks (inkl. `robots.txt`, `sitemap.xml`, `feed.xml`, `manifest.webmanifest`)
   - woechentlicher externer Link-Check (Lychee)

Ergebnis: Fehler werden vor dem Merge abgefangen, Deploys sind reproduzierbar, und Produktionsprobleme werden proaktiv erkannt.

## Neu hinzugefuegte Optimierungen

- Wiederverwendbarer `verify`-Workflow (`workflow_call`)
- Concurrency-Schutz gegen ueberlappende Runs
- Least-Privilege-`permissions` in allen Workflows
- Timeout-Absicherungen gegen haengende Jobs
- Node-Matrix fuer Kompatibilitaet
- Deterministische Pages-Artefakt-Erzeugung inkl. `.nojekyll`
- Taktisches Monitoring (Health taeglich, Link-Check woechentlich)
- Manueller Trigger (`workflow_dispatch`) fuer Ad-hoc-Checks

## Wichtige GitHub-Einstellung

Damit der neue Deploy-Workflow aktiv genutzt wird:

- In **Repository Settings -> Pages -> Build and deployment -> Source** auf **GitHub Actions** umstellen.

Sonst laeuft weiterhin der automatische Standard-Workflow "pages build and deployment" aus "Deploy from branch".
