# CryptoPilot Frontend

CryptoPilot frontend application for crypto market analysis, trading planning, risk management, AI assistance, community, news, and subscription management.

**Foundation only.** Product routes are placeholders. Backend authentication, HTTP endpoints, and realtime wire protocols are not connected. No market prices, accounts, plans, or other business records are fabricated.

## Project Overview

CryptoPilot is a Crypto Trading Support System for Spot/Futures analysis, simulated planning, risk review, and trading discipline. It does not execute real trades or connect users' exchange accounts.

The official capstone registration document is the functional authority. The reconciled requirement baseline distinguishes confirmed requirements from proposals and open decisions. Figma is the visual/UX authority; prototype demo data must never enter production.

## Product Goals

- Support the loop: market analysis → plan → risk validation → AI explanation → paper result → journal → performance.
- Make deterministic risk outputs primary; AI explains context and never issues direct buy/sell commands.
- Serve Guest, Trader, and Admin access with separate subscription entitlements.
- Preserve reliable loading, empty, error, permission, and unavailable states.

## Core Features

Planned domains: authentication/profile, Spot/Futures markets, coin analysis, trading plans, watchlist, alerts, journal/performance, community, news, AI, subscriptions, and administration. These features are **not implemented** by this initialization.

Current deliverables: routing, providers, typed service seams, HTTP client, WebSocket abstraction, auth lifecycle/guards, shared UI, isolated development adapters, checks, and documentation.

## Tech Stack

React 19, TypeScript 5, Vite 8, Tailwind CSS 4, React Router 7, and locally bundled Inter. ESLint 10, Prettier, and Vitest enforce quality. Use Node **22.13+ on the 22 line, or 24+** and npm. Exact dependency versions are recorded in `package-lock.json`.

Runtime dependencies are limited to React/DOM, routing, and font assets. Fetch and WebSocket use browser APIs. State libraries, chart packages, form frameworks, and AI/provider SDKs are intentionally deferred until a feature needs them.

## Architecture

`UI → feature hook → injected service → HTTP/realtime adapter → backend`

Pages compose shared components. Feature hooks own request lifecycle. Services expose typed domain contracts. Runtime DTO decoders must validate unknown responses. The composition root is `src/app/providers/create-services.ts`.

No UI imports fixtures or services directly. ESLint blocks these imports and direct global fetch/WebSocket usage in pages/components. Code review must also enforce the boundary against aliases or indirect calls. See [architecture](docs/architecture/frontend-architecture.md).

## Repository Structure

```text
src/
  app/             # config, providers, router
  components/      # ui, layout, feedback, charts
  features/        # auth, market, coin-analysis, trading-plan, watchlist,
                   # alerts, journal, community, news, ai-assistant,
                   # subscription, profile, admin
  pages/           # guest, trader, admin; placeholder compositions
  services/        # api, auth, websocket
  hooks/           # cross-feature integration hooks
  types/           # frontend domain vocabulary
  utils/           # pure helpers
  constants/       # UI/product metadata, never business records
  styles/          # dark theme tokens and shared component styles
  dev/             # development-only adapters and typed fixtures
docs/
  architecture/
  api/
  development/
  decisions/
.github/workflows/ # CI
```

Reserved folders use `.gitkeep` until their first feature arrives. Do not add empty service implementations for speculative operations.

## Local Development

```bash
git clone https://github.com/huyhv-se180722/cryptopilot-frontend.git
cd cryptopilot-frontend
git switch develop
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`. A missing environment file is supported: public placeholders run with a visible integration-pending banner. Protected routes show a session integration error until an auth adapter is supplied.

Optionally copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), edit public URLs, and restart Vite. Supplying a URL alone does not implement an endpoint or auth contract.

## Environment Variables

| Variable                   | Meaning                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | Absolute HTTP(S) API base, optionally including a version prefix; blank disables requests.     |
| `VITE_WS_URL`              | Absolute WS(S) service URL; blank means unavailable. No automatic connection is created.       |
| `VITE_ENABLE_DEV_FIXTURES` | Explicit `true` enables the development adapter only during Vite development. Default `false`. |

Production URLs must use HTTPS/WSS. Credentials, query strings, and fragments in configuration URLs are rejected. All `VITE_*` values are public and built into client assets; never store secrets in them.

## API Integration Strategy

The central client handles JSON, timeouts, caller cancellation, sanitized errors, 204 responses, unauthorized callbacks, and required runtime decoding. API paths stay inside the configured origin/base path. It performs no automatic mutation retries.

Service interfaces exist for auth, market, coin analysis, trading plan, journal, alerts, community, news, AI history, subscription packages, and admin logs. Current business service adapters reject with `NOT_CONFIGURED`; they do not invent endpoint URLs or successful responses. Read contracts are deliberately minimal, not full feature schemas.

See [API contract and integration checklist](docs/api/api-contract.md). Replace the adapter in the composition root after backend agreement; consuming hooks/components stay stable.

## WebSocket Strategy

`RealtimeClient<T>` provides connect/disconnect/reconnect, capped exponential retry, per-topic reference-counted subscriptions, resubscription after reconnect, error reporting, and disposal. A service supplies the URL and a validated protocol codec. Spot and Futures should have distinct agreed topic identities.

An app provider owns connection lifetime; `useRealtime` owns only its subscription and observes connection state. No socket is created by a page or at startup before a protocol exists. Heartbeats, authentication, sequence handling, stale-data policies, and snapshot reconciliation remain backend integration decisions.

