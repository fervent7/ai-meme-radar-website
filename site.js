(() => {
  'use strict';

  const menu = document.getElementById('menu');
  const nav = document.getElementById('nav');
  const year = document.getElementById('year');
  const setOpen = open => {
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
  };

  menu.addEventListener('click', () => setOpen(menu.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menu.focus();
    }
  });
  year.textContent = new Date().getFullYear();

  // Preserve shared links to sections that previously lived on the home page.
  if (document.getElementById('radar')) {
    const pages = {
      '#research': 'research.html#research',
      '#test-results': 'research.html#test-results',
      '#ecosystem': 'roadmap.html',
      '#roadmap': 'roadmap.html',
      '#community': 'community.html',
      '#research-references': 'liquidity.html#research-references'
    };
    const next = pages[window.location.hash];
    if (next) window.location.replace(next);
  }
})();
