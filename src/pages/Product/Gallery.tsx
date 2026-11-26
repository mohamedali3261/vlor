import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";

/** Compact text-led product card: no product or decorative photographs. */
export function Gallery({ product }: { product: Product }) {
  const { l, x } = useLang();
  return (
    <div className="mx-auto flex min-h-48 w-full max-w-sm flex-col justify-center rounded-[1.8rem] border border-ink/10 bg-surface px-6 py-8 text-center sm:min-h-56">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">{x("Fragrance", "عطر")}</p>
      <h2 className="font-display mt-3 text-3xl text-ink">{l(product.name)}</h2>
      <p className="mt-3 text-sm leading-relaxed text-mist">{l(product.tagline)}</p>
    </div>
  );
}
