# CryptoPilot Frontend

Web client of **CryptoPilot — Crypto Trading Support System**: market analysis, trading plans with risk
calculation, watchlist and alerts, journal and performance, community, news, AI assistant, subscriptions
and an administration console.

CryptoPilot supports decisions and simulated (paper) trading only. It never places real orders, never
connects exchange accounts or API keys, never holds funds and does not give investment advice.

## Requirements

- Node.js **22.13+** (22.x) or **24+**, npm
- A running CryptoPilot backend for live data (optional for UI work)

## Getting started

```bash
git clone https://github.com/huyhv-se180722/cryptopilot-frontend.git
cd cryptopilot-frontend
git switch develop
npm ci
npm run dev
```

Vite serves the app at `http://localhost:5173`. Without configuration the app runs and shows an
"integration pending" status strip.

## Environment

Copy `.env.example` to `.env` and adjust. Every `VITE_*` value is public and bundled into the client; never
put secrets in it.

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | REST API base URL; blank disables requests                     |
| `VITE_WS_URL`              | Realtime (WebSocket) URL; blank means unavailable              |
| `VITE_ENABLE_DEV_FIXTURES` | `true` enables labelled development data in `npm run dev` only |

Production builds require HTTPS/WSS URLs and never include development data.

## Scripts

| Command           | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Development server                              |
| `npm run build`   | Type check and production build into `dist/`    |
| `npm run preview` | Serve the production build locally              |
| `npm test`        | Unit tests (Vitest)                             |
| `npm run lint`    | ESLint, zero warnings                           |
| `npm run format`  | Apply Prettier                                  |
| `npm run check`   | Format check, types, lint, tests and build (CI) |

## Tech stack

React 19, TypeScript (strict), Vite, Tailwind CSS 4 and React Router 7.

## Workflow

Branches flow `feature/* → develop → main`. Open pull requests against `develop` with `npm run check`
passing; `main` receives reviewed releases only. Commits follow Conventional Commits
(`feat(scope): …`, `fix(scope): …`, `chore: …`).
