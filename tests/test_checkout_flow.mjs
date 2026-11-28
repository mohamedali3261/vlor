import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const {act,create} = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let lines = [{key:'p:50',productId:'p',ml:50,qty:2,price:100,image:'/p.png',name:{en:'Scent',ar:'عطر'}}];
let cleared = false, copied = '', posts = [], pendingResponse, quoteFail=false, cartOpened=false, checkoutClosed=false;
const local=new Map();globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
const orderId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tracking='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
globalThis.__checkout = {cart:()=>({lines,count:lines.reduce((s,l)=>s+l.qty,0),clear:()=>{cleared=true;lines=[];},close:()=>{},open:()=>{cartOpened=true;}}),copy:(text)=>{copied=text;return true;}};
let timers = new Map(), nextTimer = 0;
globalThis.window = {addEventListener(){},removeEventListener(){},setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id)}};
globalThis.sessionStorage = {value:null,getItem(){return this.value},setItem(_k,v){this.value=v},removeItem(){this.value=null}};
globalThis.fetch = async (url, options) => {
  posts.push({url, body:JSON.parse(options.body), key:options.headers['Idempotency-Key']});
  if (url === '/api/quote' && quoteFail) return {ok:false,status:503,json:async()=>({error:quoteFail === 'size' ? 'Size unavailable' : 'unavailable'})};
  if (url === '/api/quote') return {ok:true,json:async()=>({subtotal:240,shipping:30,discount:0,total:270,prices:[{productId:'p',ml:50,price:120}]})};
  if (pendingResponse === 'network') throw Error('network');
  return pendingResponse || {ok:true,status:201,json:async()=>({id:orderId,trackingToken:tracking,total:270})};
};
const mocks = {
  '@/context/CartContext':'exports.useCart=globalThis.__checkout.cart',
  '@/context/StoreContext':'exports.useStore=()=>({settings:{}})',
  '@/context/ToastContext':'exports.useToast=()=>({push:()=>{}})',
  '@/hooks/useUi':'exports.useBodyLock=()=>{}',
  '@/i18n/LanguageContext':'exports.useLang=()=>({lang:globalThis.__checkout.lang || "ar", t:k=>k, l:v=>v.ar})',
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
assert.equal(button().props.disabled,false);assert.equal(root.findByType('img').props.src,'/p.png');
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));assert.ok(JSON.stringify(renderer.toJSON()).includes('راجع بيانات التوصيل المطلوبة'));assert.equal(posts.filter(x=>x.url==='/api/orders').length,0);
assert.equal(field('cart.fullName').props.placeholder,undefined);
await change('cart.fullName','Test User');await change('رقم الموبيل','01012345678');await change('رقم إضافي','01112345678');await change('cart.address','Test address 123');await change('cart.city','Cairo');
await quote(); assert.equal(local.size,0); const remember=root.findAllByType('input').find(input=>input.props.type==='checkbox'); assert.equal(remember.props.checked,false); await act(async()=>remember.props.onChange({target:{checked:true}})); assert.equal(local.size,0); assert.equal(button().props.disabled,false);assert.equal(posts[0].url,'/api/quote');
// Saving delivery details is explicit, works before ordering and does not submit.
await act(async()=>root.findAllByType('button').find(x=>x.children.includes('حفظ بيانات التوصيل')).props.onClick());
assert.equal(JSON.parse(local.get('vlor.local-profile.v1')).details.address,'Test address 123');
const existing=JSON.parse(local.get('vlor.local-profile.v1'));existing.displayName='Named';existing.analyticsToken='cccccccc-cccc-4ccc-8ccc-cccccccccccc';local.set('vlor.local-profile.v1',JSON.stringify(existing));assert.equal(posts.filter(x=>x.url==='/api/orders').length,0);
// Copy uses server prices and includes the optional phone.
await act(async()=>root.findAllByType('button').find(x=>x.children.includes('نسخ الطلب')).props.onClick());
assert.ok(copied.includes('01112345678'));assert.ok(copied.includes('270'));assert.ok(copied.includes('120'));
// There is no coupon field or coupon value in the quote.
assert.equal(root.findAllByType('input').some(x=>x.props.maxLength===40),false);
assert.equal('coupon' in posts[0].body,false);
// A conflict never clears the cart and refreshes the quote before retry.
pendingResponse={ok:false,status:409,json:async()=>({error:'Prices changed'})};
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(cleared,false);assert.equal(button().props.disabled,true);await quote();
pendingResponse={ok:false,status:409,json:async()=>({error:'Insufficient stock',code:'OUT_OF_STOCK'})};
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(cleared,false);assert.ok(JSON.stringify(renderer.toJSON()).includes('الكمية المطلوبة غير متوفرة'));await quote();
pendingResponse=null;
await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));
const orderPosts=posts.filter(x=>x.url==='/api/orders');assert.equal(orderPosts.length,3);assert.equal(orderPosts[2].body.customer.additionalPhone,'01112345678');assert.equal(orderPosts[2].body.expectedShipping,30);assert.equal(orderPosts[2].body.items[0].expectedPrice,120);assert.equal(orderPosts[0].key,orderPosts[2].key);assert.equal(cleared,true);
assert.equal(root.findByType('a').props.href,`#/track/${tracking}`);
const success=JSON.stringify(renderer.toJSON());assert.ok(success.includes('Named'));assert.ok(success.includes('على ثقتك واختيارك لينا'));assert.ok(success.includes('عند حسن ظنك'));assert.ok(!success.includes('تم تأكيد طلبك'));
const stored=JSON.parse(local.get('vlor.local-profile.v1'));assert.equal(stored.displayName,'Named');assert.equal(stored.analyticsToken,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.equal(stored.details.phone,'01012345678');assert.equal(stored.details.address,'Test address 123');assert.equal(stored.orders[0].token,tracking);assert.ok(!('note' in stored.details));
await act(async()=>root.findAllByType('button').find(x=>x.children.includes('نسخ الطلب')).props.onClick());assert.ok(copied.includes('01112345678'));assert.ok(copied.includes(orderId));assert.ok(copied.includes('270'));
await act(async()=>renderer.unmount());
await act(async()=>{renderer=create(React.createElement(module.exports.CheckoutSheet,{open:true,onClose:()=>{}}))});
assert.equal(renderer.root.findAllByType('input').find(x=>x.props.autoComplete==='name').props.value,'Test User');
assert.equal(renderer.root.findAllByType('textarea')[0].props.value,'Test address 123');
await act(async()=>renderer.unmount());
// A guest gets a friendly message too, without requiring or inventing a profile name.
local.clear();quoteFail=true;lines=[{key:'p:50',productId:'p',ml:50,qty:1,price:100,image:'/p.png',name:{en:'Scent',ar:'عطر'}}];cleared=false;
await act(async()=>{renderer=create(React.createElement(module.exports.CheckoutSheet,{open:true,onClose:()=>{}}))});
const root2=renderer.root;const field2=(label)=>root2.findAllByType('label').find(x=>x.findByType('span').children.join('').includes(label)).findAll(x=>['input','textarea','select'].includes(x.type))[0];
for(const [label,value] of [['cart.fullName','Guest Name'],['رقم الموبيل','01012345678'],['cart.address','Test address 123'],['cart.city','Cairo']]) await act(async()=>field2(label).props.onChange({target:{value}}));
await quote();assert.ok(JSON.stringify(renderer.toJSON()).includes('تعذر حساب الشحن والإجمالي'));
await act(async()=>root2.findByType('form').props.onSubmit({preventDefault(){}}));assert.ok(JSON.stringify(renderer.toJSON()).includes('تعذر حساب الإجمالي'));
quoteFail=false;await act(async()=>root2.findAllByType('button').find(x=>x.children.includes('إعادة حساب الإجمالي')).props.onClick());await quote();
pendingResponse='network';await act(async()=>root2.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(cleared,false);assert.ok(JSON.stringify(renderer.toJSON()).includes('تعذر التأكد من إرسال الطلب'));assert.ok(!JSON.stringify(renderer.toJSON()).includes('تم تسجيل طلبك'));
const retryKey=posts.filter(x=>x.url==='/api/orders').at(-1).key;pendingResponse=null;
await act(async()=>root2.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(posts.filter(x=>x.url==='/api/orders').at(-1).key,retryKey);
const guestSuccess=JSON.stringify(renderer.toJSON());assert.ok(guestSuccess.includes('شكرًا على ثقتك واختيارك لينا'));assert.ok(!guestSuccess.includes('Named'));assert.ok(!guestSuccess.includes('Guest Name'));assert.ok(guestSuccess.includes('عند حسن ظنك'));assert.equal(root2.findByType('a').props.href,`#/track/${tracking}`);
await act(async()=>renderer.unmount());
// A legacy size rejected by the server gives a way back to edit the cart.
local.clear();quoteFail='size';lines=[{key:'p:100',productId:'p',ml:100,qty:1,price:100,image:'/p.png',name:{en:'Scent',ar:'عطر'}}];
await act(async()=>{renderer=create(React.createElement(module.exports.CheckoutSheet,{open:true,onClose:()=>{checkoutClosed=true}}))});
const rootUnavailable=renderer.root;const city=rootUnavailable.findAllByType('label').find(x=>x.findByType('span').children.join('').includes('cart.city')).findByType('select');
await act(async()=>city.props.onChange({target:{value:'Cairo'}}));await quote();
assert.ok(JSON.stringify(renderer.toJSON()).includes('أحد المنتجات أو المقاسات في السلة لم يعد متاحًا'));
await act(async()=>rootUnavailable.findAllByType('button').find(x=>x.children.includes('العودة للسلة')).props.onClick());
assert.equal(cartOpened,true);assert.equal(checkoutClosed,true);await act(async()=>renderer.unmount());quoteFail=false;
// English keeps the same profile greeting and does not claim the order was confirmed.
local.set('vlor.local-profile.v1',JSON.stringify({details:{name:'',phone:'',additionalPhone:'',city:'',address:''},orders:[],displayName:'Alice',analyticsToken:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
globalThis.__checkout.lang='en';lines=[{key:'p:50',productId:'p',ml:50,qty:1,price:100,image:'/p.png',name:{en:'Scent',ar:'عطر'}}];
await act(async()=>{renderer=create(React.createElement(module.exports.CheckoutSheet,{open:true,onClose:()=>{}}))});
const root3=renderer.root;const field3=(label)=>root3.findAllByType('label').find(x=>x.findByType('span').children.join('').includes(label)).findAll(x=>['input','textarea','select'].includes(x.type))[0];
for(const [label,value] of [['cart.fullName','Test User'],['Mobile number','01012345678'],['cart.address','Test address 123'],['cart.city','Cairo']]) await act(async()=>field3(label).props.onChange({target:{value}}));
await quote();await act(async()=>root3.findByType('form').props.onSubmit({preventDefault(){}}));
const english=JSON.stringify(renderer.toJSON());assert.ok(english.includes('Alice'));assert.ok(english.includes('for choosing us'));assert.ok(english.includes('live up to your trust'));assert.ok(!english.includes('order has been confirmed'));
await act(async()=>renderer.unmount());
console.log('Checkout: item details, automatic quote, optional phone, copy, conflict, one-click submission and tracking passed.');
