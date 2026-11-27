import { loadProfile } from "@/lib/localProfile";
const VISITOR_STORAGE_KEY = "vlor.analytics.visitor.v1";
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let fallbackVisitorId: string | null = null;
let cachedVisitorId: string | null = null;

function createVisitorId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getVisitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (stored && VISITOR_ID_PATTERN.test(stored)) return (cachedVisitorId = stored);

    const next = createVisitorId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, next);
    return (cachedVisitorId = next);
  } catch {
    // Keep the page usable when storage is disabled; the identifier is session-only in this case.
    fallbackVisitorId ??= createVisitorId();
    return (cachedVisitorId = fallbackVisitorId);
  }
}

/** Keep routes compact and avoid sending private tracking tokens or studio routes. */
function normalizePagePath(path: string): string | null {
  const pathname = path.split("?")[0].split("#")[0] || "/";
  if (/^\/(studio|admin)(\/|$)/i.test(pathname)) return null;
  if (/^\/track(?:\/|$)/i.test(pathname)) return "/track";
  if (pathname === "/favorites" || pathname === "/saved") return "/wishlist";
  if (/^\/product\/[a-z0-9-]{1,100}$/i.test(pathname)) return pathname.toLowerCase();
  if (["/", "/shop", "/wishlist", "/contact", "/profile"].includes(pathname)) return pathname;
  return "/404";
}

type AnalyticsEvent =
  | { type: "page_view"; pagePath: string }
  | { type: "product_click"; pagePath: string; productSlug: string }
  | { type: "heartbeat"; pagePath: string }
  | { type: "interaction"; pagePath: string; action: string };

// A small, bounded, best-effort queue keeps rapid clicks from flooding the network
// or doing storage/serialization work in the click handler. Shopping never awaits it.
const queue: (AnalyticsEvent & {profileToken?:string})[] = [];
let scheduled = false;
function schedule(): void {
  if (scheduled || !queue.length) return;
  scheduled = true;
  setTimeout(() => { void flush(); }, 200);
}
async function flush(): Promise<void> {
  const event = queue.shift();
  if (!event) { scheduled = false; return; }
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = { ...event, visitorId: getVisitorId() };
    await Promise.race([
      fetch('/api/analytics/event', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:controller.signal, keepalive:true }),
      new Promise<void>(resolve => { timeout = setTimeout(() => { controller.abort(); resolve(); }, 4000); }),
    ]);
  } catch { /* Analytics is best effort, including blocked storage or network. */ }
  finally {
    if (timeout !== undefined) clearTimeout(timeout);
    scheduled = false;
    schedule();
  }
}
function send(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const pagePath = normalizePagePath(event.pagePath);
    if (!pagePath || queue.length >= 40) return;
    const profileToken = loadProfile()?.analyticsToken;
    queue.push({ ...event, pagePath, ...(profileToken ? {profileToken} : {}) });
    schedule();
  } catch { /* Never interrupt browsing. */ }
}

export function trackPageView(pagePath: string): void {
  send({ type: "page_view", pagePath });
}

export function trackProductClick(productSlug: string, pagePath: string): void {
  if (!/^[a-z0-9-]{1,100}$/.test(productSlug)) return;
  send({ type: "product_click", pagePath, productSlug });
}


const ACTIONS = new Set(["open-cart", "checkout", "place-order", "copy-order", "add-to-cart", "wishlist", "choose-size", "quantity", "gallery", "menu", "language", "other-button", "social-whatsapp", "filter", "remove-from-cart", "carousel"]);

/** Only fixed action labels or safe storefront destinations are sent, never text or form values. */
export function interactionAction(element: Element): string | null {
  const target = element.closest("button, a, [role=button]");
  if (!target || target.matches(":disabled") || target.getAttribute("aria-disabled") === "true") return null;
  const explicit = target.getAttribute("data-analytics");
  if (explicit && ACTIONS.has(explicit)) return explicit;
  if (target.tagName.toLowerCase() !== "a") return "other-button";
  const href = target.getAttribute("href") || "";
  if (href.startsWith("#/")) {
    const path = normalizePagePath(href.slice(1));
    if (!path) return null;
    if (path.startsWith("/product/")) return `product:${path.slice(9)}`;
    return ({"/":"link-home", "/shop":"link-shop", "/wishlist":"link-wishlist", "/contact":"link-contact", "/track":"link-track"} as Record<string,string>)[path] || "link-other";
  }
  try {
    const url = new URL(href, window.location.href);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "wa.me" || host === "api.whatsapp.com") return "social-whatsapp";
    if (host === "instagram.com" || host === "m.instagram.com") return "social-instagram";
    if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.com") return "social-facebook";
    if (host === "tiktok.com" || host === "m.tiktok.com") return "social-tiktok";
    if (host === "m.me" || host === "messenger.com") return "social-messenger";
    return url.origin === window.location.origin ? "link-other" : "social-other";
  } catch { return null; }
}

/** Run only on storefront routes; hidden tabs stop heartbeats. */
export function startAnalyticsTracking(pagePath: string): () => void {
  if (!normalizePagePath(pagePath)) return () => {};
  const beat = () => { if (document.visibilityState === "visible") send({ type: "heartbeat", pagePath }); };
  const click = (event: MouseEvent) => {
    try {
      if (!(event.target instanceof Element)) return;
      const action = interactionAction(event.target);
      if (action) send({ type: "interaction", pagePath, action });
    } catch { /* A tracking error must not affect the interaction. */ }
  };
  beat();
  const timer = window.setInterval(beat, 60_000);
  document.addEventListener("visibilitychange", beat);
  document.addEventListener("click", click, true);
  return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", beat); document.removeEventListener("click", click, true); };
}
