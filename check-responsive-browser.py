import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

mint = '22oDtUuTerJC5sbiYD8UQngsJaGe9pgiMxX3RA3mjJCh'
pool = 'DH2nkUP6GA85ydDjo8Rz7smVcUkq841frwmNwfVCRBhC'
server = subprocess.Popen(['node', '-e', """
const {testServer} = require('./website-test-server.cjs');
const [address, pool] = process.argv.slice(1);
const chain = 'solana';
const observations = ['18:10:46.104810', '18:37:48.240216'].map((time, index) => ({
 chain, contract_address: address, pool_address: pool, observed_at_utc: '2026-11-12T'+time+'+00:00',
 holder_observed_at_utc: '2026-11-12T'+time+'+00:00', address_identity_version: 2,
 holder_count: 75, holder_status: 'VERIFIED', holder_source: 'Helius getTokenAccounts',
 source: 'DexScreener token-pairs API', liquidity_usd: index ? 1582.105 : 3164.21, volume_5m_usd: 0
}));
const stamp = '2026-11-14T22:31:28.964826+00:00';
const sample = (kind, pool_address, reference, payload) => ({
 kind, chain, token_address: address, pool_address, reference, observed_at_utc: stamp,
 verification: 'VERIFIED', source: 'https://api.mainnet-beta.solana.com',
 payload: {slot: 469496016, block_time_utc: stamp, ...payload}
});
const onchain = {
 chain, token_address: address, pool_address: pool,
 token_transfer_coverage:{scope:'STORED_MINT_RECORDS_NOT_POOL_ATTRIBUTED',complete_history:false,record_limit:24},
 token_transfers:[sample('token_transfers',null,'B'.repeat(88),{
  block_time_unix:Math.floor(Date.parse(stamp)/1000),transfers:[{
   outer_index:0,inner_index:null,source_account:'C'.repeat(32),destination_account:'D'.repeat(32),
   source_owner:'E'.repeat(32),destination_owner:'F'.repeat(32),amount_raw:'492719579834'}]
 })],
 holder_observations: [sample('holder_distribution', null, '469496016', {
  method_version: 'top-10-positive-owner-balances-v1', holder_count: 73,
  total_supply_raw: '995586144003707', top_10_balance_raw: '982029418470268'
 })],
 swaps: [sample('pool_swaps', pool, 'A'.repeat(88), {direction: 'SELL'})],
 reserves: [sample('pool_reserves', pool, '469496016', {
  protocol: 'raydium-cpmm', vaults: [
   {mint: address, reserve_raw: '953483215311515', decimals: 6},
   {mint: 'So11111111111111111111111111111111111111112', reserve_raw: '18520422483', decimals: 9}
  ]
 })]
};
const server = testServer({password:'browser-fixture', radarKey:'backend-fixture',
 request: async url => Response.json(url.pathname === '/api/research/onchain-history' ? onchain :
  {chain, contract_address: address, pools: [{pool_address: pool, observations}]})});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
""", mint, pool], stdout=subprocess.PIPE, text=True)
routes = ['index.html','research.html','intelligence.html','liquidity.html','roadmap.html','community.html']
community_urls = {'X': 'https://x.com/aimemeradar', 'Telegram': 'https://t.me/AIMemeRadarCommunity'}
origin = 'http://127.0.0.1:' + server.stdout.readline().strip()
pair = {'chainId':'solana','dexId':'raydium','pairAddress':pool,
        'baseToken':{'address':mint,'name':'Whale Pad','symbol':'WHALE'},
        'quoteToken':{'address':'So11111111111111111111111111111111111111112','symbol':'SOL'},
        'liquidity':{'usd':3164.21},'volume':{'m5':0},'priceUsd':'0.000001659'}
