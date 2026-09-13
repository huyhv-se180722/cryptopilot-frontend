# Frontend architecture

## Authority and scope

Read sources present in the original workspace:

- `FA26SE076_CRYPTOPILOT_CRYPTO_TRADING_SUPPORT_SYSTE_lamnn15.docx`: official capstone registration.
- `CryptoPilot_Requirement_Baseline_and_Figma_Plan_v1_FINAL.docx`: reconciled requirements, proposed additions, and open decisions.
- `Mô Tả DB.docx`: preliminary database implementation draft, not a finalized API.
- `CryptoPilot_GPT6_Figma_Prompt_Pack_v1.md`: design execution guardrails.

These source documents are not duplicated into this code repository. Obtain them from the team. The written task controls foundation scope and explicitly grants public news routing. Final visual fidelity cannot be confirmed without Figma design/prototype links.

Confirmed constraints: support/paper trading only; no exchange-account integration; deterministic risk calculations drive AI explanations; dynamic subscription packages; AI and video permissions are distinct; retained history survives subscription expiry. Proposed plan lifecycle names and unresolved calculation thresholds are deliberately not implemented.

## Dependency direction

UI → hook → service interface → adapter → backend. App providers compose concrete services. Features own domain workflows; shared components remain domain-neutral. Services must not import pages/components. Domain types do not depend on React.

- `app/config`: reads and validates public environment values.
- `app/providers`: service injection, session ownership, error boundary.
- `app/router`: static route metadata, public/private groups, role guards.
- `components/ui`: Button, Input, Select, Card, Badge/StatusIndicator, Table, Tabs, Dialog/Modal.
- `components/feedback`: Alert/Warning, Loading, EmptyState, ErrorState, ErrorBoundary.
- `components/layout`: PageHeader and StatCard; full app shell deferred.
- `components/charts`: reserved; select a chart library only when requirements need it.
- `features/<domain>`: future components, hooks, models, validation, and tests.
- `services/api`: central HTTP client and explicit service integration seams.
- `services/auth`: auth contract, lifecycle store, and access policy.
- `services/websocket`: generic transport, injected wire codec.
- `dev`: build-excluded adapters and typed test fixtures.
- `pages/guest|trader|admin`: thin route compositions, currently placeholders.

All requested feature directories are tracked. Cross-feature dependencies should go through shared services/models or explicitly exported feature APIs, never deeply import another feature's internals.

## State and data ownership

App-wide state is limited to auth and injected dependencies. Hooks own request state and abort on unmount/input changes. The market hook demonstrates this boundary without building a market screen. Financial values use decimal strings; do not perform monetary arithmetic using implicit float conversion. Locale formatting and decimal libraries should be chosen alongside feature requirements.

Service interfaces are frontend application ports, not a claim about backend DTOs. Errors are explicit; no endpoint is guessed. HTTP requires a decoder taking unknown data before returning a typed value. Production services remain unavailable until mapped to agreed endpoints.

## Realtime ownership

A future application provider creates one market service with an injected protocol codec, calls connect, and disposes on unmount/logout. Hooks subscribe and clean up. Shared subscriptions use per-consumer tokens so one consumer cannot unsubscribe others. Reconnect replays only active topics. A stopped/disposed client cannot reconnect via old timers or socket callbacks.

Connection state must be visible when realtime screens are introduced. A connection being open does not prove a quote is fresh; agree timestamps, snapshot reconciliation, and staleness rules first. No external exchange socket is opened by this foundation.

## Access

Guest means no authenticated account. Trader and Admin route access is explicit, with no implicit role hierarchy. Shared public routes are declared once. Frontend guards provide UX; backend checks are mandatory. Account status is checked separately from role. Subscription entitlements are checked for individual new actions, never used to deny historical AI reading.

## Design and accessibility

The CSS theme uses the brief's dark terminal direction, cyan accent, semantic green/red/amber, 8px-based layout spacing, Inter and monospace numeric fields. These token values are provisional until compared to the source design.

Controls use semantic HTML and associated labels. Tabs support arrow/Home/End navigation and selected-tab focus. Dialog uses the browser's modal behavior for focus containment and inert background. Feedback includes text, not color alone. Tables expose captions and horizontal scroll regions. Reduced motion and coarse pointer sizing are respected.

No product navigation shell, chart, trading form, or working business screen is part of initialization.

## Growth rules

Add a dependency only to solve a concrete feature requirement. Keep model/adapter changes together with contract docs and tests. Avoid global business-data arrays, speculative CRUD endpoints, and placeholder success responses. Introduce caching, schema validation libraries, charting, and telemetry only with a documented need.
