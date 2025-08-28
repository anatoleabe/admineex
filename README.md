# Persabe — Docker Deployment Guide

This repository is wired to run the Node.js web app and MongoDB in Docker for local and production-like environments.

## Prerequisites
- Docker and Docker Compose installed
- Optional: a MongoDB dump to seed the database (place under `./dump/<DB_NAME>`)

## Quick start
1) Build images

```bash
docker compose build
```

2) Start the stack

```bash
docker compose up -d
```

3) Open the app: http://localhost:4002

The API and static UI are served by the Node app inside `webapp`. MongoDB runs as `mongodb`.

## Services and ports
- webapp: Node.js server, exposed on host port 4002 (container port 4002)
- mongodb: MongoDB server, exposed on host port 27020 (container port 27017)

## Volumes and persistence
- Mongo data: named volume `mongo_data` persisted by Docker
- App logs: `./logs` on host mapped to `/usr/src/app/codabe/admineex/logs`
- Uploads: `./uploads` on host mapped to `/usr/src/app/codabe/admineex/server/uploads`

Ensure `./logs` and `./uploads` exist and are writable by Docker on your system.

## Configuration (environment variables)
The app reads configuration from `server/config/server.json`, overridden by environment variables at runtime:

- HTTP_PORT or PORT: container listening port (default 4002)
- MONGO_URL: MongoDB connection string (default `mongodb://mongodb:27017/persabe30072025`)
- LOG_PATH: log folder inside the container (default `/usr/src/app/codabe/admineex/logs`)
- MAILER_HOST, MAILER_PORT, MAILER_USER, MAILER_PASS: SMTP settings for email

These are set under the `webapp.environment` section of `docker-compose.yml`. Adjust as needed.

## Database initialization from dump (optional)
If you have a Mongo dump, mount it under `./dump`. On first `mongodb` startup, the init script restores the database:

- Target DB name is taken from `MONGO_INITDB_DATABASE` (default set to `persabe30072025` in compose)
- Expected dump path: `./dump/persabe30072025` (or change both the env and folder name)
- Supports gzip (`.gz`) and plain BSON dumps

If no dump is present, MongoDB starts empty.

## Useful commands
- See service status: `docker compose ps`
- Tail logs: `docker compose logs -f webapp` or `docker compose logs -f mongodb`
- Rebuild after changes: `docker compose build` then `docker compose up -d`
- Stop services: `docker compose down`

## Troubleshooting
- Port already in use: change the left side of the `ports` mapping in `docker-compose.yml` (e.g., `8080:4002`)
- Mongo restore didn’t run: ensure your dump folder matches `MONGO_INITDB_DATABASE` and path `./dump/<DB_NAME>`; remove the `mongo_data` volume to re-trigger init on a clean start (`docker compose down -v`)
- App cannot reach Mongo: confirm `MONGO_URL` uses the service name `mongodb` and port `27017`; wait for the Mongo healthcheck to pass
- Logs/Uploads not written: check host folder permissions on `./logs` and `./uploads`

## Production notes
- Keep `restart: unless-stopped` enabled (already configured)
- Put an HTTPS reverse proxy (e.g., nginx, Traefik) in front of `webapp` for TLS and compression
- Provide mailer credentials via env; avoid storing secrets in `server.json`

---
If you change the database name, update both:
- `mongodb.environment.MONGO_INITDB_DATABASE`
- `webapp.environment.MONGO_URL`
And ensure your dump (if any) is under `./dump/<your-db-name>`.
