import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/lib/image.ts'],bundle:true,platform:'node',format:'esm',write:false});
const { prepareProductImageForUpload, ImageError, uploadImageToD1 } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const mkfile=(size,type='image/png')=>new File([new Uint8Array(size)],`test.${type.split('/')[1]}`,{type});
let encodes=[],draws=[],released=0, encode;
globalThis.createImageBitmap = async () => ({width: 2000, height: 1000, close: () => released++});
globalThis.document = {createElement: (type) => {
  assert.equal(type,'canvas');
  return { width:0,height:0, getContext: () => ({drawImage: (...args)=>draws.push(args), set imageSmoothingQuality(_) {}, fillRect: () => { throw Error('must not flatten transparency'); }}), toBlob(callback,type,quality){encodes.push([type,quality,this.width,this.height]); callback(encode(type,quality,this.width,this.height));} };
}};
const blob = (size,type) => new Blob([new Uint8Array(size)],{type});
encode = (type) => blob(type === 'image/webp' ? 200_000 : 500_000,type);
const output = await prepareProductImageForUpload(mkfile(800_000));
assert.equal(output.type,'image/webp'); assert.equal(output.size,200_000); assert.equal(output.name,'test.webp');
assert.deepEqual(encodes[0],['image/webp',0.86,1440,720]); assert.equal(draws.length,1); assert.equal(released,1);
encodes=[]; const tiny=mkfile(50_000); assert.equal(await prepareProductImageForUpload(tiny),tiny); assert.equal(encodes.length,0);
// If WebP cannot be encoded, PNG input must remain PNG, never JPEG.
encodes=[]; encode=(type)=>type==='image/webp' ? blob(500_000,'image/png') : blob(400_000,type);
const fallback=await prepareProductImageForUpload(mkfile(800_000)); assert.equal(fallback.type,'image/png');
assert.ok(encodes.some(([type])=>type==='image/png')); assert.ok(encodes.every(([type])=>type!=='image/jpeg'));
// Don't make an already-small-enough original larger; respect the server ceiling.
encode=(type)=>blob(700_000,type); const original=mkfile(500_000); assert.equal(await prepareProductImageForUpload(original),original);
encode=(type)=>blob(1_200_000,type); await assert.rejects(prepareProductImageForUpload(mkfile(2_000_000)),e=>e instanceof ImageError && e.code==='size');
await assert.rejects(prepareProductImageForUpload(mkfile(20,'image/gif')),e=>e.code==='type');
await assert.rejects(prepareProductImageForUpload(mkfile(16*1024*1024)),e=>e.code==='input-size');
// Uploading a product sends the prepared blob rather than the original.
let posted; encode=(type)=>blob(100_000,type);
globalThis.fetch = async (url,opts)=>{assert.equal(url,'/api/admin/images'); posted=opts.body.get('file'); return {ok:true,json:async()=>({id:'id',url:'/api/images/id'})};};
assert.equal((await uploadImageToD1(mkfile(800_000),{product:true})).url,'/api/images/id');
assert.equal(posted.type,'image/webp'); assert.equal(posted.size,100_000);
console.log('Product image compression, transparent format fallback, size limits and upload checks passed.');
