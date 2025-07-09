# Laser Tag Ranking

This repository contains a small static web app used for managing and displaying laser tag rankings. The site is composed of several standalone HTML pages that load data from Google Sheets and from a simple Cloudflare Worker API.

## Running the site locally

The pages use ES modules, therefore they must be served via HTTP. Any static server will work, for example:

```bash
# from the repository root
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in your browser. The other pages are accessible by replacing the file name in the address bar.

### Available pages

- **[`index.html`](index.html)** – ranking table for the Junior league.
- **[`sunday.html`](sunday.html)** – ranking table for the Senior league.
- **[`gameday.html`](gameday.html)** – daily matches and standings.
- **[`balance.html`](balance.html)** – team balancer and arena helper.
- **[`rules.html`](rules.html)** – club rules and scoring system.
- **[`about.html`](about.html)** – small pixel arena demo.


