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

## ARM/Apple Silicon hosts
PhantomJS has no arm64 binary. The compose file pins the app image to `linux/amd64` to avoid build failures on Apple Silicon and other ARM machines. If you override this, set:

```yaml
webapp:
  platform: linux/amd64
  build:
    platform: linux/amd64
```

Builds under emulation can be slower.

## Useful commands
- See service status: `docker compose ps`
- Tail logs: `docker compose logs -f webapp` or `docker compose logs -f mongodb`
- Rebuild after changes: `docker compose build` then `docker compose up -d`
- Stop services: `docker compose down`

## Stop, start, and upgrade while keeping data

Data lives in:
- Named volume: `mongo_data` (MongoDB data)
- Bind mounts: `./logs`, `./uploads`

Stopping containers (keep data):
```powershell
# Stop containers but keep network/volumes
docker compose stop

# Remove containers and network (keeps named volumes and bind-mounted host data)
docker compose down
```

Start again (data persists):
```powershell
docker compose up -d
```

Upgrade app image (keep data):
```powershell
# If pulling from a registry
docker compose pull
# Or rebuild from source
docker compose build
# Apply new containers without losing data
docker compose up -d
```

Important: don’t use `-v` with `down` unless you intend to delete data:
```powershell
# DANGEROUS: deletes named volumes (Mongo data)
docker compose down -v
```

Backup tips (Mongo named volume):
```powershell
# Create a quick tarball of the named volume into current folder
# Replace persabe_mongo_data with your actual volume name if different
docker run --rm -v persabe_mongo_data:/data/db -v ${PWD}:/backup alpine `
  sh -c "tar czf /backup/mongo_data.tgz -C /data db"
```
Or use `mongodump` from inside the running Mongo container for logical backups.

## Troubleshooting
- Port already in use: change the left side of the `ports` mapping in `docker-compose.yml` (e.g., `8080:4002`)
- Mongo restore didn’t run: ensure your dump folder matches `MONGO_INITDB_DATABASE` and path `./dump/<DB_NAME>`; remove the `mongo_data` volume to re-trigger init on a clean start (`docker compose down -v`)
- App cannot reach Mongo: confirm `MONGO_URL` uses the service name `mongodb` and port `27017`; wait for the Mongo healthcheck to pass
- Logs/Uploads not written: check host folder permissions on `./logs` and `./uploads`

## Windows setup and troubleshooting

If `docker compose build` fails with:

```
error during connect: Head "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Follow these steps (PowerShell):

1) Ensure Docker is running and using Linux containers
```powershell
# Start Docker Desktop manually and wait for the whale icon to say "Running"
# If using Docker Desktop, switch to Linux containers
# Right‑click Docker icon > Switch to Linux containers (or Settings > General > Use the WSL 2 based engine)
```

2) Install/enable WSL2 (Windows 10/11)
```powershell
wsl --status
wsl --install -d Ubuntu   # if WSL or a distro is missing
wsl --set-default-version 2
wsl --shutdown            # restart WSL backend
```
Open Docker Desktop > Settings > Resources > WSL Integration, enable integration for your distro (e.g., Ubuntu).

3) Verify Docker daemon connectivity
```powershell
docker version
docker info
docker context ls
# If needed, switch context
docker context use default
```

4) Rebuild and start
```powershell
cd C:\Codabe\github\admineex
mkdir logs, uploads 2>$null
docker compose build
docker compose up -d
```

### Fix: WSL2 not supported / HCS_E_HYPERV_NOT_INSTALLED
If you see errors like:

```
WSL2 is not supported with your current machine configuration.
Please enable the "Virtual Machine Platform" optional component and ensure virtualization is enabled in the BIOS.
Error code: HCS_E_HYPERV_NOT_INSTALLED
```

Do this (PowerShell as Administrator):

1) Ensure hardware virtualization is enabled
- Reboot and enable Intel VT‑x/AMD‑V in BIOS/UEFI (Task Manager > Performance > CPU should show "Virtualization: Enabled").

2) Enable required Windows features
```powershell
# WSL and Virtual Machine Platform (required for WSL2)
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
# Optional but recommended on Pro/Enterprise (for Hyper‑V backend fallback)
dism /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart
# Containers feature (optional)
dism /online /enable-feature /featurename:Containers /all /norestart
```
Reboot:
```powershell
shutdown /r /t 0
```

3) Install/update WSL2
```powershell
wsl --status
wsl --install -d Ubuntu         # installs WSL + Ubuntu if missing
wsl --set-default-version 2
wsl --update
wsl --shutdown
```
Docker Desktop > Settings > General: enable "Use the WSL 2 based engine"; Settings > Resources > WSL Integration: enable your distro (e.g., Ubuntu).

4) Verify Docker daemon and context
```powershell
docker version
docker info
docker context ls
docker context use default
```

5) Rebuild and run
```powershell
cd C:\Codabe\github\admineex
mkdir logs, uploads 2>$null
docker compose build
docker compose up -d
```

Fallback (if WSL2 not allowed):
- In Docker Desktop > Settings > General, uncheck "Use the WSL 2 based engine" to use the Hyper‑V backend (requires Windows Pro/Enterprise and Hyper‑V enabled). Restart Docker Desktop.
- Or run a small Linux VM (Hyper‑V/VirtualBox/VMware) and use Docker Engine inside it.
- On Windows Server: prefer Server 2022+ with WSL2; Server 2019 lacks WSL2—use a Linux VM or a separate Linux host.

## Production notes
- Keep `restart: unless-stopped` enabled (already configured)
- Put an HTTPS reverse proxy (e.g., nginx, Traefik) in front of `webapp` for TLS and compression
- Provide mailer credentials via env; avoid storing secrets in `server.json`

---
If you change the database name, update both:
- `mongodb.environment.MONGO_INITDB_DATABASE`
- `webapp.environment.MONGO_URL`
And ensure your dump (if any) is under `./dump/<your-db-name>`.
