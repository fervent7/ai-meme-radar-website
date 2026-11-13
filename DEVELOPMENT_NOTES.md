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

Research cards validate reported buy and sell counts individually. Missing and invalid counts display an em dash. A reported zero remains visible. The local card regression uses synthetic provider values without network access.

## Brand assets

**AI Meme Radar — Intelligence Engine** is the full wordmark. Use
`brand-wordmark.webp` over dark surfaces in shared headers. Use the supplied
blue/cyan radar symbol for the dashboard, favicon, app icon, and social avatar.
The 512 px icon retains space for a circular avatar crop.

Keep the approved artwork proportions and the platform tagline **Research Before Risk**.

## Ecosystem and test integration

The website remains the public entry point for research, documentation and
community. The ecosystem section identifies which capabilities can be opened
today and which are under development. The near-term OTC + Programmable roadmap
tracks implementation. Living Ecosystem V2 describes longer-term services.
The [Unified Master Ecosystem Roadmap](MASTER_ECOSYSTEM_ROADMAP.md) maps
both horizons and the strategic proposals to the four website phases.

The standalone review server adds authenticated, same-origin access to cached
Radar history. It uses the protected Radar test history endpoint and projects
only the requested token and pool. Supabase remains the persistence layer in
Radar. The website stores no new research observations and starts no scans.

Use an isolated Render **Node web service** with start command
`node website-test-server.cjs` and health path `/healthz`. Configure a separate
`RADAR_WEBSITE_TEST_PASSWORD` for user `reviewer` and the existing backend
`RADAR_TEST_ACCESS_KEY` as server-side environment variables. Use HTTPS and
pin the review commit. The static website does not enable this feature.

After a test deployment, confirm the commit and asset hashes, sign in on
Android and open the exact Whale Pad pool. Load saved history and verify both
holder timestamps, 75 → 75 and 0%, and the separate unverified buyer label.
Check that opening a different pool clears the selected evidence. Hosted
authentication and persistence require environment verification.

The cached-history gateway coalesces duplicate market timestamps only
when the displayed evidence agrees. Conflicting liquidity, volume or
holder evidence produces the existing generic unavailable response.
Verified against the local authenticated test server with fixture data.

The cached-history gateway preserves Radar's microsecond precision when
sorting and deduplicating market and holder observations. The authenticated
local fixture distinguishes readings one microsecond apart and still
coalesces equivalent instants expressed with different UTC offsets.
Hosted gateway and restart read-back verification remain pending.

The history panel keeps its last successful result during temporary
refresh failures and labels it explicitly. A sign-in or permission
failure clears the panel, as does a successful empty response. Local
fixtures cover the temporary outage and sign-in expiry paths. Verify
the same flow against the hosted review service before release.

A saved market row with an unreadable timestamp makes the requested
pool history unavailable. The gateway avoids presenting partial history
and holder comparisons derived from that partial record set. An
authenticated local fixture covers the timezone-free timestamp case.

The history gateway validates calendar dates and time-of-day before
deduplicating observations. Local authenticated fixtures cover invalid
dates and hours that JavaScript would otherwise roll into the next day.
