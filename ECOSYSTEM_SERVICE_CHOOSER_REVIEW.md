# Original service chooser and developer preview — 23 November 2026

Parent: fc06c0de42a3ab5111f11cde9a2a08e5ac3d17fc, review/verified-research-terminal, draft PR #3.

## Actual UI change
Replaced the homepage's three generic module cards with a six-area service
chooser: Market Intelligence, Radar Rules Engine, Radar Liquidity Intelligence,
Radar Risk Intelligence, Radar Developer API and Radar Access Services.
Each card names who benefits, a concrete research/workflow outcome, availability
and a real internal destination. Audience buttons filter existing cards without
network requests, accounts, tracking or changing the availability labels.
Without JavaScript all six cards remain visible and inactive controls stay hidden.

Dark charcoal cards, restrained emerald/cyan accents, responsive 3/2/1 columns,
44px controls, keyboard activation, pressed states, visible focus and polite
result announcements extend the existing brand. No heavy animation or new
third-party dependency. The working market workspace remains above this section.
An expandable, keyboard-scrollable developer preview on Intelligence Studio
shows explicitly illustrative test data and original source/time/verification
fields; it is not a public API or a token observation.

Memberships, API subscriptions and services are potential product revenue paths,
not launched pricing or financial-return commitments. Live OTC/matching is not
offered; future RFQ/execution needs separate review. Private bot stays separate.

## Differentiation and scope review
Names follow Frank's approved native Radar brief. Copy and layout were written
for existing multichain source-attributed research, rule validation and saved
history; no competitor UI, assets, implementation, copy or tokenomics were used.
Generic OTC/programmable industry concepts are not represented as live products.
No formal competitor/IP/legal clearance or proprietary-novelty claim is made.
No external project source was supplied or used for a project-specific IP audit.
The catalog implements discovery/presentation of existing review tools and plans,
not the unbuilt services themselves.

## Actual verification
Codex ran npm test: 46 tests passed, including audience selection/reset,
unknown filter rejection and no-JavaScript/availability/test-data assertions.
Existing authenticated gateway, exact-pool history, market-data and retry tests
remain. Browser test syntax compiled.

The existing Playwright acceptance now exercises all ten desktop/tablet/mobile
viewports (320..2560px), audience filtering, keyboard use, touch sizes, original
market/history states, developer example expansion and no page overflow. A
390px JavaScript-disabled/reduced-motion context verifies progressive content.
It exports ecosystem screenshots at 390px and 1440px with fixture data.
Local browser execution did NOT pass: bundled Playwright browser was absent;
installed Chromium then failed with socket Operation not permitted at startup.
That is runner evidence, not a website defect or responsive PASS. Inspect new
exact-head CI and its browser artifacts before accepting browser results.
All intercepted market/history data in this test are synthetic fixtures.

## Ship/hold and continuation
Review only; no deployment, authenticated genuine hosted history or physical
Android verification occurred. Public API, memberships, notifications/webhooks,
execution and optional token access remain unlaunched/planned.

Bot review remains 8a52ec8, 1,143 source tests and security/offline CI passed.
No new protected fresh scanner capture run appeared during this review.
Its signed-fork artifact remains partial proof, not full autonomous acceptance.
Previous manual capture action is unchanged and not repeated.
Radar's companion coverage projection reuses the existing rule evaluator; no
public endpoint or PostgreSQL runtime change is implied by this UI preview.
Nothing was delegated. Preserve all three repository/deployment boundaries.
