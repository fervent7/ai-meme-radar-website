# Saved on-chain history state labels — 23 November 2026

## Defect and correction
The gateway already preserves VERIFIED, UNAVAILABLE and ERROR per observation
while stripping upstream exception details. The panel collapsed ERROR into
Unavailable, and a mixed response could announce fully loaded evidence.

The panel now labels ERROR as Error / observation could not be verified and
retains the original recorded timestamp. UNAVAILABLE remains distinct.
A mixed result says partially loaded; all-error and all-unavailable summaries
are distinct. A fully verified result keeps the existing loaded status.

No new verification, security or fraud conclusion is inferred from an error.
No provider error body, URL, credential or new backend request is displayed.
Authentication, abort timers, retry cooldown, duplicate-click protection,
exact target identity, legacy holder-method disclosure and buyer Unverified
labels are unchanged.

## Reproduce and actual validation
Use the existing authenticated history VM/gateway fixture test:
- ERROR-only row: Error label plus original timestamp and an error summary.
- VERIFIED + ERROR + UNAVAILABLE: preserve each row and say partially loaded.
- UNAVAILABLE-only: unavailable summary without an error or loaded claim.
- Existing auth/retry and fully verified browser fixture behavior remains.

All 40 Node tests passed locally via npm test. Fixtures are synthetic/retained;
there was no new provider, Radar/Supabase, deployed test service or physical
Android verification. Tests were performed by Codex, not Frank.
Inspect exact-head source/security/browser CI before accepting this review update.

## Ship/hold and next continuation
Keep review/verified-research-terminal and draft PR #3 unmerged and undeployed.
Hosted revision, authenticated genuine history, restart retention and physical
Android acceptance remain separate gates.

Auto-Trader remains at 592d8c99c7940afc1d055f1abbecc6ea1154138a with source CI green.
Its earliest blocker remains unavailable retained test-worker file access,
not a missing GitHub RPC secret. The prior Shell-availability action is unchanged;
do not repeat that request without a material change.
Follow its [concrete capture/acceptance handoff](https://github.com/fervent7/personal-bsc-auto-trader/blob/592d8c99c7940afc1d055f1abbecc6ea1154138a/HOURLY_ACCEPTANCE_HANDOFF.md).
No genuine sequential acceptance, signing or live-ready claim.

Radar review remains 1ea9658; current source CI passed and PostgreSQL constraints
remain frozen pending human review. No provider retry or review rerun was made.
Nothing was delegated to another agent.

