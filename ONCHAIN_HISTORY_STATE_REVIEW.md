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

Auto-Trader historical evidence was recovered at review commit
53f3cbc10f556cc4aee01d1e620dfc619d0ff6d2. Successful signed-fork run 45024986196
and its original artifact prove a partial disposable-wallet V3 lifecycle, exact
12% fixture allocation, gas accounting and restart/reverted-exit recovery.
Its scanner assertions are synthetic and its monitoring quotes controlled.
The first full-acceptance gap remains genuine scanner evidence into an
independently authenticated candidate, followed by executable monitoring and
complete policy/receipt/transfer proof. LIVE-READY remains NO.

Retained TEST-worker files are one source for scanner continuity, not required
to audit the historical fork and not the only possible genuine isolated source.
No exact separate TEST Render service has been verified here. Production
personal-bsc-auto-trader is user-suspended and must not be resumed or offered
as a test Shell. Do not repeat a generic Shell request or ask for a new RPC secret.
Follow the [corrected evidence and continuation handoff](https://github.com/fervent7/personal-bsc-auto-trader/blob/53f3cbc10f556cc4aee01d1e620dfc619d0ff6d2/HOURLY_ACCEPTANCE_HANDOFF.md).
This cross-project correction changes documentation only; no website behavior,
deployment, signing or provider request occurred.

Radar review remains 1ea9658; current source CI passed and PostgreSQL constraints
remain frozen pending human review. No provider retry or review rerun was made.
Nothing was delegated to another agent.

