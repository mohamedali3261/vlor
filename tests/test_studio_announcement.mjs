import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'), {act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let saved;
globalThis.__studio = { content:null, updateContent:value=>{saved=value;} };
const mocks={
  '@/context/StoreContext':'exports.useStore=()=>({content:globalThis.__studio.content,products:[],updateContent:globalThis.__studio.updateContent,resetContent:()=>{}})',
  '@/context/ToastContext':'exports.useToast=()=>({push:()=>{}})',
  '@/i18n/LanguageContext':'exports.useLang=()=>({lang:"ar",t:k=>k,x:(en,ar)=>ar})',
  '@/lib/router':`const React=require('react');exports.Link=({children,...p})=>React.createElement('a',p,children)`,
  '@/pages/Admin/ProductImageScale':'exports.ProductImageScale=()=>null',
  '@/pages/Admin/ProductCardColours':'exports.ProductCardColours=()=>null',
};
const bundle=await build({stdin:{contents:`export {ContentEditor} from './src/pages/Admin/ContentEditor';export {createDefaultContent} from './src/data/defaultContent'`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'},alias:{'@':new URL('../src',import.meta.url).pathname},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
globalThis.__studio.content=module.exports.createDefaultContent();
let r;await act(async()=>{r=create(React.createElement(module.exports.ContentEditor))});
const root=r.root;
assert.ok(root.findAll(x=>x.type==='span' && x.children.includes('الشريط المتحرك أعلى الموقع')).length);
const en=root.findAllByType('input').find(x=>x.props.value===globalThis.__studio.content.announcements[0].en);
await act(async()=>en.props.onChange({target:{value:'New free shipping offer'}}));
const right=root.findAllByType('button').find(x=>x.children.includes('تتحرك لليمين →'));
await act(async()=>right.props.onClick());
const hasText=(node,text)=>node.children.some(child=>typeof child === 'string' ? child.includes(text) : child && hasText(child,text));
const add=root.findAllByType('button').find(x=>hasText(x,'إضافة رسالة'));
await act(async()=>add.props.onClick());
const save=root.findAllByType('button').find(x=>hasText(x,'حفظ التغييرات'));
await act(async()=>save.props.onClick());
assert.equal(saved.announcements[0].en,'New free shipping offer');assert.equal(saved.strips.announcement.direction,'right');assert.equal(saved.announcements.length,2);assert.equal(saved.sections.runwayLookbook,globalThis.__studio.content.sections.runwayLookbook);
await act(async()=>r.unmount());console.log('Announcement editor exposes, edits and saves messages and direction without changing unrelated content.');
