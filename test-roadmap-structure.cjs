'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

// Focused container validation for the authored static roadmap, not a general
// browser HTML parser. Browsers can repair crossed tags and hide source defects.
function checkContainers(html) {
  const stack = [];
  const planned = new Map();
  let sections = 0;
  for (const match of html.matchAll(/<(\/?)(main|section|div|article|footer)\b([^>]*)>/g)) {
    const [, closing, tag, attributes] = match;
    if (closing) {
      assert.equal(stack.pop()?.tag, tag, 'Roadmap containers must close in source order');
      continue;
    }
    const id = /\bid="([^"]+)"/.exec(attributes)?.[1];
    if (tag === 'section' && id === 'roadmap') {
      sections++;
      assert.ok(stack.some(item => item.tag === 'main'), 'Roadmap belongs to main');
    }
    if (tag === 'footer') assert.equal(stack.length, 0, 'Footer must be outside main/section');
    if (['wallet-portfolio', 'automated-trading'].includes(id)) {
      assert.equal(tag, 'article');
      assert.ok(stack.some(item => item.tag === 'section' && item.id === 'roadmap'),
                'Planned areas belong to the roadmap section');
      const parent = stack.at(-1);
      assert.equal(parent?.tag, 'div');
      assert.match(parent.attributes, /class="[^"]*\bplanned-modules\b/);
      assert.ok(!planned.has(id), 'Planned area IDs must be unique');
      planned.set(id, parent.index);
    }
    stack.push({ tag, id, attributes, index: match.index });
  }
  assert.equal(stack.length, 0, 'Roadmap container source must be balanced');
  assert.equal(sections, 1);
  assert.equal(planned.size, 2);
  assert.equal(planned.get('wallet-portfolio'), planned.get('automated-trading'),
               'Planned cards must remain siblings in the same grid');
}

const html = readFileSync(join(__dirname, 'roadmap.html'), 'utf8');
test('roadmap planned areas remain inside balanced main/section containers', () => {
  checkContainers(html);
});

test('crossed roadmap section and grid closures are detected before browser repair', () => {
  const marker = '  <div class="module-grid planned-modules">';
  assert.ok(html.includes(marker));
  const broken = html.replace(marker, '</section>\n' + marker);
  assert.throws(() => checkContainers(broken), /Planned areas belong|close in source order/);
});
