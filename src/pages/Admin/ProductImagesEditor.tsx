import { ImageSizeComparison, type ImageSizes } from "@/pages/Admin/ImageSizeComparison";
import { SmartImage } from "@/components/ui/Primitives";
import { useLang } from "@/i18n/LanguageContext";
import { ImageError, uploadImageToD1 } from "@/lib/image";
import { MAX_PRODUCT_IMAGES, promoteProductImage, removeProductImage, setPrimaryImage } from "@/lib/productImages";
import { useEffect, useRef, useState } from "react";

/** First image is the product/card photo; the remaining images form its gallery. */
export function ProductImagesEditor({ images, onChange, uploading, setUploading }: {
  images: string[];
  onChange: (images: string[]) => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const [mainUrl, setMainUrl] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [error, setError] = useState("");
  const [sizesByUrl, setSizesByUrl] = useState<Record<string, ImageSizes>>({});
  const current = useRef(images);
  const alive = useRef(true);
  current.current = images;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const commit = (next: string[]) => {
    current.current = next;
    setSizesByUrl((previous) => Object.fromEntries(Object.entries(previous).filter(([url]) => next.includes(url))));
    onChange(next);
  };

  const addLinks = (main: boolean) => {
    const values = (main ? [mainUrl.trim()] : extraUrls.split(/\n/).map((v) => v.trim())).filter(Boolean);
    if (!values.length) return;
    if (values.some((value) => value.length > 2048)) { setError(ar ? "رابط الصورة طويل جداً." : "An image URL is too long."); return; }
    const next = main ? setPrimaryImage(current.current, values[0]) : [...current.current, ...values];
    if (next.length > MAX_PRODUCT_IMAGES) { setError(ar ? "الحد الأقصى 20 صورة للمنتج." : "Maximum 20 images per product."); return; }
    commit(next); setError("");
    if (main) setMainUrl(""); else setExtraUrls("");
  };

  const upload = async (files: File[], main: boolean) => {
    if (!files.length) return;
    const capacity = MAX_PRODUCT_IMAGES - current.current.length;
    if (!main && files.length > capacity) { setError(ar ? "الحد الأقصى 20 صورة للمنتج." : "Maximum 20 images per product."); return; }
    setError(""); setUploading(true);
    try {
      for (const file of files) {
        const result = await uploadImageToD1(file, { product: true });
        if (!alive.current) return;
        commit(main ? setPrimaryImage(current.current, result.url) : [...current.current, result.url]);
        setSizesByUrl((previous) => ({ ...previous, [result.url]: { originalBytes: result.originalBytes, uploadedBytes: result.uploadedBytes } }));
      }
    } catch (err) {
      if (alive.current) setError(err instanceof ImageError && err.code === "input-size"
        ? (ar ? "حجم الصورة الأصلية يتجاوز 15 ميجابايت." : "The original image exceeds 15 MB.")
        : err instanceof ImageError && err.code === "size"
        ? (ar ? "الصورة أكبر من 1 ميجابايت بعد الضغط." : "Image exceeds 1 MB after compression.")
        : (ar ? "تعذر رفع إحدى الصور. الصور التي رُفعت بنجاح محفوظة في القائمة." : "An image could not be uploaded. Successfully uploaded images remain in the list."));
    } finally { if (alive.current) setUploading(false); }
  };

  return (
    <div className="product-images-editor sm:col-span-2 rounded-2xl border border-ink/10 bg-surface/45 p-4">
      <h3 className="text-sm font-bold">{ar ? "صور المنتج" : "Product images"}</h3>
      <p className="mt-1 text-xs leading-relaxed text-mist">{ar ? "الصورة الأساسية تظهر على الكارت وفي المتجر والتفاصيل. الصور الإضافية تظهر في صفحة التفاصيل. يمكنك إضافة حتى 20 صورة." : "The main image appears on the card, in the shop and on the product page. Extra images appear in the gallery. Up to 20 images."}</p>
      <p className="mt-1 text-xs text-mist">{ar ? "إزالة صورة محفوظة تزيل أيضًا كميات العرض المسجلة لها، دون تغيير مخزون المنتج." : "Removing a saved image also removes its display quantities, without changing product stock."}</p>
      <p className="product-images-editor__tip">{ar ? "نحتفظ بالصورة المرفوعة إذا كانت في حدود 1 ميجابايت، ونجهز نسخًا أخف للعرض مع الحفاظ على الخلفية الشفافة. الصور الأكبر تُضغط قبل الحفظ. الصور المضافة بروابط خارجية لا تُضغط." : "Uploads up to 1 MB are kept intact and lighter display copies preserve transparency. Larger photos are compressed before storage; external links are not compressed."}</p>
      <p className="mt-2 text-[11px] text-mist">{ar ? "يظهر حجم كل صورة قبل الضغط وبعده لهذه الرفعة فقط." : "Before and after sizes are shown for images uploaded in this session."}</p>
      <fieldset disabled={uploading} className="mt-4 space-y-4 disabled:opacity-60">
        <div>
          <label className="block text-xs font-bold" htmlFor="product-main-upload">{ar ? "صورة المنتج الأساسية" : "Main product image"}</label>
          <input id="product-main-upload" className="product-images-editor__file mt-2 block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ""; void upload(files.slice(0, 1), true); }} />
          <div className="mt-2 flex gap-2"><input value={mainUrl} onChange={(e) => setMainUrl(e.target.value)} className="field min-w-0 flex-1" dir="ltr" placeholder={ar ? "أو رابط الصورة الأساسية" : "Or paste the main image URL"} aria-label={ar ? "رابط الصورة الأساسية" : "Main image URL"} /><button type="button" onClick={() => addLinks(true)} className="rounded-lg border border-ink/20 px-3 text-xs font-bold">{ar ? "إضافة" : "Add"}</button></div>
        </div>
        <div>
          <label className="block text-xs font-bold" htmlFor="product-extra-upload">{ar ? "صور إضافية" : "Additional images"}</label>
          <input id="product-extra-upload" className="product-images-editor__file mt-2 block w-full text-xs" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ""; void upload(files, false); }} />
          <div className="mt-2 flex items-start gap-2"><textarea value={extraUrls} onChange={(e) => setExtraUrls(e.target.value)} rows={2} className="field min-w-0 flex-1" dir="ltr" placeholder={ar ? "أو روابط إضافية، كل رابط في سطر" : "Or additional image URLs, one per line"} aria-label={ar ? "روابط الصور الإضافية" : "Additional image URLs"} /><button type="button" onClick={() => addLinks(false)} className="rounded-lg border border-ink/20 px-3 py-2 text-xs font-bold">{ar ? "إضافة" : "Add"}</button></div>
        </div>
        {images.length > 0 && <div className="space-y-2">{images.map((src, index) => <div key={`${src}-${index}`} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-bone/60 p-2">
          <SmartImage src={src} alt={ar ? `صورة المنتج ${index + 1}` : `Product image ${index + 1}`} className="studio-image-thumb h-16 w-16 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1"><p className="text-xs font-bold">{index === 0 ? (ar ? "الصورة الأساسية" : "Main image") : (ar ? `صورة إضافية ${index}` : `Extra image ${index}`)}</p><p className="mt-1 truncate text-[10px] text-mist" dir="ltr">{src}</p>
            {sizesByUrl[src] && <ImageSizeComparison sizes={sizesByUrl[src]} lang={lang} />}
          </div>
          {index > 0 && <button type="button" onClick={() => commit(promoteProductImage(current.current, index))} className="text-xs font-bold underline" aria-label={ar ? `جعل الصورة ${index + 1} أساسية` : `Make image ${index + 1} primary`}>{ar ? "أساسية" : "Set main"}</button>}
          <button type="button" onClick={() => commit(removeProductImage(current.current, index))} className="text-xs font-bold text-rose-700 underline" aria-label={ar ? `حذف الصورة ${index + 1}` : `Remove image ${index + 1}`}>{ar ? "حذف" : "Remove"}</button>
        </div>)}</div>}
      </fieldset>
      {uploading && <p role="status" className="mt-3 text-xs text-mist">{ar ? "جاري ضغط الصور ورفعها…" : "Optimising and uploading images…"}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
