# Secure Backend Setup

This project now includes a hardened Node.js backend (`server.js`) that serves the existing website files without changing frontend behavior.

## Start

```bash
npm run start
```

Server default: `http://0.0.0.0:8080`

## Security controls included

- Strict request method policy (`GET`, `HEAD`, `OPTIONS`)
- Strict static file serving (no directory listing, path traversal blocked)
- Rate limiting with temporary IP blocking
- Per-IP concurrent request cap
- Security headers:
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `Strict-Transport-Security` (when `FORCE_HTTPS=true`)
- Host header allow-list support (`ALLOWED_HOSTS`)
- URL length and payload size limits

## Production recommendations

1. Run behind a reverse proxy (Nginx, Caddy, Traefik, Cloudflare).
2. Enable TLS at the edge and set `FORCE_HTTPS=true`.
3. Set `TRUST_PROXY=true` only when proxy headers are trusted.
4. Set `ALLOWED_HOSTS` to your exact production domain list.
5. Keep Node.js updated (LTS).
