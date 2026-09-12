import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = process.cwd();
const template = readFileSync(`${root}/src/components/offers/painel-ripado/page.tsx`, 'utf8');
const sharedRoute = readFileSync(`${root}/src/components/offers/product-funnel-page.tsx`, 'utf8');
const resolver = readFileSync(`${root}/src/lib/offers/resolver.ts`, 'utf8');
const configurator = readFileSync(`${root}/src/components/offers/painel-ripado/configurator.tsx`, 'utf8');
const sections = readFileSync(`${root}/src/components/offers/painel-ripado/sections.tsx`, 'utf8');
const siteChrome = readFileSync(`${root}/src/components/layout/site-chrome.tsx`, 'utf8');

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

test('the Nuralta reference conversion sequence remains present without duplicating global chrome', () => {
  for (const copy of [
    'Pague como preferir',
    'Pagamento protegido',
    'Entrega acompanhada',
    'Apoio pós-venda',
  ]) expect(configurator).toContain(copy);

  for (const copy of [
    'Do fabricante.',
    'Cada detalhe,',
    'Espaços que ganharam outra vida.',
    'Galeria visual do produto',
    'Antes de decidir, tenha todas as respostas.',
  ]) expect(sections).toContain(copy);

  expect(siteChrome).toContain('!isOfferRoute && <PromotionInfo />');
  expect(siteChrome).toContain('!isOfferRoute && <SiteFooter />');
});

test('the funnel keeps the complete ten-question objection handling block', () => {
  expect((resolver.match(/question:/g) ?? []).length).toBe(10);
});

test('the painel-ripado public alias remains the canonical funnel slug', () => {
  expect(resolver).toContain("slug === 'painel-ripado'");
  expect(resolver).toContain('configForProduct(product, slug,');
});
