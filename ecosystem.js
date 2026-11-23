'use strict';
// Original service-discovery UI. No accounts, tracking, network or entitlements.
(() => {
  const controls = document.getElementById('service-filter');
  const container = document.getElementById('service-cards');
  const status = document.getElementById('service-results');
  if (!controls || !container || !status) return;
  const buttons = Array.from(controls.querySelectorAll('button[data-audience]'));
  const cards = Array.from(container.querySelectorAll('article[data-audiences]'));
  const labels = {
    all: 'everyone', individuals: 'everyday users', researchers: 'researchers',
    developers: 'developers', organizations: 'teams and businesses'
  };
  function select(audience) {
    if (!Object.hasOwn(labels, audience)) return;
    let count = 0;
    for (const card of cards) {
      const visible = audience === 'all' || card.dataset.audiences.split(' ').includes(audience);
      card.hidden = !visible;
      if (visible) count += 1;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.audience === audience));
    }
    status.textContent = count + ' service areas for ' + labels[audience] +
      '. Availability labels still apply; a match does not mean a service is launched.';
  }
  for (const button of buttons) {
    button.addEventListener('click', () => select(button.dataset.audience));
  }
  controls.hidden = false;
})();
