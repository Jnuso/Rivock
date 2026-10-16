# Rivock frontend

React 19 + TypeScript + Vite starter for the Rivock public thread/advice site.

## Setup

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Environment:

- `VITE_API_URL` defaults to `http://localhost:8000/api/v1`
- `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_AUTHORITY`, `VITE_ENTRA_API_SCOPE` required for sign-in
- Without Entra config, public browsing still works; sign-in explains missing configuration

## Scripts

- `npm run dev`: Vite dev server
- `npm run build`: production build
- `npm test`: Vitest (Markdown, API retry/auth and conversation flows)
