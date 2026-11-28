import { LoadingImage } from "@/components/ui/LoadingImage";
import { primaryProductImage } from "@/lib/productImages";
import { useLang } from "@/i18n/LanguageContext";
import { resolveAsset } from "@/lib/assets";
import type { Product } from "@/types";
import { useState } from "react";

/** Preview the global image scale, including owner-supplied product photos. */
export function ProductImageScale({ products, value, onChange }: {
  products: Product[];
  value: number;
  onChange: (value: number) => void;
}) {
  const { lang, l } = useLang();
  const ar = lang === "ar";
  const [selected, setSelected] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const product = products.find((p) => p.id === selected) ?? products[0];
  const src = (product ? primaryProductImage(product) : undefined) || "";
  const scale = Number.isFinite(value) ? Math.min(150, Math.max(50, value)) : 100;
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-mist">{ar ? "اضبط حجم الصور لكل المنتجات وشاهد النتيجة مباشرة. بعد الحفظ تظهر الصور الجديدة للزوار بالحجم المحدد." : "Adjust the image size for all products and preview it here. Save to show the new image size to visitors."}</p>
        {products.length > 0 && <label className="block text-xs font-bold">
          {ar ? "اختر منتجاً للمعاينة" : "Choose a product to preview"}
          <select className="field mt-2" value={product?.id ?? ""} onChange={(event) => setSelected(event.target.value)}>
            {products.map((item) => <option key={item.id} value={item.id}>{l(item.name)}</option>)}
          </select>
        </label>}
        <label className="block text-xs font-bold">
          <span className="flex justify-between gap-2"><span>{ar ? "حجم الصورة" : "Image size"}</span><output dir="ltr">{scale}%</output></span>
          <input className="mt-3 w-full accent-ink" type="range" min="50" max="150" step="5" value={scale} onChange={(event) => onChange(Number(event.target.value))} />
        </label>
        <button type="button" onClick={() => onChange(100)} className="text-xs font-bold underline underline-offset-4">{ar ? "الحجم الأصلي" : "Reset size"}</button>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold">{ar ? "معاينة حجم الصورة" : "Image size preview"}</p>
        <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-bone-2/50 p-4">
          {src && failedSrc !== src ? <LoadingImage key={src} src={resolveAsset(src)} alt={product ? l(product.name) : ""} onError={() => setFailedSrc(src)} style={{ transform: `scale(${scale / 100})` }} className="h-full w-full object-contain transition-transform" /> : <p className="text-center text-xs text-mist">{ar ? "لا توجد صورة متاحة لهذا المنتج. يمكنك إضافتها من تبويب المنتجات." : "No image is available for this product. Add one in Products."}</p>}
        </div>
      </div>
    </div>
  );
}
