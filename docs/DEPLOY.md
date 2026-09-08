# Deployment

## Local production mode

```bash
npm install
npm run build
NODE_ENV=production PORT=3000 npm start
```

## Docker

```bash
docker compose up --build -d
curl http://localhost:3000/api/health
```

## Render

1. Push this repository to GitHub / GitLab.
2. In Render, New → Blueprint, or New Web Service with the Dockerfile.
3. Set:
   - `APP_URL` = `https://<name>.onrender.com`
   - `TRUST_PROXY` = `true`
   - `NODE_ENV` = `production`
   - optional TURN and Twilio secrets as **secret** env vars
4. Health check path: `/api/health`

The SPA, REST API, and WebSocket endpoint share one service so Render’s reverse proxy can keep them on the same origin (`wss://…/ws`).

## Nginx (optional front)

If you terminate TLS yourself:

```
server {
  listen 443 ssl http2;
  server_name yourdomain.example;
  # ssl_certificate ...;

  location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then set `TRUST_PROXY=true` and `APP_URL=https://yourdomain.example`.
