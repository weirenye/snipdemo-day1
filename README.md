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

## Generate a release

```sh
node scripts/smoke.mjs
node scripts/build-bundle.mjs
node scripts/build-bundle.mjs
node scripts/build-bundle.mjs --push
```

The builder updates source submodules to remote branch tips, records their exact
SHAs in `bundle/release.json`, restores locked frontend dependencies with `npm ci`,
builds the UI and runs API/CLI/bundle smoke checks before committing. `npm ci`
replaces the tutorial's `npm install` to avoid implicit dependency drift.
Runs with identical inputs create no new commits; `--push` also publishes commits
from earlier local-only runs. Local changes and unrelated staged work are rejected.

```sh
cd bundle
bun start
docker build -t snip .
docker run --rm -p 3000:3000 snip
```

The Bun image digest is pinned and runs as its non-root `bun` user. CLI execution
requires Node on the host; the Bun-only container serves UI/API/redirects.
`PUBLIC_DIR=./public` is generated configuration, not a secret.
Do not add credentials to bundle output.

## CI and release security

`main` must be the GitHub default branch for hourly schedules and manual workflows.
`bundle.yml` rebuilds hourly or on manual dispatch. It uses a write-scoped job for
branch updates, and explicitly dispatches Docker verification when a new release
is pinned: pushes using `GITHUB_TOKEN` do not trigger other push workflows.

`docker.yml` runs on changes to the `bundle` gitlink or its own workflow file, and
on manual dispatch. It never updates submodules to branch tips. It verifies the
source manifest and rebuilt UI bytes, runs frontend and API/CLI tests, and blocks
on high/critical npm audit findings. A separate image job builds once, scans with
Trivy, smoke-tests that container, and only then publishes that same image as
`ghcr.io/weirenye/snipdemo-day1:latest` and `sha-<short-main-sha>`.
Action revisions and the Bun base image are pinned. Only publication has
`packages: write`; no personal token is stored in workflows.

The current Angular 19 dependency tree has high and critical audit findings.
Publication is intentionally blocked until those are resolved; do not bypass the
gate or force an Angular major upgrade without agreeing on the architecture change.
Docker is unavailable locally; container/image checks run on GitHub's Linux runner.
GHCR packages may initially be private.

## Railway

The generated branch includes Dockerfile builder selection and an `/api/links`
health check. Match `PORT` (default 3000) to the public domain target port and set
`BASE_URL` for a custom origin, otherwise the Railway public domain is used.
Storage remains in memory; redeploys and rollbacks clear links.
The tutorial's bundle-branch auto-deploy would bypass the image release gate.
For verified releases, deploy a passing GHCR image by immutable digest, retain the
previous verified digest for rollback, and smoke-test UI/create/list/redirect/CLI.
No Railway service has been configured or deployed by this workshop pipeline.
