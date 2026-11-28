import { LoadingImage } from "@/components/ui/LoadingImage";
import { primaryProductImage } from "@/lib/productImages";
import { useLang } from "@/i18n/LanguageContext";
import { resolveAsset } from "@/lib/assets";
import type { Product } from "@/types";
import type { ThemeContent } from "@/types/content";
import { useState } from "react";
import "@/styles/studio-image-scale.css";

type ScaleKey = "homeProductImageScale" | "shopHeroProductImageScale" | "shopGridProductImageScale";

/** Independent section controls, with a preview that follows the selected slider. */
export function ProductImageScale({ products, theme, onChange }: {
  products: Product[];
  theme: ThemeContent;
  onChange: (key: ScaleKey, value: number) => void;
}) {
  const { lang, l } = useLang();
  const ar = lang === "ar";
  const [selected, setSelected] = useState("");
  const [active, setActive] = useState<ScaleKey>("homeProductImageScale");
  const [failedSrc, setFailedSrc] = useState("");
  const product = products.find((p) => p.id === selected) ?? products[0];
  const src = (product ? primaryProductImage(product) : undefined) || "";
  const controls: { key: ScaleKey; label: string }[] = [
    { key: "homeProductImageScale", label: ar ? "صور منتجات الصفحة الرئيسية" : "Homepage product images" },
    { key: "shopHeroProductImageScale", label: ar ? "صور سلايدر أعلى صفحة المنتجات" : "Shop top carousel images" },
    { key: "shopGridProductImageScale", label: ar ? "صور كروت قائمة المنتجات" : "Shop product card images" },
  ];
  const scaleFor = (key: ScaleKey) => {
    const value = theme[key] ?? theme.productImageScale;
    return Number.isFinite(value) ? Math.min(150, Math.max(50, value)) : 100;
  };
  const activeLabel = controls.find((control) => control.key === active)!.label;
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-mist">{ar ? "اضبط كل قسم بشكل مستقل. يشمل إعداد الرئيسية سلايدر المنتجات والكروت فيها. احفظ التعديلات لتظهر للزوار." : "Adjust each section independently. The homepage setting covers its product carousel and cards. Save changes to show them to visitors."}</p>
        {products.length > 0 && <label className="block text-xs font-bold">
          {ar ? "اختر منتجاً للمعاينة" : "Choose a product to preview"}
          <select className="field mt-2" value={product?.id ?? ""} onChange={(event) => setSelected(event.target.value)}>
            {products.map((item) => <option key={item.id} value={item.id}>{l(item.name)}</option>)}
          </select>
        </label>}
        {controls.map(({ key, label }) => <div key={key}>
          <label className="block text-xs font-bold">
            <span className="flex justify-between gap-2"><span>{label}</span><output dir="ltr">{scaleFor(key)}%</output></span>
            <input className="mt-3 w-full accent-ink" type="range" min="50" max="150" step="5" value={scaleFor(key)} onFocus={() => setActive(key)} onChange={(event) => { setActive(key); onChange(key, Number(event.target.value)); }} />
          </label>
          <button type="button" onClick={() => { setActive(key); onChange(key, 100); }} className="mt-1 text-xs font-bold underline underline-offset-4">{ar ? "الحجم الأصلي" : "Reset size"}</button>
        </div>)}
      </div>
      <div>
        <p className="mb-2 text-xs font-bold">{ar ? "معاينة تقريبية لحجم الصورة" : "Approximate image size preview"} · {activeLabel}</p>
        <div className="studio-image-scale-preview flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-bone-2/50 p-4">
          {src && failedSrc !== src ? <LoadingImage key={src} src={resolveAsset(src)} alt={product ? l(product.name) : ""} onError={() => setFailedSrc(src)} style={{ transform: `scale(${scaleFor(active) / 100})` }} className="studio-image-scale-preview__image transition-transform" /> : <p className="text-center text-xs text-mist">{ar ? "لا توجد صورة متاحة لهذا المنتج. يمكنك إضافتها من تبويب المنتجات." : "No image is available for this product. Add one in Products."}</p>}
        </div>
      </div>
    </div>
  );
}
