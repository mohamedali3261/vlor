import { migrateInstagram } from "@/lib/migrateInstagram";
import { migrateSocialSettings } from "@/lib/migrateSocialSettings";
import { clearOldImageStorage } from "@/lib/clearOldImageStorage";
import { publishedAt, publishedContent, publishedSettings } from "@/data/published";
import { defaultSettings } from "@/data/site";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { Product, SiteSettings } from "@/types";
import type { DeepPartial, SiteContent } from "@/types/content";
import { createDefaultContent, mergeContent } from "@/data/defaultContent";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface StoreValue {
  products: Product[];
  manualProductOrder: boolean;
  reorderProducts: (ids: string[]) => Promise<void>;
  settings: SiteSettings;
  wishlist: string[];
  saveProduct: (product: Product) => Promise<void>;
  reloadProducts: () => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  resetCatalogue: () => void;
  replaceCatalogue: (products: Product[]) => Promise<void>;
  updateSettings: (settings: SiteSettings) => Promise<void>;
  content: SiteContent;
  updateContent: (content: SiteContent) => Promise<void>;
  resetContent: () => Promise<void>;
  configStatus: "loading" | "ready" | "error";
  reloadConfig: () => void;
  dirty: boolean;
  lastPublishedAt: string | null;
  markPublished: (at: string) => void;
  toggleWishlist: (id: string) => boolean;
  clearWishlist: () => void;
  isWished: (id: string) => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

/** A new studio publish bumps the storage key so the deployment wins over stale local edits. */
const catalogueVersion = publishedAt ? `.${publishedAt.replace(/[^0-9]/g, "").slice(0, 14)}` : "";

// Import the previous settings once per published version, without losing unrelated edits.
function initialSettings(): SiteSettings {
  let old: Partial<SiteSettings> | null = null;
  try {
    if (typeof window !== "undefined") old = JSON.parse(window.localStorage.getItem(`malika.settings.v2${catalogueVersion}`) || "null");
  } catch { /* use published settings */ }
  const initial = { ...defaultSettings, ...publishedSettings, ...old };
  if (old) return {
    ...initial,
    whatsapp: defaultSettings.whatsapp,
    phone: defaultSettings.phone,
    facebook: old.facebook?.trim() ? old.facebook : defaultSettings.facebook,
    youtube: old.youtube?.trim() ? old.youtube : defaultSettings.youtube,
    tiktok: old.tiktok?.trim() ? old.tiktok : defaultSettings.tiktok,
  };
  return {
    ...initial,
    whatsapp: initial.whatsapp === "201234567890" ? defaultSettings.whatsapp : initial.whatsapp,
    phone: initial.phone === "+20 123 456 7890" ? defaultSettings.phone : initial.phone,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  useState(() => {
    try {
      if (typeof window !== "undefined") {
        clearOldImageStorage(window.localStorage);
        migrateSocialSettings(window.localStorage, `malika.settings.v3${catalogueVersion}`, defaultSettings);
        migrateInstagram(window.localStorage, [`malika.settings.v3${catalogueVersion}`, `malika.settings.v2${catalogueVersion}`], defaultSettings.instagram);
      }
    } catch { /* Storage may be blocked. */ }
  });
  const [legacyDraftBackup] = useState(() => {
    try {
      if (window.localStorage.getItem("malika.catalogue.dirty.v1") !== "true") return null;
      return JSON.stringify({content:window.localStorage.getItem(`malika.content.v1${catalogueVersion}`),settings:window.localStorage.getItem(`malika.settings.v3${catalogueVersion}`)});
    } catch { return null; }
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [manualProductOrder, setManualProductOrder] = useState(false);
  const orderVersion = useRef<string | null>(null);
  const reloadProducts = useCallback(async () => {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Catalogue unavailable');
    const next: Product[] = await response.json();
    const version = response.headers.get('X-Product-Order-Version');
    orderVersion.current = version;
    setManualProductOrder(Boolean(version && version !== 'invalid'));
    setProducts(next);
  }, []);
  useEffect(() => { void reloadProducts().catch(() => console.error('Catalogue unavailable')); }, [reloadProducts]);
  const [rawSettings, setSettings] = usePersistentState<SiteSettings>(
    `malika.settings.v3${catalogueVersion}`,
    initialSettings()
  );
  const [priceSettingsMigrated, setPriceSettingsMigrated] = usePersistentState<boolean>("malika.settings.one-egp.v1", false);
  useEffect(() => {
    if (priceSettingsMigrated) return;
    setSettings((previous) => previous.freeShippingThreshold === 1 ? previous : { ...previous, freeShippingThreshold: 1 });
    setPriceSettingsMigrated(true);
  }, [priceSettingsMigrated, setPriceSettingsMigrated, setSettings]);
  const settings = useMemo<SiteSettings>(
    () => ({
      ...defaultSettings,
      ...rawSettings,
      messenger: rawSettings.messenger === "malika.perfumes" ? defaultSettings.messenger : (rawSettings.messenger ?? defaultSettings.messenger),
      instagram: rawSettings.instagram === "malika.perfumes" ? defaultSettings.instagram : (rawSettings.instagram ?? defaultSettings.instagram),
      email: rawSettings.email === "hello@malika-perfumes.com" ? defaultSettings.email : (rawSettings.email ?? defaultSettings.email),
    }),
    [rawSettings]
  );
  const [wishlist, setWishlist] = usePersistentState<string[]>("malika.wishlist.v2", []);
  const [storedContent, setStoredContent] = usePersistentState<DeepPartial<SiteContent> | null>(
    `malika.content.v1${catalogueVersion}`,
    publishedContent
  );
  const [dirty, setDirty] = usePersistentState<boolean>("malika.catalogue.dirty.v1", false);

  // A new deployment changes the storage key above, so this browser starts again
  // from the published data. Any "unpublished changes" flag left over from the
  // previous version then describes edits that no longer exist — clear it.
  const [buildSeen, setBuildSeen] = usePersistentState<string>("malika.build.seen.v1", "");
  useEffect(() => {
    if (buildSeen !== publishedAt) {
      setDirty(false);
      setBuildSeen(publishedAt);
    }
    // once, at start-up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merging on read means a release that adds new content fields still works
  // with whatever the owner saved earlier.
  const content = useMemo(() => mergeContent(storedContent), [storedContent]);

  const configVersions = useRef<{ content: string | null; settings: string | null }>({ content: null, settings: null });
  const configLoaded = useRef(false);
  const [configStatus, setConfigStatus] = useState<"loading" | "ready" | "error">("loading");
  const [configAttempt, setConfigAttempt] = useState(0);
  const reloadConfig = useCallback(() => { configLoaded.current = false; setConfigStatus("loading"); setConfigAttempt(value => value + 1); }, []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/storefront-config').then(async response => {
      if (!response.ok) throw new Error('Storefront configuration unavailable');
      return response.json() as Promise<{content: {version:string;data:SiteContent} | null; settings: {version:string;data:SiteSettings} | null}>;
    }).then(result => {
      if (cancelled) return;
      // Keep a recovery copy of older browser-only, unpublished studio edits.
      try {
        if ((result.content || result.settings) && legacyDraftBackup) {
          const backupKey = `malika.pre-server-config-backup.v1${catalogueVersion}`;
          if (!window.localStorage.getItem(backupKey)) window.localStorage.setItem(backupKey, legacyDraftBackup);
        }
      } catch { /* storage may be unavailable */ }
      if (result.content) { configVersions.current.content = result.content.version; setStoredContent(result.content.data); }
      if (result.settings) { configVersions.current.settings = result.settings.version; setSettings(result.settings.data); }
      configLoaded.current = true;
      setConfigStatus("ready");
    }).catch(() => { if (!cancelled) { configLoaded.current = false; setConfigStatus("error"); console.error('Storefront configuration unavailable'); } });
    return () => { cancelled = true; };
  }, [setStoredContent, setSettings, configAttempt, legacyDraftBackup]);

  const saveConfig = useCallback(async (kind: 'content' | 'settings', data: SiteContent | SiteSettings) => {
    if (!configLoaded.current) throw new Error('Storefront configuration unavailable');
    const response = await fetch(`/api/admin/storefront-config/${kind}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version:configVersions.current[kind],data})});
    if (response.status === 409) throw new Error('Configuration changed');
    if (!response.ok) throw new Error('Could not save storefront configuration');
    const result = await response.json();
    configVersions.current[kind] = result.version;
  }, []);
  const updateContent = useCallback(async (next: SiteContent) => {
    await saveConfig('content', next);
    setStoredContent(next);
    setDirty(false);
  }, [saveConfig, setStoredContent, setDirty]);

  const resetContent = useCallback(async () => {
    await updateContent(createDefaultContent());
  }, [updateContent]);
  const [lastPublishedAt, setLastPublishedAt] = usePersistentState<string | null>(
    "malika.catalogue.publishedAt.v1",
    null
  );

  const reorderProducts = useCallback(async (ids: string[]) => {
    if (orderVersion.current === 'invalid') throw new Error('Product order unavailable');
    const response = await fetch('/api/admin/product-order', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:orderVersion.current,ids})});
    if (response.status === 409) throw new Error('Product order changed');
    if (!response.ok) throw new Error('Could not save product order');
    const result: {version:string} = await response.json();
    orderVersion.current = result.version;
    setManualProductOrder(true);
    const positions = new Map(ids.map((id, index) => [id, index]));
    setProducts(previous => [...previous].sort((a,b) => (positions.get(a.id) ?? ids.length) - (positions.get(b.id) ?? ids.length)));
  }, []);

  const saveProduct = useCallback(async (product: Product) => {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) });
    if (!response.ok) throw new Error('Could not save product');
    setProducts(prev => {
      if (!manualProductOrder) return [product, ...prev.filter(item => item.id !== product.id)];
      return prev.some(item => item.id === product.id) ? prev.map(item => item.id === product.id ? product : item) : [...prev, product];
    });
  }, [manualProductOrder]);
  const deleteProduct = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {method:'DELETE'});
    if (!response.ok) throw new Error('Could not archive product');
    setProducts(prev => prev.filter(item => item.id !== id));
    setWishlist(prev => prev.filter(item => item !== id));
  }, [setWishlist]);
  // Bulk import/reset are deliberately not implemented as partial updates.
  const resetCatalogue = useCallback(() => { throw new Error('Bulk reset is not available with D1'); }, []);
  const replaceCatalogue = useCallback(async (next: Product[]) => {
    const response=await fetch('/api/admin/products/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products:next})});
    if (!response.ok) { const result=await response.json(); throw new Error(result.error || 'Import failed'); }
    try { await reloadProducts(); } catch { throw new Error('Import saved but refresh failed'); }
  }, [reloadProducts]);

  const updateSettings = useCallback(async (next: SiteSettings) => {
    await saveConfig('settings', next);
    setSettings(next);
    setDirty(false);
  }, [saveConfig, setSettings, setDirty]);

  const markPublished = useCallback(
    (at: string) => {
      setDirty(false);
      setLastPublishedAt(at);
    },
    [setDirty, setLastPublishedAt]
  );

  const toggleWishlist = useCallback(
    (id: string) => {
      let nextSaved = false;
      setWishlist((prev) => {
        const exists = prev.includes(id);
        nextSaved = !exists;
        return exists ? prev.filter((item) => item !== id) : [...prev, id];
      });
      return nextSaved;
    },
    [setWishlist]
  );

  const clearWishlist = useCallback(() => {
    setWishlist([]);
  }, [setWishlist]);

  const isWished = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  const value = useMemo<StoreValue>(
    () => ({
      products,
      manualProductOrder,
      reorderProducts,
      settings,
      wishlist,
      saveProduct,
      reloadProducts,
      deleteProduct,
      resetCatalogue,
      replaceCatalogue,
      updateSettings,
      content,
      updateContent,
      resetContent,
      configStatus,
      reloadConfig,
      toggleWishlist,
      clearWishlist,
      isWished,
      dirty,
      lastPublishedAt,
      markPublished,
    }),
    [
      products,
      manualProductOrder,
      reorderProducts,
      settings,
      wishlist,
      saveProduct,
      reloadProducts,
      deleteProduct,
      resetCatalogue,
      replaceCatalogue,
      updateSettings,
      content,
      updateContent,
      resetContent,
      configStatus,
      reloadConfig,
      toggleWishlist,
      clearWishlist,
      isWished,
      dirty,
      lastPublishedAt,
      markPublished,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
