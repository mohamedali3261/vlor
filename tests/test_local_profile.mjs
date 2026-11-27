import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const store=new Map();let fail=false;
globalThis.localStorage={getItem:k=>{if(fail)throw Error();return store.get(k)??null},setItem:(k,v)=>{if(fail)throw Error();store.set(k,v)},removeItem:k=>{if(fail)throw Error();store.delete(k)}};
globalThis.window={confirm:()=>true};
let tracked='new',requests=[];globalThis.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:tracked,created_at:'2026-01-01'})}};
const mocks={
 '@/i18n/LanguageContext':`exports.useLang=()=>({lang:'ar',l:v=>v.ar})`,
 '@/lib/router':`exports.useRoute=()=>({segments:['track','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']})`
};
const bundle=await build({stdin:{contents:`export {ProfilePage} from './src/pages/Profile';export {TrackOrder} from './src/pages/TrackOrder';export * from './src/lib/localProfile';export * from './src/lib/orderStatus';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'},plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const mod={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);
assert.equal(mod.exports.orderConfirmed('new',0),false);assert.equal(mod.exports.orderConfirmed('confirmed',0),true);assert.equal(mod.exports.orderConfirmed('shipped',0),false);assert.equal(mod.exports.orderConfirmed('shipped',1),true);assert.equal(mod.exports.orderConfirmed('cancelled',1),false);
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', token='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
assert.equal(mod.exports.loadProfile(),null);
const profile={details:{name:'Test',phone:'01012345678',additionalPhone:'',city:'Cairo',address:'My Address'},orders:[{id,token}]};
assert.equal(mod.exports.saveProfile(profile),true);assert.deepEqual(mod.exports.loadProfile(),profile);
let r;await act(async()=>{r=create(React.createElement(mod.exports.ProfilePage))});
let json=JSON.stringify(r.toJSON());assert.ok(json.includes('بانتظار التأكيد'));assert.ok(!json.includes('تم تأكيد طلبك'));assert.equal(requests[0].body.token,token);assert.equal(r.root.findByType('a').props.href,`#/track/${token}`);
tracked='confirmed';await act(async()=>r.root.findAllByType('button').find(b=>b.children.includes('تحديث')).props.onClick());json=JSON.stringify(r.toJSON());assert.ok(json.includes('تم تأكيد طلبك، وسيتم التواصل معك قريبًا.'));
// Editing explicitly saves only to local storage.
await act(async()=>r.root.findAllByType('input')[0].props.onChange({target:{value:'Changed'}}));await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(mod.exports.loadProfile().details.name,'Changed');
await act(async()=>r.root.findAllByType('button').find(b=>b.children.includes('حذف البروفيل')).props.onClick());assert.equal(mod.exports.loadProfile(),null);await act(async()=>r.unmount());
let track;tracked='new';await act(async()=>{track=create(React.createElement(mod.exports.TrackOrder))});assert.ok(!JSON.stringify(track.toJSON()).includes('تم تأكيد طلبك'));await act(async()=>track.unmount());
tracked='confirmed';await act(async()=>{track=create(React.createElement(mod.exports.TrackOrder))});assert.ok(JSON.stringify(track.toJSON()).includes('تم تأكيد طلبك'));await act(async()=>track.unmount());
fail=true;assert.equal(mod.exports.loadProfile(),null);assert.equal(mod.exports.saveProfile(profile),false);assert.equal(mod.exports.clearProfile(),false);
console.log('Local profile consent, editing, tracking links, confirmed notice, deletion and storage failure passed.');
