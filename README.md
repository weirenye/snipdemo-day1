# Snip

One Bun backend, two clients: an Angular 19 web app and a zero-dependency Node CLI.
Links live in memory; restarting the server clears them.

## Architecture

This repository has independent orphan branches with files at each branch root.
`main` is a superproject: its submodule gitlinks pin exact component commits.
`.gitmodules` records the same repository URL and each tracked branch.

| Path / branch | Purpose |
| --- | --- |
| backend | Bun 1.x API, no npm dependencies |
| frontend | Angular 19, Node 20+ and npm |
| cli | CommonJS Node 20+ CLI, no dependencies |
| bundle | Generated release: server, built UI, CLI and Docker configuration |
| main | Submodule pointers, documentation, release script and CI |

## API

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/api/links` | `{ "url": "https://example.com" }` | 201 `{ code, url, shortUrl, hits, createdAt }`; 400 `{ error }` for invalid JSON or non-HTTP(S) URL |
| GET | `/api/links` | - | 200 array of the same link objects |
| GET | `/:code` | - | 302 with Location, incrementing hits; 404 if unknown |

Codes are six random base62 characters; hits start at zero and createdAt is ISO.
CORS is open, with OPTIONS support. Existing static files take precedence over codes.

## Clone and develop

```sh
git clone --recurse-submodules https://github.com/weirenye/snipdemo-day1.git
cd snipdemo-day1
```

A plain clone leaves submodules empty; populate them with
`git submodule update --init --recursive`. Run these in separate terminals:

```sh
cd backend
bun start
```

```sh
cd frontend
npm ci
npm start
```

```sh
cd cli
node cli.js ls
node cli.js add https://example.com
```

Backend listens on http://localhost:3000, development UI on http://localhost:4200.
Production UI uses same-origin API requests. CLI uses `SNIP_API`, defaulting to
http://localhost:3000. Backend supports `PORT`, `BASE_URL`,
`RAILWAY_PUBLIC_DOMAIN`, and `PUBLIC_DIR`; see the component READMEs.

## Update a component

Submodule checkouts may have detached HEADs; switch to the corresponding branch
before editing, without discarding local changes.

```sh
cd backend
git switch backend
# edit and verify
git add -A
git commit -m "Update backend"
git push origin backend
cd ..
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push origin main
```

Component commits and superproject pointer commits are separate records. Never
pre-create layer folders as ordinary directories, and never hand-edit `bundle`.
