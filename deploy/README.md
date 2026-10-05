# Deploying Trip Packing

The jarvis server (`dan@100.102.159.57`) runs both environments. Each is a git checkout
that pulls through a read-only deploy key (`~/.ssh/trip-packing-deploy`, host alias
`github-trip-packing`).

| Env  | Branch | Path                     | Port | Service            | URL                              |
| ---- | ------ | ------------------------ | ---- | ------------------ | -------------------------------- |
| PROD | `main` | `/opt/trip-packing`      | 4840 | `trip-packing`     | https://packing.dabrewer.dev     |
| DEV  | `dev`  | `/opt/trip-packing-dev`  | 4850 | `trip-packing-dev` | https://packing.dev.dabrewer.dev |

Each environment has its own SQLite DB at `data/packing.db`. Dev's `.env` holds
`JARVIS_ENV=dev`; prod has no `.env`, or one without that line.

## Tailnet-only

1. **DNS**: dev uses the `*.dev.dabrewer.dev` wildcard. Prod has an explicit **A record
   `packing` → `100.102.159.57`** (DNS-only). Both resolve to the Tailscale IP, so only
   tailnet devices can connect.
2. **nginx**: both server blocks carry `allow 100.64.0.0/10; allow 127.0.0.1; deny all;`, so a
   request that reaches the box any other way (for example from the LAN) gets a 403.
   The blocks are in [nginx.conf](nginx.conf).

## Workflow

```bash
git push origin dev
ssh dan@100.102.159.57 /opt/trip-packing-dev/deploy/update-dev.sh   # → DEV
# after an approved dev→main PR is merged:
ssh dan@100.102.159.57 /opt/trip-packing/deploy/update.sh           # → PROD
```

## First-time setup (per environment)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/trip-packing-deploy -N "" -C "trip-packing deploy (jarvis-server)"
gh repo deploy-key add ~/.ssh/trip-packing-deploy.pub -R BrewerIndustries/trip-packing -t jarvis-server
# ~/.ssh/config:  Host github-trip-packing / HostName github.com / User git /
#                 IdentityFile ~/.ssh/trip-packing-deploy / IdentitiesOnly yes

sudo mkdir -p /opt/trip-packing && sudo chown dan:dan /opt/trip-packing
git clone -b main github-trip-packing:BrewerIndustries/trip-packing.git /opt/trip-packing
cd /opt/trip-packing && npm install && npm run build      # as dan, never sudo
sudo cp deploy/trip-packing.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now trip-packing
# nginx: append the prod block from deploy/nginx.conf → sudo nginx -t && sudo systemctl reload nginx
# DNS (prod only): A packing → 100.102.159.57, proxied:false (Cloudflare API, token in /etc/cloudflare/credentials.ini)
```
