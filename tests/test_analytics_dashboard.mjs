import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const mocks={
 '@/i18n/LanguageContext':'exports.useLang=()=>({lang:"ar",t:k=>k})',
 '@/context/StoreContext':'exports.useStore=()=>({content:{studioDeliveryTab:true}})',
 '@/components/ui/Select':`const React=require('react');exports.Select=({value,onChange,ariaLabel})=>React.createElement('select',{'aria-label':ariaLabel,value,onChange:e=>onChange(e.target.value)});`,
};
const bundle=await build({stdin:{contents:`export {AdminHeader} from './src/pages/Admin/AdminHeader'; export {Analytics} from './src/pages/Admin/Analytics';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'},plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@\//},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const mod={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);
let timer,requests=[],shouldFail=false;
globalThis.window={setInterval:(fn,ms)=>{assert.equal(ms,30000);timer=fn;return 9},clearInterval:id=>{assert.equal(id,9);timer=null}};
globalThis.document={visibilityState:'visible'};
globalThis.fetch=async url=>{requests.push(url);if(shouldFail)throw Error('network');return {ok:true,json:async()=>({period:{days:30,startDay:'2026-11-01',endDay:'2026-11-30'},summary:{pageViews:8,visitors:4,productClicks:3},activeVisitors:2,retainedTotals:{visitors:7,pageViews:10},pages:[{path:'/shop',views:5,visitors:3}],products:[{slug:'scent',name:{en:'Scent',ar:'عطر'},clicks:3,visitors:2,archived:false}],actions:[{path:'/shop',action:'add-to-cart',clicks:4,visitors:2}]})}};
let selected;let header;await act(async()=>{header=create(React.createElement(mod.exports.AdminHeader,{tab:'products',setTab:x=>selected=x,stats:{products:1,featured:0,saved:0}}))});
const analyticsTab=header.root.findAllByType('button').find(x=>x.children.includes('admin.tab.analytics'));assert.ok(analyticsTab);await act(async()=>analyticsTab.props.onClick());assert.equal(selected,'analytics');
let dashboard;await act(async()=>{dashboard=create(React.createElement(mod.exports.Analytics))});
const text=JSON.stringify(dashboard.toJSON());assert.ok(text.includes('الزوار الحاليون'));assert.ok(text.includes('الضغطات في كل صفحة'));assert.ok(text.includes('إضافة للسلة'));assert.ok(text.includes('عطر'));assert.equal(requests[0],'/api/admin/analytics?days=30');
await act(async()=>dashboard.root.findByType('select').props.onChange({target:{value:'7'}}));assert.equal(requests.at(-1),'/api/admin/analytics?days=7');
await act(async()=>timer());assert.equal(requests.filter(x=>x.endsWith('days=7')).length,2);
document.visibilityState='hidden';await act(async()=>timer());assert.equal(requests.length,3);document.visibilityState='visible';
shouldFail=true;await act(async()=>timer());assert.equal(dashboard.root.findAllByProps({role:'alert'}).length,1);
shouldFail=false;await act(async()=>dashboard.root.findAllByType('button').find(x=>x.children.includes('admin.analytics.retry')).props.onClick());assert.equal(dashboard.root.findAllByProps({role:'alert'}).length,0);
await act(async()=>{dashboard.unmount();header.unmount()});assert.equal(timer,null);
console.log('Analytics tab, dashboard figures, click breakdown, period selection, refresh and error retry passed.');
