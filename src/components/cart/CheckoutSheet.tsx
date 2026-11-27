import { Button } from "@/components/ui/Button";
import { Portal, SmartImage } from "@/components/ui/Primitives";
import { Check, Copy, Truck, X } from "@/components/ui/icons";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { useBodyLock } from "@/hooks/useUi";
import { useLang } from "@/i18n/LanguageContext";
import { formatPrice } from "@/lib/format";
import { cartMessage, copyText, type OrderCustomer } from "@/lib/messaging";
import { cn } from "@/utils/cn";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "@/styles/checkout.css";

const governorates = [
  { en: "Cairo", ar: "القاهرة" },
  { en: "Giza", ar: "الجيزة" },
  { en: "Alexandria", ar: "الإسكندرية" },
  { en: "Qalyubia", ar: "القليوبية" },
  { en: "Sharqia", ar: "الشرقية" },
  { en: "Dakahlia", ar: "الدقهلية" },
  { en: "Gharbia", ar: "الغربية" },
  { en: "Monufia", ar: "المنوفية" },
  { en: "Beheira", ar: "البحيرة" },
  { en: "Kafr El Sheikh", ar: "كفر الشيخ" },
  { en: "Damietta", ar: "دمياط" },
  { en: "Port Said", ar: "بورسعيد" },
  { en: "Ismailia", ar: "الإسماعيلية" },
  { en: "Suez", ar: "السويس" },
  { en: "Faiyum", ar: "الفيوم" },
  { en: "Beni Suef", ar: "بني سويف" },
  { en: "Minya", ar: "المنيا" },
  { en: "Asyut", ar: "أسيوط" },
  { en: "Sohag", ar: "سوهاج" },
  { en: "Qena", ar: "قنا" },
  { en: "Luxor", ar: "الأقصر" },
  { en: "Aswan", ar: "أسوان" },
  { en: "Red Sea", ar: "البحر الأحمر" },
  { en: "Matrouh", ar: "مطروح" },
  { en: "North Sinai", ar: "شمال سيناء" },
  { en: "South Sinai", ar: "جنوب سيناء" },
  { en: "New Valley", ar: "الوادي الجديد" },
] as const;


type Quote = { signature: string; subtotal: number; shipping: number; discount: number; total: number; prices: {productId:string; ml:number; price:number}[] };
interface CheckoutSheetProps { open: boolean; onClose: () => void; }

