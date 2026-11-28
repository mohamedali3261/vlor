/** Only our own immutable D1 URLs have derivatives. External links and data URLs stay untouched. */
export function imageVariantUrl(src: string | undefined, variant: "small-v1" | "large-v1" | "original"): string | undefined {
  if (!src || variant === "original") return src;
  if (!/^\/api\/images\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(src)) return src;
  return `${src}?variant=${variant}`;
}
