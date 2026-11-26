/** Open and close a product card as it enters or leaves the mobile viewport. */
export function observeMobileProductCard(card: HTMLElement, browser: Window = window): () => void {
  const media = browser.matchMedia?.("(max-width: 639px) and (hover: none)");
  let observer: IntersectionObserver | undefined;
  let disposed = false;
  let generation = 0;

  const sync = () => {
    const currentGeneration = ++generation;
    observer?.disconnect();
    observer = undefined;
    card.classList.remove("pc-scroll-active");
    if (media && !media.matches) return;
    // If an older browser lacks IntersectionObserver, keep controls accessible.
    if (!media || !("IntersectionObserver" in browser)) {
      card.classList.add("pc-scroll-active");
      return;
    }
    try {
      const Observer = (browser as Window & typeof globalThis).IntersectionObserver;
      observer = new Observer((entries) => {
        if (disposed || currentGeneration !== generation) return;
        for (const entry of entries) {
          if (entry.target === card) card.classList.toggle("pc-scroll-active", entry.isIntersecting && entry.intersectionRatio >= 0.15);
        }
      }, { rootMargin: "-12% 0px -12% 0px", threshold: [0, 0.15] });
      observer.observe(card);
    } catch {
      card.classList.add("pc-scroll-active");
    }
  };

  sync();
  if (media?.addEventListener) media.addEventListener("change", sync);
  else media?.addListener(sync);
  return () => {
    disposed = true;
    observer?.disconnect();
    if (media?.removeEventListener) media.removeEventListener("change", sync);
    else media?.removeListener(sync);
    card.classList.remove("pc-scroll-active");
  };
}
