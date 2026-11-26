# Saved liquidity movement UI — 24 November 2026

Parent2b8a6851d07a3b2d85b2363e841e3bda11b193ba, existing review branch/PR3.
The saved-evidence panel now shows a descriptive liquidity comparison: reported increased/decreased/unchanged, percentage if defined, first/latest USD values, distinct source observation count, original source times and an explicit historical/provider-reported limitation. Amber decrease styling includes text direction, so color is not the sole cue. Missing comparison explains that consecutive same-source values are required. Existing identity/window and buyer/security unavailable labels remain.

Gateway derives comparison from already validated, exact-target, deduplicated raw history; it does not pass through or promote backend metadata. Comparison stops at missing/unknown-source values; invalid/conflicting evidence stays withheld. Future-dated market records withhold the comparison. Zero baseline and floating overflow return null percentage, never zero/infinity. A drop does not establish current reserves, drain, coordinated selling or sellability. No new module name, competitor copy/design, public OTC desk or trade functionality.

57 Node tests passed locally (3 new contract tests and actual component assertions). Browser syntax passed. Browser fixture deliberately simulates a50% decline to test descriptive UI, never real market data. Ten-viewport CI now checks decline text/limits and screenshots at390/1440; inspect actual browser result before claiming responsive acceptance. All tests by Codex, not Frank; no physical Android or deployed-site claim.

Shared Radar fixture regenerated from actual authenticated handler, explicitly SYNTHETIC_CONTRACT_ONLY_NOT_CHAIN_EVIDENCE. No provider calls, auth changes, new dependencies or deployment. Bot genuine capture/security/connected fork/shadow remains NOT READY; production suspended. Existing user capture action unchanged, no repeated request.
