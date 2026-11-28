import { imageVariantUrl } from "@/lib/imageVariants";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "@/styles/loading-image.css";

// Limit simultaneous image requests, even when many cards enter the viewport at once.
const MAX_IMAGE_LOADS = 4;
let activeLoads = 0;
type Job = { start: () => void; active: boolean; cancelled: boolean };
const queue: Job[] = [];
function pump() {
  while (activeLoads < MAX_IMAGE_LOADS && queue.length) {
    const job = queue.shift()!;
    if (job.cancelled) continue;
    job.active = true;
    activeLoads++;
    job.start();
  }
}
function schedule(start: () => void, priority = false): () => void {
  const job: Job = { start, active: false, cancelled: false };
  if (priority) queue.unshift(job); else queue.push(job);
  pump();
  return () => {
    if (job.cancelled) return;
    job.cancelled = true;
    if (job.active) { job.active = false; activeLoads--; }
    else { const index = queue.indexOf(job); if (index !== -1) queue.splice(index, 1); }
    pump();
  };
}

/** Defers image requests until near the viewport and shows a per-image loading indicator. */
type LoadingImageProps = {
  src?: string; alt: string; className?: string; style?: CSSProperties; fallback?: ReactNode;
  onLoad?: () => void; onError?: () => void; draggable?: boolean; priority?: boolean; retry?: boolean; variant?: "small-v1" | "large-v1" | "original";
};
export function LoadingImage(props: LoadingImageProps) {
  return <ImageLoader key={`${props.src ?? ""}|${props.variant ?? "small-v1"}`} {...props} />;
}
function ImageLoader({ src: originalSrc, variant = "small-v1", alt, className, style, fallback = null, onLoad, onError, draggable = false, priority = false, retry = false }: LoadingImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [originalFallback, setOriginalFallback] = useState<string>();
  const src = imageVariantUrl(originalSrc, originalFallback === originalSrc ? "original" : variant);
  // Render a usable image in non-browser rendering and older browsers without observers.
  const observerAvailable = typeof window !== "undefined" && typeof IntersectionObserver !== "undefined";
  const [startedSrc, setStartedSrc] = useState<string | undefined>(() => observerAvailable ? undefined : src);
  const [result, setResult] = useState<{src: string; status: "loaded" | "error"} | null>(null);
  const container = useRef<HTMLSpanElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const release = useRef<(() => void) | null>(null);
  const priorityRef = useRef(priority); priorityRef.current = priority;
  const loading = Boolean(src && (result?.src !== src || result.status !== "loaded"));
  const failed = Boolean(src && result?.src === src && result.status === "error");

  useEffect(() => {
    if (!src || !observerAvailable || !container.current) return;
    let dispose: (() => void) | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      dispose = schedule(() => setStartedSrc(src), priorityRef.current);
      release.current = dispose;
    }, { rootMargin: "200px" });
    observer.observe(container.current);
    return () => { observer.disconnect(); dispose?.(); if (release.current === dispose) release.current = null; };
  }, [src, observerAvailable, attempt]);

  const finish = (status: "loaded" | "error") => {
    if (!src || result?.src === src && result.status === status) return;
    release.current?.(); release.current = null;
    if (status === "error" && originalSrc && src !== originalSrc) { setOriginalFallback(originalSrc); return; }
    setResult({ src, status });
    if (status === "loaded") onLoad?.(); else onError?.();
  };
  // Cached images can finish before React attaches its event handlers.
  useEffect(() => {
    if ((!observerAvailable || startedSrc === src) && image.current?.complete && image.current.naturalWidth > 0) finish("loaded");
  }, [startedSrc, src]);

  if (!src) return <>{fallback}</>;
  if (failed) return <>{fallback}{retry && <button type="button" className="loading-image__retry" onClick={() => {setResult(null); setOriginalFallback(undefined); setStartedSrc(undefined); setAttempt(n => n + 1);}}>{typeof document !== "undefined" && document.documentElement?.lang === "ar" ? "إعادة تحميل الصورة" : "Retry image"}</button>}</>;
  return <span className="loading-image" ref={container} aria-busy={loading}>
    {(!observerAvailable || startedSrc === src) && <img ref={image} src={src} alt={alt} className={className} style={style} decoding="async" loading={observerAvailable || priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} draggable={draggable}
      onLoad={() => finish("loaded")} onError={() => finish("error")} />}
    {loading && <span className="loading-image__spinner" role={alt ? "status" : undefined} aria-hidden={alt ? undefined : true} aria-label={alt ? (typeof document !== "undefined" && document.documentElement?.lang === "ar" ? "جارٍ تحميل الصورة" : "Loading image") : undefined} />}
  </span>;
}
