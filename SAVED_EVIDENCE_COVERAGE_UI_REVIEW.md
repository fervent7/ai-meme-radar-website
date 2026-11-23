# Saved evidence coverage interface — 23 November 2026

Parent 3f977a80c10d98694f76a2a4b5c296581f8bcd40, review/verified-research-terminal, draft PR #3.

Actual terminal UI: authenticated saved history now includes four evidence cards:
verified saved holders, reported saved liquidity, unverified buyer growth, and
unavailable contract/security/sequential-sellability checks. Original source and
microsecond timestamps remain visible. A warning states that loading history is
not current security clearance and does not refresh observation timestamps.
This prevents a useful saved holder count or market value from visually implying
that buyer/security research is complete. Existing 75→75 unchanged / 0% label,
relative-liquidity meters, retry/cooldown/auth errors and exact-pool scope remain.

Charcoal/green cards use responsive two/one-column layout and wrapping original
timestamps/addresses. Text nodes only; no raw HTML, new provider request, public
API, new credential or deployment. The interface extends Radar's native evidence
research; no competitor source, assets, branding or tokenomics used. No formal
IP/legal clearance or proprietary novelty claimed.

Actual local npm test: 46 tests passed, with the existing authenticated panel
regression expanded to assert all four coverage states, original holder time,
reported-vs-verified distinction and security absence. Browser test syntax passed.
The ten-viewport browser acceptance now asserts coverage and emits 390px/1440px
coverage screenshots. Inspect exact-head CI/artifacts; local browser startup was
previously blocked, not retried or counted as a pass. Browser inputs are fixtures,
not new live history, physical Android, provider or deployed-service verification.

Bot genuine failed capture 45253589133 was inspected/replayed. Its fifth chain
check hit429 before token1; no complete scanner snapshot. Review bc3dee1 reduces
redundant checks, diagnostic burst and log-range overhead with fail-closed tests.
No provider recovery or full autonomy is claimed; Alchemy support cap evidence
remains separate and billing untouched. Radar companion contract now identifies
saved-history scope, current-security-clearance=false, coverage counts and
stale/future/missing freshness. That pure contract is not a new hosted endpoint.

Keep draft/unmerged/undeployed. Next: inspect source/security/browser CI, then
verify hosted revision and genuine authenticated saved history when authorized.
No new user action beyond the changed-head bot capture if source CI passes.
Tests by Codex, not Frank; nothing delegated. All production boundaries preserved.
