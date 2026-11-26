import type { Product } from "@/types";

/** The first gallery image is the primary image everywhere. Older cutout-only products still work. */
export function productImages(product: Pick<Product, "images" | "cutout">): string[] {
  const images = (product.images ?? []).filter((src) => typeof src === "string" && src.trim().length > 0);
  return images.length ? images : product.cutout ? [product.cutout] : [];
}

export function primaryProductImage(product: Pick<Product, "images" | "cutout">): string | undefined {
  return productImages(product)[0];
}

export function setPrimaryImage(images: string[], src: string): string[] {
  return [src, ...images.slice(1)];
}
export function removeProductImage(images: string[], index: number): string[] {
  return images.filter((_, i) => i !== index);
}
export function promoteProductImage(images: string[], index: number): string[] {
  if (index <= 0 || index >= images.length) return images;
  return [images[index], ...images.filter((_, i) => i !== index)];
}
export const MAX_PRODUCT_IMAGES = 20;
