# Snip backend

A zero-dependency Bun URL shortener. Links are stored in memory and are cleared
when the server restarts.

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it; set
`BASE_URL` to control generated short links. If `BASE_URL` is unset, the server
uses `https://$RAILWAY_PUBLIC_DOMAIN` when available, otherwise
`http://localhost:$PORT`. Set `PUBLIC_DIR` to serve static files alongside the
API and redirects.

- `POST /api/links` with `{"url":"https://example.com"}` creates a link.
- `GET /api/links` lists links and their hit counts.
- `GET /:code` redirects to the original URL and increments its hit count.
