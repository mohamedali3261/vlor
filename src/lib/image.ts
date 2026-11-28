/**
 * Browser-side image preparation for studio uploads.
 *
 * A phone photo is 4–10 MB; the studio keeps its data in localStorage (~5 MB
 * for the whole site), so an upload is downscaled and re-encoded first. WebP is
 * used because it keeps transparency, which product cut-outs need. A browser
 * that cannot encode WebP (older Safari) falls back to a smaller PNG.
 */

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public readonly code: "type" | "size" | "input-size" | "decode") {
    super(code);
  }
}

function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  const withImage = () => new Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("decode"));
    };
    image.src = url;
  });
  if (typeof createImageBitmap !== "function") return withImage();
  return createImageBitmap(file).then((bitmap) => ({
    source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close(),
  })).catch(withImage);
}

export async function compressImage(file: File, maxSide = 900, quality = 0.84): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ImageError("type");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("size");

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageError("decode");
  }

  try {
    const draw = (side: number) => {
      const scale = Math.min(1, side / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new ImageError("decode");
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    const webp = draw(maxSide).toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
    return draw(Math.min(maxSide, 640)).toDataURL("image/png");
  } finally {
    decoded.release();
  }
}

const MAX_D1_IMAGE_BYTES = 1_000_000;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Ensures an uploaded image fits within D1's 1 MB raw limit.
 * Files already <= 1 MB in JPEG/PNG/WebP are kept byte-for-byte; larger photos
 * are downscaled and re-encoded in the browser first.
 */
export async function prepareImageForUpload(file: File, maxBytes = MAX_D1_IMAGE_BYTES): Promise<File> {
  if (!file.type.startsWith("image/")) throw new ImageError("type");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("size");
  if (file.size >= 12 && file.size <= maxBytes && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageError("decode");
  }

  try {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const fallbackType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    for (const side of [1600, 1280, 960, 720, 560]) {
      const scale = Math.min(1, side / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new ImageError("decode");
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.75, 0.64]) {
        let blob = await canvasBlob(canvas, "image/webp", quality);
        if (!blob || blob.type !== "image/webp") {
          blob = await canvasBlob(canvas, fallbackType, quality);
        }
        if (blob && blob.size >= 12 && blob.size <= maxBytes) {
          const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
          return new File([blob], `${baseName}.${ext}`, { type: blob.type });
        }
      }
    }
    throw new ImageError("size");
  } finally {
    decoded.release();
  }
}

/** Product images are optimised even when already under D1's size limit.
 * Alpha-capable encoders only: never flatten transparent PNG/WebP onto a background. */
export async function prepareProductImageForUpload(file: File, maxBytes = MAX_D1_IMAGE_BYTES): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ImageError("type");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("input-size");
  if (file.size < 12) throw new ImageError("size");
  // Avoid changing tiny already-optimised assets.
  if (file.size <= Math.min(80_000, maxBytes)) return file;

  let decoded: Awaited<ReturnType<typeof decode>>;
  try { decoded = await decode(file); }
  catch {
    // A browser without a working decoder can still upload an already valid-sized file.
    if (file.size <= maxBytes) return file;
    throw new ImageError("decode");
  }

  try {
    let best: File | undefined = file.size <= maxBytes ? file : undefined;
    const target = Math.min(280_000, maxBytes);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const dimension = Math.max(decoded.width, decoded.height);
    if (!dimension) throw new ImageError("decode");
    let lastWidth = 0, lastHeight = 0;
    for (const side of [1440, 1200, 960, 720, 560]) {
      const scale = Math.min(1, side / dimension);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      if (width === lastWidth && height === lastHeight) continue;
      lastWidth = width; lastHeight = height;
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new ImageError("decode");
      context.imageSmoothingQuality = "high";
      // The canvas starts transparent; never paint a background.
      context.drawImage(decoded.source, 0, 0, width, height);
      for (const quality of [0.86, 0.76, 0.66]) {
        let blob = await canvasBlob(canvas, "image/webp", quality);
        if (!blob || blob.type !== "image/webp") {
          const fallbackType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
          blob = await canvasBlob(canvas, fallbackType, quality);
          if (blob?.type !== fallbackType) blob = null;
        }
        if (blob && blob.size >= 12 && blob.size <= maxBytes && (!best || blob.size < best.size)) {
          const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
          best = new File([blob], `${baseName}.${ext}`, { type: blob.type });
        }
        if (best && best.size <= target) return best;
      }
    }
    if (best) return best;
    throw new ImageError("size");
  } catch (error) {
    if (file.size <= maxBytes) return file;
    throw error instanceof ImageError ? error : new ImageError("decode");
  } finally { decoded.release(); }
}

