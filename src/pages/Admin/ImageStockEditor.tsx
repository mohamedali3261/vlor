import { LoadingImage } from '@/components/ui/LoadingImage';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLang } from '@/i18n/LanguageContext';
import { productImages } from '@/lib/productImages';
import { draftsChanged, registerDraft } from '@/lib/studioDrafts';
import type { Product } from '@/types';

type Stock = {image:string;size:number;quantity:number|null};
type Props = {products:Product[];disabled?:boolean};
export function ImageStockEditor({products,disabled=false}:Props) {
  const {lang,l}=useLang();const ar=lang==='ar';
  const [productId,setProductId]=useState('');const [image,setImage]=useState('');
  const [rows,setRows]=useState<Stock[]>([]);const [values,setValues]=useState<Record<number,string>>({});
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const [attempt,setAttempt]=useState(0);const [message,setMessage]=useState('');
  const product=products.find(p=>p.id===productId);const images=product ? productImages(product) : [];
  const expected=(size:number)=>rows.find(row=>row.image===image && row.size===size)?.quantity ?? null;
  const dirty=Boolean(image && product && product.sizes.some(size=>values[size.ml] !== (expected(size.ml)===null ? '' : String(expected(size.ml)))));
  const dirtyRef=useRef(false);
  useEffect(()=>{dirtyRef.current=dirty;draftsChanged();},[dirty]);
  useEffect(()=>registerDraft({isDirty:()=>dirtyRef.current,commit:()=>({})}),[]);
  useEffect(()=>{
    if(!productId){setRows([]);setLoading(false);setFailed(false);return;}
    const controller=new AbortController();setLoading(true);setFailed(false);setRows([]);
    fetch(`/api/admin/products/${encodeURIComponent(productId)}/image-stock`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!controller.signal.aborted){setRows(data);setLoading(false)}}).catch(()=>{if(!controller.signal.aborted){setFailed(true);setLoading(false)}});
    return ()=>controller.abort();
  },[productId,attempt]);
  const warnDiscard=()=>!dirty || window.confirm(ar?'لديك كميات غير محفوظة. هل تريد تجاهلها؟':'You have unsaved quantities. Discard them?');
  const selectProduct=(id:string)=>{if(!warnDiscard())return;setProductId(id);setImage('');setValues({});setMessage('');};
  const selectImage=(url:string)=>{if(!warnDiscard())return;setImage(url);setMessage('');const p=products.find(v=>v.id===productId);setValues(Object.fromEntries((p?.sizes ?? []).map(size=>{const value=rows.find(row=>row.image===url && row.size===size.ml)?.quantity;return [size.ml,value==null?'':String(value)]})));};
  const save=async(e:FormEvent)=>{
    e.preventDefault();if(busy || disabled || loading || failed || !product || !image || !images.includes(image))return;
    const sizes=product.sizes.map(size=>({size:size.ml,quantity:values[size.ml]?.trim()==='' ? null : Number(values[size.ml]),expected:expected(size.ml)}));
    if(sizes.some(s=>s.quantity!==null && (!Number.isInteger(s.quantity) || s.quantity<0 || s.quantity>1000000))){setMessage(ar?'أدخل عددًا صحيحًا من 0 إلى 1000000 أو اترك الحقل فارغًا.':'Enter a whole number from 0 to 1000000 or leave the field blank.');return;}
    setBusy(true);setMessage('');
    try {
      const r=await fetch(`/api/admin/products/${encodeURIComponent(productId)}/image-stock`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,sizes})});
      if(r.status===409){setMessage(ar?'تغيرت الصورة أو الأحجام أو الكميات. احفظ نسخة من تعديلاتك وحدّث القائمة قبل المحاولة.':'The image, sizes or quantities changed. Copy your edits and refresh before retrying.');return;}
      if(!r.ok)throw Error();
      setRows(prev=>[...prev.filter(row=>row.image!==image),...sizes.map(s=>({image,size:s.size,quantity:s.quantity}))]);
      setMessage(ar?'تم حفظ كميات الصورة.':'Image quantities saved.');
    }catch{setMessage(ar?'تعذر التأكد من الحفظ. حدّث الكميات قبل إعادة المحاولة.':'Could not confirm the save. Refresh quantities before retrying.');}
    finally{setBusy(false);}
  };
  const refresh=()=>{if(!warnDiscard())return;setImage('');setValues({});setMessage('');setAttempt(v=>v+1);};
  return <section className="mb-5 rounded-2xl border border-ink/10 bg-surface/70 p-4" aria-labelledby="image-stock-title">
    <h3 id="image-stock-title" className="text-sm font-bold">{ar?'مخزون صور المنتج حسب الحجم':'Image stock by size'}</h3>
    <p className="mt-1 text-xs leading-relaxed text-mist">{ar?'حدد الكميات يدويًا لكل صورة وحجم. الصفر يعرض «غير متوفر»، والحقل الفارغ يعني غير محدد. هذه الكميات للعرض فقط ولا تُخصم من الطلبات أو تغيّر مخزون المنتج.':'Enter quantities manually for each image and size. Zero shows Out of stock; blank means untracked. These are display-only and do not change order inventory or decrease when orders are placed.'}</p>
    <div className="mt-3 flex flex-wrap gap-2"><label className="min-w-[180px] flex-1 text-xs font-bold">{ar?'المنتج':'Product'}<select className="field mt-1" value={productId} disabled={busy || disabled} onChange={e=>selectProduct(e.target.value)}><option value="">{ar?'اختر منتجًا':'Choose a product'}</option>{products.map(p=><option key={p.id} value={p.id}>{l(p.name)}</option>)}</select></label>{productId && <button type="button" disabled={busy || disabled || loading} onClick={refresh} className="self-end rounded-full border border-ink/15 px-4 py-3 text-xs font-bold disabled:opacity-40">{ar?'تحديث الكميات':'Refresh quantities'}</button>}</div>
    {loading && <p role="status" className="mt-2 text-xs">{ar?'جاري تحميل الكميات…':'Loading quantities…'}</p>}
    {failed && <p role="alert" className="mt-2 text-xs text-rose-700">{ar?'تعذر تحميل الكميات. حدّث الكميات وحاول مجددًا.':'Could not load quantities. Refresh and retry.'}</p>}
    {product && !loading && !failed && <>
      {images.length ? <label className="mt-3 block text-xs font-bold">{ar?'الصورة':'Image'}<select className="field mt-1" value={image} disabled={busy || disabled} onChange={e=>selectImage(e.target.value)}><option value="">{ar?'اختر صورة':'Choose an image'}</option>{[...new Set(images)].map((src,index)=><option key={src} value={src}>{ar?`الصورة ${index+1}`:`Image ${index+1}`}</option>)}</select></label> : <p className="mt-2 text-xs text-mist">{ar?'احفظ صور المنتج أولًا.':'Save product images first.'}</p>}
      {new Set(images).size<images.length && <p className="mt-2 text-xs text-mist">{ar?'الصور المتكررة بنفس الرابط تشترك في نفس الكميات لهذا المنتج.':'Duplicate image URLs share quantities for this product.'}</p>}
      {image && images.includes(image) && <form onSubmit={save} className="mt-3 space-y-3"><div className="h-20 w-20 rounded-xl border border-ink/10"><LoadingImage src={image} alt={ar?'الصورة المختارة':'Selected image'} className="h-full w-full object-contain" fallback={<span aria-hidden="true">—</span>} /></div><div className="grid gap-2 sm:grid-cols-3">{product.sizes.map(size=><label key={size.ml} className="text-xs font-bold">{size.ml} {ar?'مل':'ml'}<input className="field mt-1" type="number" min="0" max="1000000" step="1" disabled={busy || disabled} placeholder={ar?'غير محدد':'Untracked'} value={values[size.ml] ?? ''} onChange={e=>setValues(prev=>({...prev,[size.ml]:e.target.value}))} /></label>)}</div><button disabled={busy || disabled || !dirty || !product.sizes.length} className="rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-bone disabled:opacity-40">{busy?(ar?'جاري الحفظ…':'Saving…'):(ar?'حفظ كميات الصورة':'Save image quantities')}</button></form>}
    </>}
    {message && <p role="status" className="mt-3 text-xs font-bold">{message}</p>}
  </section>;
}
