import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const compiled = await build({
  entryPoints: ['tests/storefront_render_fixture.tsx'], bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', jsx: 'automatic', write: false,
  alias: { '@': new URL('../src', import.meta.url).pathname },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const storage = new Map();
globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
const render = module.exports.renderParts;
let html = render();
assert.match(html, /تفاصيل المنتج/);
assert.match(html, /قرفة/);
assert.doesNotMatch(html, /<img\b|الحكاية|التوصيل ١–٤|تقييم/);
assert.match(html, /الشحن/);
const contentKey = 'malika.content.v1.20261103170000';
storage.set(contentKey, JSON.stringify({ studioDeliveryTab: false }));
html = render();
assert.doesNotMatch(html, />الشحن<\/button>/);
storage.set(contentKey, JSON.stringify({ studioDeliveryTab: true }));
html = render();
assert.match(html, />الشحن<\/button>/);
delete globalThis.window;
console.log('Rendered product details and studio delivery-tab toggle passed.');
