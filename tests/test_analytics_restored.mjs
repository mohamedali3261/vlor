import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'), {act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let handlers={},calls=[],intervals=new Map(),nextId=0;
const storage=new Map();
globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},location:{hash:'#/',href:'https://example.com/#/',origin:'https://example.com'},addEventListener(){},removeEventListener(){},setTimeout(){},scrollTo(){},setInterval:(fn)=>{intervals.set(++nextId,fn);return nextId},clearInterval:id=>intervals.delete(id)};
globalThis.document={visibilityState:'visible',addEventListener:(key,fn)=>{handlers[key]=fn},removeEventListener:key=>{delete handlers[key]}};
class ElementMock {constructor(tag,attrs){this.tagName=tag.toUpperCase();this.attrs=attrs;}closest(){return this;}getAttribute(key){return this.attrs[key]??null;}matches(){return false;}}
globalThis.Element=ElementMock;
globalThis.fetch=async(url,options)=>{if(url==='/api/analytics/event') calls.push(JSON.parse(options.body));return {ok:true}};
const bundle=await build({stdin:{contents:`export {useStorefrontAnalytics} from './src/hooks/useStorefrontAnalytics'; export {Link} from './src/lib/router';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
function Storefront({path}){module.exports.useStorefrontAnalytics(path);return React.createElement(module.exports.Link,{to:'/product/scent'},'Scent')}
let r;await act(async()=>{r=create(React.createElement(Storefront,{path:'/'}))});
assert.deepEqual(calls.map(x=>x.type),['page_view','heartbeat']);assert.equal(intervals.size,1);
const clickTarget=new ElementMock('a',{href:'#/product/scent'});handlers.click({target:clickTarget});
await act(async()=>r.root.findByType('a').props.onClick({defaultPrevented:false,preventDefault(){},metaKey:false,ctrlKey:false,shiftKey:false,altKey:false}));
assert.equal(calls.filter(x=>x.type==='interaction')[0].action,'product:scent');assert.equal(calls.filter(x=>x.type==='product_click')[0].productSlug,'scent');
window.location.hash='#/product/scent';await act(async()=>r.update(React.createElement(Storefront,{path:'/product/scent'})));
assert.deepEqual(calls.slice(-2).map(x=>x.type),['page_view','heartbeat']);assert.equal(intervals.size,1);
await act(async()=>r.update(React.createElement(Storefront,{path:'/studio'})));assert.equal(intervals.size,0);assert.equal(handlers.click,undefined);
assert.equal(calls.filter(x=>x.pagePath.startsWith('/studio')).length,0);
await act(async()=>r.update(React.createElement(Storefront,{path:'/track/private-token'})));assert.equal(calls.at(-2).pagePath,'/track');assert.equal(calls.at(-1).pagePath,'/track');assert.ok(!JSON.stringify(calls).includes('private-token'));
await act(async()=>r.unmount());assert.equal(intervals.size,0);assert.equal(Object.keys(handlers).length,0);
// Tracking errors must not break product navigation if browser crypto is unavailable.
const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});storage.clear();
assert.doesNotThrow(()=>module.exports.Link);let r2;await act(async()=>{r2=create(React.createElement(module.exports.Link,{to:'/product/scent'},'Scent'))});
assert.doesNotThrow(()=>r2.root.findByType('a').props.onClick({defaultPrevented:false,preventDefault(){},metaKey:false,ctrlKey:false,shiftKey:false,altKey:false}));
await act(async()=>r2.unmount());Object.defineProperty(globalThis,'crypto',original);
console.log('Restored route views, product clicks, presence, studio exclusion and failure isolation passed.');
