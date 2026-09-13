# Feature ownership

Each domain grows into components/, hooks/, models/ or schemas/, and colocated tests when its feature is implemented. Do not create empty internal folder trees in advance.

Reserved domains: auth, market, coin-analysis, trading-plan, watchlist, alerts, journal, community, news, ai-assistant, subscription, profile, admin.

The initial market hook illustrates UI → hook → service data flow. Auth's cross-application lifecycle lives in services/auth and app/providers; future login/register/profile UI belongs in features/auth or features/profile. Charts live in components/charts once a chart library is selected.

Route pages stay in pages/guest, pages/trader and pages/admin. Data-bearing components must not import fixtures or call transport APIs directly.
