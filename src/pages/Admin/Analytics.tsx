import { ProfileAnalytics } from "@/pages/Admin/ProfileAnalytics";
import { latinDigits } from "@/lib/format";
import { ArrowUpRight, Eye, Lock, Refresh, Sparkles } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type AnalyticsPayload = {
  period: { days: number; startDay: string; endDay: string };
  summary: { pageViews: number; visitors: number; productClicks: number };
  activeVisitors: number;
  retainedTotals: { visitors: number; pageViews: number };
  actions: { path: string; action: string; clicks: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  products: {
    slug: string;
    name: { en: string; ar: string };
    clicks: number;
    visitors: number;
    archived: boolean;
  }[];
};

const RANGE_DAYS = [7, 30, 90, 365, 400] as const;

function pageLabel(path: string, ar: boolean): string {
  const labels: Record<string, string> = {
    "/": ar ? "الرئيسية" : "Homepage",
    "/shop": ar ? "المتجر" : "Shop",
    "/wishlist": ar ? "المفضلة" : "Wishlist",
    "/contact": ar ? "تواصل معنا" : "Contact",
    "/track": ar ? "تتبّع الطلب" : "Order tracking",
    "/404": ar ? "صفحة غير موجودة" : "Not found",
  };
  if (labels[path]) return labels[path];
  if (path.startsWith("/product/")) {
    return `${ar ? "صفحة منتج" : "Product page"} · ${path.slice("/product/".length)}`;
  }
  return path;
}

function actionLabel(action: string, ar: boolean, products: AnalyticsPayload["products"]): string {
  if (action.startsWith("product:")) {
    const slug = action.slice(8);
    const product = products.find((item) => item.slug === slug);
    return `${ar ? "فتح منتج" : "Open product"}: ${product?.name[ar ? "ar" : "en"] || slug}`;
  }
  const labels: Record<string, [string, string]> = {
    "open-cart": ["فتح السلة", "Open cart"], "checkout": ["فتح إتمام الطلب", "Open checkout"],
    "place-order": ["ضغط إتمام الطلب", "Place-order button"], "copy-order": ["نسخ الطلب", "Copy order"],
    "add-to-cart": ["إضافة للسلة", "Add to cart"], "wishlist": ["تغيير المفضلة", "Toggle wishlist"],
    "choose-size": ["اختيار الحجم", "Choose size"], "quantity": ["تغيير الكمية", "Change quantity"],
    "gallery": ["معرض الصور", "Image gallery"], "menu": ["فتح القائمة", "Open menu"], "language": ["تغيير اللغة", "Change language"],
    "filter": ["تصفية المنتجات", "Filter products"], "remove-from-cart": ["إزالة من السلة", "Remove from cart"], "carousel": ["تصفح المنتجات المتحركة", "Browse carousel"],
    "other-button": ["زر آخر", "Other button"], "link-home": ["الرئيسية", "Homepage link"],
    "link-shop": ["المتجر", "Shop link"], "link-wishlist": ["المفضلة", "Wishlist link"],
    "link-contact": ["تواصل معنا", "Contact link"], "link-track": ["تتبع الطلب", "Track order link"], "link-other": ["رابط آخر", "Other link"],
    "social-whatsapp": ["واتساب", "WhatsApp"], "social-instagram": ["إنستجرام", "Instagram"],
    "social-facebook": ["فيسبوك", "Facebook"], "social-tiktok": ["تيك توك", "TikTok"],
    "social-messenger": ["ماسنجر", "Messenger"], "social-other": ["رابط خارجي آخر", "Other external link"],
  };
  return labels[action]?.[ar ? 0 : 1] || (ar ? "تفاعل آخر" : "Other interaction");
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist">{label}</p>
          <p className="font-display mt-2 text-3xl leading-none text-ink tabular-nums">{value}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-mist">{detail}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acid/15 text-ink">{icon}</span>
      </div>
    </article>
  );
}

