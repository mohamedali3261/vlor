import { useContent } from "@/hooks/useContent";
import { Marquee } from "@/components/ui/Marquee";
import { useEffect, useState } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { Sparkle } from "@/components/ui/icons";

export function Announcement() {
  const { c, lc } = useContent();
  const { lang } = useLang();
  const [offers, setOffers] = useState<{id:string;kind:'quantity'|'amount';threshold:number;discountAmount:number}[]>([]);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort(); controller = new AbortController();
      const current = controller;
      fetch('/api/discount-rules', {signal:current.signal}).then(r => r.ok ? r.json() : []).then(data => { if (!current.signal.aborted && Array.isArray(data)) setOffers(data); }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('vlor:discounts-changed', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { controller?.abort(); window.removeEventListener('vlor:discounts-changed', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const strip = c.strips.announcement;
  const messages = c.announcements.filter((item) => {
    const english = item.en.trim().toLocaleLowerCase();
    const arabic = item.ar.trim();
    const removedPromo =
      english.includes("2 free samples with every order") ||
      english.includes("made in small batches · online") ||
      arabic.includes("عينتان مجانيتان مع كل طلب") ||
      arabic.includes("تُصنع بكميات صغيرة · أونلاين");
    return !removedPromo && lc(item).trim().length > 0;
  });

  if (!strip.enabled || (messages.length === 0 && offers.length === 0)) return null;

  return (
    <div className="relative overflow-hidden bg-ink text-bone">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(199,168,115,0.22),transparent_55%)]" />
      <Marquee
        speed={strip.speed}
        direction={strip.direction}
        pauseOnHover={false}
        draggable={false}
        className="relative h-9"
        trackClassName="h-9"
      >
        {offers.map(offer => <span key={offer.id} className="flex shrink-0 items-center gap-3 px-5 text-[10px] font-bold tracking-wide text-bone"><Sparkle className="h-3 w-3 shrink-0 text-acid" /><span className="whitespace-nowrap">{lang === 'ar' ? `خصم ${offer.discountAmount} ج.م عند شراء ${offer.kind === 'quantity' ? `${offer.threshold} زجاجات أو أكثر` : `بـ ${offer.threshold} ج.م أو أكثر`}` : `EGP ${offer.discountAmount} off ${offer.kind === 'quantity' ? `${offer.threshold}+ bottles` : `orders of EGP ${offer.threshold} or more`}`}</span></span>)}
        {messages.map((message, index) => (
          <span
            key={`${message.en}-${index}`}
            className="flex shrink-0 items-center gap-3 px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-bone/70"
          >
            <Sparkle className="h-3 w-3 shrink-0 text-acid" />
            <span className="whitespace-nowrap">{lc(message)}</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
