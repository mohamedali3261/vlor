import { useState, type ReactNode } from "react";

/** An owner-supplied photo, with a text fallback if it is absent or unavailable. */
export function ProductPhoto({ src, alt, className, fallback }: {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState("");
  if (!src || failed === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async"
    onError={() => setFailed(src)} style={{ transform: "scale(var(--product-image-scale, 1))" }} />;
}