export function Analytics() {
  const { lang, t } = useLang();
  const ar = lang === "ar";
  const number = useMemo(() => new Intl.NumberFormat(ar ? "ar-EG-u-nu-latn" : "en-US"), [ar]);
  const [days, setDays] = useState("30");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const rangeOptions = RANGE_DAYS.map((value) => ({
    value: String(value),
    label: value === 400 ? (ar ? "كل البيانات المتاحة (400 يوم)" : "All available data (400 days)") : ar ? `آخر ${number.format(value)} يوماً` : `Last ${value} days`,
  }));

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(`/api/admin/analytics?days=${days}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Analytics request failed");
        return (await response.json()) as AnalyticsPayload;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [days, reload]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") setReload((value) => value + 1); }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const maxViews = Math.max(0, ...(data?.pages.map((page) => page.views) ?? []));
  const formatDay = (day: string) => {
    const date = new Date(`${day}T00:00:00Z`);
    return new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  };

  return (
    <section className="space-y-4" aria-labelledby="analytics-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="analytics-title" className="font-display text-2xl">{t("admin.analytics.heading")}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-mist">{t("admin.analytics.description")}</p>
          {data && <p className="mt-1 text-[10px] text-mist">{formatDay(data.period.startDay)} – {formatDay(data.period.endDay)}</p>}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            ariaLabel={t("admin.analytics.range")}
            className="min-w-[155px] flex-1 sm:flex-none"
            buttonClassName="h-10"
            value={days}
            options={rangeOptions}
            onChange={(value) => { if (value !== days) { setData(null); setStatus("loading"); setDays(value); } }}
            dir={ar ? "rtl" : "ltr"}
          />
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            disabled={status === "loading"}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-surface px-4 text-xs font-bold transition hover:border-ink/30 disabled:opacity-50"
          >
            <Refresh className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
            {t("admin.analytics.refresh")}
          </button>
        </div>
      </div>

      {status === "error" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          <span>{t("admin.analytics.error")}</span>
          <button type="button" className="underline underline-offset-2" onClick={() => setReload((value) => value + 1)}>{t("admin.analytics.retry")}</button>
        </div>
      )}

      {status === "loading" && !data ? (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-ink/5" />)}
        </div>
      ) : data ? (
        <>
          <ProfileAnalytics days={days} reload={reload} actionLabel={action=>actionLabel(action,ar,data.products)} pageLabel={path=>pageLabel(path,ar)} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={ar ? "الزوار الحاليون" : "Visitors online"} value={number.format(data.activeVisitors)} detail={ar ? "متصفحات نشطة خلال آخر 5 دقائق — تحديث تلقائي" : "Browsers active in the last 5 minutes — refreshes automatically"} icon={<span className="h-3 w-3 rounded-full bg-emerald-500" />} />
            <MetricCard label={ar ? "إجمالي الزوار المتاح" : "Total available visitors"} value={number.format(data.retainedTotals.visitors)} detail={ar ? "متصفحات مميزة خلال آخر 400 يوم" : "Unique browsers over the last 400 days"} icon={<Sparkles className="h-5 w-5" />} />
            <MetricCard label={ar ? "إجمالي المشاهدات المتاح" : "Total available views"} value={number.format(data.retainedTotals.pageViews)} detail={ar ? "مشاهدات الصفحات خلال آخر 400 يوم" : "Page views over the last 400 days"} icon={<Eye className="h-5 w-5" />} />
            <MetricCard
              label={t("admin.analytics.pageViews")}
              value={number.format(data.summary.pageViews)}
              detail={t("admin.analytics.pageViewsDetail")}
              icon={<Eye className="h-5 w-5" />}
            />
            <MetricCard
              label={t("admin.analytics.visitors")}
              value={number.format(data.summary.visitors)}
              detail={t("admin.analytics.visitorsDetail")}
              icon={<Sparkles className="h-5 w-5" />}
            />
            <MetricCard
              label={t("admin.analytics.productClicks")}
              value={number.format(data.summary.productClicks)}
              detail={t("admin.analytics.productClicksDetail")}
              icon={<ArrowUpRight className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-surface" aria-labelledby="analytics-pages-title">
              <header className="border-b border-ink/10 px-4 py-3.5 sm:px-5">
                <h3 id="analytics-pages-title" className="text-sm font-bold">{t("admin.analytics.pagesTitle")}</h3>
                <p className="mt-0.5 text-[10px] text-mist">{t("admin.analytics.pagesDescription")}</p>
              </header>
              {data.pages.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-mist">{t("admin.analytics.noPages")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-start text-xs">
                    <thead className="bg-bone-2/45 text-[9px] font-bold uppercase tracking-[0.12em] text-mist">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-start">{t("admin.analytics.page")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end">{t("admin.analytics.pageViews")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end">{t("admin.analytics.visitors")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5">
                      {data.pages.map((page) => (
                        <tr key={page.path}>
                          <th scope="row" className="max-w-[240px] px-4 py-3 text-start font-semibold">
                            <span className="block truncate">{pageLabel(page.path, ar)}</span>
                            <span dir="ltr" className="mt-0.5 block truncate text-[9px] font-normal text-mist">{page.path}</span>
                            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-ink/5">
                              <span className="block h-full rounded-full bg-acid" style={{ width: `${maxViews ? Math.max(2, (page.views / maxViews) * 100) : 0}%` }} />
                            </span>
                          </th>
                          <td className="px-4 py-3 text-end font-bold tabular-nums">{number.format(page.views)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{number.format(page.visitors)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-surface" aria-labelledby="analytics-products-title">
              <header className="border-b border-ink/10 px-4 py-3.5 sm:px-5">
                <h3 id="analytics-products-title" className="text-sm font-bold">{t("admin.analytics.productsTitle")}</h3>
                <p className="mt-0.5 text-[10px] text-mist">{t("admin.analytics.productsDescription")}</p>
              </header>
              {data.products.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-mist">{t("admin.analytics.noProducts")}</p>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[420px] text-start text-xs">
                    <thead className="sticky top-0 bg-bone-2 text-[9px] font-bold uppercase tracking-[0.12em] text-mist">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-start">{t("admin.analytics.product")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end">{t("admin.analytics.clicks")}</th>
                        <th scope="col" className="px-4 py-2.5 text-end">{t("admin.analytics.uniqueClickers")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5">
                      {data.products.map((product) => (
                        <tr key={product.slug} className={product.archived ? "opacity-55" : ""}>
                          <th scope="row" className="max-w-[240px] px-4 py-3 text-start font-semibold">
                            <span className="block truncate">{latinDigits(product.name[lang] || product.slug)}</span>
                            <span dir="ltr" className="mt-0.5 block truncate text-[9px] font-normal text-mist">
                              {product.slug}{product.archived ? ` · ${t("admin.analytics.archived")}` : ""}
                            </span>
                          </th>
                          <td className="px-4 py-3 text-end font-bold tabular-nums">{number.format(product.clicks)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{number.format(product.visitors)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-ink/10 bg-surface" aria-labelledby="analytics-actions-title">
            <header className="border-b border-ink/10 px-4 py-3.5 sm:px-5">
              <h3 id="analytics-actions-title" className="text-sm font-bold">{ar ? "الضغطات في كل صفحة" : "Clicks by page"}</h3>
              <p className="mt-1 text-xs leading-relaxed text-mist">{ar ? "يعرض أكثر 300 تفاعل للأزرار والروابط حسب الصفحة. الأزرار غير المصنّفة تظهر كزر آخر؛ الضغط لا يعني بالضرورة نجاح الطلب. تتوفر البيانات الجديدة من وقت تفعيل هذه الميزة." : "Top 300 button and link interactions by page. Unclassified buttons appear as Other button; a click does not mean an order succeeded. New interaction data starts when this feature is enabled."}</p>
            </header>
            {data.actions.length === 0 ? <p className="px-5 py-8 text-center text-xs text-mist">{ar ? "لا توجد ضغطات مسجلة خلال هذه الفترة." : "No interactions recorded for this period."}</p> : <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[520px] text-start text-xs"><thead className="sticky top-0 bg-bone-2 text-[10px] text-mist"><tr>
                <th scope="col" className="px-4 py-3 text-start">{ar ? "الصفحة" : "Page"}</th><th scope="col" className="px-4 py-3 text-start">{ar ? "العنصر" : "Action"}</th><th scope="col" className="px-4 py-3 text-end">{ar ? "الضغطات" : "Clicks"}</th><th scope="col" className="px-4 py-3 text-end">{ar ? "زوار مميزون" : "Unique visitors"}</th>
              </tr></thead><tbody className="divide-y divide-ink/5">{data.actions.map((row) => <tr key={`${row.path}:${row.action}`}>
                <th scope="row" className="px-4 py-3 text-start font-semibold">{pageLabel(row.path, ar)}</th><td className="px-4 py-3">{actionLabel(row.action, ar, data.products)}</td><td className="px-4 py-3 text-end font-bold tabular-nums">{number.format(row.clicks)}</td><td className="px-4 py-3 text-end tabular-nums">{number.format(row.visitors)}</td>
              </tr>)}</tbody></table>
            </div>}
          </section>

          <p className="flex items-start gap-2 rounded-xl border border-ink/8 bg-ink/[0.025] px-3.5 py-3 text-[10px] leading-relaxed text-mist">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("admin.analytics.privacy")}</span>
          </p>
        </>
      ) : null}
    </section>
  );
}
