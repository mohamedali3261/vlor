import { Logo } from "@/components/ui/Primitives";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { useLang } from "@/i18n/LanguageContext";
import { formatPrice } from "@/lib/format";
import { Link } from "@/lib/router";
import { runwayWheel } from "@/lib/runwayScroll";
import { emitBagPulse } from "@/motion";
import type { Product } from "@/types";
import { cn } from "@/utils/cn";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "@/styles/runway-lookbook.css";

// Exact 7-stop depth table from d = -1 (leaving past rail) to d = 5 (arriving from haze)
const KX = [1.2, 0.744, 0.496, 0.346, 0.235, 0.15, 0.085] as const;
const KF = [1.14, 0.89, 0.777, 0.704, 0.651, 0.616, 0.59] as const;
const KH = [1.18, 0.832, 0.574, 0.436, 0.334, 0.258, 0.19] as const;
const KB = [0, 0, 1.5, 4, 8, 12, 17] as const;
const KO = [1, 1, 1, 1, 0.86, 0.5, 0] as const;

const BOTTLE_ASPECT = 0.54;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

interface RailEntry {
  key: string;
  product: Product;
  ml: number;
  price: number;
  badge: string;
}

export function RunwayLookbook() {
  const { lang, l, t, x, dir } = useLang();
  const { products, wishlist, toggleWishlist, isWished } = useStore();
  const { count: cartCount, add, open: openCart } = useCart();
  const { push } = useToast();

  // Each displayed scent has one synchronized runway and rail position.
  const { lookProducts, railItems } = useMemo(() => {
    const lookProducts = products.filter((product) => product.showOnHome !== false)
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    const railItems = lookProducts.map((product): RailEntry => {
      const size = product.sizes.find((s) => s.ml === 50) ?? product.sizes[0] ?? { ml: 50, price: product.price };
      return { key: product.id, product, ml: size.ml, price: size.price, badge: `${size.ml} ${lang === "ar" ? "مل" : "ml"}` };
    });
    return { lookProducts, railItems };
  }, [products, lang]);

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const modelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const decoded = true;
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);

  // Single float `p` & animation refs (never trigger React renders per frame)
  const animRef = useRef({
    W: 0,
    H: 0,
    base: 0,
    cardS: 0,
    side: false,
    dirty: true,
    p: 0,
    target: 0,
    last: 0,
    mx: 0,
    my: 0,
    cx: 0,
    cy: 0,
    down: false,
    pointerId: -1,
    sx: 0,
    st: 0,
    moved: 0,
    wheelTimer: 0,
    inView: true,
    calm: false,
    filterCache: [] as string[],
    opacityCache: [] as string[],
  });

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const rail = railRef.current;
    if (!stage || !rail) return;

    const s = animRef.current;
    s.W = stage.clientWidth;
    s.H = stage.clientHeight;
    s.base = s.H * 1.2;
    s.target = clamp(s.target, 0, Math.max(0, lookProducts.length - 1));
    s.p = clamp(s.p, 0, Math.max(0, lookProducts.length - 1));
    s.side = window.innerWidth <= 820;

    for (let i = 0; i < lookProducts.length; i++) {
      const el = modelRefs.current[i];
      if (!el) continue;
      el.style.width = `${(s.base * BOTTLE_ASPECT).toFixed(1)}px`;
      el.style.height = `${s.base.toFixed(1)}px`;
    }

    s.cardS = s.side ? 160 : rail.clientHeight / 3;
    for (let i = 0; i < cardRefs.current.length; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      card.style.height = s.side ? "100%" : `${s.cardS.toFixed(2)}px`;
    }

    s.dirty = true;
  }, [lookProducts.length]);

  const paint = useCallback(() => {
    const s = animRef.current;
    const N = lookProducts.length;
    if (s.W === 0 || s.H === 0 || N === 0) return;
    // Disable expensive blur on coarse pointers / narrow screens for 60fps
    const disableBlur = s.side || s.W < 820;

    for (let i = 0; i < N; i++) {
      const el = modelRefs.current[i];
      if (!el) continue;

      const d = i - s.p;
      if (d < -1) {
        el.style.opacity = "0";
        s.opacityCache[i] = "0";
        continue;
      }

      const k = clamp(d + 1, 0, 6);
      const a = Math.floor(k);
      const b = Math.min(6, a + 1);
      const tMix = k - a;
      const mix = (arr: readonly number[]) => arr[a] + (arr[b] - arr[a]) * tMix;

      const h = mix(KH) * s.H;
      const scale = h / Math.max(1, s.base);
      const w = h * BOTTLE_ASPECT;
      const px = mix(KX) * s.W - w / 2;
      const py = mix(KF) * s.H - h;

      el.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;

      const opacityStr = mix(KO).toFixed(3);
      const filterStr = disableBlur ? "none" : (() => {
        const blurVal = mix(KB) / Math.max(0.05, scale);
        return blurVal < 0.2 ? "none" : `blur(${blurVal.toFixed(1)}px)`;
      })();

      if (filterStr !== s.filterCache[i]) {
        s.filterCache[i] = filterStr;
        el.style.filter = filterStr;
      }
      if (opacityStr !== s.opacityCache[i]) {
        s.opacityCache[i] = opacityStr;
        el.style.opacity = opacityStr;
      }
      el.style.zIndex = String(100 - Math.round(d * 10));
    }

    const itemCount = cardRefs.current.length;
    if (itemCount > 0 && s.cardS > 0) {
      for (let i = 0; i < itemCount; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const pos = i * s.cardS - s.p * s.cardS;
        card.style.transform = s.side
          ? `translate3d(${pos.toFixed(1)}px,0,0)`
          : `translate3d(0,${pos.toFixed(1)}px,0)`;
      }
    }

    const nextIdx = Math.round(clamp(s.p, 0, N - 1));
    if (nextIdx !== activeIdxRef.current) {
      activeIdxRef.current = nextIdx;
      setActiveIdx(nextIdx);
    }
  }, [lookProducts.length]);

  // Viewport observer + rAF loop + resize listener
  useEffect(() => {
    const s = animRef.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.calm = mq.matches;
    const onMq = () => {
      s.calm = mq.matches;
      if (s.calm) paint();
    };
    mq.addEventListener("change", onMq);

    measure();
    paint();

    window.addEventListener("resize", measure);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sectionRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(sectionRef.current);
    }

    let raf = 0;
    let stopped = false;
    const schedule = () => {
      if (stopped || raf) return;
      raf = window.requestAnimationFrame(loop);
    };
    const loop = (now: number) => {
      raf = 0;
      if (!s.inView || document.hidden) {
        stopped = true;
        return;
      }
      const dt = Math.min(50, now - s.last) || 16;
      s.last = now;
      const was = s.p;
      if (s.calm) s.p = s.target;
      else s.p += (s.target - s.p) * (1 - Math.exp(-dt * 0.0072));
      if (Math.abs(s.target - s.p) < 0.0004) s.p = s.target;
      if (s.p !== was || s.dirty) {
        s.dirty = false;
        paint();
      }
      s.cx += (s.mx - s.cx) * 0.32;
      s.cy += (s.my - s.cy) * 0.32;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${s.cx.toFixed(1)}px,${s.cy.toFixed(1)}px,0)`;
      }
      raf = window.requestAnimationFrame(loop);
    };
    // Initial start
    raf = window.requestAnimationFrame(loop);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined" && sectionRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const nowIn = entries.some((e) => e.isIntersecting);
          s.inView = nowIn;
          if (nowIn && stopped) {
            stopped = false;
            s.last = performance.now();
            schedule();
          } else if (!nowIn) {
            // Pause loop when out of view
            if (raf) {
              window.cancelAnimationFrame(raf);
              raf = 0;
            }
            stopped = true;
          }
        },
        { rootMargin: "200px 0px" }
      );
      io.observe(sectionRef.current);
    }

    const onVisibility = () => {
      if (!document.hidden && s.inView && stopped) {
        stopped = false;
        s.last = performance.now();
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(s.wheelTimer);
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [measure, paint, lookProducts.length]);

  // Both the stage and rail yield to native page scrolling at the ends.
  useEffect(() => {
    const stage = stageRef.current;
    const rail = railRef.current;
    if (!stage || !rail) return;
    const s = animRef.current;
    const last = lookProducts.length - 1;
    const onWheel = (event: WheelEvent) => {
      const delta = (event.deltaY + event.deltaX) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
      const { target, consume } = runwayWheel(s.target, last, delta);
      s.target = target;
      if (!consume) return;
      event.preventDefault();
      window.clearTimeout(s.wheelTimer);
      s.wheelTimer = window.setTimeout(() => {
        s.target = clamp(delta > 0 ? Math.ceil(s.target) : Math.floor(s.target), 0, last);
      }, 150);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      rail.removeEventListener("wheel", onWheel);
      window.clearTimeout(s.wheelTimer);
    };
  }, [lookProducts.length]);

  const stepBy = (delta: number) => {
    animRef.current.target = clamp(Math.round(animRef.current.target) + delta, 0, lookProducts.length - 1);
  };

  const onStagePointerEnter = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") ringRef.current?.classList.add("is-show");
  };

  const onStagePointerLeave = () => {
    ringRef.current?.classList.remove("is-show");
  };

  const onStagePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest("a, button")) return;
    const s = animRef.current;
    s.down = true;
    s.pointerId = e.pointerId;
    s.sx = e.clientX;
    s.st = s.target;
    s.moved = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    ringRef.current?.classList.add("is-drag");
  };

  const onStagePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = animRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    s.mx = e.clientX - r.left;
    s.my = e.clientY - r.top;
    if (!s.down || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.sx;
    s.moved = Math.max(s.moved, Math.abs(dx));
    const pull = Math.max(150, s.W * 0.2);
    s.target = clamp(s.st + dx / pull, 0, lookProducts.length - 1);
  };

  const onStagePointerRelease = (e: ReactPointerEvent<HTMLElement>) => {
    const s = animRef.current;
    if (!s.down || s.pointerId !== e.pointerId) return;
    s.down = false;
    ringRef.current?.classList.remove("is-drag");

    if (s.moved < 6) {
      const hit = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((node) => node.classList?.contains("rl-m")) as HTMLElement | undefined;
      if (hit && hit.dataset.i !== undefined) {
        s.target = clamp(Number(hit.dataset.i), 0, lookProducts.length - 1);
      }
    } else {
      s.target = Math.round(s.target);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      stepBy(-1);
    }
  };

  const handleToggleFav = (product: Product) => {
    const saved = toggleWishlist(product.id);
    push(saved ? t("product.saved") : t("product.unsaved"), saved ? "success" : "info");
  };

  const handleAddToCart = (entry: RailEntry) => {
    add(entry.product, entry.ml, entry.price, 1);
    emitBagPulse();
    push(`${l(entry.product.name)} (${entry.badge}) · ${t("product.added")}`);
  };

  if (lookProducts.length === 0) return null;

  const activeProduct = lookProducts[activeIdx] ?? lookProducts[0];

  return (
    <section
      ref={sectionRef}
      id="runway-lookbook"
      className="rl-section scroll-mt-[72px]"
      aria-label={x("Runway Depth Lookbook", "منصّة العرض العميق لعطور ڨلور")}
    >
      {/* Editorial Runway Header */}
      <div className="rl-header" dir="ltr">
        <div className="rl-r1">
          <Link to="/shop" dir="ltr" aria-label={x("VLOR shop", "متجر ڨلور")}>
            <Logo compact className="rl-brand" />
          </Link>

          <nav className="rl-tabs rl-wide rl-wide-i18n" aria-label={x("Runway navigation", "تنقّل المنصّة")}>
            <span className="is-on">{x("Runway", "منصّة العرض")}</span>
            <Link to="/contact">{x("Contact", "تواصل")}</Link>
            <Link to="/wishlist">{x("Saved", "المفضلة")}</Link>
            <Link to="/shop">{x("Shop", "المتجر")}</Link>
          </nav>

          <div className="rl-acct rl-wide rl-wide-i18n">
            <Link to="/shop" className="rl-acct-icon rl-acct-hide-sm" aria-label={x("Search scents", "بحث")}>
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
            </Link>

            <Link
              to="/wishlist"
              className="rl-acct-icon pcard-chip"
              aria-label={x("Saved scents", "صفحة المفضلة")}
            >
              <svg
                viewBox="0 0 24 24"
                style={
                  wishlist.length > 0
                    ? { fill: "#d8a7a0", stroke: "#b98179" }
                    : undefined
                }
              >
                <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
              </svg>
              {wishlist.length > 0 && <span className="rl-acct-badge">{wishlist.length}</span>}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="rl-acct-icon rl-acct-hide-sm pcard-chip"
              aria-label={t("nav.cart")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M5 8h14l1 13H4Z" />
                <path d="M9 10V6a3 3 0 0 1 6 0v4" />
              </svg>
            </button>

            <button
              type="button"
              onClick={openCart}
              className="pcard-chip pcard-keep"
            >
              {x("Cart", "السلة")} (<span dir="ltr">{cartCount}</span>)
            </button>
          </div>
        </div>

        <nav className="rl-r2 rl-wide rl-wide-i18n" aria-label={x("Fragrance families", "العائلات العطرية")}>
          <Link to="/shop">{x("All perfumes", "كل العطور")}</Link>
          <Link to="/shop">{t("shop.all")}</Link>
          <Link to="/wishlist">{x("Saved List", "قائمة المفضلة")}</Link>
        </nav>
      </div>

      {/* Runway Stage + Synchronized Product Rail */}
      <div className="rl-main">
        <section
          ref={stageRef}
          className="rl-stage"
          tabIndex={0}
          aria-label={x(
            "Runway scents. Drag, scroll or use the arrow keys to change scent.",
            "عطور العرض. اسحب أو مرّر أو استخدم الأسهم لتغيير العطر."
          )}
          onKeyDown={onKeyDown}
          onPointerEnter={onStagePointerEnter}
          onPointerLeave={onStagePointerLeave}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerRelease}
          onPointerCancel={onStagePointerRelease}
        >
          <div className="rl-line">
            {lookProducts.map((product, i) => (
              <div
                key={`${product.id}-${i}`}
                ref={(el) => {
                  modelRefs.current[i] = el;
                }}
                data-i={i}
                className="rl-m"
              >
                <div className="rl-text-flacon"><span>{l(product.name)}</span></div>
              </div>
            ))}
          </div>

          <div className="rl-intro" dir={dir}>
            <p>
              {x("Explore the collection. Drag, scroll or use the arrows to discover each scent.", "اكتشف المجموعة. اسحب أو مرّر أو استخدم الأسهم لتتعرّف على العطور.")}
            </p>
          </div>

          <div className="rl-tag" dir={dir}>
            {activeProduct && (
              <div className="rl-active-scent">
                <p className="rl-active-name">{l(activeProduct.name)}</p>
                <p className="rl-active-notes">
                  {l(activeProduct.tagline)} · {formatPrice(activeProduct.price, lang)}
                </p>
              </div>
            )}

            <div className="rl-actions-row">
              <Link
                to={activeProduct ? `/product/${activeProduct.slug}` : "/shop"}
                className="rl-shop rl-wide rl-wide-i18n"
              >
                {x("Shop the scent", "تسوّق هذا العطر")}
              </Link>

              <div className="rl-step-btns" dir="ltr">
                <button
                  type="button"
                  onClick={() => stepBy(-1)}
                  className="rl-step-btn pcard-chip"
                  aria-label={x("Previous scent", "العطر السابق")}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => stepBy(1)}
                  className="rl-step-btn pcard-chip"
                  aria-label={x("Next scent", "العطر التالي")}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div ref={ringRef} className="rl-ring" />
        </section>

        {/* Synchronized Product Rail */}
        <aside
          ref={railRef}
          className="rl-rail"
          aria-label={x("Perfumes in the collection", "عطور المجموعة")}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement | null)?.closest("a, button")) return;
            const s = animRef.current;
            s.down = true;
            s.pointerId = e.pointerId;
            s.sx = animRef.current.side ? e.clientX : e.clientY;
            s.st = s.target;
            s.moved = 0;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const s = animRef.current;
            if (!s.down || s.pointerId !== e.pointerId) return;
            const cur = s.side ? e.clientX : e.clientY;
            const delta = s.sx - cur;
            s.moved = Math.max(s.moved, Math.abs(delta));
            s.target = clamp(s.st + delta / Math.max(120, s.cardS), 0, lookProducts.length - 1);
          }}
          onPointerUp={(e) => {
            const s = animRef.current;
            if (!s.down || s.pointerId !== e.pointerId) return;
            s.down = false;
            if (s.moved >= 6) s.target = Math.round(s.target);
          }}
          onPointerCancel={(e) => {
            const s = animRef.current;
            if (s.pointerId === e.pointerId) {
              s.down = false;
              s.target = Math.round(s.target);
            }
          }}
        >
          {railItems.map((entry, idx) => {
            const wished = isWished(entry.product.id);
            return (
              <article
                key={entry.key}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className={cn(
                  "rl-card",
                  idx % 2 === 1 && "is-alt",
                  idx === activeIdx && "is-active"
                )}
                aria-current={idx === activeIdx ? "true" : undefined}
              >
                <button
                  type="button"
                  onClick={() => handleToggleFav(entry.product)}
                  aria-pressed={wished}
                  aria-label={`${x("Save", "حفظ")} ${l(entry.product.name)}`}
                  className="rl-fav pcard-chip"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
                  </svg>
                </button>

                <Link
                  to={`/product/${entry.product.slug}`}
                  className="rl-shot"
                  aria-label={l(entry.product.name)}
                >
                  <span className="rl-text-rail">{l(entry.product.name)}</span>
                </Link>

                <div className="rl-meta" dir={dir}>
                  <Link to={`/product/${entry.product.slug}`}>
                    <h3 className="rl-wide rl-wide-i18n pcard-keep">{l(entry.product.name)}</h3>
                  </Link>
                  <span className="rl-meta-sub pcard-keep">
                    {formatPrice(entry.price, lang)} · {entry.badge}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(entry)}
                    aria-label={`${x("Add to bag", "أضف إلى السلة")} ${l(entry.product.name)}`}
                    className="rl-add pcard-chip"
                  />
                </div>
              </article>
            );
          })}
        </aside>
      </div>

      <div className={cn("rl-wait", decoded && "is-gone")} aria-hidden="true" />
    </section>
  );
}
