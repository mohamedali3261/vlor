import { useBrand } from "@/hooks/useBrand";
import { cn } from "@/utils/cn";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ---------- Portal (overlays must escape transformed page wrappers) ---------- */
export function Portal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;
  return createPortal(children, host);
}

/* ---------- Badge ---------- */
export function Badge({
  children,
  tone = "ink",
  className,
}: {
  children: ReactNode;
  tone?: "ink" | "acid" | "lilac" | "bone" | "glass";
  className?: string;
}) {
  const tones = {
    ink: "bg-ink text-bone",
    acid: "bg-acid text-ink",
    lilac: "bg-lilac text-ink",
    bone: "bg-bone/90 text-ink",
    glass: "glass-dark text-bone border border-white/15",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Eyebrow ---------- */
export function Eyebrow({
  children,
  className,
  light,
}: {
  children: ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.3em]",
        light ? "text-bone/60" : "text-mist",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", light ? "bg-acid" : "bg-plum")} />
      {children}
    </span>
  );
}

/* ---------- Section heading ---------- */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  action,
  align = "start",
  dark,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  action?: ReactNode;
  align?: "start" | "center" | "between";
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        align === "between" && "gap-5 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <Eyebrow light={dark}>{eyebrow}</Eyebrow>}
        <h2
          className={cn(
            "hd-section font-display mt-3 leading-[1.02] tracking-[-0.02em]",
            dark ? "text-bone" : "text-ink"
          )}
        >
          {title}
        </h2>
        {lead && (
          <p
            className={cn(
              "lead-copy mt-3 max-w-xl",
              dark ? "text-bone/65" : "text-mist",
              align === "center" && "mx-auto"
            )}
          >
            {lead}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------- Image-free placeholder ---------- */
export function SmartImage({ src, alt, className, imgClassName }: {
  src: string; fallbackSrc?: string; alt: string; className?: string;
  imgClassName?: string; sizes?: string; priority?: boolean;
}) {
  const [failed, setFailed] = useState("");
  return <div className={cn("grid place-items-center overflow-hidden bg-bone-2 text-center text-xs text-ink/60", className)}>
    {src && failed !== src ? <img src={src} alt={alt} onError={() => setFailed(src)} className={cn("h-full w-full object-contain", imgClassName)} /> : <span className="p-2">{alt}</span>}
  </div>;
}

/* ---------- Accordion ---------- */
export function Accordion({
  items,
  className,
  defaultOpen = 0,
}: {
  items: { title: string; body: ReactNode }[];
  className?: string;
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className={cn("divide-y divide-ink/10 border-y border-ink/10", className)}>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.title}>
            <button
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-5 text-start"
              aria-expanded={isOpen}
            >
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em]">{item.title}</span>
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300",
                  isOpen ? "rotate-45 border-ink bg-ink text-bone" : "border-ink/20 text-ink"
                )}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-6 pe-10 text-sm leading-relaxed text-mist">{item.body}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Brand logo ---------- */
export function Logo({ compact, className }: { light?: boolean; compact?: boolean; className?: string }) {
  const { wordmark } = useBrand();
  return <img src="/images/brand/vlor-supplied-logo.webp" alt={wordmark || "VLOR"} draggable={false} decoding="async" className={cn("brand-logo shrink-0 object-contain", compact ? "h-12 w-20" : "h-20 w-32", className)} />;
}