export function CheckoutSheet({ open, onClose }: CheckoutSheetProps) {
  const { lines, count, clear, close: closeCart } = useCart();
  const { settings } = useStore();
  const { lang, t, l } = useLang();
  const { push } = useToast();
  const ar = lang === "ar";
  useBodyLock(open);
  const [step, setStep] = useState<"details" | "sent">("details");
  const [customer, setCustomer] = useState<OrderCustomer>({ name: "", phone: "", additionalPhone: "", city: "", address: "", note: "" });
  const [errors, setErrors] = useState<{ name?: boolean; phone?: boolean; additionalPhone?: boolean; city?: boolean; address?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingRef = useRef<{digest:string; key:string} | null>(null);
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<{ id: string; tracking: string; total: number; message: string } | null>(null);
  const quoteInput = { city: customer.city, ...(coupon.trim() ? { coupon: coupon.trim().toUpperCase() } : {}), items: lines.map(({ productId, ml, qty }) => ({ productId, ml, qty })) };
  const quoteSignature = JSON.stringify(quoteInput);
  const activeQuote = quote?.signature === quoteSignature ? quote : null;
  const displayedSubtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  useEffect(() => {
    if (!open) return;
    setStep("details"); setConfirmation(null); setQuote(null); setErrors({}); setQuoteState("idle");
  }, [open]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !submittingRef.current) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Refresh the server's price, discount and shipping whenever the order changes.
  useEffect(() => {
    if (!open || step !== "details" || !customer.city || !lines.length) { setQuoteState("idle"); return; }
    const controller = new AbortController();
    setQuoteState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: quoteSignature, signal: controller.signal });
        if (!response.ok) throw new Error("quote unavailable");
        const result = await response.json();
        if (!controller.signal.aborted) { setQuote({ ...result, signature: quoteSignature }); setQuoteState("ready"); }
      } catch { if (!controller.signal.aborted) { setQuote(null); setQuoteState("error"); } }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, step, quoteSignature, quoteAttempt, customer.city, lines.length]);

  const set = (key: keyof OrderCustomer, value: string) => setCustomer((previous) => ({ ...previous, [key]: value }));
  const validPhone = (phone: string) => /^[+\d\s()-]{8,30}$/.test(phone.trim()) && phone.replace(/\D/g, "").length >= 8;
  const validate = () => {
    const next = { name: customer.name.trim().length < 2, phone: !validPhone(customer.phone), additionalPhone: Boolean(customer.additionalPhone?.trim()) && !validPhone(customer.additionalPhone ?? ""), city: !customer.city, address: customer.address.trim().length < 6 };
    setErrors(next);
    if (Object.values(next).some(Boolean)) push(ar ? "راجع البيانات المطلوبة وأرقام الموبيل." : "Check the required details and mobile numbers.", "error");
    return !Object.values(next).some(Boolean);
  };
  const orderText = () => {
    const pricedLines = activeQuote ? lines.map((line) => ({ ...line, price: activeQuote.prices.find((p) => p.productId === line.productId && p.ml === line.ml)?.price ?? line.price })) : lines;
    return cartMessage(pricedLines, lang, settings, customer) + (activeQuote ? `\n${ar ? "الشحن" : "Shipping"}: ${formatPrice(activeQuote.shipping, lang)}\n${ar ? "الخصم" : "Discount"}: ${formatPrice(activeQuote.discount, lang)}\n${ar ? "الإجمالي شامل الشحن" : "Total including shipping"}: ${formatPrice(activeQuote.total, lang)}` : "");
  };
  const copyOrder = async () => {
    const ok = await copyText(confirmation?.message ?? orderText());
    push(ok ? t("cart.copied") : (ar ? "تعذر نسخ الطلب." : "Could not copy the order."), ok ? "success" : "error");
  };
  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || !validate() || !activeQuote || quoteState !== "ready" || !lines.length) return;
    submittingRef.current = true; setSubmitting(true);
    try {
      const body = JSON.stringify({ customer, ...(coupon.trim() ? { coupon: coupon.trim().toUpperCase() } : {}), expectedShipping: activeQuote.shipping, expectedDiscount: activeQuote.discount, items: lines.map(({ productId, ml, qty }) => ({ productId, ml, qty, expectedPrice: activeQuote.prices.find((p) => p.productId === productId && p.ml === ml)!.price })) });
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))), (byte) => byte.toString(16).padStart(2, "0")).join("");
      let pending = pendingRef.current;
      try { pending = pending ?? JSON.parse(sessionStorage.getItem("malika.pendingOrder") || "null"); } catch { /* memory fallback */ }
      if (!pending || pending.digest !== digest) {
        pending = { digest, key: crypto.randomUUID() }; pendingRef.current = pending;
        try { sessionStorage.setItem("malika.pendingOrder", JSON.stringify(pending)); } catch { /* retain key in memory */ }
      }
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key }, body });
      const result = await response.json();
      if (response.status === 409) {
        setQuote(null); setQuoteState("loading"); setQuoteAttempt((value) => value + 1);
        push(ar ? "تغير السعر أو الشحن أو المخزون. راجع الإجمالي المحدث قبل إعادة الطلب." : "Price, shipping or stock changed. Review the updated total before retrying.", "error");
        return;
      }
      if (!response.ok) throw new Error("Order failed");
      const message = `${ar ? "رقم الطلب" : "Order"}: ${result.id}\n${orderText()}`;
      setConfirmation({ id: result.id, tracking: result.trackingToken, total: result.total, message });
      setStep("sent"); closeCart(); clear();
      pendingRef.current = null; try { sessionStorage.removeItem("malika.pendingOrder"); } catch { /* no action needed */ }
      push(ar ? "تم تسجيل طلبك بنجاح." : "Your order was placed successfully.");
    } catch { push(ar ? "تعذر حفظ الطلب، حاول مجدداً." : "Could not save the order. Please try again.", "error"); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  const close = () => { if (!submittingRef.current) onClose(); };
  if (!open) return null;

  return <Portal>
    <div className="fixed inset-0 z-[125] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div onClick={close} className="anim-fade absolute inset-0 bg-ink/55 backdrop-blur-sm" />
      <div className="checkout-sheet anim-pop relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[1.6rem] bg-bone shadow-2xl sm:max-h-[90vh] sm:max-w-xl sm:rounded-[1.8rem]">
        <div className="checkout-header flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div><p className="flex items-center gap-2 text-xs font-bold text-mist"><Truck className="h-4 w-4" /> {ar ? "بيانات التوصيل" : "Delivery details"}</p><h2 id="checkout-title" className="font-display mt-1 text-3xl">{step === "details" ? t("cart.detailsTitle") : (ar ? "تم تسجيل طلبك" : "Order placed")}</h2></div>
          <button type="button" onClick={close} disabled={submitting} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 transition hover:bg-ink hover:text-bone disabled:opacity-50" aria-label={t("common.close")}><X className="h-4 w-4" /></button>
        </div>
        {step === "details" ? <form onSubmit={submitOrder} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="checkout-section" aria-label={ar ? "منتجات طلبك" : "Your order items"}>
            <div className="flex items-center justify-between gap-2"><h3 className="checkout-heading">{ar ? "منتجات طلبك" : "Your items"}</h3><span className="checkout-count">{count} {t("cart.items")}</span></div>
            <div className="mt-3 space-y-2">{lines.map((line) => {
              const price = activeQuote?.prices.find((item) => item.productId === line.productId && item.ml === line.ml)?.price ?? line.price;
              return <div key={line.key} className="checkout-item"><SmartImage src={line.image} alt={l(line.name)} className="checkout-item__photo" /><div className="min-w-0 flex-1"><p className="checkout-item__name">{l(line.name)}</p><p className="mt-1 text-xs text-mist"><bdi>{line.ml} {ar ? "مل" : "ml"}</bdi> · {ar ? "الكمية" : "Qty"}: {line.qty}</p></div><strong className="checkout-item__price">{formatPrice(price * line.qty, lang)}</strong></div>;
            })}</div>
          </section>
          <fieldset disabled={submitting} className="checkout-section mt-4 space-y-3 disabled:opacity-70">
            <legend className="sr-only">{ar ? "بيانات التوصيل" : "Delivery details"}</legend>
            <h3 className="checkout-heading">{ar ? "بيانات التوصيل" : "Delivery details"}</h3>
            <label className="checkout-field"><span>{t("cart.fullName")} *</span><input value={customer.name} onChange={(e) => set("name", e.target.value)} className={cn("field", errors.name && "border-rose-400 bg-rose-50")} autoComplete="name" aria-invalid={!!errors.name} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="checkout-field"><span>{ar ? "رقم الموبيل" : "Mobile number"} *</span><input type="tel" value={customer.phone} onChange={(e) => set("phone", e.target.value)} className={cn("field", errors.phone && "border-rose-400 bg-rose-50")} inputMode="tel" dir="ltr" autoComplete="tel" aria-invalid={!!errors.phone} /></label>
              <label className="checkout-field"><span>{ar ? "رقم إضافي (اختياري)" : "Additional number (optional)"}</span><input type="tel" value={customer.additionalPhone ?? ""} onChange={(e) => set("additionalPhone", e.target.value)} className={cn("field", errors.additionalPhone && "border-rose-400 bg-rose-50")} inputMode="tel" dir="ltr" aria-invalid={!!errors.additionalPhone} /></label>
            </div>
            <label className="checkout-field"><span>{t("cart.city")} *</span><select value={customer.city} onChange={(e) => set("city", e.target.value)} className={cn("field", errors.city && "border-rose-400 bg-rose-50")} aria-invalid={!!errors.city}><option value="">{t("cart.cityPh")}</option>{governorates.map((governorate) => <option key={governorate.en} value={governorate.en}>{l(governorate)}</option>)}</select></label>
            <label className="checkout-field"><span>{t("cart.address")} *</span><textarea value={customer.address} onChange={(e) => set("address", e.target.value)} rows={2} className={cn("field resize-y", errors.address && "border-rose-400 bg-rose-50")} placeholder={t("cart.addressPh")} autoComplete="street-address" aria-invalid={!!errors.address} /></label>
            <label className="checkout-field"><span>{t("cart.noteField")}</span><input value={customer.note} onChange={(e) => set("note", e.target.value)} className="field" placeholder={t("cart.notePh")} /></label>
            <label className="checkout-field"><span>{ar ? "كود الخصم (اختياري)" : "Coupon code (optional)"}</span><input className="field" value={coupon} maxLength={40} onChange={(e) => setCoupon(e.target.value)} dir="ltr" /></label>
          </fieldset>
          <section className="checkout-section mt-4" aria-label={ar ? "ملخص الحساب" : "Order summary"}>
            <h3 className="checkout-heading">{ar ? "ملخص الحساب" : "Order summary"}</h3>
            <div className="checkout-totals mt-3"><div><span>{ar ? "المنتجات" : "Subtotal"}</span><b>{formatPrice(activeQuote?.subtotal ?? displayedSubtotal, lang)}</b></div>
              {activeQuote && activeQuote.discount > 0 && <div><span>{ar ? "الخصم" : "Discount"}</span><b>− {formatPrice(activeQuote.discount, lang)}</b></div>}
              <div><span>{ar ? "الشحن" : "Shipping"}</span><b>{activeQuote ? formatPrice(activeQuote.shipping, lang) : (ar ? "بعد اختيار المحافظة" : "Choose a governorate")}</b></div>
              {activeQuote && <div className="checkout-total"><span>{ar ? "الإجمالي" : "Total"}</span><b>{formatPrice(activeQuote.total, lang)}</b></div>}
            </div>
            {quoteState === "loading" && <p role="status" className="mt-2 text-xs text-mist">{ar ? "جاري حساب الشحن والإجمالي…" : "Calculating shipping and total…"}</p>}
            {quoteState === "error" && <p role="alert" className="mt-2 text-xs text-rose-700">{ar ? "تعذر حساب الشحن أو الكوبون غير صالح. راجع المحافظة والكود." : "Could not calculate shipping or the coupon is invalid. Check the governorate and code."}</p>}
            <p className="checkout-payment"><Check className="h-4 w-4 shrink-0" /> {ar ? "الدفع عند الاستلام" : "Cash on delivery"}</p>
          </section>
          <div className="checkout-actions sticky bottom-0 -mx-4 mt-4 grid gap-2 border-t border-ink/10 bg-bone/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-5 sm:px-5">
            <Button type="submit" disabled={submitting || !activeQuote || quoteState !== "ready" || !lines.length} variant="acid" full size="lg">{submitting ? (ar ? "جاري إتمام الطلب…" : "Placing order…") : (ar ? "إتمام الطلب" : "Place order")}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={submitting || !lines.length} onClick={copyOrder} icon={<Copy className="h-4 w-4" />} iconPosition="start">{ar ? "نسخ الطلب" : "Copy order"}</Button>
          </div>
        </form> : <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-acid"><Check className="h-7 w-7 text-ink" /></span>
          <h3 className="font-display mt-4 text-3xl">{ar ? "تم تسجيل طلبك" : "Order placed"}</h3>
          <p className="mt-2 text-sm text-mist">{ar ? "شكرًا لك، تم تسجيل طلبك بنجاح." : "Thank you. Your order has been placed."}</p>
          {confirmation && <><p className="mt-3 text-xs text-mist">{ar ? "رقم الطلب" : "Order"}: <bdi>{confirmation.id}</bdi></p><p className="mt-2 font-bold">{ar ? "الإجمالي المؤكد" : "Confirmed total"}: {formatPrice(confirmation.total, lang)}</p><a className="mt-4 underline" href={`#/track/${confirmation.tracking}`}>{ar ? "تتبع طلبك — احفظ الرابط" : "Track your order — save this link"}</a><Button variant="outline" className="mt-5" onClick={copyOrder} icon={<Copy className="h-4 w-4" />} iconPosition="start">{ar ? "نسخ الطلب" : "Copy order"}</Button></>}
        </div>}
      </div>
    </div>
  </Portal>;
}
