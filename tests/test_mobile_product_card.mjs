import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const output = await build({ entryPoints: ['src/lib/mobileProductCardMotion.ts'], bundle:true, platform:'node', format:'esm', write:false });
const { observeMobileProductCard } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
const classes = new Set();
const card = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) } };
let listener, observer, options;
const media = { matches:true, addEventListener: (_, f) => { listener=f; }, removeEventListener: (_, f) => { if (listener===f) listener=undefined; } };
class FakeObserver {
  constructor(cb, opts) { this.cb=cb; this.disconnected=false; observer=this; options=opts; }
  observe(element) { this.element=element; }
  disconnect() { this.disconnected=true; }
  emit(isIntersecting, intersectionRatio) { this.cb([{ target: card, isIntersecting, intersectionRatio }]); }
}
const browser = { matchMedia: (q) => { assert.match(q, /max-width: 639px/); assert.match(q, /hover: none/); return media; }, IntersectionObserver: FakeObserver };
const cleanup=observeMobileProductCard(card,browser);
assert.equal(observer.element,card); assert.deepEqual(options.threshold,[0,0.15]);
observer.emit(true,0.10); assert.equal(classes.has('pc-scroll-active'),false);
observer.emit(true,0.4); assert.equal(classes.has('pc-scroll-active'),true);
observer.emit(false,0); assert.equal(classes.has('pc-scroll-active'),false);
observer.emit(true,0.5); assert.equal(classes.has('pc-scroll-active'),true);
const oldObserver=observer; media.matches=false; listener();
assert.equal(oldObserver.disconnected,true); assert.equal(classes.has('pc-scroll-active'),false);
oldObserver.emit(true,0.8); assert.equal(classes.has('pc-scroll-active'),false);
media.matches=true; listener(); assert.notEqual(observer,oldObserver); observer.emit(true,0.4); assert.equal(classes.has('pc-scroll-active'),true);
cleanup(); assert.equal(observer.disconnected,true); assert.equal(classes.has('pc-scroll-active'),false); assert.equal(listener,undefined);
observer.emit(true,1); assert.equal(classes.has('pc-scroll-active'),false);
const fallback=observeMobileProductCard(card,{matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})});
assert.equal(classes.has('pc-scroll-active'),true); fallback(); assert.equal(classes.has('pc-scroll-active'),false);
const css=await readFile('src/styles/product-card.css','utf8');
assert.match(css,/@media \(max-width: 639px\)[\s\S]*?\.pc-card \{ height: 460px; max-width: 340px; \}/);
assert.match(css,/\.related-cards \.pc-card \{ height: 360px; max-width: 250px; \}/);
for (const part of ['pc-disc','pc-bottle-link','pc-panel','pc-sizes','pc-buy-btn']) assert.match(css,new RegExp(`\\.pc-card\\.pc-scroll-active \\.${part}`));
assert.match(css,/@media \(hover: hover\)\s*\{\s*\.pc-card:hover \.pc-panel/);
assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
for (const path of ['src/pages/Home/Featured.tsx','src/pages/Shop/ProductGrid.tsx','src/pages/Wishlist/WishlistPage.tsx']) {
  assert.doesNotMatch(await readFile(path,'utf8'),/min-\[400px\]:grid-cols-2/);
}
console.log('Mobile card dimensions, viewport activation, resizing, cleanup and fallback passed.');
