import { useState } from "react";
import "@/styles/product-page.css";
import { Gallery } from "@/pages/Product/Gallery";
import { PurchasePanel } from "@/pages/Product/PurchasePanel";
import { RelatedScents } from "@/pages/Product/RelatedScents";
import { Button } from "@/components/ui/Button";
import { ArrowUpRight, Sparkle } from "@/components/ui/icons";
import { getProductBySlug } from "@/data/products";
import { useStore } from "@/context/StoreContext";
import { useLang } from "@/i18n/LanguageContext";
import { Link, useRoute } from "@/lib/router";
import { productAccent } from "@/lib/theme";

export function ProductPage() {
  const { t, x } = useLang();
  const { products } = useStore();
  const { segments } = useRoute();
  const product = getProductBySlug(products, segments[1] ?? "");
  const [selection, setSelection] = useState<{id:string; ml:number} | null>(null);

  if (!product) {
    return (
      <div className="anim-page flex min-h-[60vh] flex-col items-center justify-center bg-bone px-6 py-20 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-lilac-soft">
          <Sparkle className="h-7 w-7 text-plum" />
        </span>
        <h1 className="font-display mt-6 text-4xl sm:text-5xl">{t("product.notFound")}</h1>
        <p className="mt-3 max-w-sm text-sm text-mist">
          {x("It may have moved or sold out. Explore the rest of the collection.", "ربما تم نقله أو نفدت كميته. جرّب استكشاف بقية المجموعة.")}
        </p>
        <Button to="/shop" className="mt-6" icon={<ArrowUpRight className="h-4 w-4" />}>
          {t("product.notFoundCta")}
        </Button>
      </div>
    );
  }

  const ml = selection?.id === product.id && product.sizes.some(size => size.ml === selection.ml) ? selection.ml : (product.sizes.find(size => size.ml === 50) ?? product.sizes[0])?.ml ?? 50;

  return (
    <div className="product-page anim-page bg-bone">
      <section className="product-page__section relative overflow-hidden page-pad">
        <div
          className="pointer-events-none absolute -start-32 top-20 h-80 w-80 rounded-full opacity-20 blur-[100px]"
          style={{ background: productAccent(product.accent, "var(--color-acid)") }}
        />
        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <Link
            to="/shop"
            className="product-page__back mb-5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-mist transition hover:text-ink"
          >
            <span className="rtl:rotate-180">←</span> {t("featured.all")}
          </Link>
          <div className="product-page__layout grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Gallery product={product} selectedSize={ml} />
            </div>
            <PurchasePanel key={product.id} product={product} ml={ml} onSizeChange={size => setSelection({id:product.id, ml:size})} />
          </div>
        </div>
      </section>

      <RelatedScents product={product} />
    </div>
  );
}
