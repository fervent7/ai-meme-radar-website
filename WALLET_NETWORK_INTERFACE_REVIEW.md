# Interactive Wallet DNA graph — review only

Parent a84fd94b879131cdfc207da8189dea9f83221019, review/verified-research-terminal PR3. Owner instructions read at issue comments 7167853678,7171240552,7171293354,7171558517.

New wallet-network.js renders only backend relationships already validated against the SAME authenticated saved transfer response by wallet-relationships.cjs. No graph is inferred from missing records or unavailable graphs. No new RPC/provider calls, clustering, identity inference, live freshness, safety rating or trading permission.

Directed SVG links and numbered owner nodes have accessible HTML controls: select an owner to apply the existing address/direction filter; select a link to highlight it, focus its evidence card and open original signature/slot/source/time details. No wallet connection required. Twelve links per diagram page, at most24nodes, at most1000existing saved links validated before drawing. Pagination and filters retain original edge indices. No amount-based wealth/impact encoding. Layout is static and responsive; controls are >=48px. Raw integers remain in source evidence, not floating-point graph sizing. Synthetic fixtures are visibly labelled inside the graph as well as the parent view.

Public third-party project case studies/token links removed from liquidity.html; independently useful liquidity workflow retained. Public navigation now says Liquidity Intelligence. The roadmap reflects the approved eight phases with public trading/token/vault services future and gated. Existing icon/wordmark assets unchanged. This does not complete six-section navigation or shared Research workspace tabs.

Local Node suite passed86tests before final hosted validation, including bounded page geometry, preserved original link identities, empty filters, and malformed/unbounded rejection. Browser checks exercise owner filtering, link highlight/original-proof inspection and graph screenshots at390px/1440px across the existing ten-viewport suite. Browser fixtures are synthetic contract data, not genuine chain observations or physical Android acceptance.

See WEBSITE_INTERFACE_INVENTORY.md: strict dedicated-interface coverage5/14, not >90% and not launch ready. No hosted release, production/configuration change, PostgreSQL mutation, personal-bot change or paid usage.
