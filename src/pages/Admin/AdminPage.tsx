import { Analytics } from "@/pages/Admin/Analytics";
import { DiscountRules } from "@/pages/Admin/DiscountRules";
import { Delivery } from "@/pages/Admin/Delivery";
import { Security } from "@/pages/Admin/Security";
import { Orders } from "@/pages/Admin/Orders";
import { AdminHeader, type AdminTab } from "@/pages/Admin/AdminHeader";
import { ProductForm } from "@/pages/Admin/ProductForm";
import { ImageOptimization } from "@/pages/Admin/ImageOptimization";
import { ImageStockEditor } from "@/pages/Admin/ImageStockEditor";
import { UnifyProductImages } from "@/pages/Admin/UnifyProductImages";
import { ProductTable } from "@/pages/Admin/ProductTable";
import { ContentEditor } from "@/pages/Admin/ContentEditor";
import { StoreSettingsForm } from "@/pages/Admin/StoreSettingsForm";
import { Button } from "@/components/ui/Button";
import { Download, Plus, Refresh, Upload } from "@/components/ui/icons";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { useLang } from "@/i18n/LanguageContext";
import { downloadJson } from "@/lib/format";
import { Link } from "@/lib/router";
import { countDirtyDrafts } from "@/lib/studioDrafts";
import type { Product, SiteSettings } from "@/types";
import { useEffect, useRef, useState } from "react";

