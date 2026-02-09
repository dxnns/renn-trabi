# Mobile Styles

This folder contains mobile-only overrides that are loaded **after** the existing desktop styles.

## Structure

- `shared.css`: shared mobile overrides for pages that include `assets/css/style.css`.
- `index.css`: mobile tuning for `index.html`.
- `team.css`: mobile tuning for `team.html`.
- `sponsoring.css`: mobile tuning for `sponsoring-anfrage.html`.

## Rules

- Keep desktop behavior unchanged.
- Add only `@media`-scoped overrides in this folder.
- Keep selectors as specific as needed, and prefer page-local selectors in page files.
