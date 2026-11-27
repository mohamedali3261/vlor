import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const alias={'@':new URL('../src',import.meta.url).pathname};
async function load(path) { const out=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias});const module={exports:{}};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports; }
const {protectStorefrontImages}=await load('src/lib/protectStorefrontImages.ts');
const listeners=new Map(), classes=new Set();
const doc={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);},documentElement:{classList:{add:(v)=>classes.add(v),remove:(v)=>classes.delete(v)}}};
const remove=protectStorefrontImages(doc); assert.ok(classes.has('image-guard-active'));
for (const action of ['contextmenu','dragstart']) {
  let prevented=false;
  listeners.get(action)({target:{closest:(selector)=>selector==='img'?{}:null},preventDefault:()=>prevented=true}); assert.equal(prevented,true);
  prevented=false;listeners.get(action)({target:{closest:()=>null},preventDefault:()=>prevented=true}); assert.equal(prevented,false);
  listeners.get(action)({target:null,preventDefault:()=>{throw Error('unrelated targets must not be blocked');}});
}
remove();assert.equal(listeners.size,0);assert.equal(classes.size,0);
const app=readFileSync('src/App.tsx','utf8'); assert.match(app,/path === "\/studio" \|\| path === "\/admin"/); assert.match(app,/return protectStorefrontImages\(document\)/);
const css=readFileSync('src/index.css','utf8');assert.match(css,/html\.image-guard-active img[^}]*-webkit-touch-callout:\s*none/);
const {migrateInstagram}=await load('src/lib/migrateInstagram.ts');
const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
data.set('v3',JSON.stringify({instagram:'old',whatsapp:'123',address:{en:'mine'},freeShippingThreshold:42}));data.set('v2',JSON.stringify({instagram:'previous',other:'keep'}));
migrateInstagram(store,['v3','v2'],'@vlor.perfumes');
assert.deepEqual(JSON.parse(data.get('v3')),{instagram:'@vlor.perfumes',whatsapp:'123',address:{en:'mine'},freeShippingThreshold:42});
assert.deepEqual(JSON.parse(data.get('v2')),{instagram:'@vlor.perfumes',other:'keep'});
data.set('v3',JSON.stringify({instagram:'owner.updated'}));migrateInstagram(store,['v3','v2'],'@vlor.perfumes');assert.equal(JSON.parse(data.get('v3')).instagram,'owner.updated');
const {socialUrl}=await load('src/lib/messaging.ts');
assert.equal(socialUrl('@vlor.perfumes','instagram'),'https://instagram.com/vlor.perfumes');
assert.equal(socialUrl('vlor.perfumes','instagram'),'https://instagram.com/vlor.perfumes');
assert.equal(socialUrl('https://evil.com/x','instagram'),undefined);
const shop=readFileSync('src/styles/shop-slider.css','utf8');assert.match(shop,/shop-bottle-enter\[data-active="true"\][^{]*\{\s*animation:/);assert.match(shop,/\[data-on="true"\] \.shop-reveal\s*\{\s*animation:/);assert.match(shop,/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.shop-bottle-enter\[data-active="true"\]/);
const hero=readFileSync('src/styles/home-scroll.css','utf8');assert.match(hero,/\.home-hero \.hero-pad/);assert.match(hero,/\.home-hero \.hd-hero/);assert.match(hero,/var\(--ss\)/);assert.match(hero,/var\(--hs\)/);
console.log('Storefront image deterrence, Instagram update, reduced-motion animations and scoped hero sizing passed.');
