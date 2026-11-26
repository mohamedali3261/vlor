import { Accordion } from "@/components/ui/Primitives";
import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";

export function ProductDetails({ product }: { product: Product }) {
  const { t, l, x } = useLang();

  const noteGroups = [
    { label: t("product.top"), notes: product.notes.top },
    { label: t("product.heart"), notes: product.notes.heart },
    { label: t("product.base"), notes: product.notes.base },
  ].filter((group) => group.notes.length > 0);

  const items = [
    ...(noteGroups.length ? [{
      title: t("product.notes"),
      body: (
        <div className="grid gap-3 sm:grid-cols-3">
          {noteGroups.map((group) => (
            <div key={group.label} className="rounded-xl bg-bone-2/60 px-3 py-2.5">
              <p className="text-[10px] font-bold text-ink">{group.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/70">{group.notes.map(l).join(" · ")}</p>
            </div>
          ))}
        </div>
      ),
    }] : []),
    {
      title: t("product.story"),
      body: <p className="text-[13px] leading-relaxed text-ink/70">{l(product.story)}</p>,
    },
  ];

  return (
    <div className="space-y-3">
      <Accordion items={items} />
      <p className="rounded-xl bg-bone-2/60 px-3.5 py-2.5 text-center text-[11px] leading-relaxed text-mist">
        {x(
          "Delivery 1–4 days · Free shipping over EGP 2,000 · Cash on delivery",
          "التوصيل ١–٤ أيام · مجاناً فوق ٢٠٠٠ ج.م · الدفع عند الاستلام"
        )}
      </p>
    </div>
  );
}