def intercept(route):
    if route.request.url.startswith(origin + '/'):
        route.continue_()
    elif '/api/status' in route.request.url:
        route.fulfill(json={'tokens':[{'name':'Whale Pad','symbol':'WHALE','chain':'solana','address':mint,'liquidity_usd':3164.21,'volume_5m_usd':0}]},headers={'access-control-allow-origin':'*'})
    elif route.request.url.startswith('https://api.dexscreener.com/'):
        route.fulfill(json={'pairs':[pair]},headers={'access-control-allow-origin':'*'})
    else:
        route.abort()
def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth === innerWidth'), page.url

def verify_community_links(container):
    for name, url in community_urls.items():
        link = container.get_by_role('link', name=name, exact=True)
        assert link.is_visible() and link.get_attribute('href') == url
        assert link.bounding_box()['height'] >= 44
        link.click(trial=True)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        anonymous = browser.new_context()
        assert anonymous.request.get(origin + '/research.html').status == 401
        anonymous.close()
        screenshots = Path('browser-evidence')
        screenshots.mkdir(exist_ok=True)
        fallback = browser.new_context(viewport={'width':390,'height':844}, java_script_enabled=False,
            reduced_motion='reduce', http_credentials={'username':'reviewer','password':'browser-fixture'})
        fallback.route('**/*',intercept)
        static = fallback.new_page()
        static.goto(origin+'/index.html')
        assert static.locator('#service-cards article:visible').count() == 6
        assert not static.locator('#service-filter').is_visible()
        no_overflow(static)
        fallback.close()
        for w,h in [(1366,768),(1440,900),(1920,1080),(1280,800),(2560,1440),
                    (768,1024),(1024,768),(320,640),(390,844),(430,932)]:
            ctx = browser.new_context(viewport={'width':w,'height':h},has_touch=w<=1024,
                http_credentials={'username':'reviewer','password':'browser-fixture'})
            ctx.route('**/*',intercept)
            page = ctx.new_page()
            errs=[]
            page.on('pageerror',lambda error: errs.append(str(error)))
            page.goto(origin+'/index.html')
            page.keyboard.press('Tab')
            assert page.evaluate("document.activeElement.classList.contains('skip-link')")
            page.keyboard.press('Enter')
            page.wait_for_function("document.activeElement.id === 'main'")
            page.locator('#tokenRows .tablelink').wait_for()
            table=page.locator('.tablewrap')
            assert table.evaluate('(e) => e.scrollWidth '+('>' if w<700 else '===')+' e.clientWidth')
            if w<=1024:
                menu=page.locator('#menu')
                menu.press('Enter')
                assert menu.get_attribute('aria-expanded')=='true'
                page.keyboard.press('Escape')
                assert menu.get_attribute('aria-expanded')=='false' and menu.evaluate('(e) => e === document.activeElement')
            else:
                assert page.locator('.site-nav').evaluate("(e) => getComputedStyle(e).position === 'sticky'")
                assert page.locator('#nav').is_visible() and not page.locator('#menu').is_visible()
                market = page.locator('.market-panel').bounding_box()
                monitor = page.locator('.dashboard-workspace .monitor-card').bounding_box()
                assert market['width'] > monitor['width']
                assert market['x'] + market['width'] <= monitor['x']
                assert abs(market['y'] - monitor['y']) < 2
                assert market['y'] < h / 2, 'Market table should be in the upper half of the workspace'
                if w in (1366, 1440, 1920):
                    page.screenshot(path=str(screenshots / f'dashboard-{w}.png'), animations='disabled')
            verify_community_links(page.locator('.community-panel'))
            # Original service chooser: keyboard/touch, honest badges and no overflow.
            services = page.locator('#service-cards')
            assert services.locator('article:visible').count() == 6
            developer_filter = page.get_by_role('button', name='Developers', exact=True)
            developer_filter.focus()
            page.keyboard.press('Enter')
            assert developer_filter.get_attribute('aria-pressed') == 'true'
            assert services.locator('article:visible').count() == 4
            assert page.locator('#service-results').inner_text().startswith('4 service areas for developers')
            assert services.locator('[data-service="developer"] .feature-state').inner_text() == 'Planned'
            page.get_by_role('button', name='Everyone', exact=True).click()
            assert services.locator('article:visible').count() == 6
            for button in page.locator('#service-filter button').all():
                assert button.bounding_box()['height'] >= 44
            no_overflow(page)
            if w in (390,1440):
                page.locator('.ecosystem-workspace').screenshot(path=str(screenshots / f'ecosystem-{w}.png'), animations='disabled')
            page.evaluate('scrollTo(0, 0)')
            if w<=1024:
                page.locator('#menu').tap()
            verify_community_links(page.locator('.sidebar-community'))
            if w<=1024:
                page.keyboard.press('Escape')
            for name in routes[1:] + routes[:1]:
                if w<=1024: page.locator('#menu').tap()
                page.locator('#nav a[href="'+name+'"]').click()
                page.wait_for_url(origin+'/'+name)
                assert page.locator('main h1').count()==1
                if name == 'intelligence.html':
                    example = page.locator('#developer-contract details')
                    example.locator('summary').click()
                    assert example.locator('pre').is_visible()
                    assert example.locator('pre').get_attribute('tabindex') == '0'
                    assert 'not a token observation' in example.inner_text()
                    passport=page.locator('#passport-preview')
                    passport.get_by_text('Evidence missing or unavailable (example)',exact=True).wait_for()
                    passport.locator('#passport-scenario').select_option('expired')
                    passport.get_by_text('Expired evidence (example)',exact=True).wait_for()
                    passport.locator('#passport-scenario').select_option('revoked')
                    passport.get_by_text('Revoked reference (example)',exact=True).wait_for()
                    passport.locator('#passport-scenario').select_option('current')
                    passport.get_by_text('Recorded checks current (example)',exact=True).wait_for()
                    assert passport.locator('.passport-check').count()==3
                    assert 'PRODUCER_ASSERTION_NOT_INDEPENDENT_ATTESTATION' not in passport.inner_text()
                    assert passport.get_by_text('Current source record',exact=True).count()==3
                    first_check=passport.locator('.passport-check').first
                    first_check.get_by_text('View chain reference',exact=True).click()
                    assert first_check.get_by_text('Block 17',exact=True).is_visible()
                    assert 'UTC' in first_check.inner_text()
                    assert 'No attestation is issued' in passport.inner_text()
                    assert passport.locator('#passport-scenario').bounding_box()['height']>=48
                    no_overflow(page)
                    if w in (390,1440): passport.screenshot(path=str(screenshots/f'passport-preview-{w}.png'),animations='disabled')

                assert page.locator('#nav a[aria-current="page"]').get_attribute('href')==name
                no_overflow(page)
                verify_community_links(page.locator('footer'))
                page.evaluate('scrollTo(0, 0)')
            page.goto(origin+'/research.html')
            if w > 1024:
                search_input = page.locator('#address').bounding_box()
                search_button = page.locator('#searchBtn').bounding_box()
                assert search_input['x'] + search_input['width'] <= search_button['x']
                assert abs(search_input['y'] - search_button['y']) < 2
            # Native network filter is a UI scope, never a contract/security claim.
            invalid_requests=[]
            def track_invalid(request):
                if request.url.startswith('https://api.dexscreener.com/latest/dex/search'): invalid_requests.append(request.url)
            page.on('request',track_invalid)
            page.locator('#network').select_option('bsc')
            page.locator('#address').fill(mint)
            page.get_by_role('button',name='Research token',exact=True).click()
            page.get_by_text('Address format does not match the selected network.',exact=False).wait_for()
            assert page.locator('#address').get_attribute('aria-invalid') == 'true'
            assert invalid_requests == []
            page.remove_listener('request',track_invalid)
            page.locator('#network').select_option('solana')
            page.locator('#address').fill(mint)
            page.locator('#searchBtn').click()
            handoff = page.get_by_role('link', name='Open Radar test research (sign-in required)', exact=True)
            handoff.wait_for()
            assert page.locator('#address').get_attribute('aria-invalid') == 'false'
            if w == 390:
                page.evaluate("""() => {window.copiedIdentity=null;
                  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
                    writeText:value=>{window.copiedIdentity=value;return Promise.resolve()}}});} """)
                token_copy=page.get_by_role('button',name='Copy token address',exact=True)
                pool_copy=page.get_by_role('button',name='Copy pool address',exact=True)
                assert token_copy.bounding_box()['height'] >= 48
                assert pool_copy.bounding_box()['height'] >= 48
                token_copy.click()
                page.get_by_text('Token address copied.',exact=True).wait_for()
                assert page.evaluate('window.copiedIdentity') == mint
                pool_copy.click()
                page.get_by_text('Pool address copied.',exact=True).wait_for()
                assert page.evaluate('window.copiedIdentity') == pool
                page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}})")
                token_copy.click()
                page.get_by_text('Copy unavailable. Select the full token address shown above.',exact=True).wait_for()
                assert token_copy.is_enabled()
                assert page.locator('.research-primary code').filter(has_text=mint).is_visible()
                no_overflow(page)

            assert handoff.locator('..').text_content() == 'Open Radar test research (sign-in required)'
            page.get_by_role('button',name='Load saved research history').click()
            page.get_by_text('Verified holder trend: UNCHANGED · 75 → 75 (0%)',exact=True).wait_for()
            assert page.get_by_text('Buyer growth: Unverified',exact=True).is_visible()
            coverage = page.get_by_role('region', name='Saved evidence coverage')
            assert coverage.locator('article').count() == 4
            assert coverage.get_by_text('Reported saved value',exact=True).is_visible()
            assert coverage.get_by_text('Unavailable',exact=True).count() == 1
            assert 'not a current security clearance' in coverage.inner_text()
            audit = coverage.locator('details.saved-evidence-identity')
            audit.get_by_text('Research identity and saved window',exact=True).click()
            assert audit.get_by_text(mint,exact=True).is_visible()
            assert audit.locator('dt').count() == 6
            assert 'distinct from holder lookup times' in audit.inner_text()
            no_overflow(page)
            if w in (390,1440):
                audit.screenshot(path=str(screenshots / f'saved-identity-{w}.png'),animations='disabled')
            audit.get_by_text('Research identity and saved window',exact=True).click()
            movement = coverage.locator('.saved-liquidity-movement')
            assert movement.get_by_text('Reported decreased · -50%',exact=True).is_visible()
            assert 'does not establish current reserves' in movement.inner_text()
            no_overflow(page)
            if w in (390,1440):
                movement.screenshot(path=str(screenshots / f'saved-liquidity-{w}.png'),animations='disabled')
                coverage.screenshot(path=str(screenshots / f'evidence-coverage-{w}.png'), animations='disabled')
            assert page.get_by_text('2026-11-12T18:10:46.104810',exact=False).count()
            assert page.locator('meter').count()==2
            assert page.locator('meter').first.evaluate("(e) => e.getBoundingClientRect().width > 100 && Number(e.value) === 1582.105")
            page.get_by_role('button', name='Load finalized on-chain evidence').click()
            page.get_by_text('Saved on-chain evidence loaded.', exact=True).wait_for()
            for heading in ('Holder distribution', 'Classified swaps', 'Pool reserve history'):
                assert page.get_by_role('heading', name=heading, exact=True).is_visible()
            assert page.get_by_text('Top 10 share of total mint supply 98.64%', exact=False).is_visible()
            assert page.get_by_text('Legacy method v1; infrastructure owners are not excluded', exact=False).is_visible()
            assert page.get_by_text('SELL · Organic activity unverified', exact=False).is_visible()
            assert page.get_by_text('18.520422483', exact=False).is_visible()
            assert page.get_by_text('Slot 469496016', exact=False).count() == 4
            transfer_heading=page.get_by_role('heading',name='Recorded token transfers (mint scope)',exact=True)
            assert transfer_heading.is_visible()
            transfer_detail=page.locator('.stored-transfer').first
            assert transfer_detail.get_attribute('open') is None
            transfer_detail.get_by_text('Saved transaction · 1 decoded transfer',exact=True).click()
            expect(transfer_detail).to_have_attribute('open','')
            # Controlled clipboard outcomes; no system clipboard or external service.
            page.evaluate("Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async value => { window.__copiedSignature=value; }}})")
            copy=transfer_detail.get_by_role('button',name='Copy transaction signature',exact=True)
            copy.click()
            transfer_detail.get_by_text('Transaction signature copied.',exact=True).wait_for()
            assert page.evaluate('window.__copiedSignature') == transfer_detail.locator('code').inner_text()
            page.evaluate("Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async () => {throw Error('denied')}}})")
            copy.click()
            transfer_detail.get_by_text('Copy unavailable. Select and copy the full signature above.',exact=True).wait_for()
            assert copy.is_enabled()
            assert transfer_detail.get_by_text('492719579834',exact=True).is_visible()
            assert transfer_detail.get_by_text('Raw amount (base units; decimals unavailable)',exact=True).is_visible()
            assert transfer_detail.locator('dt').count() == 6
            assert page.get_by_text('Stored records for this mint only;',exact=False).is_visible()
            if w in (390,1440):
                transfer_detail.screenshot(path=str(screenshots/f'stored-transfers-{w}.png'),animations='disabled')
            if w in (390,1440):
                heading = page.get_by_role('heading', name='Holder distribution', exact=True)
                evidence_panel = heading.locator('..')
                before = evidence_panel.inner_text()
                page.route('**/api/radar/onchain-history?*', lambda route: route.fulfill(
                    status=429, body='', headers={'Retry-After':'30'}))
                page.get_by_role('button', name='Load finalized on-chain evidence').click()
                # Retention text also exists while loading: wait for the terminal
                # rate-limit response, then the finally-cleared busy state.
                page.get_by_text('On-chain history service is busy. Try again in ', exact=False).wait_for()
                assert evidence_panel.inner_text() == before
                expect(evidence_panel).to_have_attribute('aria-busy', 'false')
                evidence_panel.screenshot(path=str(screenshots / f'retained-onchain-{w}.png'),animations='disabled')
                page.route('**/api/radar/history?*', lambda route: route.fulfill(
                    status=503, json={'status':'EVIDENCE_HELD','observations':[]}))
                page.get_by_role('button', name='Load saved research history').click()
                held = page.get_by_role('alert').filter(has_text='Saved evidence is withheld')
                held.wait_for()
                assert 'No verified result is available' in held.inner_text()
                assert page.get_by_text('Verified holder trend: UNCHANGED · 75 → 75 (0%)',exact=True).count() == 0
                page.locator('.cached-research').screenshot(path=str(screenshots / f'held-history-{w}.png'),animations='disabled')
            pause = page.get_by_role('button',name='Pause automatic refresh',exact=True)
            pause.click()
            resume = page.get_by_role('button',name='Resume automatic refresh',exact=True)
            expect(resume).to_have_attribute('aria-pressed','true')
            assert 'Automatic market refresh paused' in page.locator('#liveResearchStatus').inner_text()
            assert page.get_by_role('heading',name='Holder distribution',exact=True).is_visible()
            no_overflow(page)
            if w in (390,1440):
                page.locator('.live-market-controls').screenshot(path=str(screenshots/f'paused-market-{w}.png'),animations='disabled')
            resume.click()
            expect(page.get_by_role('button',name='Pause automatic refresh',exact=True)).to_have_attribute('aria-pressed','false')
            page.locator('#liveResearchStatus').filter(has_text='Live market snapshots').wait_for()
            assert page.get_by_role('heading',name='Holder distribution',exact=True).is_visible()
            assert not errs,errs
            no_overflow(page)
            if w in (390,1366,1440,1920):
                page.screenshot(path=str(screenshots / f'whale-pad-{w}.png'),animations='disabled',full_page=True)
            print(f'{w}x{h}: six routes, community links, responsive controls, table and Whale Pad saved history passed',flush=True)
            ctx.close()
finally:
    server.terminate()
    server.wait()
