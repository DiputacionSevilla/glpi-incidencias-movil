---
name: deploy-glpi-movil
description: Use when deploying, diagnosing, or updating this GLPI mobile application with Docker Compose, Caddy, Nginx Proxy Manager, DNS, HTTPS, or the Ubuntu server 10.158.1.3.
---

# Deploy GLPI Movil

## Current Deployment

- Server: Ubuntu 24.04 at `10.158.1.3`.
- SSH user: `fjcarrion`; Docker commands currently require `sudo`.
- Project directory: `/home/fjcarrion/glpi-incidencias-movil`.
- Compose services: `app`, `redis`, `proxy`.
- Caddy listens only on port `80` and reverse-proxies to `app:3000`.
- Redis is internal to Docker and stores ephemeral sessions; restarting it invalidates active application sessions.
- Do not put credentials, `SESSION_SECRET`, or `GLPI_APP_TOKEN` in source files, skills, commands, logs, or handoff documents.

## Proxy and HTTPS

- Public domain: `cuentasclaras.mairenadelalcor.net`.
- The name resolves to `176.32.50.234`, where Nginx Proxy Manager/OpenResty is installed.
- Nginx Proxy Manager must terminate TLS and proxy to `http://10.158.1.3:80`, preserving `Host` and forwarding HTTPS information.
- The backend is verified with a request carrying `Host: cuentasclaras.mairenadelalcor.net` and returns health endpoints through Caddy.
- TLS was pending at the last handoff. A TLS error such as `tlsv1 unrecognized name` means NPM lacks a valid Proxy Host and/or certificate for the domain.
- Configure NPM with WebSockets enabled, block common exploits enabled, a Let's Encrypt certificate, and Force SSL after the certificate is issued.
- After HTTPS works, remove temporary HTTP origins from `APP_ORIGIN`, retaining only `https://cuentasclaras.mairenadelalcor.net`, then recreate `app`. This restores `Secure` cookies and enables mobile dictation.

## Compose Operations

```sh
ssh fjcarrion@10.158.1.3
cd /home/fjcarrion/glpi-incidencias-movil
sudo docker compose ps
sudo docker compose logs --tail=100 app
curl --fail http://10.158.1.3/api/health/live
curl --fail http://10.158.1.3/api/health/ready
```

For an application update, copy only source/deployment files. Preserve remote `.env`.

```sh
sudo docker compose build app
sudo docker compose up -d --force-recreate app
sudo docker compose ps
curl --fail http://10.158.1.3/api/health/ready
```

- Do not use `docker compose down -v` during normal updates.
- Do not remove unrelated containers, images, volumes, or build caches.
- The root volume was expanded with LVM to about 22 GB. Check `df -h /` before large builds.

## Environment Rules

- Remote `.env` must have mode `0600`.
- Keep `GLPI_BASE_URL`, valid `GLPI_APP_TOKEN`, `SESSION_SECRET`, `REDIS_URL`, and `APP_ORIGIN` configured.
- Compose should never load `.env.local`; that file may contain local diagnostic credentials.
- If GLPI readiness fails, test name resolution and the public GLPI endpoint from inside `app`, then inspect `docker compose logs app` without leaking secrets.

## Verification Checklist

1. `docker compose ps`: app and Redis healthy.
2. `/api/health/live`: process responds.
3. `/api/health/ready`: Redis and GLPI connectivity work.
4. Test authenticated login, ticket listing, user search, and one authorized write against a disposable ticket.
5. Once NPM TLS is active, validate `https://cuentasclaras.mairenadelalcor.net/api/health/ready` and mobile dictation.

## Related Context

Read `HANDOFF_2026-08-13.md` before significant deployment or proxy changes. It contains the latest validated topology and functional state without sensitive values.
