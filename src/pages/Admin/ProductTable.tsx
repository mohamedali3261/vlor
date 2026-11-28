import { primaryProductImage } from "@/lib/productImages";
import { SmartImage } from "@/components/ui/Primitives";
import { Pencil, Search, Trash } from "@/components/ui/icons";
import { useLang } from "@/i18n/LanguageContext";
import { formatPrice } from "@/lib/format";
import { cn } from "@/utils/cn";
import type { Product } from "@/types";
import { useMemo, useState } from "react";

export function ProductTable({
  products,
  onEdit,
  onDelete,
  onReorder,
  onReload,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onReorder: (ids: string[]) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { t, lang, l } = useLang();
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<"all" | "home" | "shop">("all");
  const ar = lang === "ar";
  const [ordering, setOrdering] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const canReorder = scope === "all" && !term.trim() && !ordering && !needsRefresh && products.length <= 1000;
  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (!canReorder || target < 0 || target >= products.length) return;
    const ids = products.map(product => product.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setOrdering(true); setOrderMessage("");
    try {
      await onReorder(ids);
      setOrderMessage(ar ? "تم حفظ الترتيب للموقع." : "Product order saved for the storefront.");
    } catch {
      setNeedsRefresh(true);
      setOrderMessage(ar ? "تعذر تأكيد الحفظ أو تغيرت المنتجات. حدّث القائمة قبل المحاولة مجددًا." : "Could not confirm the save or the catalogue changed. Refresh before trying again.");
    } finally { setOrdering(false); }
  };
  const refreshOrder = async () => {
    setOrdering(true);
    try { await onReload(); setNeedsRefresh(false); setOrderMessage(ar ? "تم تحديث القائمة." : "Catalogue refreshed."); }
    catch { setOrderMessage(ar ? "تعذر تحديث القائمة. حاول مجددًا." : "Could not refresh the catalogue. Try again."); }
    finally { setOrdering(false); }
  };

  const scoped = useMemo(
    () => products.filter((product) => {
      if (scope === "home") return product.showOnHome !== false;
      if (scope === "shop") return product.showOnShop !== false;
      return true;
    }),
    [products, scope]
  );

  const filtered = useMemo(() => {
    const value = term.trim().toLowerCase();
    if (!value) return scoped;
    return scoped.filter((product) =>
      [product.name.en, product.name.ar, product.slug, product.gender]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [scoped, term]);

  const scopes = [
    { key: "all" as const, label: ar ? "كل المنتجات" : "All products", count: products.length },
    { key: "home" as const, label: ar ? "الرئيسية" : "Homepage", count: products.filter((product) => product.showOnHome !== false).length },
    { key: "shop" as const, label: ar ? "المتجر" : "Shop", count: products.filter((product) => product.showOnShop !== false).length },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-ink/10 bg-bone-2/50 p-1" role="tablist" aria-label={ar ? "تصفية بطاقات المنتجات حسب الصفحة" : "Filter product cards by page"}>
          {scopes.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={scope === item.key}
              onClick={() => setScope(item.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition",
                scope === item.key ? "bg-ink text-bone" : "text-mist hover:bg-surface hover:text-ink"
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] tabular-nums", scope === item.key ? "bg-bone/15 text-acid" : "bg-ink/5")}>{item.count}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist" />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("shop.search")} className="field h-9 ps-9 text-[11px]" />
        </label>
        <p className="w-full text-end text-[11px] font-semibold text-mist sm:w-auto">
          {filtered.length} / {scoped.length} {t("shop.results")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bone-2/40 px-3 py-2 text-xs text-mist">
        <p>{ar ? "رتّب المنتجات بالسهمين؛ يُحفظ الترتيب للرئيسية والمتجر والاستوديو. اختر «كل المنتجات» وامسح البحث للترتيب." : "Use the arrows to save one order for the homepage, shop and studio. Select All products and clear search to reorder."}</p>
        {needsRefresh && <button type="button" disabled={ordering} onClick={() => void refreshOrder()} className="font-bold underline disabled:opacity-40">{ar ? "تحديث القائمة" : "Refresh catalogue"}</button>}
        {products.length > 1000 && <p>{ar ? "الحد الأقصى للترتيب 1000 منتج." : "Ordering supports up to 1000 products."}</p>}
        {orderMessage && <p role="status" aria-live="polite" className="w-full font-semibold">{orderMessage}</p>}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ink/15 py-10 text-center text-[12px] text-mist">{t("admin.noProducts")}</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-surface/40">
          <div className="hidden grid-cols-[2.6fr_0.9fr_0.9fr_0.7fr] gap-3 border-b border-ink/10 bg-bone-2/50 px-4 py-2.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-mist md:grid">
            <span>{t("admin.tab.products")}</span>
            <span>{t("shop.gender")}</span>
            <span>{t("featured.eyebrow")}</span>
            <span className="text-end">{t("admin.edit")}</span>
          </div>
          {filtered.map((product, index) => (
            <div key={product.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink/8 px-3 py-3 last:border-0 hover:bg-surface/60 md:grid-cols-[2.6fr_0.9fr_0.9fr_0.7fr] md:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <SmartImage src={primaryProductImage(product) ?? ""} alt={l(product.name)} className="h-12 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold">{product.name.en}</p>
                  <p className="truncate text-[10px] text-mist">{product.name.ar} · {formatPrice(product.price, lang)}</p>
                  <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                    {product.showOnHome !== false && <span className="rounded-full bg-lilac px-1.5 py-0.5 text-[7px] font-bold">{ar ? "الرئيسية" : "home"}</span>}
                    {product.showOnShop !== false && <span className="rounded-full bg-bone-2 px-1.5 py-0.5 text-[7px] font-bold">{ar ? "المتجر" : "shop"}</span>}
                    {product.featured && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[7px] font-bold text-acid">{ar ? "مميز" : "featured"}</span>}
                    {product.isNew && <span className="rounded-full bg-lilac px-1.5 py-0.5 text-[7px] font-bold">{ar ? "جديد" : "new"}</span>}
                    {product.bestseller && <span className="rounded-full bg-acid px-1.5 py-0.5 text-[7px] font-bold">{ar ? "الأكثر مبيعًا" : "best"}</span>}
                  </div>
                </div>
              </div>
              <span className="hidden text-[11px] text-ink/60 md:block">{t(`shop.${product.gender}`)}</span>
              <div className="hidden flex-wrap gap-1 md:flex">
                {product.showOnHome !== false && <span className="rounded-full bg-lilac px-1.5 py-0.5 text-[7px] font-bold">{ar ? "الرئيسية" : "home"}</span>}
                {product.showOnShop !== false && <span className="rounded-full bg-bone-2 px-1.5 py-0.5 text-[7px] font-bold">{ar ? "المتجر" : "shop"}</span>}
                {product.featured && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[7px] font-bold text-acid">{ar ? "مميز" : "featured"}</span>}
                {product.isNew && <span className="rounded-full bg-lilac px-1.5 py-0.5 text-[7px] font-bold">{ar ? "جديد" : "new"}</span>}
                {product.bestseller && <span className="rounded-full bg-acid px-1.5 py-0.5 text-[7px] font-bold">{ar ? "الأكثر مبيعًا" : "best"}</span>}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <button type="button" disabled={!canReorder || index === 0} onClick={() => void move(index, -1)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-ink disabled:opacity-30" aria-label={`${ar ? "نقل لأعلى" : "Move up"} · ${l(product.name)}`}>↑</button>
                <button type="button" disabled={!canReorder || index === products.length - 1} onClick={() => void move(index, 1)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-ink disabled:opacity-30" aria-label={`${ar ? "نقل لأسفل" : "Move down"} · ${l(product.name)}`}>↓</button>
                <button disabled={ordering} onClick={() => onEdit(product)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-ink transition hover:bg-ink hover:text-bone" aria-label={t("admin.edit")}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button disabled={ordering} onClick={() => onDelete(product)} className="grid h-8 w-8 place-items-center rounded-full border border-ink/10 text-mist transition hover:bg-rose-100 hover:text-rose-600" aria-label={t("admin.delete")}>
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
