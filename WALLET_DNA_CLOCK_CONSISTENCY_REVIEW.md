# Original-time consistency and legacy unavailable state —24 November2026

Authenticated on-chain history now withholds verified rows claiming chain time
more than300seconds after their ORIGINAL recorded time. This is a clock-consistency
tolerance, not freshness or source/security authentication. No timestamp refresh,
Date.now substitution or authority promotion. Backend independently enforces it
for WalletDNA; gateway applies it to verified on-chain rows.

Actual relationship cards explicitly label a missing legacy pair window as
unavailable and retain access to original proofs.80local Node checks PASS. Browser
cases at390/1440px cover unavailable legacy state and restore the original valid
window; the existing ten-viewports suite remains enabled. Synthetic fixtures
stay labelled. No deployment, real Android-device or fresh hosted service launch
acceptance claimed. Exact-head CI pending.
