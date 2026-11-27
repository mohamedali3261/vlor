import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const {act,create} = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let lines = [{key:'p:50',productId:'p',ml:50,qty:2,price:100,image:'/p.png',name:{en:'Scent',ar:'عطر'}}];
let cleared = false, copied = '', posts = [], pendingResponse;
globalThis.__checkout = {cart:()=>({lines,count:lines.reduce((s,l)=>s+l.qty,0),clear:()=>{cleared=true;lines=[];},close:()=>{}}),copy:(text)=>{copied=text;return true;}};
let timers = new Map(), nextTimer = 0;
globalThis.window = {addEventListener(){},removeEventListener(){},setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id)}};
globalThis.sessionStorage = {value:null,getItem(){return this.value},setItem(_k,v){this.value=v},removeItem(){this.value=null}};
globalThis.fetch = async (url, options) => {
  posts.push({url, body:JSON.parse(options.body), key:options.headers['Idempotency-Key']});
  if (url === '/api/quote') return {ok:true,json:async()=>({subtotal:240,shipping:30,discount:0,total:270,prices:[{productId:'p',ml:50,price:120}]})};
  return pendingResponse || {ok:true,status:201,json:async()=>({id:'order1',trackingToken:'track1',total:270})};
};
const mocks = {
  '@/context/CartContext':'exports.useCart=globalThis.__checkout.cart',
  '@/context/StoreContext':'exports.useStore=()=>({settings:{}})',
  '@/context/ToastContext':'exports.useToast=()=>({push:()=>{}})',
  '@/hooks/useUi':'exports.useBodyLock=()=>{}',
  '@/i18n/LanguageContext':'exports.useLang=()=>({lang:"ar", t:k=>k, l:v=>v.ar})',
  '@/components/ui/Primitives':`const React=require('react');exports.Portal=({children})=>children;exports.SmartImage=p=>React.createElement('img',p);`,
  '@/components/ui/Button':`const React=require('react');exports.Button=({children,icon,iconPosition,full,variant,size,...p})=>React.createElement('button',p,children);`,
  '@/components/ui/icons':`const React=require('react'); for(const i of ['Check','Copy','Truck','X']) exports[i]=()=>React.createElement('i');`,
  '@/lib/messaging':`exports.copyText=globalThis.__checkout.copy;exports.cartMessage=(lines,lang,settings,customer)=>JSON.stringify({lines,customer});`,
};
const bundle = await build({entryPoints:['src/components/cart/CheckoutSheet.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'},alias:{'@':new URL('../src',import.meta.url).pathname},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const module={exports:{}}; new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
let renderer;await act(async()=>{renderer=create(React.createElement(module.exports.CheckoutSheet,{open:true,onClose:()=>{}}))});
const root=renderer.root;
const field=(label)=>root.findAllByType('label').find(x=>x.findByType('span').children.join('').includes(label)).findAll(x=>['input','textarea','select'].includes(x.type))[0];
const change=async(label,value)=>act(async()=>field(label).props.onChange({target:{value}}));
const quote=async()=>{assert.equal(timers.size,1);let fn=[...timers.values()][0];timers.clear();await act(async()=>{await fn()})};
const button=()=>root.findAllByType('button').find(x=>x.children.includes('إتمام الطلب'));
assert.equal(button().props.disabled,true);assert.equal(root.findByType('img').props.src,'/p.png');
assert.equal(field('cart.fullName').props.placeholder,undefined);
await change('cart.fullName','Test User');await change('رقم الموبيل','01012345678');await change('رقم إضافي','01112345678');await change('cart.address','Test address 123');await change('cart.city','Cairo');
await quote(); assert.equal(button().props.disabled,false);assert.equal(posts[0].url,'/api/quote');
// Copy uses server prices and includes the optional phone.
await act(async()=>root.findAllByType('button').find(x=>x.children.includes('نسخ الطلب')).props.onClick());
assert.ok(copied.includes('01112345678'));assert.ok(copied.includes('٢٧٠'));assert.ok(copied.includes('120'));
// A changed quote disables submission until the fresh total is ready.
await change('كود الخصم','PROMO');assert.equal(button().props.disabled,true);await quote();
// A conflict never clears the cart and refreshes the quote before retry.
pendingResponse={ok:false,status:409,json:async()=>({error:'Prices changed'})};
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(cleared,false);assert.equal(button().props.disabled,true);await quote();
pendingResponse=null;
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));
const orderPosts=posts.filter(x=>x.url==='/api/orders');assert.equal(orderPosts.length,2);assert.equal(orderPosts[1].body.customer.additionalPhone,'01112345678');assert.equal(orderPosts[1].body.expectedShipping,30);assert.equal(orderPosts[1].body.items[0].expectedPrice,120);assert.equal(orderPosts[0].key,orderPosts[1].key);assert.equal(cleared,true);
assert.equal(root.findByType('a').props.href,'#/track/track1');
await act(async()=>root.findAllByType('button').find(x=>x.children.includes('نسخ الطلب')).props.onClick());assert.ok(copied.includes('01112345678'));assert.ok(copied.includes('order1'));assert.ok(copied.includes('٢٧٠'));
await act(async()=>renderer.unmount());
console.log('Checkout: item details, automatic quote, optional phone, copy, conflict, one-click submission and tracking passed.');
