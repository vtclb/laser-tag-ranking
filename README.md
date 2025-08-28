# Laser Tag Ranking

This repository contains a small static web app used for managing and displaying laser tag rankings. The site is composed of several standalone HTML pages that load data from Google Sheets and route API requests through a small Google Apps Script.

All data submissions—saving match results, importing detailed stats and uploading avatars—are sent to this Apps Script which then updates the underlying spreadsheets and storage.

## CSV data sources

The app consumes public CSV exports from Google Sheets:

- **Kids ranking:** https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv
- **Adults (Sunday Games) ranking:** https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv
- **Match logs for both leagues:** https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv

## Running the site locally

The pages use ES modules, therefore they must be served via HTTP. Any static server will work, for example:

If the API proxy is unavailable, the balancer page will fetch player data directly from the published Google Sheets.

