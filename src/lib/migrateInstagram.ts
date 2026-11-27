/** Apply the owner's newly supplied Instagram handle once to existing local settings. */
export function migrateInstagram(storage: Storage, keys: string[], handle: string): void {
  const marker = "malika.settings.instagram-vlor.v1";
  try {
    if (storage.getItem(marker)) return;
    for (const key of keys) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const settings = JSON.parse(raw);
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
      storage.setItem(key, JSON.stringify({ ...settings, instagram: handle }));
    }
    storage.setItem(marker, "1");
  } catch { /* Do not disrupt the store when storage is blocked or invalid. */ }
}
