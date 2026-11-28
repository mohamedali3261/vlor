import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/lib/image.ts'],bundle:true,platform:'node',format:'esm',write:false});
const { prepareProductImageForUpload, ImageError, uploadImageToD1, createImageVariants, uploadImageVariants } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
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
// Files that fit D1 are retained byte-for-byte and optional variants are separate.
let posted, variantPosts=[]; encode=(type)=>blob(100_000,type);
globalThis.fetch = async (url,opts)=>{
  if(url==='/api/admin/images') {posted=opts.body.get('file'); return {ok:true,json:async()=>({id:'id',url:'/api/images/id'})};}
  variantPosts.push({url,body:opts.body});return {ok:true};
};
const uploaded = await uploadImageToD1(mkfile(800_000),{product:true});
assert.equal(uploaded.url,'/api/images/id');
assert.equal(posted.type,'image/png'); assert.equal(posted.size,800_000);
assert.equal(uploaded.originalBytes,800_000); assert.equal(uploaded.uploadedBytes,posted.size);
assert.equal(variantPosts.length,2);assert.ok(variantPosts[0].url.endsWith('/small-v1'));assert.ok(variantPosts[1].url.endsWith('/large-v1'));
const unchanged = await uploadImageToD1(mkfile(50_000),{product:true});
assert.equal(unchanged.originalBytes,50_000); assert.equal(unchanged.uploadedBytes,50_000);
// Derivatives shrink dimensions, preserve transparent PNG fallback and are never larger than the original.
encodes=[];encode=(type)=>type==='image/webp' ? blob(50_000,'image/png') : blob(45_000,type);
const variants=await createImageVariants(mkfile(200_000));
assert.equal(variants['small-v1'].type,'image/png');assert.equal(variants['large-v1'].type,'image/png');
assert.ok(encodes.some(([type,,w,h])=>type==='image/png' && w===420 && h===210));
assert.ok(encodes.some(([type,,w,h])=>type==='image/png' && w===1000 && h===500));
assert.ok(encodes.every(([type])=>type!=='image/jpeg'));
encode=(type)=>blob(100_000,type);assert.deepEqual(await createImageVariants(mkfile(50_000)),{});
// A derivative upload failure never turns a successful original upload into an error.
globalThis.fetch=async(url)=>url==='/api/admin/images'?{ok:true,json:async()=>({id:'id',url:'/api/images/id'})}:{ok:false,status:503};
assert.equal((await uploadImageToD1(mkfile(800_000),{product:true})).url,'/api/images/id');
await assert.rejects(uploadImageVariants('id',mkfile(800_000)),/variant_upload_failed/);
globalThis.fetch = async () => ({ok:false,status:500});
await assert.rejects(uploadImageToD1(mkfile(50_000), {product:true}), /upload_failed/);
console.log('Original preservation, product image compression, transparent variants, fallback and upload checks passed.');
