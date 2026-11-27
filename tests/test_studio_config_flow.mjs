import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'), {act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const bundle=await build({stdin:{contents:`export {StoreProvider,useStore} from './src/context/StoreContext'; export {createDefaultContent} from './src/data/defaultContent'; export {defaultSettings} from './src/data/site';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const {StoreProvider,useStore,createDefaultContent,defaultSettings}=module.exports;
const remoteContent=createDefaultContent();remoteContent.announcements[0].ar='رسالة مشتركة';
const store=new Map();globalThis.window={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
let calls=[], conflict=false, version='11111111-1111-4111-8111-111111111111';
globalThis.fetch=async(url,options)=>{
 calls.push({url,options});
 if(url==='/api/products')return {ok:true,json:async()=>[]};
 if(url==='/api/storefront-config')return {ok:true,json:async()=>({content:{version,data:remoteContent},settings:{version,data:defaultSettings}})};
 if(conflict)return {ok:false,status:409};
 return {ok:true,status:200,json:async()=>({version:'22222222-2222-4222-8222-222222222222'})};
};
let context;function Reader(){context=useStore();return null;}
let renderer;await act(async()=>{renderer=create(React.createElement(StoreProvider,null,React.createElement(Reader)))});
assert.equal(context.configStatus,'ready');assert.equal(context.content.announcements[0].ar,'رسالة مشتركة');
const next=structuredClone(context.content);next.announcements[0].ar='رسالة جديدة';
await act(async()=>{await context.updateContent(next)});
const request=calls.find(x=>x.url.endsWith('/content'));assert.equal(JSON.parse(request.options.body).version,version);assert.equal(context.content.announcements[0].ar,'رسالة جديدة');
conflict=true;const other=structuredClone(next);other.announcements[0].ar='غير محفوظ';
await assert.rejects(async()=>{await act(async()=>context.updateContent(other))},/Configuration changed/);assert.equal(context.content.announcements[0].ar,'رسالة جديدة');
await act(async()=>renderer.unmount());
console.log('Shared configuration loads for visitors; save uses version and failed saves do not replace data.');