export function AdminPage() {
  const { t, lang, l } = useLang();
  const { products, settings, wishlist, saveProduct, reloadProducts, deleteProduct, resetCatalogue, replaceCatalogue, updateSettings, content, configStatus, reloadConfig } = useStore();
  const { push } = useToast();
  const [tab, setTab] = useState<AdminTab>("products");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const changeTab = (next: AdminTab) => {
    if (next === tab) return;
    if (countDirtyDrafts() && !window.confirm(lang === "ar" ? "لديك تعديلات غير محفوظة. هل تريد مغادرة هذا القسم وفقدها؟" : "You have unsaved changes. Leave this section and discard them?")) return;
    setTab(next);
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (countDirtyDrafts()) event.preventDefault(); };
    const leaving = (event: MouseEvent) => {
      if (!countDirtyDrafts() || !(event.target instanceof Element)) return;
      const href = event.target.closest('a')?.getAttribute('href') || '';
      if (!href.startsWith('#/') || /^#\/(studio|admin)(?:[/?#]|$)/i.test(href)) return;
      if (!window.confirm(lang === "ar" ? "لديك تعديلات غير محفوظة. هل تريد مغادرة الاستوديو؟" : "You have unsaved changes. Leave the studio?")) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', leaving, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', leaving, true); };
  }, [lang]);

  const requireSavedProductDrafts = () => {
    if (!countDirtyDrafts()) return true;
    push(lang === "ar" ? "احفظ كميات الصور أو تجاهل تعديلاتك أولًا." : "Save or discard image quantity edits first.", "error");
    return false;
  };
  const openNew = () => {
    if (!requireSavedProductDrafts()) return;
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!requireSavedProductDrafts()) return;
    setEditing(product);
    setFormOpen(true);
  };

  const handleSave = async (product: Product, stocks: number[] = []) => {
    const conflict = products.some((item) => item.slug === product.slug && item.id !== product.id);
    if (conflict) {
      push(lang === "ar" ? "هذا الرابط (slug) مستخدم بالفعل. اختر رابطاً آخر." : "That slug is already in use. Choose another one.", "error");
      return;
    }
    try { await saveProduct(product); } catch { push(lang === "ar" ? "تعذر حفظ المنتج" : "Could not save product", "error"); return; }
    // Handle stock: for each size, adjust to desired quantity
    try {
      const desired = product.sizes.map((s, i) => ({ size: s.ml, qty: Math.max(0, Math.trunc(stocks[i] ?? 0)) }));
      const filtered = desired.filter(d => d.qty > 0 || products.some(p=>p.id===product.id));
      if (filtered.length > 0) {
        const invRes = await fetch('/api/admin/inventory');
        if (!invRes.ok) throw new Error('Inventory unavailable');
        const invRows: { product_id:string; size:number; quantity:number }[] = await invRes.json();
        const currentMap = new Map(invRows.filter(r=>r.product_id===product.id).map(r=>[r.size, r.quantity] as const));
        for (const d of filtered) {
          const current = currentMap.get(d.size) ?? 0;
          const delta = d.qty - current;
          if (delta === 0) continue;
          if (delta > 0) {
            const r = await fetch(`/api/admin/inventory/${encodeURIComponent(product.id)}/${d.size}/add`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount: delta }) });
            if (!r.ok) throw new Error('stock add failed');
          } else {
            // need to set directly via PUT (decrease)
            const r = await fetch(`/api/admin/inventory/${encodeURIComponent(product.id)}/${d.size}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ quantity: d.qty, expectedQuantity: current }) });
            if (!r.ok) throw new Error('stock set failed');
          }
        }
      }
    } catch {
      push(lang === "ar" ? "تم حفظ المنتج لكن تعذر تحديث المخزون؛ راجع كمية المنتج." : "Product saved but stock update failed; check the product quantity.", "error");
      setFormOpen(false);
      return;
    }
    setFormOpen(false);
    push(`${l(product.name)} · ${t("admin.saved")}`);
  };

  const handleDelete = async (product: Product) => {
    if (!requireSavedProductDrafts()) return;
    if (window.confirm(`${t("admin.deleteConfirm")}\n${product.name[lang]}`)) {
      try { await deleteProduct(product.id); } catch { push(lang === "ar" ? "تعذرت أرشفة المنتج" : "Could not archive product", "error"); return; }
      push(t("admin.deleted"), "error");
    }
  };

  const handleReset = () => {
    if (!requireSavedProductDrafts()) return;
    if (window.confirm(t("admin.resetConfirm"))) {
      try { resetCatalogue(); } catch { push(lang === "ar" ? "استعادة الكتالوج بالكامل غير متاحة." : "Bulk reset is unavailable.", "error"); return; }
      push(t("admin.resetDone"), "info");
    }
  };

  const exportAll = () => {
    downloadJson("catalog.json", { generatedAt: new Date().toISOString(), settings, content, products });
    push(lang === "ar" ? "تم تصدير الكتالوج." : "Catalogue exported.", "info");
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next: unknown = Array.isArray(parsed) ? parsed : parsed?.products;
        if (
          !Array.isArray(next) ||
          next.some(
            (item) =>
              !item?.slug ||
              !item?.name?.en ||
              !Array.isArray(item?.sizes) ||
              item.sizes.length === 0 ||
              !Array.isArray(item?.notes?.top)
          )
        ) {
          throw new Error("invalid");
        }
        if (!requireSavedProductDrafts()) return;
        if (!window.confirm(lang === "ar" ? `استيراد ${next.length} منتج؟ سيتم تحديث المنتجات الموجودة بنفس المعرّف ولن تُحذف المنتجات الأخرى.` : `Import ${next.length} products? Matching IDs will be updated; other products will not be deleted.`)) return;
        await replaceCatalogue(next as Product[]);
        push(lang === "ar" ? "تم استيراد الكتالوج." : "Catalogue imported.");
      } catch {
        push(lang === "ar" ? "تعذر الاستيراد. تحقق من البيانات وتعارض الروابط (الحد 100 منتج)." : "Import failed. Check data and slug conflicts (maximum 100 products).", "error");
      }
    };
    reader.readAsText(file);
    fileRef.current!.value = "";
  };

  const saveSettings = async (next: SiteSettings) => {
    try { await updateSettings(next); push(lang === "ar" ? "تم حفظ بيانات المتجر للزوار." : "Storefront details saved."); }
    catch (error) { push(error instanceof Error && error.message === 'Configuration changed' ? (lang === "ar" ? "تغيرت البيانات من جلسة أخرى. انسخ تعديلاتك ثم حدّث الصفحة." : "Settings changed in another session. Copy your edits and refresh.") : (lang === "ar" ? "تعذر حفظ البيانات. تحقق من الاتصال." : "Could not save settings. Check your connection."), "error"); }
  };

  return (
    <div className="anim-page bg-bone pb-28 pt-8">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-mist transition hover:text-ink">
            <span className="rtl:rotate-180">←</span> {lang === "ar" ? "العودة للمتجر" : "Back to storefront"}
          </Link>
          <span className="rounded-full border border-ink/10 bg-surface/50 px-3 py-1 text-[8.5px] font-bold uppercase tracking-[0.16em] text-mist">
            {lang === "ar" ? "إدارة المتجر" : "Store management"}
          </span>
        </div>

        <AdminHeader tab={tab} setTab={changeTab} stats={{ products: products.length, featured: products.filter((product) => product.featured).length, saved: wishlist.length }} />

        <div className="mt-5 rounded-[1.5rem] border border-ink/10 bg-bone/60 p-4 sm:p-5">
          {tab === "products" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[13px] font-bold">{t("admin.collection")}</h2>
                  <p className="text-[10px] text-mist">
                    {lang === "ar" ? "أضف أو عدّل أو احذف كروت العطور، وحدد ظهور كل كارت في الرئيسية والمتجر." : "Add, edit or remove scent cards, and choose whether each appears on the homepage or shop."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])}
                  />
                  <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} icon={<Upload className="h-3.5 w-3.5" />} iconPosition="start">
                    {t("admin.import")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exportAll} icon={<Download className="h-3.5 w-3.5" />} iconPosition="start">
                    {t("admin.export")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset} icon={<Refresh className="h-3.5 w-3.5" />} iconPosition="start">
                    {t("admin.reset")}
                  </Button>
                  <Button size="sm" variant="acid" onClick={openNew} icon={<Plus className="h-3.5 w-3.5" />} iconPosition="start">
                    {t("admin.newProduct")}
                  </Button>
                </div>
              </div>
              <UnifyProductImages products={products} reloadProducts={reloadProducts} disabled={formOpen} />
              <ImageOptimization disabled={formOpen} />
              <ImageStockEditor products={products} disabled={formOpen} />
              <ProductTable products={products} onEdit={openEdit} onDelete={handleDelete} />
            </>
          )}

          {tab === "analytics" && <Analytics />}
          {tab === "orders" && <Orders canHide />}
          {tab === "delivery" && content.studioDeliveryTab && <Delivery />}
          {tab === "discounts" && <DiscountRules />}
          {tab === "security" && <Security />}
          {tab === "content" && (
            <>
              <div className="mb-4">
                <h2 className="text-[13px] font-bold">{t("admin.tab.content")}</h2>
                <p className="text-[10px] text-mist">
                  {lang === "ar"
                    ? "تحكّم كامل في نصوص الموقع والأقسام والألوان."
                    : "Full control over every text, section and colour on the site."}
                </p>
              </div>
              {configStatus === "ready" ? <ContentEditor onManageProducts={() => setTab("products")} /> : <ConfigLoading status={configStatus} retry={reloadConfig} ar={lang === "ar"} />}
            </>
          )}

          {tab === "settings" && (
            <>
              <div className="mb-4">
                <h2 className="text-[13px] font-bold">{t("admin.tab.settings")}</h2>
                <p className="text-[10px] text-mist">{lang === "ar" ? "بيانات التواصل والشحن المستخدمة في كل الصفحات." : "Contact and shipping details used across every page."}</p>
              </div>
              {configStatus === "ready" ? <StoreSettingsForm settings={settings} onSave={saveSettings} /> : <ConfigLoading status={configStatus} retry={reloadConfig} ar={lang === "ar"} />}
            </>
          )}        </div>
      </div>

      <ProductForm open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onSave={handleSave} />
    </div>
  );
}

function ConfigLoading({status,retry,ar}: {status:"loading" | "error"; retry:() => void; ar:boolean}) {
  return <div role={status === "error" ? "alert" : "status"} className="rounded-xl border border-ink/10 bg-surface p-4 text-sm">
    {status === "loading" ? (ar ? "جارٍ تحميل إعدادات المتجر…" : "Loading storefront settings…") : <>{ar ? "تعذر تحميل إعدادات المتجر. لم يتم تغيير أي بيانات." : "Could not load storefront settings. No data was changed."} <button className="font-bold underline" onClick={retry}>{ar ? "إعادة المحاولة" : "Retry"}</button></>}
  </div>;
}