export async function uploadImageToD1(file: File, options?: { product?: boolean }): Promise<{ id: string; url: string; originalBytes: number; uploadedBytes: number }> {
  if (options?.product && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ImageError("type");
  // Keep the original byte-for-byte when D1 can store it; larger files still need
  // the existing 1 MB upload preparation before they can be saved.
  const prepared = options?.product && file.size > MAX_D1_IMAGE_BYTES ? await prepareProductImageForUpload(file) : await prepareImageForUpload(file);
  const data = new FormData();
  data.append("file", prepared);
  const response = await fetch("/api/admin/images", { method: "POST", body: data });
  if (response.status === 413) throw new ImageError("size");
  if (!response.ok) throw new Error("upload_failed");
  const result = (await response.json()) as { id: string; url: string };
  // Variants are optional. A preparation/network error must never lose a successful upload.
  try { await uploadImageVariants(result.id, prepared); } catch { /* Backfill can retry later. */ }
  return { ...result, originalBytes: file.size, uploadedBytes: prepared.size };
}

/** Rough storage cost of a string, in kilobytes. */
export const kb = (value: string) => Math.round(value.length / 1024);

export type ImageVariant = "small-v1" | "large-v1";

/** Derive smaller images without changing the stored original or flattening transparency. */
export async function createImageVariants(file: File, wanted: ImageVariant[] = ["small-v1", "large-v1"]): Promise<Partial<Record<ImageVariant, File>>> {
  if (!wanted.length || file.size < 12) return {};
  const decoded = await decode(file);
  try {
    const result: Partial<Record<ImageVariant, File>> = {};
    const dimension = Math.max(decoded.width, decoded.height);
    if (!dimension) throw new ImageError("decode");
    for (const variant of wanted) {
      const side = variant === "small-v1" ? 420 : 1000;
      const scale = Math.min(1, side / dimension);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new ImageError("decode");
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      let best: Blob | undefined;
      for (const quality of [0.8, 0.68, 0.56]) {
        let candidate = await canvasBlob(canvas, "image/webp", quality);
        if (!candidate || candidate.type !== "image/webp") {
          const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
          candidate = await canvasBlob(canvas, type, quality);
          if (candidate?.type !== type) candidate = null;
        }
        if (candidate && candidate.size >= 12 && candidate.size <= 350_000 && candidate.size < file.size && (!best || candidate.size < best.size)) best = candidate;
        if (best && best.size <= (variant === "small-v1" ? 80_000 : 200_000)) break;
      }
      if (best) result[variant] = new File([best], `${variant}.${best.type === "image/webp" ? "webp" : best.type === "image/jpeg" ? "jpg" : "png"}`, { type: best.type });
    }
    return result;
  } finally { decoded.release(); }
}

/** Best-effort: an original remains usable even if a derivative cannot be prepared or uploaded. */
export async function uploadImageVariants(key: string, file: File, wanted: ImageVariant[] = ["small-v1", "large-v1"], signal?: AbortSignal): Promise<void> {
  const variants = await createImageVariants(file, wanted);
  for (const variant of wanted) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const image = variants[variant];
    if (!image) continue; // Already smaller, unsupported encoder, or no useful saving.
    const response = await fetch(`/api/admin/images/${encodeURIComponent(key)}/variants/${variant}`, { method: "PUT", headers: { "Content-Type": image.type }, body: image, signal });
    if (!response.ok) throw new Error("variant_upload_failed");
  }
}
