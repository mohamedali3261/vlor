import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreProvider } from '@/context/StoreContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { ProductDetails } from '@/pages/Product/ProductDetails';
import { AdminHeader } from '@/pages/Admin/AdminHeader';
import { Gallery } from '@/pages/Product/Gallery';
import { Logo } from '@/components/ui/Primitives';
import type { Product } from '@/types';
import products from '../worker/newProducts.json';

export function renderLogo() {
  return renderToStaticMarkup(<StoreProvider><LanguageProvider><Logo compact /></LanguageProvider></StoreProvider>);
}

export function renderParts() {
  const product = products.find((p) => p.id === 'khamrah') as Product;
  return renderToStaticMarkup(
    <StoreProvider><LanguageProvider>
      <ProductDetails product={product} />
      <Gallery product={product} />
      <AdminHeader tab="products" setTab={() => {}} stats={{products: 1, featured: 0, saved: 0}} dirty={false} />
    </LanguageProvider></StoreProvider>,
  );
}

import { Footer } from '@/components/layout/Footer';
import { ContactPage } from '@/pages/Contact/ContactPage';
import { ToastProvider } from '@/context/ToastContext';
import { mergeContent } from '@/data/defaultContent';
import { runwayWheel } from '@/lib/runwayScroll';
import { socialUrl } from '@/lib/messaging';
export { mergeContent, runwayWheel, socialUrl };

export function renderContactAndFooter() {
  return renderToStaticMarkup(
    <StoreProvider><LanguageProvider><ToastProvider><ContactPage /><Footer /></ToastProvider></LanguageProvider></StoreProvider>,
  );
}

import { ProductImageScale } from '@/pages/Admin/ProductImageScale';
import { StoreSettingsForm } from '@/pages/Admin/StoreSettingsForm';
import { defaultSettings } from '@/data/site';

export function renderStudioSettingsAndImages(scale: number, withImage = true) {
  const product = { ...(products[0] as Product), images: withImage ? ['https://example.com/scent.png'] : [], cutout: undefined };
  return renderToStaticMarkup(
    <StoreProvider><LanguageProvider>
      <StoreSettingsForm settings={defaultSettings} onSave={() => {}} />
      <ProductImageScale products={[product]} value={scale} onChange={() => {}} />
    </LanguageProvider></StoreProvider>,
  );
}

export function renderGalleryWithImage() {
  const product = { ...(products[0] as Product), images: ['/api/images/new-image'], cutout: undefined };
  return renderToStaticMarkup(<StoreProvider><LanguageProvider><Gallery product={product} /></LanguageProvider></StoreProvider>);
}
export { clearOldImageStorage } from '@/lib/clearOldImageStorage';

import { ProductImagesEditor } from '@/pages/Admin/ProductImagesEditor';
import { ProductPhoto } from '@/components/product/ProductPhoto';
export { productImages, primaryProductImage, setPrimaryImage, removeProductImage, promoteProductImage } from '@/lib/productImages';
export { shopHeroProducts } from '@/lib/shopHeroProducts';
export function renderImageEditor() {
  return renderToStaticMarkup(<StoreProvider><LanguageProvider>
    <ProductImagesEditor images={['/api/images/first', '/api/images/second']} onChange={() => {}} uploading={false} setUploading={() => {}} />
  </LanguageProvider></StoreProvider>);
}
export function renderProductPhotos() {
  const product = { ...(products[0] as Product), images: ['/api/images/first', '/api/images/second'], cutout: '/api/images/legacy' };
  return renderToStaticMarkup(<StoreProvider><LanguageProvider>
    <Gallery product={product} /><ProductPhoto src={product.images[0]} alt="card" fallback={null} />
  </LanguageProvider></StoreProvider>);
}
