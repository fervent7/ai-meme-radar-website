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

  function coverage(history, identity) {
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
    const audit = create('details');
    audit.className = 'saved-evidence-identity';
    audit.append(create('summary', 'Research identity and saved window'));
    const fields = create('dl');
    const observations = history.observations;
    for (const [label, value] of [
      ['Chain', identity.chain], ['Token address', identity.token], ['Pool address', identity.pool],
      ['Distinct saved market observations', String(observations.length)],
      ['First market observation', observations.at(-1).observed_at_utc],
      ['Last market observation', observations[0].observed_at_utc]
    ]) fields.append(create('dt', label), create('dd', value));
    audit.append(fields, create('p', 'Market observation times are distinct from holder lookup times. This saved window is not a live price, holder-growth, or security guarantee.'));
    const movement = create('aside');
    movement.className = 'saved-liquidity-movement';
    movement.append(create('h6','Saved liquidity movement'));
    const comparison = history.reported_liquidity_window;
    if (comparison) {
      movement.setAttribute('data-direction', comparison.direction);
      const percent = comparison.change_pct === null ? 'Percentage unavailable' :
        Number(comparison.change_pct.toFixed(2)) + '%';
      movement.append(create('strong', 'Reported ' + comparison.direction.toLowerCase() + ' · ' + percent),
        create('p', formatUsd(comparison.first.liquidity_usd) + ' → ' + formatUsd(comparison.latest.liquidity_usd) +
          ' · ' + comparison.observations + ' saved market observations'),
        create('p', comparison.first.observed_at_utc + ' → ' + comparison.latest.observed_at_utc + ' · ' + comparison.source));
    } else {
      movement.append(create('strong','Comparison unavailable'),
        create('p','At least two consecutive same-source liquidity observations are required. Missing values and source changes break the comparison.'));
    }
    movement.append(create('p','Historical reported values only. A change does not establish current reserves, a liquidity drain, coordinated selling or sellability.'));
    section.append(grid, audit, movement);
    return section;
  }

  function render(panel, history, identity) {
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
    panel.replaceChildren(metrics, create('h5', marketHeading), rows, coverage(history, identity));
  }

  function storedTransfer(sample) {
    const details = create('details');
    details.className = 'stored-transfer';
    const count = sample.movements.length;
    details.append(create('summary','Saved transaction · ' + count + ' decoded transfer' + (count === 1 ? '' : 's')),
      create('p','Slot ' + sample.slot + ' · Block ' + sample.block_time_utc +
        ' · Recorded ' + sample.observed_at_utc + ' · ' + sample.source),
      create('p','Transaction signature'),create('code',sample.signature));
    const copy = create('button','Copy transaction signature');
    copy.type = 'button';
    const copyStatus = create('p','');
    copyStatus.setAttribute('role','status');
    copyStatus.setAttribute('aria-live','polite');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try {
        if (!window.navigator?.clipboard?.writeText) throw Error('Clipboard unavailable');
        await window.navigator.clipboard.writeText(sample.signature);
        copyStatus.textContent = 'Transaction signature copied.';
      } catch {
        copyStatus.textContent = 'Copy unavailable. Select and copy the full signature above.';
      } finally { copy.disabled = false; }
    });
    details.append(copy,copyStatus);
    if (!count) details.append(create('p','No target-token transfers decoded in this saved transaction. This does not establish mint-wide absence of activity.'));
    for (const [index,move] of sample.movements.entries()) {
      const item = create('article');
      item.append(create('h6','Transfer ' + (index + 1)));
      const fields = create('dl');
      for (const [label,value] of [
        ['Raw amount (base units; decimals unavailable)',move.amount_raw],
        ['Source owner',move.source_owner],['Destination owner',move.destination_owner],
        ['Source token account',move.source_account],['Destination token account',move.destination_account],
        ['Instruction index',String(move.outer_index) + (move.inner_index === null ? ' (outer)' : ' / ' + move.inner_index)]
      ]) fields.append(create('dt',label),create('dd',value));
      item.append(fields);details.append(item);
    }
    return details;
  }

  function walletRelationships(graph) {
    const section=create('section');section.className='wallet-relationships';
    section.setAttribute('aria-label','Wallet DNA saved transfer relationships');
    if (graph?.synthetic_example === true) section.append(create('strong','Synthetic contract test data · not a chain observation'));
    section.append(create('h5','Wallet DNA · saved transfer relationships'),
      create('p','Historical mint-scoped transfer links, not people or proof of common ownership, coordination or fraud. Incomplete coverage; loading this view does not refresh the evidence.'));
    if (!graph || !['HISTORICAL_OBSERVED_RELATIONSHIPS','NO_ATTRIBUTABLE_RELATIONSHIPS'].includes(graph.status)) {
      const reasons={OBSERVATION_PRECEDES_BLOCK_TIME:'The original recording time conflicts with the claimed chain time.',
        TRANSACTION_CHAIN_POINT_CONFLICT:'A saved transaction has conflicting chain locations.',
        SLOT_BLOCK_TIME_CONFLICT:'Saved records disagree on the block time for one slot.',
        CONFLICTING_TRANSFER_INSTRUCTION:'Saved records disagree on a transfer instruction.',
        TRANSFER_MOVEMENT_BUDGET:'The saved transfer set exceeds the supported evidence limit.',
        WRONG_TRANSFER_SCOPE:'Saved transfer records do not match the selected research scope.'};
      section.append(create('strong','Relationship evidence unavailable'),
        create('p',reasons[graph?.withholding_reason]||'The backend has not supplied a validated relationship projection for this saved window.'));
      return section;
    }
    if (!graph.relationships.length) section.append(create('strong','No attributable links in the supplied saved records. This does not establish absence of wallet activity.'));
    if (Number.isSafeInteger(graph.linked_owner_address_count)) section.append(
      create('p',graph.linked_owner_address_count+' linked owner addresses in saved evidence. Addresses may include contracts; this is not a count of people.'));
    if (graph.coverage) {
      const window=graph.coverage;
      section.append(create('p','Saved window: '+window.input_records+' input records · '+
        window.withheld_records+' withheld · '+window.unique_transactions+' distinct transactions.'),
        create('p',window.first_block_time_unix===null?'Original chain-time window unavailable.':
          'Original block times: '+new Date(window.first_block_time_unix*1000).toISOString()+
          ' → '+new Date(window.last_block_time_unix*1000).toISOString()));
    }
    const controls=create('div');controls.className='wallet-filter';
    const label=create('label','Filter owner address in this saved window');
    const query=create('input');query.type='search';query.value='';query.maxLength=44;
    query.autocomplete='off';query.spellcheck=false;label.append(query);
    const directionLabel=create('label','Owner address appears as');
    const direction=create('select');
    direction.setAttribute('aria-label','Owner address appears as');
    for (const [value,text] of [['either','Sender or recipient'],['sender','Sender'],['recipient','Recipient']]) {
      const option=create('option',text);option.value=value;direction.append(option);
    }
    directionLabel.append(direction);
    const clear=create('button','Show all saved links');clear.type='button';
    const count=create('p');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
    const cards=[];let network=null;
    function filterLinks() {
      const text=query.value.trim();let visible=0;
      for (const [edge,item] of cards) {
        const sender=direction.value!=='recipient'&&edge.source_owner.includes(text);
        const recipient=direction.value!=='sender'&&edge.destination_owner.includes(text);
        item.hidden=!!text&&!sender&&!recipient;
        if (!item.hidden) visible++;
      }
      count.textContent=visible+' of '+cards.length+' saved links shown. Solana addresses are case-sensitive; coverage remains incomplete.';
      if(network)network.update(cards.map(([edge,item],index)=>({edge,item,index})).filter(row=>!row.item.hidden));
    }
    query.addEventListener('input',filterLinks);
    direction.addEventListener('change',filterLinks);
    clear.addEventListener('click',()=>{query.value='';direction.value='either';filterLinks();});
    if (graph.relationships.length) { controls.append(label,directionLabel,clear,count);section.append(controls); }
    for (const edge of graph.relationships) {
      const item=create('article');item.className='wallet-relationship-edge';cards.push([edge,item]);const owners=create('dl');
      for (const [label,value] of [['From owner address',edge.source_owner],['To owner address',edge.destination_owner],
        ['Transferred base units (decimals unavailable)',edge.amount_raw],['Distinct saved instructions',String(edge.transfer_count)]]) {
        owners.append(create('dt',label),create('dd',value));
      }
      const evidence=create('details');evidence.append(create('summary','Inspect original transaction evidence'));
      for (const proof of edge.evidence) {
        evidence.append(create('p','Slot '+proof.slot+' · Block '+proof.block_time_utc+' · Recorded '+proof.observed_at_utc+' · '+proof.source),
          create('code',proof.signature));
      }
      item.append(owners);
      if(edge.observed_window){
        const window=edge.observed_window;
        item.append(create('p','Saved pair window: '+new Date(window.first_block_time_unix*1000).toISOString()+
          ' → '+new Date(window.last_block_time_unix*1000).toISOString()+' · '+window.distinct_transactions+
          ' distinct transactions. This does not refresh the evidence.'));
      } else item.append(create('p','Saved pair window unavailable for these legacy records. Inspect the original evidence below.'));
      item.append(evidence);section.append(item);
      const jump=create('div');jump.className='wallet-filter';
      for (const [name,address,value] of [['Filter this sender',edge.source_owner,'sender'],['Filter this recipient',edge.destination_owner,'recipient']]) {
        const button=create('button',name);button.type='button';
        button.addEventListener('click',()=>{query.value=address;direction.value=value;filterLinks();query.focus();});
        jump.append(button);
      }
      item.append(jump);
    }
    if(graph.relationships.length&&window.RadarWalletNetwork){
      const host=create('div');controls.after(host);
      network=window.RadarWalletNetwork.mount(host,cards.map(([edge],index)=>({edge,index})),{
        synthetic:graph.synthetic_example===true,
        onOwner(address){query.value=address;direction.value='either';filterLinks();query.focus();},
        onEvidence(index){const item=cards[index][1];item.querySelector('details').open=true;item.tabIndex=-1;item.focus();item.scrollIntoView({block:'nearest'});}
      });
    }
    filterLinks();
    return section;
  }

  function renderOnchain(panel, history) {
    panel.append(walletRelationships(history.wallet_relationships));
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
      }).join(' | ')],
      ['Recorded token transfers (mint scope)', history.transfers ?? [], null]
    ];
    for (const [label, rows, describe] of evidenceSections) {
      const list = create('ul');
      list.className = 'saved-market-rows';
      for (const sample of rows) {
        if (label === 'Recorded token transfers (mint scope)' && sample.verification === 'VERIFIED') {
          const row = create('li');row.append(storedTransfer(sample));list.append(row);continue;
        }
        list.append(create('li', sample.verification === 'VERIFIED'
          ? describe(sample) + ' · Slot ' + sample.slot + ' · Block ' + sample.block_time_utc +
            ' · Recorded ' + sample.observed_at_utc + ' · ' + sample.source
          : (sample.verification === 'ERROR' ? 'Error · Observation could not be verified · ' : 'Unavailable · ') + sample.observed_at_utc));
      }
      panel.append(create('h5', label), rows.length ? list : create('p', 'Unavailable'));
      if (label === 'Recorded token transfers (mint scope)') {
        const note = create('p','Stored records for this mint only; not attributed to the selected pool. History coverage is incomplete. Owner addresses are not people; common ownership and coordinated activity are not established.');
        note.className = 'research-warning';
        panel.append(note);
      }
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
          const observations = [].concat(data.holders, data.swaps, data.reserves, data.transfers ?? []);
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
      status.className = '';
      status.setAttribute('role', 'status');
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
          if (failure?.status === 'EVIDENCE_HELD') {
            panel.replaceChildren();
            status.className = 'history-held';
            status.setAttribute('role', 'alert');
            status.textContent = failure.reason === 'HOLDER_TIME_AFTER_RECORD_TOLERANCE'
              ? 'Saved holder evidence is withheld because its lookup time is inconsistent with the original saved record. No verified result is available. Try again later.'
              : 'Saved evidence is withheld because its records conflict or cannot be validated. No verified result is available. Try again later.';
            return;
          }
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
        render(panel, history, { chain, token, pool });
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


