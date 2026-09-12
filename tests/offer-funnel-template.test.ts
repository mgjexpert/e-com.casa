import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = process.cwd();
const template = readFileSync(`${root}/src/components/offers/painel-ripado/page.tsx`, 'utf8');
const sharedRoute = readFileSync(`${root}/src/components/offers/product-funnel-page.tsx`, 'utf8');
const resolver = readFileSync(`${root}/src/lib/offers/resolver.ts`, 'utf8');

test('every product offer reuses the approved complete funnel', () => {
  expect(sharedRoute).toContain('<PainelRipadoOfferPage {...props} />');
  for (const block of [
    '<PanelConfigurator',
    '<PanelCampaignStory',
    '<PanelProductDetails',
    '<PanelInspiration',
    '<PanelReviews',
    '<PanelFaq',
    '<PanelFooter',
  ]) expect(template).toContain(block);
});

test('the painel-ripado public alias remains the canonical funnel slug', () => {
  expect(resolver).toContain("slug === 'painel-ripado'");
  expect(resolver).toContain('configForProduct(product, slug,');
});
