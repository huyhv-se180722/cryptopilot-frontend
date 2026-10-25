# API contract: integration pending

**Status:** no approved backend OpenAPI specification, endpoint catalogue, auth scheme, or realtime protocol was supplied. This document records frontend seams and open decisions; it is not an implemented server contract.

## Existing frontend ports

| Service       | Initial port                                         | Frontend domain model                    |
| ------------- | ---------------------------------------------------- | ---------------------------------------- |
| auth          | restoreSession, login, register, logout              | Session, User, Entitlements              |
| market        | list                                                 | MarketQuote                              |
| coin-analysis | get by symbol/market/timeframe                       | CoinAnalysis                             |
| trading-plan  | list                                                 | TradingPlan                              |
| journal       | list                                                 | JournalEntry                             |
| alerts        | list                                                 | PriceAlert                               |
| community     | list                                                 | CommunityPost                            |
| news          | feed, article, sentimentSummary (HTTP, T-080, D-125) | NewsArticle, NewsArticleDetail, NewsPage |
| ai            | list historical conversations                        | AiConversation                           |
| subscription  | list packages                                        | SubscriptionPackage                      |
| admin         | list logs                                            | AdminLog                                 |

These minimal read ports reserve integration ownership. They are not comprehensive feature models. Indicator alerts, OHLCV, futures context, risk metrics, watchlist, notifications, payment operations, AI invocation, and admin mutations must be designed in their feature tasks against confirmed requirements. No speculative endpoint or real trading operation exists.

Frontend list requests allow optional cursor/limit/signal; responses contain items and nextCursor. A backend may use a different pagination/envelope shape; map it in the adapter. Decimal strings preserve monetary precision. Dates are intended as ISO 8601 UTC instants; confirm serialization with backend. IDs are frontend strings independent of DB key type.

## HTTP boundary

Use `createHttpClient({ baseUrl, credentials, timeoutMs, fetcher, onUnauthorized })`. Each request supplies a relative path, method, optional body/signal/headers, and a mandatory `decode(unknown)` function. Default timeout is 15 seconds; default credentials are same-origin, not a finalized auth policy.

The client preserves API path prefixes, blocks cross-origin/base-path escapes, parses JSON, handles no-content responses, sanitizes errors, and distinguishes timeout from cancellation. It does not blindly cast responses to domain types. Default headers are Accept JSON and Content-Type JSON only when a body is present.

No automatic retries are implemented. Mutations may be non-idempotent. If retry is introduced, define eligibility, retry-after handling, cancellation, and idempotency with backend first.

Codes: NOT_CONFIGURED, HTTP_ERROR (with status), NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE, UNSUPPORTED_OPERATION. UI displays safe messages; error response bodies are not rendered. Field validation and correlation-ID mappings require an agreed backend error schema.

## Auth decisions required

- Cookie session or bearer token; login/register payload and response schemas.
- Registration verification and whether it ever returns a session.
- Session restoration endpoint and expiry/refresh behavior.
- Cookie credentials/CORS settings, SameSite, HttpOnly, Secure, CSRF.
- Logout revocation semantics and concurrent session policy.
- Account status mapping and backend enforcement.
- 401 versus 403 handling; wire unauthorized callback to store invalidation.
- Runtime validation of role, status, entitlements and user identity.

Never store a token in localStorage as an assumed contract. Keep credentials in memory only while submitting. A missing integration produces an error, not a fabricated Guest/login response. Once integrated, an explicitly unauthenticated restoration should map to null.

## Subscription rules

Roles and entitlements are separate. AI invoke and video attach require independently active permissions. Existing AI history and published videos remain readable after expiry. Package names, prices, durations, and included features are backend data, not constants.

Frontend redirect success must not activate a subscription. Backend payment verification/callback is authoritative. Renewal, upgrade/proration, refund policies, and payment schemas remain open.

## Realtime contract to agree

Transport supports injected encodeSubscription/decode functions; no JSON message format is assumed. Agree topic syntax for Spot/Futures, authentication without leaking URL tokens, subscription acknowledgements, payload validation, error codes, heartbeat, sequence numbers, resync, stale thresholds, and connection limits.

The abstraction reconnects with exponential delays capped at 30 seconds and six retry attempts by default, replays active subscriptions, and supports explicit retry after exhaustion. Retry count resets after opening; long-term flapping/visibility/network policies can be added after integration requirements exist.

## Integration acceptance checklist

1. Link an approved versioned backend specification and replace open assumptions.
2. Add wire DTOs and runtime decoders that map to frontend domain models.
3. Implement the service adapter through the central client and inject it.
4. Add contract tests for valid/invalid payloads, empty results, abort, 401/403, network/timeouts.
5. Confirm server authorization, ownership and entitlements; clear private state on logout.
6. Verify real integration with fixtures disabled, including unavailable/stale states.
7. Update documentation and review in a feature PR to develop.
