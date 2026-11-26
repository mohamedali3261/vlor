import type { Product } from "@/types";

/** Automatically show every product enabled for the shop, using live catalogue data. */
export function shopHeroProducts(products: Product[]): Product[] {
  return products.filter((product) => product.showOnShop !== false)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}
