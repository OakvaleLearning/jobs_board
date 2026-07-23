# Deployment Guide — Oakvale Learning Jobs Portal (VPS)

This guide walks through deploying the portal to a single VPS using the Docker Compose
stack that ships with this repo. The whole application (Postgres, Redis, backend, frontend,
Nginx) runs as one Compose project.

The production path is:

```
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
```

Everything below prepares the server and environment for that command, then layers HTTPS on
top of the bundled Nginx.

---

## 1. Prerequisites

- **A VPS** running Ubuntu 22.04 or 24.04 LTS. Recommended minimum **2 vCPU / 4 GB RAM**
  (the box runs Postgres, Redis, a Node backend, and a Next.js frontend together; the
  frontend `sharp`/Next build is memory-hungry).
- **A domain name** with a DNS **A record** pointing at the VPS public IP (e.g.
  `portal.oakvaleltd.com → 203.0.113.10`). HTTPS issuance in section 6 requires this.
- **SSH access** with a sudo-capable user (steps below create one if you only have root).

This guide is written for the production domain **`jobs.oakvaleltd.com`**. Replace `<vps-ip>`
with your server's public IP where it appears.

---

## 2. Server preparation

SSH in as root (or your provider's default user) and update the base system:

```bash
apt update && apt upgrade -y
```

### 2.1 Create a non-root sudo user

This guide uses an admin user named **`preacher`** — substitute your own name if different,
but use it **consistently** everywhere below.

```bash
adduser preacher                    # skip if the user already exists
usermod -aG sudo preacher           # grant sudo
```

Give the user your SSH public key so you can log in without a password. **The keys must land
in that user's own home directory** (`/home/preacher`) — a common mistake is copying to a
different path (e.g. `/home/deploy`), which leaves the account with no `authorized_keys` and
no way to log in:

```bash
# copies root's authorized_keys so the same key works for preacher
rsync --archive --chown=preacher:preacher ~/.ssh /home/preacher
ls -la /home/preacher/.ssh          # confirm authorized_keys is present here
```

Also set a password as a fallback in case key auth has any issue:

```bash
passwd preacher
```

> ⚠️ **Do NOT disable root/password login yet.** First prove you can get in as `preacher`
> (next step). Locking down before verifying is the #1 way people lock themselves out.

### 2.1a Verify the new user, THEN harden SSH

**Keep your current root session open.** In a **separate** terminal, log in as the new user
and confirm sudo works:

```bash
ssh preacher@<vps-ip>
sudo whoami          # must print: root
```

Only once that works, harden the SSH daemon. On Ubuntu cloud images the effective setting
often comes from a drop-in file (`/etc/ssh/sshd_config.d/50-cloud-init.conf`) that
**silently overrides** the main `sshd_config` — so you must fix both. First see what's set:

```bash
grep -R "PermitRootLogin\|PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
```

Then disable root login and password auth in the main config **and** in the cloud-init
drop-in if it re-enables them:

```bash
# main config
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# cloud-init drop-in (only exists on some images) — the one that actually wins
sudo sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/50-cloud-init.conf 2>/dev/null || true

sudo sshd -t                        # validate config — must print nothing
sudo systemctl restart ssh
```

**Verify before closing anything.** From a fresh terminal: `ssh preacher@<vps-ip>` should
still work with your key (no password prompt), and `ssh root@<vps-ip>` should now be
**refused**. Keep the working session open until you've confirmed this.

### 2.2 Install Docker Engine + Compose plugin

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker preacher
```

Log out and back in as `preacher` so the `docker` group membership applies, then verify:

```bash
docker --version
docker compose version
```

### 2.3 Firewall

Allow SSH and web traffic only:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

> The Compose stack also publishes Postgres (`5433`), Redis (`6379`), and the backend/
> frontend ports on the host by default. With `ufw` enabled as above those ports are **not**
> reachable from the internet, which is what we want — only Nginx (80/443) is public. If your
> provider has a separate cloud firewall, mirror the same rules there.

### 2.4 (Optional) Swap

If the VPS has ≤4 GB RAM, add swap so the frontend build doesn't get OOM-killed:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Get the code

```bash
sudo mkdir -p /opt/oakvale
sudo chown preacher:preacher /opt/oakvale
cd /opt/oakvale
git clone <your-repo-url> jobs_portal
cd jobs_portal
```

The rest of the guide assumes your working directory is `/opt/oakvale/jobs_portal`.

> **Why the source is on the VPS:** the production Compose file bind-mounts `../backend` and
> `../frontend` into the containers and builds against the current tree. To deploy a new
> version you `git pull` here and rebuild (see section 7).

---

## 4. Configure environment (`.env`)

All services read secrets from a single root `.env` file (referenced via `env_file` in
Compose). It is **gitignored** and must be created on the server — never commit it.

```bash
cp .env.example .env
nano .env
```

Set production values. At minimum:

```dotenv
# App
NODE_ENV=production
PORT=3000
APP_URL=https://jobs.oakvaleltd.com

# Database — password MUST match the Postgres service (see §4.1)
DATABASE_URL=postgresql://oakvale:<strong-db-password>@postgres:5432/oakvale_jobs

# Redis
REDIS_URL=redis://redis:6379

# JWT — generate fresh secrets, do NOT reuse the dev defaults
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800

# Frontend API URLs
NEXT_PUBLIC_API_URL=https://jobs.oakvaleltd.com/api/v1
INTERNAL_API_URL=http://backend:3000/api/v1

# S3 / Cloudflare R2 — required in production
S3_BUCKET=...
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_PUBLIC_URL=https://pub-xxxx.r2.dev   # required: public base URL for file downloads

# Payments (set when the pipelines go live)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
PAYSTACK_SECRET_KEY=...
PAYSTACK_WEBHOOK_SECRET=...

# Email / SMS
RESEND_API_KEY=...
FROM_EMAIL=noreply@oakvaleltd.com
TERMII_API_KEY=...
TERMII_SENDER_ID=Oakvale
```

Generate strong secrets with:

```bash
openssl rand -hex 32
```

> **`NEXT_PUBLIC_API_URL` is baked into the frontend at request time** and must be the
> public HTTPS URL. `INTERNAL_API_URL` stays on the internal Docker network
> (`http://backend:3000/api/v1`) — do not change it to the public URL.

### 4.1 Change the default database password

The Postgres service in `infra/docker-compose.yml` currently hard-codes
`POSTGRES_PASSWORD: oakvale`. **Change this before exposing the server.** Either:

- **Option A (edit Compose):** update `POSTGRES_USER` / `POSTGRES_PASSWORD` /
  `POSTGRES_DB` in `infra/docker-compose.yml`, and make `DATABASE_URL` in `.env` match; or
- **Option B (parameterise):** replace the hard-coded values with env references, e.g.
  `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`, and set `POSTGRES_PASSWORD` in `.env` alongside
  a matching `DATABASE_URL`.

The Postgres username, password, and database name in `DATABASE_URL` **must** match the
`postgres` service config, or the backend cannot connect.

---

## 5. First deploy over HTTP (validate before adding TLS)

Bring up the full production stack:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
```

This builds the images and starts everything with `restart: unless-stopped`. The developer
GUI tools (Adminer, Redis Commander) are parked behind a `tools` profile and **do not**
start here.

### 5.1 Migrations run automatically

The production backend command is `npm run db:migrate && npm run build && npm run start`, so
schema migrations are applied on every backend start. Watch the backend come up:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml logs -f backend
```

Wait until it reports the server is listening and healthy (the first boot builds TypeScript,
so give it a minute).

### 5.2 Seed the first admin and reference data

Seeds are **not** run automatically. Run them inside the backend container (this is the
required convention — run seeds/migrations in-container, never from the host):

```bash
# Minimum: create the first admin login
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  exec backend npm run db:seed-admin

# Reference data (workforce categories, care types, employer types, agent, etc.)
# NOTE: db:seed-all also loads TEST data — for a clean production DB, run the
# individual reference seeds instead of db:seed-all:
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  exec backend sh -c "npm run db:seed-categories && npm run db:seed-care-types && npm run db:seed-employer-types && npm run db:seed-agent"
```

> `db:seed-all` is convenient for staging but includes `db:seed-test` (fake workers/employers).
> Skip it on a real production database.

### 5.3 Verify

```bash
# Health endpoint — reports db and redis status
curl http://<vps-ip>/health
# → {"status":"ok","db":"ok","redis":"ok"}   (or "degraded" if redis is down)
```

Then open `http://jobs.oakvaleltd.com` in a browser. Once this works, add HTTPS.

---

## 6. Add HTTPS with Certbot + Nginx

The bundled Nginx listens on **:80 only**. We'll obtain a Let's Encrypt certificate and
reconfigure Nginx to serve TLS on :443 and redirect HTTP → HTTPS.

### 6.1 Add cert + ACME volumes to Nginx

Edit the `nginx` service in `infra/docker-compose.prod.yml` so it can read certificates and
serve the ACME challenge. Add these mounts (create the host directories first):

```bash
sudo mkdir -p /opt/oakvale/certbot/conf /opt/oakvale/certbot/www
```

```yaml
# infra/docker-compose.prod.yml
  nginx:
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /opt/oakvale/certbot/conf:/etc/letsencrypt:ro
      - /opt/oakvale/certbot/www:/var/www/certbot:ro
```

> The base `nginx` service only publishes `80`. Re-declaring `ports` and `volumes` in the
> prod override (as above) is what exposes `443` and mounts the certs in production.

### 6.2 Serve the ACME challenge (temporary HTTP config)

Before a certificate exists, Nginx must answer the HTTP-01 challenge. Add this `location` to
the existing `server { listen 80; ... }` block in `infra/nginx/nginx.conf`:

```nginx
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }
```

Apply the change and reload:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d nginx
```

### 6.3 Issue the certificate

Run a one-off Certbot container that writes into the shared volumes:

```bash
docker run --rm \
  -v /opt/oakvale/certbot/conf:/etc/letsencrypt \
  -v /opt/oakvale/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d jobs.oakvaleltd.com \
  --email you@oakvaleltd.com --agree-tos --no-eff-email
```

On success the cert lives at `/opt/oakvale/certbot/conf/live/jobs.oakvaleltd.com/`.

### 6.4 Switch Nginx to HTTPS

Replace `infra/nginx/nginx.conf` with the TLS version below (keeps the existing routing:
`/api/` and `/health` → backend, everything else → frontend, 12 MB upload limit):

```nginx
events {}

http {
  resolver 127.0.0.11 valid=10s ipv6=off;

  # HTTP: serve ACME challenge, redirect everything else to HTTPS
  server {
    listen 80;
    server_name jobs.oakvaleltd.com;

    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }

    location / {
      return 301 https://$host$request_uri;
    }
  }

  # HTTPS
  server {
    listen 443 ssl;
    server_name jobs.oakvaleltd.com;
    client_max_body_size 12M;

    ssl_certificate     /etc/letsencrypt/live/jobs.oakvaleltd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobs.oakvaleltd.com/privkey.pem;

    location /api/ {
      set $upstream_backend backend:3000;
      proxy_pass http://$upstream_backend;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
      set $upstream_backend backend:3000;
      proxy_pass http://$upstream_backend/health;
    }

    location / {
      set $upstream_frontend frontend:3000;
      proxy_pass http://$upstream_frontend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
    }
  }
}
```

Reload:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d nginx
```

Verify `https://jobs.oakvaleltd.com` loads and `https://jobs.oakvaleltd.com/health` returns `ok`.

### 6.5 Auto-renew

Let's Encrypt certs last 90 days. Add a cron job (run `crontab -e` as `preacher`) that renews
and reloads Nginx:

```cron
0 3 * * * docker run --rm -v /opt/oakvale/certbot/conf:/etc/letsencrypt -v /opt/oakvale/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose -f /opt/oakvale/jobs_portal/infra/docker-compose.yml -f /opt/oakvale/jobs_portal/infra/docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 7. Operations reference

Define a shorthand to save typing (optional):

```bash
alias dcp='docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml'
```

### Deploy a new version

```bash
cd /opt/oakvale/jobs_portal
git pull
dcp up -d --build     # migrations re-run automatically on backend start
```

### Common commands

```bash
dcp ps                        # service status
dcp logs -f backend           # tail backend logs
dcp logs -f frontend
dcp restart backend           # restart a single service
dcp down                      # stop the stack (named volumes persist data)
```

### Run migrations manually

```bash
dcp exec backend npm run db:migrate
```

### Database backups

```bash
# Dump to a host file
dcp exec -T postgres pg_dump -U oakvale oakvale_jobs > backup_$(date +%F).sql

