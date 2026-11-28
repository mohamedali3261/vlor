import { useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n/LanguageContext";
import { uploadImageVariants, type ImageVariant } from "@/lib/image";
type StoredImage = { key: string; has_small?: number; has_large?: number };

export function ImageOptimization({disabled = false}:{disabled?: boolean}) {
  const { lang } = useLang();
  const [message, setMessage] = useState("");
  const [optimising, setOptimising] = useState(false);
  const [progress, setProgress] = useState(0);
  const optimisation = useRef<AbortController | null>(null);
  useEffect(() => () => { optimisation.current?.abort(); }, []);
  const optimiseExisting = async () => {
    if (optimisation.current) return;
    const controller = new AbortController(); optimisation.current = controller;
    setOptimising(true); setProgress(0); setMessage("");
    let done = 0, failed = 0, next: string | null = null;
    try {
      do {
        const response = await fetch("/api/admin/images" + (next ? `?cursor=${encodeURIComponent(next)}` : ""), { signal: controller.signal });
        if (!response.ok) throw new Error("list_failed");
        const page: { images: StoredImage[]; cursor: string | null } = await response.json();
        for (const image of page.images) {
          if (controller.signal.aborted) return;
          const wanted: ImageVariant[] = [];
          if (!image.has_small) wanted.push("small-v1");
          if (!image.has_large) wanted.push("large-v1");
          if (wanted.length) {
            try {
              const original = await fetch(`/api/images/${image.key}`, {signal: controller.signal});
              if (!original.ok) throw new Error("image_failed");
              const blob = await original.blob();
              await uploadImageVariants(image.key, new File([blob], image.key, {type:blob.type}), wanted, controller.signal);
            } catch (error) { if (controller.signal.aborted) return; failed++; }
          }
          setProgress(++done);
        }
        next = page.cursor;
      } while (next && !controller.signal.aborted);
      setMessage(lang === "ar" ? `تمت معالجة ${done} صورة. ${failed ? `تعذر تجهيز ${failed} صورة؛ يمكنك المحاولة مجددًا. ` : ""}الصور الصغيرة أصلًا تبقى كما هي.` : `Processed ${done} images. ${failed ? `${failed} could not be prepared; you can retry. ` : ""}Already-small images remain unchanged.`);
    } catch { if (!controller.signal.aborted) setMessage(lang === "ar" ? "تعذر إكمال تجهيز الصور؛ يمكنك المحاولة مجددًا." : "Could not finish preparing images; you can retry."); }
    finally { if (optimisation.current === controller) {optimisation.current = null; if(!controller.signal.aborted) setOptimising(false);} }
  };

  return <div className="mb-5 rounded-2xl border border-ink/10 bg-surface/70 p-4">
    <button type="button" disabled={optimising || disabled} onClick={() => void optimiseExisting()} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold disabled:opacity-50">{optimising ? (lang === "ar" ? `جاري تجهيز الصور: ${progress}` : `Preparing images: ${progress}`) : (lang === "ar" ? "تجهيز نسخ أخف للصور الموجودة" : "Prepare lighter copies of existing images")}</button>
    <p className="mt-2 text-xs text-mist">{lang === "ar" ? "اترك الصفحة مفتوحة حتى الانتهاء. تُحفظ الصور الأصلية ولا تتغير المنتجات أو المخزون؛ الروابط الخارجية لا تُعدّل." : "Keep this page open until complete. Originals, products and stock are unchanged; external URLs are not modified."}</p>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </div>;
}
