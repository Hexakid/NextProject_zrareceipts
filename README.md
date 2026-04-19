# VAT Receipt Data Collector App

React + Vite app for ZRA invoice capture, scanning, and CSV export.

Now includes:
- IndexedDB persistence via Dexie
- Stable invoice IDs for reliable edit/delete/select behavior
- Server-side AI extraction endpoint (`/api/extract`) to keep API keys out of the browser
- Zod-based form validation
- Tailwind CSS compiled locally (no CDN in production)

## Run locally

1. Install dependencies:
   npm install
2. Create a `.env` file from [.env.example](.env.example) and set `GEMINI_API_KEY`
3. Start dev server (client + API server):
   npm run dev
4. Open the local URL shown in terminal.

## API server

- Runs on `http://localhost:8787` in local dev
- Runs on `PORT` (typically `3000`) in production/container
- Health check: `GET /api/health`
- Extraction endpoint: `POST /api/extract`

## Build

npm run build

## Deploy on Dokploy

This app is ready for Dokploy using Docker.

1. In Dokploy, create a new application from this repository.
2. Select Docker build (it will use [Dockerfile](Dockerfile)).
3. Set environment variables:
   - `GEMINI_API_KEY` = your Gemini key
   - `NODE_ENV` = `production`
   - `PORT` = `3000` (optional, Dokploy can inject this)
   - `TRUST_PROXY` = `1`
4. Expose port `3000` in Dokploy service settings.
5. Deploy.

Health endpoint:
- `GET /api/health`

### Production hardening included

- Security headers via `helmet`
- Response compression via `compression`
- Rate limiting for `POST /api/extract`
- Payload type/size validation and upload caps
- Gemini request timeout handling
- Sanitized extraction response before returning to client

## Troubleshooting

- `/api/extract` returns `404`:
   - Ensure backend is deployed and running in the same service/container.
   - If frontend and API are on different domains, set `VITE_API_BASE_URL` at build time.
- `cdn.tailwindcss.com should not be used in production`:
   - Fixed in this project by switching to compiled Tailwind via PostCSS.
- `Host validation failed` / `Host is not supported` messages:
   - Usually from a browser extension, not this app runtime.
