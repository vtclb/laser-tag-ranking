# Laser Tag Ranking

This repository contains a small static web app used for managing and displaying laser tag rankings. The site is composed of several standalone HTML pages that load data from Google Sheets and from a simple Cloudflare Worker API.

The ranking spreadsheet is expected to contain a `Gender` column after the `Points` column. The app will read this value for each player when loading data.

## Running the site locally

The pages use ES modules, therefore they must be served via HTTP. Any static server will work, for example:

