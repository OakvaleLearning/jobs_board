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

> **Why the source is on the VPS:** the production images are **built on the server** from the
> checked-out tree (`docker compose ... build` runs the multi-stage Dockerfiles). The build
> output is baked into the images — there are **no source bind-mounts** and nothing is compiled
> at container startup. To deploy a new version you `git pull` here and rebuild (see section 7).

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

The `postgres` service now reads its credentials from the environment
(`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, defaulting to `oakvale` for local
dev). **Set a strong `POSTGRES_PASSWORD` in `.env` before exposing the server**, and make the
`DATABASE_URL` in the same `.env` use the **same** user/password/db, e.g.:

```dotenv
POSTGRES_USER=oakvale
POSTGRES_PASSWORD=<strong-db-password>
POSTGRES_DB=oakvale_jobs
DATABASE_URL=postgresql://oakvale:<strong-db-password>@postgres:5432/oakvale_jobs
```

The credentials in `DATABASE_URL` **must** match the `POSTGRES_*` values, or the backend
cannot connect.

---

## 5. First deploy — app services (validate before adding TLS)

The production `nginx` serves TLS and references a certificate that doesn't exist yet, so on a
**fresh** server bring up everything **except nginx** first, validate, then issue the cert and
start nginx in section 6:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  up -d --build postgres redis backend frontend
```

This builds the multi-stage images and starts the app services with `restart: unless-stopped`.
The developer GUI tools (Adminer, Redis Commander) live in the **dev** override only and do not
exist in production.

> On later redeploys (once a cert exists) you can bring up the whole stack in one go with
> `... up -d --build`.

### 5.1 Migrations run automatically

The backend image's start command is
`node dist/backend/src/shared/db/migrate.js && node dist/backend/src/app.js`, so schema
migrations (compiled, no `tsx`) are applied on every backend start. Watch it come up:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml logs -f backend
```

Wait until it reports the server is listening and the container is healthy. Unlike before,
TypeScript is **already compiled into the image** at build time — nothing is built at startup.

### 5.2 Seed the first admin and reference data

Seeds are **not** run automatically. The runtime image has no `tsx`, so run the **compiled**
seed scripts (from `dist/`) inside the backend container (run seeds/migrations in-container,
never from the host):

```bash
# Minimum: create the first admin login
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  exec backend node dist/backend/src/shared/db/seed-admin.js

# Reference data (workforce categories, care types, employer types, agent).
# Run the individual reference seeds — do NOT run the test-data seed on production.
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  exec backend sh -c "node dist/backend/src/shared/db/seed-categories.js && node dist/backend/src/shared/db/seed-care-types.js && node dist/backend/src/shared/db/seed-employer-types.js && node dist/backend/src/shared/db/seed-agent.js"
```

> `seed-test-data.js` loads fake workers/employers — convenient for staging, never for a real
> production database.

### 5.3 Verify

```bash
# Health endpoint — hit the backend directly on its host port (nginx isn't up yet).
# BACKEND_HOST_PORT defaults to 3000; ufw keeps it off the public internet.
curl http://localhost:3000/health
# → {"status":"ok","db":"ok","redis":"ok"}   (or "degraded" if redis is down)
```

Once the backend reports healthy, add HTTPS (which also brings nginx up).

---

## 6. Add HTTPS with Certbot + Nginx

The production `infra/nginx/nginx.conf` already contains the full TLS config (`:80` serves the
ACME challenge and 301-redirects to HTTPS; `:443` proxies the app). The prod override
(`infra/docker-compose.prod.yml`) already publishes `:443` and mounts the certs from
`./certbot`. All that's left is to **issue the first certificate** before starting nginx — a
helper script does the whole dance so there's nothing to hand-edit.

> **Set your domain first.** `infra/nginx/nginx.conf` references `jobs.oakvaleltd.com` in three
> places (`server_name` ×2 and the two `ssl_certificate` paths). If you deploy under a different
> domain, replace it there before proceeding.

### 6.1 Issue the first certificate

From the repo root, run the bootstrap script with your domain and email. It stands up a
throwaway HTTP-only nginx to answer the Let's Encrypt HTTP-01 challenge, requests the cert into
`./certbot`, then tears the throwaway down:

```bash
./infra/init-letsencrypt.sh jobs.oakvaleltd.com you@oakvaleltd.com
# add --staging as a 3rd arg first to dry-run against Let's Encrypt staging
```

Prerequisites: `jobs.oakvaleltd.com` must already resolve to this server's public IP (`dig
+short jobs.oakvaleltd.com`), and port 80 must be open (ufw allows it). On success the cert is
at `./certbot/conf/live/jobs.oakvaleltd.com/`.

### 6.2 Start nginx (TLS)

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d nginx
```

Verify `https://jobs.oakvaleltd.com` loads and `https://jobs.oakvaleltd.com/health` returns
`{"status":"ok",...}`, and that plain HTTP 301-redirects to HTTPS.

### 6.3 Auto-renew

Let's Encrypt certs last 90 days. Add a cron job (run `crontab -e` as the deploy user) that
renews and reloads nginx. Note the `-T` on `docker compose exec` — cron has no TTY, and paths
must match your clone location:

```cron
0 3 * * * docker run --rm -v /opt/oakvale/jobs_portal/certbot/conf:/etc/letsencrypt -v /opt/oakvale/jobs_portal/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose -f /opt/oakvale/jobs_portal/infra/docker-compose.yml -f /opt/oakvale/jobs_portal/infra/docker-compose.prod.yml exec -T nginx nginx -s reload
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

The runtime image has no `tsx` — run the compiled migrate script:

```bash
dcp exec backend node dist/backend/src/shared/db/migrate.js
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

- **Production images are baked, not mounted.** Both services build via multi-stage Dockerfiles;
  the runtime images run compiled output (`node dist/...` / `next start`) with **no** source
  bind-mounts and **no** build-at-startup. If a code change isn't reflected, you forgot
  `--build` — always deploy with `dcp up -d --build`.
- **nginx crashes on start with "cannot load certificate":** the cert doesn't exist yet. On a
  fresh box, run `./infra/init-letsencrypt.sh` (§6.1) **before** starting nginx, or bring up the
  app services without nginx first (§5).
- **Change the default Postgres password** (§4.1) before the server is reachable from the
  internet. The repo ships with `oakvale:oakvale` for local dev only.
- **Nginx is the only TLS terminator here.** If you later put a managed load balancer or
  Cloudflare in front, terminate TLS there and keep the container Nginx on plain `:80`.
- **Backend won't start / DB connection errors:** confirm `DATABASE_URL` in `.env` matches the
  `POSTGRES_*` credentials exactly (user, password, `@postgres:5432`, db name).
- **Backend exits with "Invalid environment variables … required in production":** in
  production the app requires the real S3/Stripe/Paystack secrets (`S3_PUBLIC_URL`,
  `STRIPE_*`, `PAYSTACK_*`). Fill them in `.env` — the guard is intentional.
- **`/health` returns `degraded`:** the `db` or `redis` field will show `down` — check
  `dcp logs postgres` / `dcp logs redis` and that both are healthy in `dcp ps`.
- **Frontend can't reach the API:** `NEXT_PUBLIC_API_URL` is baked into the client bundle **at
  build time**, so after changing it you must rebuild the frontend image
  (`dcp up -d --build frontend`), not just restart it. Verify it's the public URL
  (`https://jobs.oakvaleltd.com/api/v1`) and `INTERNAL_API_URL=http://backend:3000/api/v1`.

### Local development

Development uses a separate override that restores hot-reload (bind-mounts, `tsx watch` /
`next dev`) and the Adminer + Redis Commander GUIs:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build
# or simply: npm run dev
```
