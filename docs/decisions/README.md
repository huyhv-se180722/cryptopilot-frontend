# Architectural decision log

Record new decisions here or in numbered ADR files with context, decision, alternatives, and consequences.

## ADR-001 — Feature-oriented architecture (accepted)

Use the requested app/components/features/pages/services split. Keep integration at service boundaries and avoid adding heavyweight state, HTTP, chart, or form dependencies before a feature requires them. Consequence: some directories intentionally remain reserved.

## ADR-002 — No invented backend contract (accepted)

The documents describe requirements and a preliminary DB, not finalized endpoints. Expose minimal frontend ports with explicit NOT_CONFIGURED adapters. Use required runtime decoders in the HTTP client. Endpoint paths, DTOs, error envelopes and auth/realtime formats remain open.

## ADR-003 — Development data isolation (accepted)

Fixtures are typed, isolated under src/dev, activated only by explicit development configuration, and visibly labeled. Initial fixtures are empty. Dynamic imports are gated by Vite DEV, and production build inspection rejects any dev module. There is no fallback from failing real requests to fixtures.

## ADR-004 — Auth roles versus entitlements (accepted)

Treat Guest as unauthenticated access, consistent with the baseline's proposed resolution. Store only Trader/Admin account roles in frontend models. Account status and subscription permissions are independent checks. Admin does not implicitly gain Trader-only routes. Backend mapping must confirm these choices.

Session data is memory-only; cookie/bearer persistence and refresh are pending. Historical AI/video reads are not subscription gated.

## ADR-005 — Realtime transport ownership (accepted)

Use a generic protocol-injected WebSocket client owned by an application provider/service. Hook subscriptions clean up independently. No browser component opens an exchange socket; no real trade execution exists. Heartbeat/resync/staleness/auth protocols remain open.

## ADR-006 — Visual source unavailable (provisional)

The task describes the existing dark terminal design, but Figma design/prototype URLs were not supplied. Shared tokens follow the written brief; exact values and visual fidelity are not claimed. Obtain source links and reconcile tokens in feature/app-shell before expanding screens.

## ADR-007 — Develop-only initialization (accepted, owner-directed)

The owner changed the original push-main-then-develop instruction: push only develop; main is for the completed product. The supplied GitHub repository was empty when cloned. Initialize the first commit on develop, do not create a bootstrap commit or push on main, and do not create product feature branches. Main will be established by an approved release.

The GitHub default branch is hosting metadata and does not mean production readiness. Verify it independently; do not claim that an unborn main exists.

## ADR-008 — Minimal client state and accessible primitives (accepted)

React context handles service injection; useSyncExternalStore subscribes to the auth store. Browser fetch/WebSocket/native dialog and semantic controls avoid unnecessary runtime libraries. Add server caching or schema libraries when contract/feature complexity warrants them.

## Open decisions

Approved OpenAPI and auth/session contract; realtime protocol; exact Figma tokens; plan lifecycle; risk thresholds and calculation precision; alert trigger policies; subscription renew/upgrade policies; deployment host; observability; branch protection and release process.

Any change must preserve the source constraints: support/paper trading only, no exchange-account connection or real execution, no copied prototype records, deterministic risk outputs primary, and dynamic backend subscription packages.
