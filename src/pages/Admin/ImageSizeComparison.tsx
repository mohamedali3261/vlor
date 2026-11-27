import type { Lang } from "@/types";

export type ImageSizes = { originalBytes: number; uploadedBytes: number };

export function formatImageSize(bytes: number, lang: Lang): string {
  const unit = bytes >= 1024 * 1024 ? "MB" : bytes >= 1024 ? "KB" : "B";
  const divisor = unit === "MB" ? 1024 * 1024 : unit === "KB" ? 1024 : 1;
  const number = new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", { maximumFractionDigits: unit === "B" ? 0 : 2 }).format(bytes / divisor);
  return `${number} ${unit}`;
}

/** Reports the exact input and uploaded payload sizes, including unchanged files. */
export function ImageSizeComparison({ sizes, lang }: { sizes: ImageSizes; lang: Lang }) {
  const ar = lang === "ar";
  const reduction = Math.round((1 - sizes.uploadedBytes / sizes.originalBytes) * 100);
  return (
    <div className="image-size-comparison" role="status">
      <span>{ar ? "قبل الضغط" : "Before"}: <b dir="ltr">{formatImageSize(sizes.originalBytes, lang)}</b></span>
      <span aria-hidden="true">{ar ? "←" : "→"}</span>
      <span>{ar ? "بعد الضغط" : "After"}: <b dir="ltr">{formatImageSize(sizes.uploadedBytes, lang)}</b></span>
      {sizes.uploadedBytes === sizes.originalBytes
        ? <span className="image-size-comparison__note">{ar ? "بدون تغيير" : "Unchanged"}</span>
        : reduction > 0 && <span className="image-size-comparison__note">{ar ? "توفير" : "Saved"} <b dir="ltr">{new Intl.NumberFormat(ar ? "ar-EG-u-nu-latn" : "en-US").format(reduction)}%</b></span>}
    </div>
  );
}