# Restore
cat backup_2026-07-21.sql | dcp exec -T postgres psql -U oakvale oakvale_jobs
```

Application state lives in the `pgdata` and `redisdata` Docker volumes. `dcp down` keeps
them; `dcp down -v` **deletes** them — never use `-v` in production unless you intend to
wipe the database.

---

## 8. Troubleshooting & known limitations

- **Frontend runs `next dev` in production (known).** The production override intentionally
  keeps the frontend on the dev command because a clean `next build` currently fails while
  static-exporting Next's internal error pages (`/_error` → `/404`, `/500`) — a
  framework/config issue unrelated to app code (all real pages build). This is the currently
  supported production path; switching to `next build && next start` is tracked tech debt.
  See the comment block in `infra/docker-compose.prod.yml`.
- **Change the default Postgres password** (§4.1) before the server is reachable from the
  internet. The repo ships with `oakvale:oakvale` for local dev only.
- **Nginx is the only TLS terminator here.** If you later put a managed load balancer or
  Cloudflare in front, terminate TLS there and keep the container Nginx on plain `:80`.
- **Backend won't start / DB connection errors:** confirm `DATABASE_URL` in `.env` matches
  the Postgres service credentials exactly (user, password, `@postgres:5432`, db name).
- **`/health` returns `degraded`:** the `db` or `redis` field will show `down` — check
  `dcp logs postgres` / `dcp logs redis` and that both are healthy in `dcp ps`.
- **Frontend can't reach the API:** verify `NEXT_PUBLIC_API_URL=https://jobs.oakvaleltd.com/api/v1`
  (public) and `INTERNAL_API_URL=http://backend:3000/api/v1` (internal), then rebuild the
  frontend (`dcp up -d --build frontend`).
