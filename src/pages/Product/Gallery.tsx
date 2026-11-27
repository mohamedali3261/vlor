import { productImages } from "@/lib/productImages";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";
import { useEffect, useState, type CSSProperties, type PointerEvent } from "react";
import "@/styles/product-gallery.css";

const SLIDE_DELAY = 5000;

export function Gallery({ product }: { product: Product }) {
  const { l, lang, x } = useLang();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [loadedSrc, setLoadedSrc] = useState("");
  const [zoomPoint, setZoomPoint] = useState<{ x: number; y: number } | null>(null);
  const images = productImages(product);
  const count = images.length;
  const activeIndex = count ? Math.min(index, count - 1) : 0;
  const src = images[activeIndex];

  useEffect(() => { setIndex(0); setZoomPoint(null); }, [product.id]);
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
    if (count < 2 || !playing || hovered || focused || !visible) return;
    const timer = window.setTimeout(() => setIndex((previous) => (Math.min(previous, count - 1) + 1) % count), SLIDE_DELAY);
    return () => window.clearTimeout(timer);
  }, [activeIndex, count, playing, hovered, focused, visible]);

  const select = (next: number) => {
    if (!count) return;
    setIndex((next + count) % count);
    setZoomPoint(null);
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
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setZoomPoint(null); }}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="product-gallery__stage" onPointerMove={moveZoom} onPointerLeave={() => setZoomPoint(null)}>
        <div className="product-gallery__halo" aria-hidden="true" />
        <div className="product-gallery__zoom-layer" data-zoomed={Boolean(zoomPoint && loadedSrc === src)} style={zoomStyle}>
          <ProductPhoto key={src ?? "empty"} src={src} alt={l(product.name)} className="product-gallery__image" onLoad={() => setLoadedSrc(src ?? "")} onError={() => setLoadedSrc("")} fallback={<div className="product-gallery__fallback">
            <p>{x("Fragrance", "عطر")}</p>
            <h2>{l(product.name)}</h2>
            <p>{l(product.tagline)}</p>
          </div>} />
        </div>
        {count > 0 && <span className="product-gallery__counter" dir="ltr" aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>}
        {src && loadedSrc === src && <span className="product-gallery__zoom-hint" aria-hidden="true">{x("Hover to zoom", "حرّك المؤشر للتكبير")}</span>}
      </div>

      {count > 1 && <>
        <p className="sr-only" aria-live={playing && !focused && !hovered ? "off" : "polite"}>{`${x("Image", "الصورة")} ${activeIndex + 1} ${x("of", "من")} ${count}`}</p>
        <div className="product-gallery__toolbar">
          <span className="product-gallery__label">{x("Explore the details", "استعرض تفاصيل العطر")}</span>
          <div className="product-gallery__controls">
            <button type="button" onClick={() => select(activeIndex - 1)} aria-label={x("Previous image", "الصورة السابقة")}>{lang === "ar" ? "→" : "←"}</button>
            <button type="button" onClick={() => select(activeIndex + 1)} aria-label={x("Next image", "الصورة التالية")}>{lang === "ar" ? "←" : "→"}</button>
            <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? x("Pause automatic image rotation", "إيقاف تغيير الصور تلقائياً") : x("Play automatic image rotation", "تشغيل تغيير الصور تلقائياً")} aria-pressed={!playing}>{playing ? "Ⅱ" : "▶"}</button>
          </div>
        </div>
        <div className="product-gallery__thumbnails" role="group" aria-label={x("Choose an image", "اختر صورة")}>
          {images.map((image, i) => <button type="button" key={`${image}-${i}`} onClick={() => select(i)} aria-pressed={activeIndex === i} aria-label={`${x("Image", "الصورة")} ${i + 1}${i === 0 ? ` · ${x("Main", "الأساسية")}` : ""}`}>
            <img src={image} alt="" loading="lazy" decoding="async" />
          </button>)}
        </div>
      </>}
    </section>
  );
}
