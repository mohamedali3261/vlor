import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let listeners={},shown=[];
globalThis.window={addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k]};
globalThis.document={visibilityState:'visible',addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k]};
globalThis.fetch=async()=>({ok:true,json:async()=>shown});
const mocks={
 '@/hooks/useContent':`exports.useContent=()=>({c:{strips:{announcement:{enabled:true,speed:44,direction:'left'}},announcements:[{en:'Hello',ar:'أهلاً'}]},lc:v=>v.ar})`,
 '@/i18n/LanguageContext':`exports.useLang=()=>({lang:'ar'})`,
 '@/components/ui/Marquee':`const React=require('react');exports.Marquee=({children})=>React.createElement('div',null,children)`,
 '@/components/ui/icons':`const React=require('react');exports.Sparkle=()=>React.createElement('i')`,
};
const bundle=await build({entryPoints:['src/components/layout/Announcement.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'},plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
let r;await act(async()=>{r=create(React.createElement(module.exports.Announcement))});
assert.ok(JSON.stringify(r.toJSON()).includes('أهلاً'));assert.ok(!JSON.stringify(r.toJSON()).includes('خصم'));
shown=[{id:'1',kind:'quantity',threshold:3,percent:15},{id:'2',kind:'amount',threshold:500,percent:20}];
await act(async()=>listeners['vlor:discounts-changed']());
const text=JSON.stringify(r.toJSON());assert.ok(text.includes('خصم 15% عند شراء 3'));assert.ok(text.includes('خصم 20% عند شراء بـ 500'));
await act(async()=>r.unmount());assert.deepEqual(listeners,{});
console.log('Active offers appear alongside owner announcements and refresh after editing.');
