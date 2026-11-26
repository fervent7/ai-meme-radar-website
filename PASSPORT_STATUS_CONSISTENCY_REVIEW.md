# Contradictory passport states show an actionable unavailable state

24November2026, review/verified-research-terminal, parent4542008d.
The actual preview component previously trusted a top-level 'current' label even
if an embedded check said revoked or unavailable. It now requires all three
expected check kinds exactly once, recognized check states and a matching
aggregate status. Corrupt examples clear cards and show Retry instead of a
misleading current summary; a valid response restores the normal interface.
Human-readable reasons, provenance, UTC dates, chain references and the dark/
emerald Android layout are retained.

72 Node tests passed locally. Existing responsive browser suite now also drives
an inconsistent response at390px, checks that 'current' is withheld/cards cleared,
and retries a valid response successfully. Exact-head browser CI must run to
verify this new flow. Synthetic fixtures remain explicitly labelled; this is not
a live passport, signed attestation, security clearance or trading permission.
Shared schema/valid fixture remain byte-identical to Radar; backend also preserves
scoped revocation when metadata is unavailable, without accepting wrong-target
references. No real registry/hosted API integration or deployment is claimed.

Work occurred during the independent personal bot's source/capture/CI wait.
Personal bot source->scanner->canonical-auth prefix does not authorize trades or
bypass missing independent risk/sellability/fork/restart evidence. No paid use,
production action, token/funds/distributions, external messages or merge/deploy.
