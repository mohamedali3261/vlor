import { useState, type ReactNode } from "react";

/** An owner-supplied photo, with a text fallback if it is absent or unavailable. */
export function ProductPhoto({ src, alt, className, fallback, onLoad, onError }: {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState("");
  if (!src || failed === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async"
    onLoad={onLoad} onError={() => { setFailed(src); onError?.(); }} style={{ transform: "scale(var(--product-image-scale, 1))" }} />;
}
