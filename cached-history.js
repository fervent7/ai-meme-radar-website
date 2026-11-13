(() => {
  'use strict';
  const supportedChains = new Set(['solana', 'bsc', 'base', 'ethereum']);
  const create = (tag, value) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    return element;
  };

  function render(panel, history) {
    const holder = history.latest_holder_observation;
    const trend = history.holder_trend;
    const metrics = create('ul');
    if (holder) {
      metrics.append(create('li', 'Verified holder wallets: ' + holder.count + ' · ' + holder.observed_at_utc + ' · Helius getTokenAccounts'));
    }
    const growth = trend && trend.growth_pct !== null ? ' (' + Number(trend.growth_pct.toFixed(2)) + '%)' : '';
    const label = trend ? 'Verified holder trend: ' + trend.status + ' · ' + trend.first.count + ' → ' + trend.latest.count + growth
      : 'Verified holder trend: Insufficient saved evidence';
    metrics.append(create('li', label), create('li', 'Buyer growth: Unverified'));
    if (trend) {
      metrics.append(create('li', 'Holder observations: ' + trend.first.observed_at_utc +
        ' → ' + trend.latest.observed_at_utc));
    }
    const rows = create('ul');
    for (const observation of history.observations) {
      const liquidity = observation.liquidity_usd === null ? 'Unavailable' : '$' + observation.liquidity_usd.toLocaleString();
      const volume = observation.volume_5m_usd === null ? 'Unavailable' : '$' + observation.volume_5m_usd.toLocaleString();
      rows.append(create('li', observation.observed_at_utc + ' · Liquidity ' + liquidity +
        ' · 5m volume ' + volume + ' · ' + (observation.market_source ?? 'Source unavailable')));
    }
    panel.replaceChildren(metrics, create('h5', 'Saved market observations'), rows);
  }

  function mount(card) {
    const { chain, pool, token } = card.dataset;
    if (!window.RADAR_CACHED_HISTORY_ENABLED || !supportedChains.has(chain) || !pool || !token) return;
    const wrapper = create('section');
    wrapper.className = 'cached-research';
    const button = create('button', 'Load saved research history');
    button.type = 'button';
    button.className = 'outline';
    const status = create('p');
    status.setAttribute('role', 'status');
    const panel = create('div');
    const query = new URLSearchParams({ chain, address: token, pool });
    wrapper.append(button, status, panel);
    card.append(wrapper);

    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Loading saved observations…';
      const signal = AbortSignal.timeout(8500);
      try {
        const response = await fetch('/api/radar/history?' + query, {
          credentials: 'same-origin', cache: 'no-store', signal
        });
        if (response.status === 401 || response.status === 403) {
          panel.replaceChildren();
          status.textContent = 'Reload the page to sign in to the test environment.';
          return;
        }
        if (response.status === 429) {
          status.textContent = 'History service is busy. Try again later.';
          if (panel.childElementCount) status.textContent += ' Showing the last saved observations loaded.';
          return;
        }
        if (response.status === 503) {
          const failure = await response.json().catch(() => null);
          if (failure?.status === 'BACKEND_AUTH_REQUIRED') {
            panel.replaceChildren();
            status.textContent = 'The test website could not authenticate to the Radar backend.';
            return;
          }
        }
        if (!response.ok) throw Error('History unavailable');
        const history = await response.json();
        if (history.status === 'EMPTY') {
          panel.replaceChildren();
          status.textContent = 'No saved observations for this pool.';
          return;
        }
        if (history.status !== 'READY') throw Error('History unavailable');
        render(panel, history);
        status.textContent = 'Saved observations loaded.';
      } catch {
        status.textContent = signal.aborted ? 'History request timed out. Try again.'
          : 'Saved history is unavailable. Try again later.';
        if (panel.childElementCount) status.textContent += ' Showing the last saved observations loaded.';
      } finally {
        button.disabled = false;
      }
    });
  }

  window.RadarCachedHistory = { mount };
})();
