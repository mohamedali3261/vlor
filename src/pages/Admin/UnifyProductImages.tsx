import { useState } from 'react';
import { useLang } from '@/i18n/LanguageContext';
import { productImages } from '@/lib/productImages';
import { countDirtyDrafts } from '@/lib/studioDrafts';
import type { Product } from '@/types';

type Props = { products:Product[]; reloadProducts:()=>Promise<void>; disabled?:boolean };
export function UnifyProductImages({products,reloadProducts,disabled=false}:Props) {
  const {lang,l} = useLang(); const ar=lang==='ar';
  const [sourceId,setSourceId]=useState('');
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const source=products.find(product=>product.id===sourceId);
  const images=source ? productImages(source) : [];
  const unify=async()=>{
    if (busy || disabled || !source || !images.length || products.length<2 || products.length>500) return;
    if (countDirtyDrafts()) {setMessage(ar?'احفظ تعديلاتك المفتوحة أولًا ثم حاول مجددًا.':'Save your open edits first, then try again.');return;}
    const question=ar
      ? `استبدال صور كل المنتجات الأخرى (${products.length-1}) بصور «${l(source.name)}» (${images.length} صورة)؟ ستُزال روابط صورها الحالية من المنتجات، دون حذف ملفات الصور. كميات الصور المستبدلة ستُحذف ولا تُنقل، ومخزون المنتجات لن يتغير. المنتجات المؤرشفة لن تتغير.`
      : `Replace images on all ${products.length-1} other products with ${images.length} image(s) from “${l(source.name)}”? Existing product image links will be replaced; image files will not be deleted. Display quantities for replaced images are removed, not copied; product stock is unchanged. Archived products are not changed.`;
    if (!window.confirm(question)) return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/admin/products/unify-images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId,products:products.map(product=>({id:product.id,images:product.images ?? [],cutout:product.cutout ?? null}))})});
      if(response.status===409){setMessage(ar?'لم تُطبّق الصور. قد تكون صور المنتجات أو القائمة تغيرت؛ حدّث المنتجات ثم حاول مجددًا.':'Images were not applied. The catalogue or its images may have changed; refresh and retry.');return;}
      if(response.status===422){setMessage(ar?'لم تُطبّق الصور. تحقق أن صور المنتج المختار متاحة وغير محذوفة.':'Images were not applied. Check that the selected images are available and not deleted.');return;}
      if(!response.ok)throw Error();
      const result=await response.json();
      try { await reloadProducts(); setMessage(ar?`تم توحيد الصور في ${result.count} منتج.`:`Images applied to ${result.count} products.`); }
      catch { setMessage(ar?'تم توحيد الصور، لكن تعذر تحديث القائمة. حدّث الصفحة لعرضها.':'Images were applied, but the list could not refresh. Reload the page to see them.'); }
    } catch {setMessage(ar?'تعذر التأكد من تطبيق الصور. حدّث قائمة المنتجات قبل إعادة المحاولة.':'Could not confirm whether images were applied. Refresh products before retrying.');}
    finally {setBusy(false);}
  };
  const refresh=async()=>{setBusy(true);try{await reloadProducts();setMessage(ar?'تم تحديث قائمة المنتجات.':'Products refreshed.');}catch{setMessage(ar?'تعذر تحديث المنتجات.':'Could not refresh products.');}finally{setBusy(false);}};
  return <section className="mb-5 rounded-2xl border border-ink/10 bg-surface/70 p-4" aria-labelledby="unify-images-title">
    <h3 id="unify-images-title" className="text-sm font-bold">{ar?'توحيد صور المنتجات':'Unify product images'}</h3>
    <p className="mt-1 text-xs leading-relaxed text-mist">{ar?'اختر منتجًا لنسخ صوره إلى جميع المنتجات الأخرى بدل صورها الحالية. الأسعار والمخزون وباقي البيانات لا تتغير.':'Choose a product to replace the images on every other active product. Prices, stock and other details stay unchanged.'}</p>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-[180px] flex-1 text-xs font-bold">{ar?'المنتج مصدر الصور':'Source product'}<select className="field mt-1" value={sourceId} disabled={busy || disabled} onChange={e=>{setSourceId(e.target.value);setMessage('')}}><option value="">{ar?'اختر منتجًا':'Choose a product'}</option>{products.map(product=><option key={product.id} value={product.id}>{l(product.name)}</option>)}</select></label>
      <button type="button" disabled={busy || disabled || !source || !images.length || products.length<2 || products.length>500} onClick={()=>void unify()} className="rounded-full bg-ink px-5 py-3 text-xs font-bold text-bone disabled:opacity-40">{busy?(ar?'جاري التنفيذ…':'Working…'):(ar?'توحيد الصور لكل المنتجات':'Apply images to all products')}</button>
      <button type="button" disabled={busy || disabled} onClick={()=>void refresh()} className="rounded-full border border-ink/15 px-4 py-3 text-xs font-bold disabled:opacity-40">{ar?'تحديث المنتجات':'Refresh products'}</button>
    </div>
    {products.length>500 && <p className="mt-2 text-xs text-rose-700">{ar?'الحد الأقصى 500 منتج في العملية الواحدة.':'The maximum is 500 products per operation.'}</p>}
    {source && <p className="mt-2 text-xs text-mist">{images.length ? (ar?`${images.length} صورة ستُطبّق على ${products.length-1} منتج.`:`${images.length} image(s) will be applied to ${products.length-1} products.`) : (ar?'هذا المنتج ليس له صور.':'This product has no images.')}</p>}
    {message && <p role="status" className="mt-3 text-xs font-bold text-ink">{message}</p>}
  </section>;
}
