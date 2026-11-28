import { LoadingImage } from "@/components/ui/LoadingImage";
import type { ReactNode } from "react";

/** An owner-supplied photo, with a text fallback if it is absent or unavailable. */
export function ProductPhoto({ src, alt, className, fallback, onLoad, onError, variant, priority, retry }: {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  variant?: "small-v1" | "large-v1" | "original";
  priority?: boolean; retry?: boolean;
}) {
  return <LoadingImage src={src} alt={alt} className={className} fallback={fallback} variant={variant} priority={priority} retry={retry}
    onLoad={onLoad} onError={onError} style={{ transform: "scale(var(--product-image-scale, 1))" }} />;
}
