import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";

export function ProductDetails({ product }: { product: Product }) {
  const { t, l, x } = useLang();
  const noteGroups = [
    { label: t("product.top"), notes: product.notes.top },
    { label: t("product.heart"), notes: product.notes.heart },
    { label: t("product.base"), notes: product.notes.base },
  ].filter((group) => group.notes.length > 0);

  return (
    <section aria-label={x("Product details", "تفاصيل المنتج")} className="product-details space-y-3">
      <h2 className="text-[11px] font-bold text-ink">{x("Product details", "تفاصيل المنتج")}</h2>
      <p className="text-[13px] leading-relaxed text-ink/70">{l(product.description)}</p>
      {noteGroups.length > 0 && (
        <div className="product-details__notes grid gap-2 sm:grid-cols-3">
          {noteGroups.map((group) => (
            <div key={group.label} className="rounded-xl bg-bone-2/60 px-3 py-2.5">
              <p className="text-[10px] font-bold text-ink">{group.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/70">{group.notes.map(l).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
