/** Remove legacy image references once without disturbing saved edits or cart lines. */
export function clearOldImageStorage(storage: Storage) {
  const marker = 'malika.remove-old-images.v1';
  try {
    if (storage.getItem(marker) === '1') return;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (!key.startsWith('malika.content.v1') && key !== 'malika.cart.v2') continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      let value: any;
      try { value = JSON.parse(raw); } catch { continue; }
      if (key.startsWith('malika.content.v1') && value?.showcase && typeof value.showcase === 'object') value.showcase.images = [];
      if (key === 'malika.cart.v2' && Array.isArray(value)) value = value.map((line) => line && typeof line === 'object' ? { ...line, image: '' } : line);
      storage.setItem(key, JSON.stringify(value));
    }
    storage.setItem(marker, '1');
  } catch { /* Storage can be unavailable; the API remains authoritative. */ }
}
