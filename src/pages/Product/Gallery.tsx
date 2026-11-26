import { SmartImage } from "@/components/ui/Primitives";
import { productImages } from "@/lib/productImages";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { useLang } from "@/i18n/LanguageContext";
import type { Product } from "@/types";
import { useEffect, useState } from "react";

export function Gallery({ product }: { product: Product }) {
  const { l, x } = useLang();
  const [index, setIndex] = useState(0);
  const images = productImages(product);
  useEffect(() => { setIndex(0); }, [product.id]);
  const src = images[Math.min(index, images.length - 1)];
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="flex min-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-[1.8rem] border border-ink/10 bg-surface px-6 py-8 text-center sm:min-h-56">
        <ProductPhoto src={src} alt={l(product.name)} className="h-56 w-full object-contain sm:h-72" fallback={<>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">{x("Fragrance", "عطر")}</p>
          <h2 className="font-display mt-3 text-3xl text-ink">{l(product.name)}</h2>
          <p className="mt-3 text-sm leading-relaxed text-mist">{l(product.tagline)}</p>
        </>} />
      </div>
      {images.length > 1 && <div className="mt-3 flex flex-wrap justify-center gap-2">{images.map((image, i) =>
        <button type="button" key={`${image}-${i}`} onClick={() => setIndex(i)} aria-pressed={Math.min(index, images.length - 1) === i} aria-label={`${x("Image", "الصورة")} ${i + 1}`} className="h-16 w-16 overflow-hidden rounded-xl border-2 border-ink/20 aria-pressed:border-acid-deep"><SmartImage src={image} alt="" className="h-full w-full" /></button>
      )}</div>}
    </div>
  );
}
