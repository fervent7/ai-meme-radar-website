# Withheld Wallet DNA evidence — review only

24 November 2026. Saved graphs now preserve a small static allowlist of conflict/scope/budget reason enums. Invalid records still clear the entire graph; missing/unknown errors stay generic and raw provider text is never returned. No source timestamp, freshness, security, ownership or transaction authority is added.

Backend tests cover clock/slot conflicts and a malformed private-looking timestamp that must not be reflected. Website gateway independently accepts only the allowlist, clears coverage/relationships and maps all other reasons to a generic enum. Actual UI displays static explanations; legacy missing pair windows retain their separate label. Browser regression adds synthetic withheld/restored states at 390px and 1440px. These fixtures are not genuine chain observations.

Local checks: 11 backend relationship tests and 81 website Node tests passed. Browser cases require hosted CI; local Chromium is unavailable in this environment. No claim of physical Android or fresh hosted/provider-backed launch acceptance. PostgreSQL runtime/schema freeze, production and deployment settings remain unchanged. Personal bot remains separate.
