import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreProvider } from '@/context/StoreContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { ProductDetails } from '@/pages/Product/ProductDetails';
import { AdminHeader } from '@/pages/Admin/AdminHeader';
import { Gallery } from '@/pages/Product/Gallery';
import type { Product } from '@/types';
import products from '../worker/newProducts.json';

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
