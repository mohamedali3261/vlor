import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = {
  '@/i18n/LanguageContext': 'exports.useLang=()=>({lang:"ar",t:k=>k,l:v=>v.ar})',
  '@/components/ui/Primitives': 'exports.SmartImage=()=>null',
  '@/components/ui/icons': 'exports.Pencil=exports.Search=exports.Trash=()=>null',
};
const bundle = await build({entryPoints:['src/pages/Admin/ProductTable.tsx'], bundle:true, platform:'node', format:'cjs', packages:'external', jsx:'automatic', write:false, loader:{'.css':'empty'}, alias:{'@':process.cwd()+'/src'}, plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//}, a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined); b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const module={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const make=(id)=>({id,slug:id,name:{en:id,ar:id},gender:'men',price:149,images:[]});
let products=[make('a'),make('b'),make('c')], moves=[], fail=false, reloads=0;
const props=()=>({products,onEdit:()=>{},onDelete:()=>{},onReorder:async ids=>{moves.push(ids);if(fail)throw Error('conflict');products=ids.map(id=>products.find(p=>p.id===id));},onReload:async()=>{reloads++;}});
let view;
await act(async()=>{view=create(React.createElement(module.exports.ProductTable,props()));});
let byLabel=label=>view.root.findByProps({'aria-label':label});
assert.equal(byLabel('نقل لأعلى · a').props.disabled,true);
assert.equal(byLabel('نقل لأسفل · c').props.disabled,true);
await act(async()=>{await byLabel('نقل لأعلى · b').props.onClick();});
assert.deepEqual(moves[0],['b','a','c']);
await act(async()=>view.update(React.createElement(module.exports.ProductTable,props())));
assert.equal(byLabel('نقل لأعلى · b').props.disabled,true);
let search=view.root.findByType('input');
await act(async()=>search.props.onChange({target:{value:'a'}}));
assert.equal(byLabel('نقل لأسفل · a').props.disabled,true);
await act(async()=>search.props.onChange({target:{value:''}}));
await act(async()=>view.root.findAllByProps({role:'tab'})[1].props.onClick());
assert.equal(byLabel('نقل لأسفل · a').props.disabled,true);
await act(async()=>view.root.findAllByProps({role:'tab'})[0].props.onClick());
fail=true;
await act(async()=>{await byLabel('نقل لأسفل · b').props.onClick();});
assert.equal(byLabel('نقل لأسفل · b').props.disabled,true);
const refresh=view.root.findAllByType('button').find(b=>b.children.includes('تحديث القائمة'));
assert.ok(refresh);
await act(async()=>{await refresh.props.onClick();});
assert.equal(reloads,1);
assert.equal(byLabel('نقل لأسفل · b').props.disabled,false);
await act(async()=>view.unmount());
const css=readFileSync('src/styles/studio-image-scale.css','utf8');
assert.match(css,/grid-template-rows: minmax\(0, 1fr\)/);
assert.match(css,/max-width: 60%;[\s\S]*?height: 60%;[\s\S]*?object-fit: contain/);
console.log('Studio ordering, filter protection, conflict refresh and bounded preview passed.');
