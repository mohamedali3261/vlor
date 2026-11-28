import type { Product } from "@/types";

/** Automatically show every product enabled for the shop, using live catalogue data. */
export function shopHeroProducts(products: Product[], manualOrder = false): Product[] {
  const result = products.filter((product) => product.showOnShop !== false);
  return manualOrder ? result : result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}
