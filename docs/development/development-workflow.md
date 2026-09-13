# Development workflow

## Setup

Use Node 22.13+ (22.x) or 24+, npm, and Git. Clone the repository, switch to develop, run npm install and npm run dev. Commit the npm lockfile and use npm ci in CI. The app boots without .env but correctly marks integration as unavailable.

## Branches

This initialization goes only to develop. Main is reserved for completed, reviewed product releases and is not created by an empty bootstrap commit. No product features are developed directly on main.

After foundation acceptance:

1. Update local develop with a fast-forward pull.
2. Create feature/app-shell (or another approved feature/* name).
3. Implement the bounded task and update docs/contracts.
4. Run npm run check and review the diff for secrets/data.
5. Push the feature branch and open a PR targeting develop.
6. A maintainer reviews and merges. Promote completed releases to main separately.

Suggested names: feature/auth, feature/markets, feature/coin-analysis, feature/trading-plan, feature/journal, feature/alerts, feature/news, feature/community, feature/subscription, feature/ai-assistant, feature/admin. Do not pre-create unused branches.

## Quality commands

| Command              | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| npm install          | Local installation / lockfile creation or update  |
| npm ci               | Reproducible installation from committed lockfile |
| npm run dev          | Local Vite server                                 |
| npm run typecheck    | Strict app and configuration type checking        |
| npm run lint         | ESLint with zero warnings                         |
| npm run format       | Apply Prettier                                    |
| npm run format:check | Check formatting                                  |
| npm test             | Transport/session/access/fixture unit tests       |
| npm run test:watch   | Interactive tests                                 |
| npm run build        | Typecheck and production bundle                   |
| npm run preview      | Local production-bundle inspection                |
| npm run check        | Formatting, types, lint, tests, build             |

CI runs the locked installation and quality checks. It does not deploy. A green local check is not evidence that GitHub Actions has run; check the actual Actions run before claiming CI success.

## Building a feature

Start from the requirement and Figma source. Keep pages as compositions. Put data access in a feature hook backed by an injected service. Define unknown-to-domain runtime decoding at the adapter boundary; do not assert a response's shape using an unchecked cast.

Cover relevant loading, empty, error, stale and permission behavior. Add meaningful tests for business/security/transport logic and user interactions. Do not generate tests merely duplicating trivial markup.

Use shared theme tokens and accessible controls. Add responsive layout and keyboard checks for each real screen. Feature hooks must cancel outstanding requests and unsubscribe on unmount.

## Development adapters

Set VITE_ENABLE_DEV_FIXTURES=true only in an uncommitted local environment file. The app shows a fixture banner. Keep fixture constants under src/dev/fixtures and import them only from development adapters/tests. The initial fixture is empty. Do not add fake authentication to unblock a screen without an explicit development-only test seam and clear labeling.

Production builds reject development modules. Never use backend failure as a trigger to activate fixtures.

## Troubleshooting

- Integration pending: expected until a service adapter is implemented; a URL alone is insufficient.
- Protected route error: auth restoration has no backend adapter; do not bypass the guard.
- Environment validation: use absolute HTTP(S)/WS(S) URLs without credentials/query/fragment; production requires TLS.
- Deep-link 404 after hosting: configure the host's SPA fallback to index.html.
- Realtime error: check the approved protocol and connection configuration; no real socket exists in the initial route host.
- Node engine error: update Node to the supported range before installing.

## Review record

PRs state the concrete change, requirement/design references, tests actually run, screenshots for UI changes, API changes, and unresolved assumptions. No secrets, accounts, business arrays, or copied prototype data may appear in a PR.
