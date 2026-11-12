# Snip Frontend

The Angular 19 web client for Snip. It creates and lists links using the shared API:

- `POST /api/links` with `{ "url": "https://…" }` returns `{ code, url, shortUrl, hits, createdAt }`.
- `GET /api/links` returns an array of those link objects.

## Local development

Run the Bun backend on port `3000`, then start the Angular app:

```sh
npm install
npm start
```

Open `http://localhost:4200`. Development builds call the API at `http://localhost:3000`; the backend allows cross-origin requests for local development.

## Production and bundle

Production builds use same-origin `/api/links` requests. The generated `dist/snip-frontend/browser` files are served by the bundled backend on port `3000`, so no browser-side localhost URL or separate CORS configuration is needed in the release.

## Build

```sh
npx ng build
```

The output is `dist/snip-frontend/browser`, which is consumed by the Snip bundle build.
