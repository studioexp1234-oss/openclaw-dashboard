# OpenClaw Dashboard

A clean mobile-first PWA dashboard for monitoring OpenClaw agents and local N8N workflows.

## Stack
- Backend: Node.js + Express
- Frontend: Vanilla HTML, CSS, and JavaScript
- PWA: manifest + service worker
- Auth: hardcoded PIN (`1337`)
- Port: `3458`

## Files
- `server.js` — Express server with API routes
- `public/index.html` — SPA shell with login and dashboard
- `public/style.css` — dark theme mobile-first styling
- `public/app.js` — frontend logic for auth, agents, and workflows
- `public/manifest.json` — installable PWA manifest
- `public/sw.js` — service worker caching static assets

## API
- `POST /api/auth` — validate PIN
- `GET /api/agents` — read agents from `/Users/mylilbitch/.openclaw/openclaw.json`
- `POST /api/agents/:id/model` — update agent model in `openclaw.json`
- `GET /api/n8n/workflows` — proxy local N8N workflows endpoint
- `POST /api/n8n/workflows/:id/toggle` — toggle workflow active state via N8N API

## Run
```bash
cd ~/openclaw-dashboard
npm install
node server.js
```

Then open <http://localhost:3458> and log in with PIN `1337`.
