# Website research evidence update

Development only. This branch targets radar-website-research-test and does not
change a public deployment or the newer private Sites preview.

The existing website could display base-token price movement, market cap, FDV
and buy/sell transaction direction when a searched token was the quote asset.
The new shared tokenMetrics helper withholds those token-specific values for a
quote-side lookup. Pool liquidity and total volume remain visible as reported
pool metrics. This follows the backend's existing quote-side evidence policy.

Tests cover EVM/Solana identity, zero values, quote-side suppression and the actual
card renderer in an isolated no-network harness. No DOM/browser deployment test
is claimed. CI requires no npm dependencies or paid data-provider requests.

The newer private Sites terminal and this older repository branch still need
careful source reconciliation. Carry the tokenMetrics helper and renderer fix
into the selected maintained frontend source when that reconciliation is made;
do not silently replace either source or deploy without approval.

A new search cancels the previous market refresh. Responses from cancelled work cannot replace cards or update the active search status. The offline regression completes a cancelled response after the new refresh and checks that the new result remains visible. Quote endpoint integration still depends on selecting the maintained website source and verifying its access path.
