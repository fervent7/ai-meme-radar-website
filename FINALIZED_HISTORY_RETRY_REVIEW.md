# Finalized-history retry retention — 23 November 2026

Parent 1b6ddcdd87727715fa42d4ade0c5b65dc473da8c, review/verified-research-terminal, draft PR #3.

Verified UX defect: every finalized-history refresh erased previously loaded
evidence before fetching, so timeout/429 discarded useful source/timestamp rows.
Market-history refresh already retained its rows; finalized history did not.

The on-chain panel now keeps original saved evidence during loading and transient
429/504/network/malformed-response failures. Visible status explicitly says
previously loaded saved evidence / refresh not confirmed. Original observation
times never change. aria-busy marks only the current request and resets on every
exit. Authentication loss (401/403 or backend-auth failure) and authoritative
EMPTY clear retained data. Successful rendering builds off-panel then replaces
atomically; partial malformed rendering cannot replace old evidence or append
duplicates. Duplicate-click prevention, timeout and cooldown remain.

Actual local npm test: 50 tests passed. Four new VM tests cover transient retention,
abort/busy state, auth/EMPTY clearing and atomic repeated successful refresh.
Existing auth, exact-target history, unchanged75→75/0%, buyerUnverified, coverage
and market regressions pass. Browser syntax checked; existing ten-viewport suite
now performs real rendered retention checks with an intercepted429 at 390/1440px
and saves retained-panel screenshots. Inspect exact-head browser/security CI;
fixtures are synthetic/retained, not provider, physical Android or hosted proof.
Local browser startup blocker was not retried. No new dependency or external call.

Original native Radar UX extends evidence-first research; no competitor assets,
copy, architecture/tokenomics, new module naming or IP/legal clearance claim.
Private bot genuine capture still pending (last45253589133), no repeated action
request or new signing. Radar companion authenticates/cache-projects coverage;
PostgreSQL remains frozen. Keep draft/unmerged/undeployed. Nothing delegated.
