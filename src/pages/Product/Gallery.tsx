import { productImages } from "@/lib/productImages";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import "@/styles/product-gallery.css";

const SLIDE_DELAY = 5000;
const SWIPE_THRESHOLD = 48;

export function Gallery({ product, selectedSize }: { product: Product; selectedSize?:number }) {
  const { l, lang, x } = useLang();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [loadedSrc, setLoadedSrc] = useState("");
  const [stock, setStock] = useState<{id:string; state:"loading"|"ready"|"error"; rows:{image:string;size:number;available:number}[]}>({id:product.id,state:"loading",rows:[]});
  const [zoomPoint, setZoomPoint] = useState<{ x: number; y: number } | null>(null);
  const images = productImages(product);
  const count = images.length;
  const activeIndex = count ? Math.min(index, count - 1) : 0;
  const src = images[activeIndex];
  const size = selectedSize ?? (product.sizes?.find(item => item.ml === 50) ?? product.sizes?.[0])?.ml;
  const availability = stock.id === product.id && stock.state === "ready" ? stock.rows : [];
  const unavailable = (url:string) => availability.some(row => row.image === url && row.size === size && row.available === 0);

  useEffect(() => {
    const controller = new AbortController();
    setStock({id:product.id,state:"loading",rows:[]});
    fetch(`/api/products/${encodeURIComponent(product.id)}/image-stock`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const rows=await r.json();if(!Array.isArray(rows))throw Error();return rows;}).then(rows=>{if(!controller.signal.aborted)setStock({id:product.id,state:"ready",rows});}).catch(()=>{if(!controller.signal.aborted)setStock({id:product.id,state:"error",rows:[]});});
    return ()=>controller.abort();
  },[product.id]);

  useEffect(() => { setIndex(0); setZoomPoint(null); touchStart.current = null; setTouching(false); }, [product.id]);
  useEffect(() => { setZoomPoint(null); }, [src]);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const onChange = () => { if (media.matches) setPlaying(false); };
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  useEffect(() => {
    if (count < 2 || !playing || hovered || focused || touching || !visible) return;
    const timer = window.setTimeout(() => setIndex((previous) => (Math.min(previous, count - 1) + 1) % count), SLIDE_DELAY);
    return () => window.clearTimeout(timer);
  }, [activeIndex, count, playing, hovered, focused, touching, visible]);

  const select = (next: number) => {
    if (!count) return;
    setIndex((next + count) % count);
    setZoomPoint(null);
  };
  const cancelTouch = (pointerId?: number) => {
    if (touchStart.current && (pointerId === undefined || touchStart.current.id === pointerId)) {
      touchStart.current = null;
      setTouching(false);
    }
  };
  const startTouch = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || count < 2) return;
    // Do not turn multi-touch or pinch gestures into a slide change.
    if (!event.isPrimary) { cancelTouch(); return; }
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setTouching(true);
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Capture may not be available. */ }
  };
  const endTouch = (event: PointerEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    if (event.pointerType !== "touch" || !start || start.id !== event.pointerId) return;
    cancelTouch(event.pointerId);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.3) {
      select(activeIndex + (dx < 0 ? 1 : -1));
    }
  };
  const moveZoom = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !src || loadedSrc !== src) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setZoomPoint({
      x: Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.min(100, Math.max(0, (event.clientY - rect.top) / rect.height * 100)),
    });
  };
  const zoomStyle = zoomPoint ? { "--zoom-x": `${zoomPoint.x}%`, "--zoom-y": `${zoomPoint.y}%` } as CSSProperties : undefined;

  return (
    <section className="product-gallery" aria-label={x("Product image gallery", "معرض صور المنتج")}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") { setHovered(false); setZoomPoint(null); } }}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="product-gallery__stage" data-swipe={count > 1}
        onPointerDown={startTouch} onPointerUp={endTouch} onPointerCancel={(event) => cancelTouch(event.pointerId)}
        onLostPointerCapture={(event) => cancelTouch(event.pointerId)} onPointerMove={moveZoom}
        onPointerLeave={(event) => { setZoomPoint(null); if (event?.pointerType === "touch") cancelTouch(event.pointerId); }}>
        <div className="product-gallery__halo" aria-hidden="true" />
        <div className="product-gallery__zoom-layer" data-zoomed={Boolean(zoomPoint && loadedSrc === src)} style={zoomStyle}>
          <ProductPhoto key={src ?? "empty"} src={src} alt={l(product.name)} className="product-gallery__image" onLoad={() => setLoadedSrc(src ?? "")} onError={() => setLoadedSrc("")} fallback={<div className="product-gallery__fallback">
            <p>{x("Fragrance", "عطر")}</p>
            <h2>{l(product.name)}</h2>
            <p>{l(product.tagline)}</p>
          </div>} />
        </div>
        {src && unavailable(src) && <span className="product-gallery__availability" role="status">{lang === "ar" ? `غير متوفر · ${size} مل` : `Out of stock · ${size} ml`}</span>}
        {count > 0 && <span className="product-gallery__counter" dir="ltr" aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>}
        {src && loadedSrc === src && <span className="product-gallery__zoom-hint" aria-hidden="true">{x("Hover to zoom", "حرّك المؤشر للتكبير")}</span>}
        {count > 1 && <span className="product-gallery__swipe-hint" aria-hidden="true">{x("Swipe to see more", "اسحب لمشاهدة الصور")}</span>}
      </div>

      {stock.id === product.id && stock.state === "error" && <p role="status" className="mt-2 text-xs text-mist">{lang === "ar" ? "تعذر تحميل حالة الصور." : "Could not load image availability."}</p>}
      {availability.length > 0 && <p className="mt-2 text-xs leading-relaxed text-mist">{lang === "ar" ? "حالة الصور حسب الكميات المسجلة يدويًا؛ مخزون المنتج يُراجع عند الطلب." : "Image availability is manually maintained; product stock is checked at checkout."}</p>}
      {count > 1 && <>
        <p className="sr-only" aria-live={playing && !focused && !hovered ? "off" : "polite"}>{`${x("Image", "الصورة")} ${activeIndex + 1} ${x("of", "من")} ${count}`}</p>
        <div className="product-gallery__toolbar">
          <span className="product-gallery__label">{x("Explore the details", "استعرض تفاصيل العطر")}</span>
          <div className="product-gallery__controls">
            <button data-analytics="gallery" type="button" onClick={() => select(activeIndex - 1)} aria-label={x("Previous image", "الصورة السابقة")}>{lang === "ar" ? "→" : "←"}</button>
            <button data-analytics="gallery" type="button" onClick={() => select(activeIndex + 1)} aria-label={x("Next image", "الصورة التالية")}>{lang === "ar" ? "←" : "→"}</button>
            <button data-analytics="gallery" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? x("Pause automatic image rotation", "إيقاف تغيير الصور تلقائياً") : x("Play automatic image rotation", "تشغيل تغيير الصور تلقائياً")} aria-pressed={!playing}>{playing ? "Ⅱ" : "▶"}</button>
          </div>
        </div>
        <div className="product-gallery__thumbnails" role="group" aria-label={x("Choose an image", "اختر صورة")}>
          {images.map((image, i) => <button data-analytics="gallery" type="button" key={`${image}-${i}`} onClick={() => select(i)} aria-pressed={activeIndex === i} aria-label={`${x("Image", "الصورة")} ${i + 1}${i === 0 ? ` · ${x("Main", "الأساسية")}` : ""}${unavailable(image) ? ` · ${x("Out of stock", "غير متوفر")} · ${size} ml` : ""}`}>
            <img src={image} alt="" loading="lazy" decoding="async" />
            {unavailable(image) && <span className="product-gallery__thumbnail-status">{lang === "ar" ? "غير متوفر" : "Sold out"}</span>}
          </button>)}
        </div>
      </>}
    </section>
  );
}
