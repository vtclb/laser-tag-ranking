# Laser Tag Ranking

This repository contains a small static web app used for managing and displaying laser tag rankings. The site is composed of several standalone HTML pages that load data from Google Sheets and route API requests through a small Google Apps Script.

All data submissions—saving match results, importing detailed stats and uploading avatars—are sent to this Apps Script which then updates the underlying spreadsheets and storage.

## Running the site locally

The pages use ES modules, therefore they must be served via HTTP. Any static server will work, for example:

If the API proxy is unavailable, the balancer page will fetch player data directly from the published Google Sheets.

