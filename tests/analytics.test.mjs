import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const code = readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8');
function fixture(href, referrer = '') {
  const scripts = [];
  const context = {
    window: { location: new URL(href) }, URL,
    document: { referrer, createElement: () => ({}), head: { appendChild: s => scripts.push(s) } }
  };
  runInNewContext(code, context);
  return { context, scripts, calls: Array.from(context.window.dataLayer || [], v => Array.from(v)) };
}
test('production sends one sanitized pageview config and loads one async tag', () => {
  const { calls, scripts } = fixture('https://hyderabadreads.fun/books?email=private@example.com#secret', 'https://example.org/read?token=private#fragment');
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], 'config');
  assert.equal(calls[1][1], 'G-KQ5C6LHH8R');
  assert.equal(calls[1][2].page_location, 'https://hyderabadreads.fun/books');
  assert.equal(calls[1][2].page_referrer, 'https://example.org/read');
  assert.equal(calls[1][2].page_title, 'Hyderabad Reads');
  assert.equal(calls[1][2].allow_google_signals, false);
  assert.equal(calls[1][2].allow_ad_personalization_signals, false);
  assert.equal('user_id' in calls[1][2], false);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-KQ5C6LHH8R');
});
test('www production hostname works', () => assert.equal(fixture('https://www.hyderabadreads.fun/').scripts.length, 1));
test('local, preview and lookalike hosts never load or queue analytics', () => {
  for (const href of ['http://localhost:5173/', 'http://127.0.0.1/', 'https://hyderabadreads.vercel.app/', 'https://hyderabadreads.fun.example.org/']) {
    const result = fixture(href);
    assert.equal(result.scripts.length, 0);
    assert.equal(result.calls.length, 0);
  }
});
test('repeated execution cannot double-load or double-count', () => {
  const { context, scripts } = fixture('https://hyderabadreads.fun/');
  runInNewContext(code, context);
  assert.equal(scripts.length, 1);
  assert.equal(context.window.dataLayer.length, 2);
});
test('empty or non-http referrer is not transmitted', () => {
  for (const value of ['', 'not a URL', 'file:///private', 'javascript:secret']) {
    assert.equal(fixture('https://hyderabadreads.fun/', value).calls[1][2].page_referrer, '');
  }
});
test('HTML includes the local loader once', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/src="\/analytics.js"/g) || []).length, 1);
});
