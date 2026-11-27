import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/i18n/LanguageContext";
import { contrastRatio, productCardColours, siteSurfaces } from "@/lib/theme";
import type { Product } from "@/types";
import type { ThemeContent } from "@/types/content";
import type { CSSProperties } from "react";

// Keep the preview available even when the catalogue is empty or loading.
const example: Product = {
  id: "studio-preview", slug: "preview", name: { en: "Your perfume", ar: "عطرك المميز" },
  tagline: { en: "", ar: "" }, description: { en: "", ar: "" }, story: { en: "", ar: "" },
  price: 1, sizes: [{ ml: 50, price: 1 }], category: "woody", gender: "unisex", moods: [],
  notes: { top: [], heart: [], base: [] }, images: [],
  accent: "#D4A035", longevity: "", sillage: { en: "", ar: "" }, rating: 0, reviews: 0, createdAt: "",
};

type ColourKey = "productCardBase" | "productCardDisc" | "productCardText";

export function ProductCardColours({
  theme, product, onChange, onSave, dirty,
}: {
  theme: ThemeContent;
  product?: Product;
  onChange: (key: ColourKey, value: string | undefined) => void;
  onSave: () => void;
  dirty: boolean;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const colours = productCardColours(theme);
  const lowContrast = contrastRatio(colours.text, colours.base) < 4.5 || contrastRatio(colours.text, colours.disc) < 4.5;
  const previewStyle = {
    "--product-card-base": colours.base,
    "--product-card-disc": colours.disc,
    "--product-card-text": colours.text,
    "--color-ink": theme.ink,
    "--color-acid": theme.accent,
    "--color-card-light": siteSurfaces(theme).cardLight,
  } as CSSProperties;
  const fields: { key: ColourKey; label: string; value: string }[] = [
    { key: "productCardBase", label: ar ? "لون خلفية الكارت" : "Card background", value: colours.base },
    { key: "productCardDisc", label: ar ? "لون الدائرة" : "Circle colour", value: colours.disc },
    { key: "productCardText", label: ar ? "لون النص" : "Text colour", value: colours.text },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_270px] md:items-start">
      <div>
        <p className="text-xs leading-relaxed text-mist">{ar ? "غيّر الألوان وشاهد النتيجة فوراً. الدرجات التلقائية تتبع لون تمييز الموقع. بعد الحفظ تظهر التغييرات للزوار." : "Change the colours to preview them instantly. Automatic shades follow the site accent. Save to show visitors."}</p>
        <div className="mt-4 grid gap-2">
          {fields.map(({ key, label, value }) => (
            <div key={key} className="rounded-xl border border-ink/10 bg-bone/50 p-3">
              <label className="flex items-center gap-3">
                <input type="color" value={value} onChange={(event) => onChange(key, event.target.value)}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-surface p-1" />
                <span>
                  <span className="block text-xs font-bold text-ink">{label}</span>
                  <span dir="ltr" className="mt-1 block text-[11px] text-mist">{value.toUpperCase()}</span>
                </span>
              </label>
              {theme[key] && <button type="button" onClick={() => onChange(key, undefined)} className="mt-2 text-xs font-bold text-ink underline underline-offset-4">
                {ar ? "استخدام اللون التلقائي" : "Use automatic colour"}
              </button>}
            </div>
          ))}
        </div>
        {lowContrast && <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{ar ? "التباين ضعيف بين النص وأحد ألوان الكارت؛ اختر ألواناً أوضح لسهولة القراءة." : "Text contrast is low against one of the card colours; choose more contrasting colours for readability."}</p>}
        <Button variant="acid" className="mt-4" onClick={onSave} disabled={!dirty}>{ar ? "حفظ التغييرات" : "Save changes"}</Button>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-ink">{ar ? "معاينة مباشرة" : "Live preview"}</p>
        <div style={previewStyle} inert aria-hidden="true">
          <ProductCard product={product ?? example} />
        </div>
        <p className="mt-2 text-[11px] text-mist">{ar ? "المعاينة للعرض فقط ولا تضيف منتجات للسلة." : "Preview only; no items are added to the bag."}</p>
      </div>
    </div>
  );
}
