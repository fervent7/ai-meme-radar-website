(() => {
  'use strict';
  const supportedChains = new Set(['solana', 'bsc', 'base', 'ethereum']);
  const create = (tag, value) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    return element;
  };

  function formatUsd(value) {
    if (value === null) return 'Unavailable';
    if (value > 0 && value < 0.01) return 'Less than $0.01';
    return '$' + value.toLocaleString();
  }

  function coverage(history) {
    const section = create('section');
    section.className = 'evidence-coverage';
    section.setAttribute('aria-label', 'Saved evidence coverage');
    section.append(create('h5', 'Evidence coverage'), create('p',
      'Saved observations, not a current security clearance. Loading history does not refresh its original timestamps.'));
    const grid = create('div');
    grid.className = 'evidence-coverage-grid';
    const holder = history.latest_holder_observation;
    const liquidity = history.observations.find(row => row.liquidity_usd !== null);
    const rows = [
      ['Holder evidence', holder ? 'Verified saved count' : 'Unavailable',
        holder ? holder.count + ' owner addresses · ' + holder.observed_at_utc + ' · Helius getTokenAccounts'
          : 'No verified holder observation supplied.'],
      ['Liquidity evidence', liquidity ? 'Reported saved value' : 'Unavailable',
        liquidity ? formatUsd(liquidity.liquidity_usd) + ' · ' + liquidity.observed_at_utc + ' · ' + liquidity.market_source
          : 'No attributed liquidity observation supplied.'],
      ['Buyer verification', 'Unverified', 'Unique buyer-wallet growth is not established by this saved history.'],
      ['Security checks', 'Unavailable', 'Contract restrictions and sequential sellability proof are not supplied by this history.']
    ];
    for (const [label, state, detail] of rows) {
      const card = create('article');
      card.append(create('h6', label), create('strong', state), create('p', detail));
      grid.append(card);
    }
    section.append(grid);
    return section;
  }

  function render(panel, history) {
    const holder = history.latest_holder_observation;
    const trend = history.holder_trend;
    const metrics = create('ul');
    metrics.append(create('li', holder
      ? 'Verified holder owner addresses: ' + holder.count + ' · ' + holder.observed_at_utc + ' · Helius getTokenAccounts'
      : 'Verified holder count: Unavailable'));
    const growth = trend && trend.growth_pct !== null ? ' (' + Number(trend.growth_pct.toFixed(2)) + '%)' : '';
    const label = trend ? 'Verified holder trend: ' + trend.status + ' · ' + trend.first.count + ' → ' + trend.latest.count + growth
      : 'Verified holder trend: Insufficient saved evidence';
    metrics.append(create('li', label), create('li', 'Buyer growth: Unverified'));
    if (trend) {
      metrics.append(create('li', 'Holder observations: ' + trend.first.observed_at_utc +
        ' → ' + trend.latest.observed_at_utc));
    }
    const rows = create('ul');
    rows.className = 'saved-market-rows';
    const maxLiquidity = Math.max(0, ...history.observations.map(row => row.liquidity_usd ?? 0));
    for (const observation of history.observations) {
      const liquidity = formatUsd(observation.liquidity_usd);
      const volume = formatUsd(observation.volume_5m_usd);
      const row = create('li', observation.observed_at_utc + ' · Liquidity ' + liquidity +
        ' · 5m volume ' + volume + ' · ' + (observation.market_source ?? 'Source unavailable'));
      if (maxLiquidity > 0 && observation.liquidity_usd !== null) {
        const bar = create('meter');
        bar.setAttribute('min', '0');
        bar.setAttribute('max', String(maxLiquidity));
        bar.setAttribute('value', String(observation.liquidity_usd));
        bar.setAttribute('aria-hidden', 'true');
        row.append(bar);
      }
      rows.append(row);
    }
    const marketHeading = maxLiquidity > 0
      ? 'Saved market observations · bars show relative liquidity'
      : 'Saved market observations';
    panel.replaceChildren(metrics, create('h5', marketHeading), rows, coverage(history));
  }

  function renderOnchain(panel, history) {
    const evidenceSections = [
      ['Holder distribution', history.holders, sample => sample.holder_count +
        ' positive-balance owner addresses · Top 10 share of total mint supply ' + sample.concentration_pct +
        '% · Legacy method v1; infrastructure owners are not excluded'],
      ['Classified swaps', history.swaps, sample => sample.direction +
        ' · Organic activity unverified · Transaction ' + sample.signature],
      ['Pool reserve history', history.reserves, sample => sample.vaults.map(vault => {
        const digits = vault.reserve_raw.padStart(vault.decimals + 1, '0');
        const amount = vault.decimals ? digits.slice(0, -vault.decimals) + '.' + digits.slice(-vault.decimals) : digits;
        return amount + ' · Mint ' + vault.mint;
      }).join(' | ')]
    ];
    for (const [label, rows, describe] of evidenceSections) {
      const list = create('ul');
      list.className = 'saved-market-rows';
      for (const sample of rows) {
        list.append(create('li', sample.verification === 'VERIFIED'
          ? describe(sample) + ' · Slot ' + sample.slot + ' · Block ' + sample.block_time_utc +
            ' · Recorded ' + sample.observed_at_utc + ' · ' + sample.source
          : (sample.verification === 'ERROR' ? 'Error · Observation could not be verified · ' : 'Unavailable · ') + sample.observed_at_utc));
      }
      panel.append(create('h5', label), rows.length ? list : create('p', 'Unavailable'));
    }
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
    if (chain === 'solana') {
      const evidence = create('section');
      const onchainButton = create('button', 'Load finalized on-chain evidence');
      onchainButton.type = 'button';
      onchainButton.className = 'outline';
      const onchainStatus = create('p');
      onchainStatus.setAttribute('role', 'status');
      const onchainPanel = create('div');
      let onchainRetryAt = 0;
      function onchainMessage(message) {
        onchainStatus.textContent = message + (onchainPanel.childElementCount
          ? ' Showing previously loaded saved evidence; refresh not confirmed.' : '');
      }
      function showOnchainCooldown() {
        const seconds = Math.ceil((onchainRetryAt - Date.now()) / 1000);
        onchainMessage('On-chain history service is busy. Try again in ' +
          seconds + (seconds === 1 ? ' second.' : ' seconds.'));
      }
      evidence.append(onchainButton, onchainStatus, onchainPanel);
      wrapper.append(evidence);
      onchainButton.addEventListener('click', async () => {
        if (onchainButton.disabled) return;
        if (Date.now() < onchainRetryAt) {
          showOnchainCooldown();
          return;
        }
        onchainButton.disabled = true;
        onchainPanel.setAttribute('aria-busy', 'true');
        onchainMessage('Loading saved on-chain evidence…');
        const controller = new AbortController();
        const signal = controller.signal;
        const timer = setTimeout(() => controller.abort(), 8500);
        try {
          const response = await fetch('/api/radar/onchain-history?' + query, {
            credentials: 'same-origin', cache: 'no-store', signal
          });
          if (response.status === 401 || response.status === 403) {
            onchainPanel.replaceChildren();
            onchainStatus.textContent = 'Reload the page to sign in to the test environment.';
            return;
          }
          if (response.status === 429) {
            const delay = Number(response.headers.get('Retry-After'));
            onchainRetryAt = Date.now() + (Number.isSafeInteger(delay) && delay > 0 ? delay : 30) * 1000;
            showOnchainCooldown();
            return;
          }
          if (response.status === 504) {
            onchainMessage('Radar on-chain history request timed out. Try again.');
            return;
          }
          if (response.status === 503) {
            const failure = await response.json().catch(() => null);
            if (failure?.status === 'BACKEND_AUTH_REQUIRED') {
              onchainPanel.replaceChildren();
              onchainStatus.textContent = 'The test website could not authenticate to the Radar backend.';
              return;
            }
          }
          if (!response.ok) throw Error('On-chain history unavailable');
          const data = await response.json();
          if (data.status !== 'READY' && data.status !== 'EMPTY') {
            throw Error('On-chain history unavailable');
          }
          if (data.status === 'EMPTY') {
            onchainPanel.replaceChildren();
            onchainStatus.textContent = 'No saved on-chain evidence for this token and pool.';
            return;
          }
          // Build off-panel: malformed/partial rendering must not destroy the
          // previously loaded evidence or replace it with a partial new result.
          const nextPanel = create('div');
          renderOnchain(nextPanel, data);
          onchainPanel.replaceChildren(...nextPanel.children);
          const observations = [].concat(data.holders, data.swaps, data.reserves);
          const hasVerified = observations.some(row => row.verification === 'VERIFIED');
          const hasErrors = observations.some(row => row.verification === 'ERROR');
          const hasUnavailable = observations.some(row => row.verification === 'UNAVAILABLE');
          onchainStatus.textContent = hasVerified
            ? (hasErrors || hasUnavailable
              ? 'Saved on-chain evidence partially loaded. Some observations are unavailable or have errors.'
              : 'Saved on-chain evidence loaded.')
            : (hasErrors ? 'Saved observations include errors and could not be verified.'
              : 'Saved observations are unavailable or could not be verified.');
        } catch {
          onchainMessage(signal.aborted ? 'On-chain history request timed out. Try again.'
            : 'Saved on-chain evidence is unavailable. Try again later.');
        } finally {
          clearTimeout(timer);
          onchainPanel.setAttribute('aria-busy', 'false');
          onchainButton.disabled = false;
        }
      });
    }

    let retryAt = 0;
    function showCooldown() {
      const seconds = Math.ceil((retryAt - Date.now()) / 1000);
      status.textContent = 'History service is busy. Try again in ' + seconds + (seconds === 1 ? ' second.' : ' seconds.');
      if (panel.childElementCount) status.textContent += ' Showing the last saved observations loaded.';
    }

    button.addEventListener('click', async () => {
      if (button.disabled) return;
      if (Date.now() < retryAt) {
        showCooldown();
        return;
      }
      button.disabled = true;
      status.textContent = 'Loading saved observations…';
      if (panel.childElementCount) status.textContent += ' Showing the last saved observations loaded.';
      const controller = new AbortController();
      const signal = controller.signal;
      const timer = setTimeout(() => controller.abort(), 8500);
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
          const delay = Number(response.headers.get('Retry-After'));
          retryAt = Date.now() + (Number.isSafeInteger(delay) && delay > 0 ? delay : 30) * 1000;
          showCooldown();
          return;
        }
        if (response.status === 504) {
          status.textContent = 'Radar history request timed out. Try again.';
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
          status.textContent = 'No saved observations for this pool. Chain: ' + chain +
            ' · Token: ' + token + ' · Pool: ' + pool +
            '. An indexed market listing does not establish saved research history.';
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
        clearTimeout(timer);
        button.disabled = false;
      }
    });
  }

  window.RadarCachedHistory = { mount };
})();


