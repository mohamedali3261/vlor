import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.document={documentElement:{}};
const mocks={
  '@/hooks/usePersistentState':`exports.usePersistentState=()=>['ar',()=>{}]`,
  '@/context/StoreContext':`exports.useStore=()=>({content:{textOverrides:{'hero.eyebrow':{ar:'عرض ٢٥٪',en:'Sale ٢٥'},'i:Hello':{ar:'عرض ١٠٠',en:'Sale'}}}})`,
};
const bundle=await build({stdin:{contents:`export {LanguageProvider,useLang} from './src/i18n/LanguageContext'; export {formatPrice,formatRating} from './src/lib/format';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',write:false,alias:{'@':process.cwd()+'/src'},plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@\//},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
let lang;function Probe(){lang=module.exports.useLang();return null}let r;await act(async()=>{r=create(React.createElement(module.exports.LanguageProvider,null,React.createElement(Probe)))});
assert.equal(lang.t('hero.eyebrow'),'عرض 25٪');assert.equal(lang.x('Hello',''), 'عرض 100');assert.equal(lang.l({ar:'١٢٣٫٤',en:'English'}),'123.4');
for(const language of ['ar','en']){assert.match(module.exports.formatPrice(1234,language),/1,234/);assert.match(module.exports.formatRating(4.5,language),/4\.5/);}
await act(async()=>r.unmount());console.log('Latin digits for both languages, edited content, prices and ratings passed.');
