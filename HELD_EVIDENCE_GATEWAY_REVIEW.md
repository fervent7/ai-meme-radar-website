# Held evidence across the authenticated gateway — 23 November 2026

Parent690e3ecc098532a5f21846982c8528b38d21b1df, review/verified-research-terminal, draft PR #3.

Verified integration gap: backend1e4b940 withholds conflicting storage-key rows
and supplies evidence_coverage.evidence_reason. The gateway ignored that metadata,
so held data with zero exposed rows could be mistaken for EMPTY.
The gateway now validates present projection version, exact chain/token/pool,
saved-history/research scope and false permission/security-clearance flags.
Conflict/unavailable/invalid/contradictory projection metadata becomes503
EVIDENCE_HELD, not200 EMPTY/READY. No raw upstream reason is forwarded.
Legacy backends with no projection retain existing row-level validation.
Metadata is only an additional restriction; it never upgrades holder/market
claims or forwards unvalidated metrics as evidence.

The terminal shows a distinct amber alert for withheld/unvalidated records,
removes previously displayed verified saved values and resets the alert after a
successful retry. Transient timeout/429 retention and auth clearing remain.
This is an original extension of existing Radar UX, no new service branding,
competitor asset/architecture/tokenomics or IP/legal-clearance claim.

## Shared source/consumer contract and actual tests
test-fixtures/history-coverage-gateway-contract-v1.json is byte-identical to the
Radar test fixture generated from actual authenticated cache handler functions.
SHA25661c4f93359e1f8ff9f1a580b8d416de6a5b5ef25ea52f7e8813b1da0c1cba3ed.
Both files say SYNTHETIC_CONTRACT_ONLY_NOT_CHAIN_EVIDENCE. Neither is a genuine
token/scanner observation, network call or independent provider verification.

Actual npm test:54 passed. Four new gateway tests cover actual-handler fixture
compatibility, held-vs-empty, wrong identity/flags and unknown reason/legacy
behavior; existing UI test asserts stale verified rows clear, fixed warning and
successful-retry reset. Claimed999 metadata cannot upgrade own validated75 count.
Browser syntax checked; ten-viewport acceptance adds rendered held-alert tests at
390/1440px and screenshots. Inspect exact-head CI/artifacts. Prior690e3ec browser
wait correction PASSED; do not carry its old pending/failure status forward.
All data in browser/contract tests remain fixtures; no hosted/physical Android proof.

Bot capture still pending, source metadata retention corrected separately. No
repeat user request, provider spend, signing, deployment or configuration change.
Keep PR draft/unmerged; public developer API, memberships and trading unavailable.
Nothing delegated; tests by Codex, not Frank. PostgreSQL/runtime boundaries preserved.
