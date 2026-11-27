/** Discourage casual image saving; browser-delivered images cannot be made copy-proof. */
export function protectStorefrontImages(doc: Document): () => void {
  const preventImageAction = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.closest?.("img")) event.preventDefault();
  };
  doc.addEventListener("contextmenu", preventImageAction);
  doc.addEventListener("dragstart", preventImageAction);
  doc.documentElement.classList.add("image-guard-active");
  return () => {
    doc.removeEventListener("contextmenu", preventImageAction);
    doc.removeEventListener("dragstart", preventImageAction);
    doc.documentElement.classList.remove("image-guard-active");
  };
}
