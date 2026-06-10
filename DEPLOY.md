# University Landing Platform — VPS Deployment Guide (Hostinger)

## Overview

This guide explains how to deploy the platform on a Hostinger KVM VPS using:
- **Node.js 20+** — runtime
- **PM2** — process manager (cluster mode, zero-downtime reloads)
- **Caddy** — reverse proxy with automatic HTTPS via Let's Encrypt

---

## Prerequisites

Your VPS should have the following installed:

| Software | Version | Install |
|----------|---------|---------|
| Node.js | 20 LTS | `curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs` |
| PM2 | latest | `npm install -g pm2` |
| Caddy | 2.7+ | [caddyserver.com/docs/install](https://caddyserver.com/docs/install) |
| PostgreSQL | 15+ | `apt install -y postgresql postgresql-contrib` |
| Git | any | `apt install -y git` |

---

## First-Time Setup

### 1 — Clone the repository

```bash
git clone https://github.com/your-org/uni-landing.git /var/www/uni-landing
cd /var/www/uni-landing
```

### 2 — Create the uploads directory

This directory lives **outside** the repo so uploads survive deployments.

```bash
mkdir -p /var/data/uni-landing/uploads
chown -R www-data:www-data /var/data/uni-landing   # or your app user
```

### 3 — Configure environment variables

```bash
cp .env.example .env
nano .env   # fill in DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY, UPLOADS_DIR
```

> ⚠️ **ENCRYPTION_KEY — Critical Warning**
>
> Generate this key **once** before first launch:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> **Back it up immediately to a secure password manager or secrets vault.**
>
> If the key is lost or changed after AI API keys have been stored in the database,
> all stored API keys become permanently unrecoverable and must be re-entered
> manually on every tenant. **Never rotate this key once in production.**

### 4 — Install dependencies & build

```bash
npm install
npm run build
```

Verify the output:
```
dist/index.cjs   ← server bundle
dist/public/     ← compiled frontend (HTML + JS + CSS)
```

### 5 — Initialize the database

```bash
npm run db:push
```

This creates all tables using Drizzle's push mechanism. On first run it also seeds the default tenant and admin account.

### 6 — Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save          # persist process list across reboots
pm2 startup       # generate and install startup script
```

Check logs:
```bash
pm2 logs uni-landing
pm2 status
```

### 7 — Configure Caddy

```bash
cp Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile   # update email, UPLOADS_DIR path
systemctl reload caddy
```

Caddy will automatically obtain Let's Encrypt certificates for each domain
added via the admin panel. No manual certificate management needed.

---

## Adding a New University Domain

1. **Admin panel** → Sites → select tenant → Domains → add the new domain
2. **DNS** — point the domain's A/AAAA record to the VPS IP
3. **Wait ~1–2 minutes** for DNS to propagate
4. **First visitor** to the new domain triggers Caddy's on-demand TLS check.
   Caddy calls `GET /api/internal/verify-domain?domain=<host>`, the app
   returns `200` (domain is in the DB), and Caddy issues a Let's Encrypt cert.
5. **Done** — HTTPS works automatically.

> Domains that are **not** in the `tenant_domains` table get a `403` from the
> verify-domain endpoint, so Caddy refuses to issue a certificate for them.
> This prevents certificate abuse.

---

## Deploying Updates

Use the included deployment script for zero-downtime updates:

```bash
cd /var/www/uni-landing
bash deploy.sh
```

The script runs in order:
1. `git pull --ff-only`
2. `npm install`
3. `npm run build`
4. `npm run db:push`
5. `pm2 reload ecosystem.config.cjs --update-env`

PM2's `reload` performs a rolling restart — old workers stay alive until new
ones are ready, so there is no downtime.

---

## Blog Scheduler (multi-instance note)

In cluster mode PM2 spawns one worker per CPU core.  The blog post scheduler
must only run in **one** worker to avoid duplicate post publishing.  The server
automatically checks `process.env.NODE_APP_INSTANCE === '0'` (set by PM2) and
starts the cron job only in the primary worker.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Random string for signing session cookies (≥ 32 chars) |
| `ENCRYPTION_KEY` | ✅ | 64-char hex key for AES-256 encryption of AI API keys |
| `UPLOADS_DIR` | ✅ | Absolute path for file uploads (e.g. `/var/data/uni-landing/uploads`) |
| `PORT` | optional | Server port (default: `5000`) |
| `NODE_ENV` | optional | Set to `production` (PM2 does this automatically) |

> **Removed from VPS setup:** `DEFAULT_OBJECT_STORAGE_BUCKET_ID`,
> `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` — these were Replit
> object-storage variables.  On VPS, local disk storage via `UPLOADS_DIR`
> replaces them entirely.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `SESSION_SECRET` not set error on startup | Missing env var | Add to `.env` or PM2 env |
| Caddy doesn't issue cert for new domain | Domain not in DB | Add domain via admin panel first |
| AI API keys show "decryption error" | `ENCRYPTION_KEY` changed | Restore original key from backup |
| Uploads return 404 | `UPLOADS_DIR` path mismatch | Check `.env` and Caddyfile path |
| PM2 workers keep restarting | OOM / memory leak | Reduce `instances` in `ecosystem.config.cjs` |

---

## Useful Commands

```bash
pm2 status                         # Show process list
pm2 logs uni-landing --lines 100   # Last 100 log lines
pm2 reload uni-landing             # Zero-downtime restart
pm2 monit                          # Real-time CPU/memory monitor

systemctl status caddy             # Caddy status
journalctl -u caddy -f             # Caddy live logs
caddy validate --config /etc/caddy/Caddyfile  # Validate config

psql $DATABASE_URL -c "\dt"        # List DB tables
```