## Authentication Strategy

`AuthStore` supports login, registration, logout, session restoration, cancellation, and invalidation. Stale restoration responses cannot restore access after logout. Inactive accounts are rejected. Logout clears local access immediately; remote revocation failure is visible.

Guest is an unauthenticated principal; account roles are Trader/Admin. Admin does not implicitly inherit Trader-only routes. Protected routes wait for restoration, redirect confirmed guests to login, and distinguish integration errors from guest access. Backend authorization remains authoritative.

Cookie versus bearer auth, CSRF, refresh/expiry, and registration verification remain open. No tokens are persisted in browser storage. Entitlements gate new AI/video actions independently; expired subscriptions must not hide previous AI history or published videos.

## State Management Strategy

Use React local state for ephemeral UI, a small external auth store through `useSyncExternalStore`, and context for dependency injection. Feature hooks own server request state and cancellation. No global store or query cache is installed yet; adopt one only when actual caching/invalidation requirements justify it. Clear private caches on logout when those caches are introduced.

## Error Handling

Service errors expose stable codes and safe messages. Pages never render backend stack traces. Request cancellation is distinct from failure. Global and router error boundaries protect rendering. Shared Alert, Warning, Loading, EmptyState, and ErrorState components cover feedback. Missing configuration never silently falls back to mock data.

## Responsive Strategy

Preserve dark, compact trading UI with cyan accents, subtle borders, Inter text, and monospace/tabular numbers. Tables scroll within their region; page headers wrap; coarse-pointer controls have larger targets. Shared controls have labels, visible keyboard focus, semantic states, native modal focus containment, and keyboard tabs.

Exact Figma tokens and component matching are pending the design/prototype links. Current tokens follow the written brief and are provisional. The responsive app shell is the next task.

## Development Data Strategy

Fixtures live only in `src/dev/fixtures`, conform to domain models, and enter via a development service adapter. The initial market fixture is an empty typed collection. Other services remain explicitly unavailable; there are no fake users or fake successful logins.

Enable with `VITE_ENABLE_DEV_FIXTURES=true` during `npm run dev`. A visible banner identifies fixture mode. The production build guard rejects any bundled `src/dev` module. Tests use isolated in-memory examples and never provide production UI data.

## Git Workflow

Create feature branches from develop. Open PRs into develop after checks pass. Only reviewed, completed product releases may be promoted to main. Never force-push shared branches.

## Branch Strategy

`feature/* → develop → main`

Per project-owner instruction, this foundation is committed and pushed **only to develop**. The remote was empty at initialization; no main commit is created or pushed by this task. Establish main at the first approved completed-product release. No feature branches are pre-created.

Planned names include `feature/app-shell`, `feature/auth`, `feature/markets`, `feature/coin-analysis`, `feature/trading-plan`, `feature/journal`, `feature/alerts`, `feature/news`, `feature/community`, `feature/subscription`, `feature/ai-assistant`, and `feature/admin`.

## Commit Convention

Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`. Initial commit: `chore: initialize CryptoPilot frontend`.

## Testing

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run check
```

Vitest covers HTTP errors/decoding/cancellation, auth roles/entitlements/session races, realtime subscriptions/retry/disposal, route metadata, and fixture isolation. `npm run test:watch` supports local iteration. Feature PRs add meaningful user-behavior tests; full browser E2E coverage is deferred until screens exist.

## Build

```bash
npm run build
npm run preview
```

Build performs strict type checking then generates static assets in `dist/`. Preview is a local inspection server, not production hosting. `npm run format` applies Prettier.

## Deployment

No deployment pipeline is configured. A future static host must serve HTTPS, fall back to `index.html` for client routes (including deep links), set appropriate security/cache headers, and inject public environment values before build. Hashed assets can be cached; index HTML should be revalidated. Configure backend CORS/auth and realtime permissions before enabling integrations.

CI runs `npm ci` (locked clean equivalent of install), formatting, types, lint, tests, and build on develop/main pushes and PRs. It uses read-only repository permissions and contains no deployment credentials.

## Security

Never commit `.env`, credentials, tokens, exchange keys, or provider secrets. No real trading, wallet, deposit, withdrawal, or exchange-account connection is implemented. Backend must enforce RBAC, entitlements, account status, and user ownership on every operation. Do not render untrusted HTML or log credentials. Sanitize any future external links and rich content.

## Roadmap

1. `feature/app-shell`: obtain Figma references, reconcile tokens, implement responsive navigation and role-aware layouts.
2. Finalize API/auth/realtime contracts and add validated adapters.
3. Build auth and public market foundations, then core planning/risk/journal flows.
4. Add monitoring, AI, subscriptions/content, and admin capabilities in reviewed feature branches.
5. Add E2E/accessibility verification and approve the first release to main.

## Backend Integration Plan

Agree versioned endpoints, DTOs, decimal/time formats, pagination, error codes, session/CSRF/refresh rules, entitlement semantics, and realtime protocol. Implement one adapter at a time using required runtime decoders; wire 401 handling to auth invalidation without retry loops. Add contract tests, cancellation, empty/error coverage, then connect feature hooks. Never replace an integration failure with fixtures in production.

See [CONTRIBUTING](CONTRIBUTING.md), [development workflow](docs/development/development-workflow.md), and [decisions](docs/decisions/README.md).
