# Market numeric evidence validation — 23 November 2026

Parent: 0cdfa3a1c326e1777756a337d7fdf3782ed2ded0
Branch: review/verified-research-terminal; draft PR #3

## Confirmed defect

The actual app.js numeric coercion returned 0 for false and [].
The price formatter displayed negative price -1 as $-1 and false as $false.
This could make malformed provider fields look like price, valuation or price
change evidence. The existing card tests replaced num and pairPrice with
test-only functions, so they did not check the production formatters.

## Correction and reproduction

num now accepts only finite numbers or nonempty decimal/scientific numeric
strings. Booleans, arrays, objects, hexadecimal strings, whitespace-only text
and nonfinite values return null. Negative price is unavailable; negative
price CHANGE remains meaningful and is preserved. Valid numeric/string zero
and very small decimal/scientific prices remain visible.

Card regressions now execute the actual num, pairPrice and fmt functions from
app.js. They retain the quote-token attribution and zero transaction-count
checks, and test malformed price/change/valuation alongside valid zero/small
price and negative change. No provider claim becomes independently verified.

Actual local command: npm test — 42 tests passed.
These are Node VM/local gateway tests using synthetic fixtures. No new provider,
deployed revision, genuine authenticated report, physical Android or production
verification occurred. Tests were performed by Codex, not Frank.
Exact-head hosted source/browser/security results must be inspected separately.

## Ship / hold

Keep review branch and PR #3 draft, unmerged and undeployed. Current live/public
and authenticated hosted acceptance gates remain unchanged. Planned wallet/
trading features remain unavailable. No configuration or routing was changed.

## Three-project blocker triage and continuation

Auto-Trader review head bc39ac7d5131861939711e7731e1b1cf271b2747:
[Personal Bot Tests 45165487221](https://github.com/fervent7/personal-bsc-auto-trader/actions/runs/45165487221)
passed 1,096 tests;
[security 45165487301](https://github.com/fervent7/personal-bsc-auto-trader/actions/runs/45165487301)
passed enforced checks, with 14 medium / zero high Bandit findings remaining.
Read-only provider runs 45165487044 and 45165487250 were deliberately SKIPPED.
No qualifying full autonomous acceptance exists.

Its unchanged earliest genuine blocker is access to authentic exact-target
scanner/history/holder evidence, not missing hosted BSC_RPC_URL. No test-worker
capture has been executed and no separate TEST Render resource is verified
here. The existing Android test-resource access request is not repeated.
The production personal-bsc-auto-trader worker stays user-suspended.
Historical signed-fork and manual-wallet evidence remain partial classifications.

Return to [the precise bot acceptance handoff](https://github.com/fervent7/personal-bsc-auto-trader/blob/bc39ac7d5131861939711e7731e1b1cf271b2747/HOURLY_ACCEPTANCE_HANDOFF.md)
once genuine source evidence is accessible. Its next integration is real
collector evidence -> independently authenticated candidate -> isolated fork
entry, then executable monitoring/final exit policy and complete transfer/
receipt/recovery proof. Do not replace the missing source with mocked inputs,
resume production, retry unchanged RPC 429s or request wallet keys.

Radar review 42e944a35e44430f96ed23dfcb85f798a79cb659:
research 45158193574, security 45158193585 and link audit 45158193602 passed.
PostgreSQL runtime remains frozen pending required human review; authenticated
restart retention still needs separate evidence. No new provider or restart
attempt was made. Nothing was delegated.
