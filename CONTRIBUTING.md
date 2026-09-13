# Contributing to CryptoPilot

Start with the README, frontend architecture, API integration notes, and requirement/Figma sources. Keep changes within the assigned feature.

## Branch naming

Branch from develop using feature/<name>, fix/<name>, docs/<name>, or chore/<name>. Target PRs at develop. Main is reserved for approved completed-product releases. This foundation is initialized only on develop; do not create product feature branches until work begins.

## Commit convention

Use Conventional Commits: feat(scope): description, fix(scope): description, docs:, test:, refactor:, chore:. Write concise descriptions of the resulting change. The initial commit is chore: initialize CryptoPilot frontend.

## Pull request expectations

Explain the problem and resulting behavior. Link requirement IDs, design references, and related issues. Include actual validation commands/results, UI screenshots when applicable, integration changes, and material assumptions. Keep scope bounded; do not add unsolicited product features or dependencies.

PRs require review and passing checks before merge. Do not force-push shared branches or merge/release without authorization.

## Code quality

Use strict TypeScript and avoid any in business models. Validate unknown network input at adapter boundaries. Pages/components consume hooks; hooks consume typed services. Keep shared controls domain-neutral. Respect theme tokens, semantic HTML, keyboard behavior, responsive layout, and request/subscription cleanup.

Run npm run check before requesting review. Use npm run format for formatting. Update docs alongside architecture or contract changes.

## Testing expectations

Test meaningful behavior: permission boundaries, auth races, cancellation, error/empty states, realtime lifecycle, calculations when introduced, and feature interactions. Avoid tests that merely copy implementation details. Include browser/accessibility tests as working screens arrive. Do not claim tests or CI passed unless actually run.

## No hardcoded business data

Never embed prices, volumes, P/L, users, journal records, subscription packages, posts, articles, alerts, AI conversations, or plans in production components or constants. Never copy Figma Make demo records. UI strings, route metadata, and visual tokens are configuration, not business data.

Fixtures belong only in src/dev/fixtures or isolated tests and must conform to domain models. Components cannot import them. Service adapters preserve the same consumer contract. Production never silently falls back to fixtures.

## Environment and secrets

Commit .env.example with blank public placeholders; never commit .env or other environment files. Every VITE_* value is public. Never commit passwords, keys, credentials, tokens, exchange secrets, or backend provider keys. Do not log credentials or raw private server error bodies.

## Product constraints

CryptoPilot supports analysis, risk management and paper trading, not exchange execution. Enforce roles separately from subscription permissions. Preserve old AI history/video after expiry; do not invent package prices, trading thresholds, refund rules, or backend auth semantics.
