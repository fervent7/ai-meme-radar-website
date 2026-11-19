# Institutional research terminal redesign — implementation brief

**Status:** design branch only. No merge, Render deploy, production API change, or external publication approved.

## Design goal
Position AI Meme Radar as a serious, evidence-first **multichain crypto research platform**, not a meme-token promotional landing page. Keep the existing AI Meme Radar wordmark, cyan/green accent and **Research Before Risk** identity. Restrained dark navy surfaces, precise typography, high-contrast tables, compact status chips and provenance timestamps. No fabricated metrics, logos of unconnected partners or promises of returns.

## Information architecture
- **Overview:** clear platform value proposition, a compact research-workspace preview, methodology and explicit connection status.
- **Live Radar:** actual backend observations, freshness, filters, source attribution and clear unavailable state.
- **Token Research:** prominent address input; auto chain detection; liquidity, market activity, verified/unverified holder evidence, risk context and historical observations.
- **Wallet Intelligence:** development status; no simulated holder verification presented as live.
- **Liquidity & Market Structure:** evidence and roadmap, distinguish OTC-related research from a live OTC service.
- **Ecosystem / Roadmap:** future programmable utility, wallet tools and planned capabilities labeled as such.
- **Community:** official X and Telegram links, public updates, transparent research-first positioning.

## Page-level design decisions
1. Replace large decorative radar hero with a **compact research-terminal overview** and a clear entry point to token lookup. Keep the hero statement short and factual.
2. Show backend state prominently but without occupying the entire page. Unavailable ≠ zero. Never fabricate pool counts, volume, holder numbers, scan frequency or risk certification.
3. Move token research and evidence to the visual foreground: desktop table + detail rail, mobile stacked cards with horizontal table scroll only where unavoidable.
4. Use a restrained type scale and 8px spacing rhythm, consistent 12–16px panel radius, accessible focus rings, adequate contrast and touch targets.
5. Preserve IDs and hooks consumed by existing `app.js` and tests (`fresh`, `candidates`, `eligible`, `tokenRows`, `healthBadge`, `connection`, `statusText`, `scansText`, `alertsText`, `updated`, `radarNotice`, `refresh`, `address`, `searchBtn`, `researchResults`).
6. Keep the six existing routes and redirects working; preserve canonical community links and accessible keyboard/mobile navigation.
7. Mark in-development features explicitly. The independent Personal BSC Auto-Trader is **not** a deployed AI Meme Radar feature.

## Release and acceptance gates
- Changes remain on `design/institutional-research-terminal` until reviewed.
- Run all Node website tests, security checks, link audit and viewport checks including 320px, 390px, 430px and desktop.
- Validate both backend-online and backend-unavailable states. Use fixture data only when explicitly labeled as fixture.
- Check real Android behavior and authenticated saved-history retrieval separately; offline fixture passes are not live service verification.
- Obtain explicit owner approval before merging/deploying to aimemeradar.com.

## Implementation sequence
A. Refresh overview visual hierarchy and reusable design tokens without breaking API-bound element IDs.
B. Redesign token research workspace and live radar density.
C. Align remaining pages and mobile navigation.
D. Test all routes, states and responsive layouts; document screenshots and unresolved backend configuration separately.
