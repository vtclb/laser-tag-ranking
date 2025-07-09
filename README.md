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

## Avatar management

Avatar uploads are managed **only** through `balance.html`. The *Керування аватарами* section contains a file input next to each nickname and a **Зберегти аватари** button. Select the desired images, then click the button to upload them to the `/avatars/{nick}` API endpoint defined in `scripts/api.js`.

If a player has no stored avatar the site will attempt to load a default image from `assets/default_avatars/{nick}.png` before falling back to a placeholder. Place any default avatars you want to use in that folder.

### Server configuration

The avatar API is implemented as a Cloudflare Worker found in [`avatar-worker.js`](avatar-worker.js). Deploy it with a KV namespace named `AVATARS` bound to the worker. A minimal `wrangler.toml` would look like:

```toml
name = "laser-proxy"
main = "avatar-worker.js"
compatibility_date = "2023-10-01"

[[kv_namespaces]]
binding = "AVATARS"
id = "<namespace_id>"
```

Requests to `/avatars/<nick>` support `GET` for downloading and `POST` for uploading avatars. CORS headers are sent automatically so the pages can access the API from any origin.

## Summary

1. Start a static server in the repository root.
2. Visit `index.html` or any other page listed above.
3. Open `balance.html` to upload avatars or manage data.
4. Ensure the Cloudflare Worker from `avatar-worker.js` is deployed if you need avatar uploads.
