import assert from 'node:assert/strict';
import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const sent=[], requests=[];
globalThis.__variantTest={upload:async(key,file,wanted)=>{sent.push({key,wanted,type:file.type})}};
const pages={
  '/api/admin/images':{images:[{key:'one',size:900,has_small:0,has_large:1},{key:'ready',size:300,has_small:1,has_large:1}],cursor:'next'},
  '/api/admin/images?cursor=next':{images:[{key:'two',size:900,has_small:0,has_large:0}],cursor:null},
};
globalThis.fetch=async(url)=>{requests.push(url);if(pages[url])return {ok:true,json:async()=>pages[url]};if(url.startsWith('/api/images/'))return {ok:true,blob:async()=>new Blob([new Uint8Array(16)],{type:'image/png'})};throw Error(url)};
const mocks={
 '@/i18n/LanguageContext':`exports.useLang=()=>({lang:'ar'})`,
 '@/lib/image':`exports.uploadImageVariants=globalThis.__variantTest.upload; exports.uploadImageToD1=async()=>{}; exports.ImageError=class extends Error {}`,
 '@/components/ui/LoadingImage':`exports.LoadingImage=()=>null`,
 '@/lib/messaging':`exports.copyText=async()=>true`,
};
const bundle=await build({entryPoints:['src/pages/Admin/ImageOptimization.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}))}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
let view;await act(async()=>{view=create(React.createElement(module.exports.ImageOptimization))});
assert.match(require('node:fs').readFileSync('src/pages/Admin/AdminPage.tsx','utf8'), /<ImageOptimization/);
const btn=view.root.findAllByType('button').find(b=>b.children.includes('تجهيز نسخ أخف للصور الموجودة'));assert.ok(btn);
await act(async()=>{btn.props.onClick();await new Promise(r=>setTimeout(r,10))});
assert.deepEqual(sent,[{key:'one',wanted:['small-v1'],type:'image/png'},{key:'two',wanted:['small-v1','large-v1'],type:'image/png'}]);
assert.ok(requests.includes('/api/admin/images?cursor=next'));assert.ok(!requests.includes('/api/images/ready'));
assert.ok(JSON.stringify(view.toJSON()).includes('تمت معالجة 3 صورة'));await act(async()=>view.unmount());
console.log('Existing image backfill processes pages sequentially, skips ready variants and reports progress.');
