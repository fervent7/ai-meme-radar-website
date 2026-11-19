# Saved on-chain history timeout compatibility — review only

19 November 2026. Website review branch review/verified-research-terminal,
draft PR #3. Baseline 52dfefd160e3779379814827e20a5fe2db5c1811. No deployment,
production change, live market request, provider call or credential access.

Confirmed compatibility defect: the on-chain history button directly invoked
AbortSignal.timeout. In a browser environment with AbortController but no such
static method, it caught the resulting failure before fetch and displayed
unavailable without requesting saved evidence. The deterministic VM reproduction
omits AbortSignal; the baseline first request test fails with zero requests.
This is a reproduced capability-specific defect, not a claim that every current
Android Chrome lacks that API or a physical-device diagnosis.

Use the existing market-history pattern: AbortController with a bounded 8500-ms
browser timer, cleared in finally for every return/failure. Preserve same-origin
authentication, no-store requests, exact chain/token/pool query, duplicate-click
protection, 429 cooldowns and unavailable-data handling. Abort failures now show
an explicit timeout and manual retry message instead of generic unavailability.
No automatic retry, new endpoint, new library or simulated live evidence.

Four local Node VM tests pass using injected fetch and timers: no AbortSignal
static method, in-flight duplicate suppression, timeout/retry, response-body
abort and cleanup across 401/403/429/503/504 and malformed JSON. All requests are
mocked; no backend or chain data is acquired. Full Node/security and existing
responsive-browser CI must pass at the published commit. Local VM checks do not
substitute for browser screenshots, deployed revision/authentication checks or
physical Android acceptance. Browser CI uses the existing clearly labeled
Whale Pad evidence fixtures, not a fresh Supabase retrieval.

Remaining hosted website verification is still blocked on separately approved
test deployment/review access. Keep production unchanged. Existing Research
Engine PostgreSQL implementation 8ef36a1 and handoff 32d0e43 remain frozen while
Issue #4 awaits human review; no independent approval is inferred from tests.
Personal BSC Auto-Trader remains separate. No user action is needed to run the
current offline/review CI. Deployment/merge remain separately authorized steps.
