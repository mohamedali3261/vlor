import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url), React=require('react');
const {act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={};
const observers=[];
globalThis.IntersectionObserver=class {
  constructor(callback,options){this.callback=callback;this.options=options;this.disconnected=false;observers.push(this)}
  observe(node){this.node=node}
  disconnect(){this.disconnected=true}
  enter(){this.callback([{isIntersecting:true}])}
};
const bundle=await build({entryPoints:['src/components/ui/LoadingImage.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'},alias:{'@':new URL('../src',import.meta.url).pathname}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const {LoadingImage}=module.exports;
let loaded=[],errors=[];
const render=(items)=>React.createElement('div',{},items.map(i=>React.createElement(LoadingImage,{key:i,src:`/${i}.jpg`,alt:`Image ${i}`,fallback:'missing',onLoad:()=>loaded.push(i),onError:()=>errors.push(i)})));
let view;await act(async()=>{view=create(render([1,2,3,4,5,6,7]),{createNodeMock:element=>element.type==='img'?{complete:false,naturalWidth:0}:{}})});
const imgs=()=>view.root.findAllByType('img');
assert.equal(imgs().length,0);assert.equal(view.root.findAllByProps({role:'status'}).length,7);
assert.equal(observers[0].options.rootMargin,'200px');
await act(async()=>{for(let i=0;i<6;i++)observers[i].enter()});
assert.equal(imgs().length,4);assert.deepEqual(imgs().map(x=>x.props.src),['/1.jpg','/2.jpg','/3.jpg','/4.jpg']);
await act(async()=>imgs()[0].props.onLoad());
assert.deepEqual(loaded,[1]);assert.equal(imgs().length,5);assert.equal(view.root.findAllByProps({role:'status'}).length,6);
await act(async()=>imgs()[1].props.onError());
assert.deepEqual(errors,[2]);assert.equal(imgs().length,5);assert.equal(view.root.findAllByProps({role:'status'}).length,5);
assert.ok(JSON.stringify(view.toJSON()).includes('missing'));
// Cancel queued image 7 and active image 3; neither may block the queue.
await act(async()=>observers[6].enter());
await act(async()=>view.update(render([1,4,5,6])));
assert.equal(imgs().some(x=>x.props.src==='/7.jpg'),false);
await act(async()=>view.unmount());
// A new image can immediately acquire a released slot after unmount.
await act(async()=>{view=create(render([8]),{createNodeMock:element=>element.type==='img'?{complete:false,naturalWidth:0}:{}})});
await act(async()=>observers.at(-1).enter());assert.equal(imgs()[0].props.src,'/8.jpg');
await act(async()=>view.unmount());
// A failed managed variant uses a fresh observer and queue slot for the original,
// then allows a visible retry after the original also fails.
const managed='/api/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await act(async()=>{view=create(React.createElement(LoadingImage,{src:managed,alt:'Product',retry:true}),{createNodeMock:element=>element.type==='img'?{complete:false,naturalWidth:0}:{}})});
await act(async()=>observers.at(-1).enter());assert.equal(imgs()[0].props.src,managed+'?variant=small-v1');
await act(async()=>imgs()[0].props.onError());assert.equal(imgs().length,0);
await act(async()=>observers.at(-1).enter());assert.equal(imgs()[0].props.src,managed);
await act(async()=>imgs()[0].props.onError());assert.equal(imgs().length,0);
await act(async()=>view.root.findByType('button').props.onClick());
await act(async()=>observers.at(-1).enter());assert.equal(imgs()[0].props.src,managed+'?variant=small-v1');
await act(async()=>imgs()[0].props.onLoad());await act(async()=>view.unmount());
// With no IntersectionObserver, source changes remain usable and use native lazy loading.
delete globalThis.IntersectionObserver;
await act(async()=>{view=create(render([9]),{createNodeMock:element=>element.type==='img'?{complete:false,naturalWidth:0}:{}})});
assert.equal(imgs()[0].props.loading,'lazy');assert.equal(imgs()[0].props.src,'/9.jpg');
await act(async()=>view.update(React.createElement(LoadingImage,{src:'/10.jpg',alt:'New image'})));assert.equal(imgs()[0].props.src,'/10.jpg');
await act(async()=>view.update(React.createElement(LoadingImage,{src:'/11.jpg',alt:'Another image'})));assert.equal(imgs()[0].props.src,'/11.jpg');
await act(async()=>view.unmount());
// Managed D1 URLs choose size-specific variants; a broken variant falls back to the original.
const original='/api/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await act(async()=>{view=create(React.createElement(LoadingImage,{src:original,alt:'Product',variant:'large-v1',retry:true,fallback:'Unavailable'}),{createNodeMock:element=>element.type==='img'?{complete:false,naturalWidth:0}:{}})});
assert.equal(imgs()[0].props.src,original+'?variant=large-v1');
await act(async()=>imgs()[0].props.onError());assert.equal(imgs()[0].props.src,original);
await act(async()=>imgs()[0].props.onError());assert.ok(JSON.stringify(view.toJSON()).includes('Unavailable'));
await act(async()=>view.root.findByType('button').props.onClick());assert.equal(imgs()[0].props.src,original+'?variant=large-v1');
await act(async()=>imgs()[0].props.onLoad());assert.equal(view.root.findAllByProps({role:'status'}).length,0);
await act(async()=>view.unmount());
// External URLs remain unchanged and never get sent to the local variant endpoint.
await act(async()=>{view=create(React.createElement(LoadingImage,{src:'https://example.com/image.png',alt:'external'}),{createNodeMock:()=>({complete:false,naturalWidth:0})})});
assert.equal(imgs()[0].props.src,'https://example.com/image.png');await act(async()=>view.unmount());
console.log('Deferred viewport loading, four-request queue, spinner, errors, cleanup and fallback passed.');
