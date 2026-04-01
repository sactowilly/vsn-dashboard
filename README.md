# Vision Packaging Dashboard - GitHub Pages Scaffold

This scaffold is designed to run on GitHub Pages.

## Key design decision

This build does **not** fetch third-party sources directly in the browser.
Instead, the dashboard reads local JSON files from the `data/` folder.

That makes it GitHub Pages-friendly because:
- no backend is required
- no API keys are required in the browser
- no CORS dependency is required at runtime
- dataset freshness is visible and controlled

## How it works

Runtime:
- `index.html`
- `style.css`
- `config.js`
- `app.js`

Published datasets:
- `data/build-meta.json`
- `data/unemployment.json`
- `data/fed.json`
- `data/stocks.json`
- `data/gas-current.json`
- `data/gas-history.json`
- `data/disasters.json`
- `data/labor.json`
- `data/pulp.json`
- `data/resin.json`
- `data/competitors.json`
- `data/news.json`
- `data/news-sources.json`

## GitHub Pages deployment

1. Push this folder to a GitHub repository
2. In GitHub, open repository settings
3. Open Pages
4. Set source to deploy from the main branch root or `/docs` if you move files there
5. Save
6. Open the published URL

## Local testing

Use a local server for testing:

```bash
python -m http.server 8000
```

Then open:
```text
http://localhost:8000
```

## Important runtime note

The button in the app says:
`Reload Latest Published Data`

That button reloads JSON files already published in the repo/site.
It does **not** force upstream sources like AAA, BLS, or FRED to refresh in real time.

## How to keep data fresh

Best path:
- use GitHub Actions on a schedule
- fetch source data in the workflow
- rewrite JSON files in `data/`
- commit the updated JSON back to the repo

A starter workflow stub is included in:
- `.github/workflows/update-data.yml`

## Recommended next build step

Wire scheduled data update scripts for:
- BLS unemployment
- FRED federal funds rate
- AAA gas snapshot + EIA history
- USGS + NWS disruptions
- Cornell labor tracker
- packaging news curation

## Current scaffold status

This zip includes:
- full 10-tile dashboard
- detail drawer
- chart rendering
- starter published JSON datasets
- GitHub Pages-friendly runtime architecture
- workflow stub for future automation
