import { Reveal } from "@/components/ui/Reveal";
import { ArrowUpRight, Messenger, Sparkle, Whatsapp } from "@/components/ui/icons";
import { useStore } from "@/context/StoreContext";
import { useLang } from "@/i18n/LanguageContext";
import { useContent } from "@/hooks/useContent";
import { openChannel, messengerUrl, whatsappUrl } from "@/lib/messaging";

export function ContactCTA() {
  const { t, x } = useLang();
  const { c, lc } = useContent();
  const { settings } = useStore();
  const greeting = x("Hello VLOR, help me choose my signature scent 🌿", "مرحباً ڨلور، ساعدوني في اختيار عطري المميّز 🌿");

  return (
    <section className="cv-auto relative bg-bone sec-pb">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="section-card grain relative overflow-hidden rounded-[2rem] bg-ink px-6 py-10 text-bone sm:rounded-[2.5rem] sm:px-10 lg:px-14 lg:py-14">
            <div className="pointer-events-none absolute -start-20 bottom-0 h-80 w-80 rounded-full bg-plum blur-[90px]" />
            <div className="pointer-events-none absolute end-0 top-0 h-72 w-72 rounded-full bg-lilac/20 blur-[100px]" />

            <div className="relative">
              <div>
                <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-acid">
                  <Sparkle className="h-3.5 w-3.5" /> {lc(c.cta.eyebrow)}
                </span>
                <h2 className="hd-section font-display mt-3 max-w-xl leading-[1] tracking-tight">
                  {lc(c.cta.title)}
                </h2>
                <p className="lead-copy mt-3 max-w-md text-bone/55">{lc(c.cta.lead)}</p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => openChannel(whatsappUrl(settings.whatsapp, greeting))}
                    className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-acid px-6 text-[12px] font-bold text-ink transition hover:bg-acid-deep"
                  >
                    <Whatsapp className="h-4 w-4" />
                    {t("cta.whatsapp")}
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                  <button
                    onClick={() => openChannel(messengerUrl(settings.messenger))}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full border border-bone/20 px-6 text-[12px] font-bold text-bone transition hover:border-bone/50 hover:bg-bone/5"
                  >
                    <Messenger className="h-4 w-4" />
                    {t("cta.messenger")}
                  </button>
                </div>

                <p className="mt-6 max-w-md text-[10px] font-semibold leading-relaxed tracking-wide text-bone/45">
                  {x("Personal guidance from the first note to your final choice.", "إرشاد شخصي، من أول نوتة حتى اختيارك الأخير.")}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
