# Laser Tag Ranking

This repository contains a small static web app used for managing and displaying laser tag rankings. The site is composed of several standalone HTML pages that load data from Google Sheets and route API requests through a small Google Apps Script.

All data submissions—saving match results, importing detailed stats and uploading avatars—are sent to this Apps Script which then updates the underlying spreadsheets and storage.

## Running the site locally

The pages use ES modules, therefore they must be served via HTTP. Any static server will work, for example:

If the API proxy is unavailable, the balancer page will fetch player data directly from the published Google Sheets.

## Deployment checklist

Before publishing the static site make sure the generated assets are up to date. The Summer 2025 social preview is created from
the latest ranking pack and should be rebuilt on every deploy:

```
npm ci && npm run build:summer2025-og
```

The command writes the image to `assets/summer2025-table-preview.png`, which is excluded from version control but must be present
in the final artifact served by the CDN/hosting provider.

