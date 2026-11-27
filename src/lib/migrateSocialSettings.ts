import type { SiteSettings } from "@/types";

/** Seed newly supplied links once for browsers with legacy empty settings.
 * Explicit custom links and every unrelated setting are left untouched. */
export function migrateSocialSettings(storage: Storage, key: string, defaults: SiteSettings) {
  const marker = "malika.settings.social-links.v1";
  try {
    if (storage.getItem(marker)) return;
    const raw = storage.getItem(key);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        for (const field of ["facebook", "youtube", "tiktok"] as const) {
          if (typeof stored[field] !== "string" || !stored[field].trim()) stored[field] = defaults[field];
        }
        storage.setItem(key, JSON.stringify(stored));
      }
    }
    storage.setItem(marker, "1");
  } catch { /* Storage may be unavailable; leave settings untouched. */ }
}
