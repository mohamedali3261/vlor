import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const bundle = await build({
  entryPoints: ['src/data/defaultContent.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '@': new URL('../src', import.meta.url).pathname },
});
const { mergeContent } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
assert.equal(mergeContent(null).studioDeliveryTab, true);
assert.equal(mergeContent({ theme: { accent: '#123456' } }).studioDeliveryTab, true);
const hidden = mergeContent({ studioDeliveryTab: false });
assert.equal(mergeContent(JSON.parse(JSON.stringify(hidden))).studioDeliveryTab, false);
assert.equal(mergeContent({ studioDeliveryTab: 'false' }).studioDeliveryTab, true);
assert.equal(mergeContent({ studioDeliveryTab: true }).studioDeliveryTab, true);

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const home = await read('src/pages/Home/HomePage.tsx');
assert.doesNotMatch(home, /<Showcase\b/);
const details = await read('src/pages/Product/ProductDetails.tsx');
assert.match(details, /product\.description/);
assert.match(details, /product\.notes\.top/);
assert.doesNotMatch(details, /product\.story|1–4 days|٢٠٠٠/);
for (const path of ['src/pages/Product/PurchasePanel.tsx', 'src/components/product/QuickView.tsx']) {
  const page = await read(path);
  assert.match(page, /<ProductDetails/);
  assert.doesNotMatch(page, /<Stars|product\.rating|product\.reviews/);
}
assert.doesNotMatch(await read('src/pages/Shop/FilterBar.tsx'), /sortRating/);
const css = await read('src/index.css');
assert.match(css, /img, picture, video\s*\{\s*display:\s*none/);
assert.match(css, /img\.brand-logo\s*\{\s*display:\s*block/);
assert.match(await read('src/components/layout/Navbar.tsx'), /<Logo compact className="nav-brand-wordmark"/);
assert.match(await read('src/components/layout/HomeLoader.tsx'), /brand-logo home-loader__emblem/);
assert.match(await read('src/pages/Home/RunwayLookbook.tsx'), /<Logo compact className="rl-brand"/);
assert.match(await read('src/components/layout/Footer.tsx'), /<Logo light/);
assert.match(await read('index.html'), /vlor-supplied-favicon\.png/);
assert.match(await read('src/pages/Admin/ContentEditor.tsx'), /next\.studioDeliveryTab = event\.target\.checked/);
assert.match(await read('src/pages/Admin/AdminHeader.tsx'), /item\.key !== "delivery" \|\| content\.studioDeliveryTab/);
assert.match(await read('src/pages/Admin/AdminPage.tsx'), /tab === "delivery" && content\.studioDeliveryTab && <Delivery/);
console.log('Storefront presentation and delivery-tab persistence tests passed.');
