import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let selected=50,added,opened=0,lang='ar',wished=false;
globalThis.__productTest={
  lang:()=>({lang,t:k=>k,l:v=>v[lang],x:(en,ar)=>lang==='ar'?ar:en}),
  cart:()=>({add:(...args)=>added=args,open:()=>opened++}),
  store:()=>({settings:{whatsapp:''},isWished:()=>wished,toggleWishlist:()=>wished=!wished}),
};
const mocks={
  '@/i18n/LanguageContext':'exports.useLang=globalThis.__productTest.lang',
  '@/context/CartContext':'exports.useCart=globalThis.__productTest.cart',
  '@/context/StoreContext':'exports.useStore=globalThis.__productTest.store',
  '@/context/ToastContext':'exports.useToast=()=>({push:()=>{}})',
  '@/components/ui/Primitives':`const React=require('react');exports.Badge=({children})=>React.createElement('span',null,children)`,
  '@/components/ui/Button':`const React=require('react');exports.Button=({children,icon,iconPosition,variant,size,full,href,...props})=>React.createElement(href?'a':'button',props,children)`,
  '@/lib/router':`const React=require('react');exports.Link=({children,to,...props})=>React.createElement('a',props,children)`,
  '@/motion':'exports.emitBagPulse=()=>{}',
};
const bundle=await build({entryPoints:['src/pages/Product/PurchasePanel.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'},alias:{'@':process.cwd()+'/src'},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}))}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const product={id:'scent',name:{ar:'عطر طويل للتجربة',en:'A very long scent name'},tagline:{ar:'وصف',en:'Scent'},description:{ar:'تفاصيل العطر',en:'Scent details'},notes:{top:[{ar:'قرفة',en:'Cinnamon'}],heart:[],base:[]},sizes:[{ml:30,price:149},{ml:50,price:179}],price:149};
let view;const render=()=>React.createElement(module.exports.PurchasePanel,{product,ml:selected,onSizeChange:n=>selected=n});
await act(async()=>{view=create(render())});
let sizeButtons=()=>view.root.findAllByProps({'data-analytics':'choose-size'});
assert.equal(sizeButtons().length,2);assert.equal(sizeButtons()[1].props['aria-pressed'],true);
await act(async()=>sizeButtons()[0].props.onClick());await act(async()=>view.update(render()));
assert.equal(sizeButtons()[0].props['aria-pressed'],true);
await act(async()=>view.root.findByProps({'aria-label':'increase'}).props.onClick());
await act(async()=>view.root.findByProps({'data-analytics':'add-to-cart'}).props.onClick());
assert.deepEqual(added,[product,30,149,2]);assert.equal(opened,1);
assert.ok(JSON.stringify(view.toJSON()).includes('تفاصيل العطر'));assert.ok(JSON.stringify(view.toJSON()).includes('قرفة'));
lang='en';await act(async()=>view.update(render()));assert.ok(JSON.stringify(view.toJSON()).includes('Scent details'));
await act(async()=>view.unmount());
const css=readFileSync('src/styles/product-page.css','utf8');
assert.match(css,/@media \(max-width: 639px\)/);assert.match(css,/height: clamp\(190px, 42svh, 310px\)/);assert.match(css,/max-width: 360px/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/"quantity wishlist" "add add"/);assert.match(css,/min-height: 48px/);
for(const [width,height] of [[320,568],[375,667],[390,844],[430,932]]) {
 const gallery=Math.max(190,Math.min(310,height*.42));assert.ok(gallery<=310);assert.ok(gallery<=height*.55);assert.ok(width-32>=288);
}
const page=readFileSync('src/pages/Product/ProductPage.tsx','utf8');assert.match(page,/product-page__layout/);assert.match(page,/selectedSize=\{ml\}/);assert.match(page,/lg:grid-cols/);
console.log('Mobile product layout bounds, responsive actions, Arabic/English, size and cart behavior passed.');
