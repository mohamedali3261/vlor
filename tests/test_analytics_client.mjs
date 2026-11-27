import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:['src/lib/analytics.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const {interactionAction,startAnalyticsTracking}=module.exports;
class FakeElement {
  constructor(tag='button',attrs={}) {this.tagName=tag.toUpperCase();this.attrs=attrs;}
  closest(){return this;}
  getAttribute(name){return this.attrs[name] ?? null;}
  matches(selector){return selector===':disabled' && !!this.attrs.disabled;}
}
globalThis.Element=FakeElement;
let listeners={}, interval, calls=[];
globalThis.window={location:{href:'https://shop.example/#/',origin:'https://shop.example'},localStorage:{getItem:()=>null,setItem(){}},setInterval:(fn,ms)=>{assert.equal(ms,60000);interval=fn;return 7;},clearInterval:(id)=>{assert.equal(id,7);interval=null;}};
globalThis.document={visibilityState:'visible',addEventListener:(type,fn)=>{listeners[type]=fn},removeEventListener:(type)=>{delete listeners[type]}};
globalThis.fetch=async (url,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true}};
const el=(tag,attrs)=>new FakeElement(tag,attrs);
assert.equal(interactionAction(el('a',{href:'#/product/scent'})),'product:scent');
assert.equal(interactionAction(el('a',{href:'#/track/123-private-token'})),'link-track');
assert.equal(interactionAction(el('a',{href:'https://wa.me/20123456789?text=private'})),'social-whatsapp');
assert.equal(interactionAction(el('a',{href:'https://m.me/store'})),'social-messenger');
assert.equal(interactionAction(el('a',{href:'#/studio'})),null);
assert.equal(interactionAction(el('button',{'data-analytics':'add-to-cart'})),'add-to-cart');
assert.equal(interactionAction(el('button',{'data-analytics':'personal-data'})),'other-button');
assert.equal(interactionAction(el('button',{disabled:true})),null);
let stop=startAnalyticsTracking('/shop?search=private'); assert.equal(calls[0].type,'heartbeat');assert.equal(calls[0].pagePath,'/shop');
listeners.click({target:el('button',{'data-analytics':'checkout'})});assert.equal(calls[1].action,'checkout');
listeners.click({target:el('a',{href:'#/track/private-token'})});assert.equal(calls[2].action,'link-track');assert.ok(!JSON.stringify(calls).includes('private'));
document.visibilityState='hidden';interval();assert.equal(calls.length,3);document.visibilityState='visible';listeners.visibilitychange();assert.equal(calls.length,4);
stop();assert.equal(interval,null);assert.equal(Object.keys(listeners).length,0);
startAnalyticsTracking('/studio');assert.equal(calls.length,4);assert.equal(Object.keys(listeners).length,0);
console.log('Privacy-safe click classification, heartbeats, route exclusion, visibility and cleanup passed.');
