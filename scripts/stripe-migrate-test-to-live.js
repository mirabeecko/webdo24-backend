#!/usr/bin/env node
/**
 * stripe-migrate-test-to-live.js
 *
 * Zkopíruje aktivní produkty + ceny ze Stripe TEST režimu do LIVE režimu.
 *
 * SPUŠTĚNÍ:
 *   node scripts/stripe-migrate-test-to-live.js
 *
 * DRY RUN (nic nevytvoří, jen vypíše co by udělal):
 *   DRY_RUN=true node scripts/stripe-migrate-test-to-live.js
 *
 * PROMĚNNÉ PROSTŘEDÍ (nastavit před spuštěním nebo v .env):
 *   STRIPE_TEST_SECRET_KEY=sk_test_...
 *   STRIPE_LIVE_SECRET_KEY=sk_live_...
 *
 * INSTALACE ZÁVISLOSTÍ (pokud ještě nejsou):
 *   npm install stripe
 */

'use strict';

const Stripe = require('stripe');

// ── Konfigurace ──────────────────────────────────────────────────────────────

const TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY;
const LIVE_KEY = process.env.STRIPE_LIVE_SECRET_KEY;
const DRY_RUN  = process.env.DRY_RUN === 'true';

if (!TEST_KEY) { console.error('❌  Chybí STRIPE_TEST_SECRET_KEY'); process.exit(1); }
if (!LIVE_KEY) { console.error('❌  Chybí STRIPE_LIVE_SECRET_KEY'); process.exit(1); }

const testStripe = Stripe(TEST_KEY);
const liveStripe = Stripe(LIVE_KEY);

// ── Pomocné funkce ────────────────────────────────────────────────────────────

function log(msg)  { console.log(msg); }
function info(msg) { console.log('  ℹ', msg); }
function ok(msg)   { console.log('  ✓', msg); }
function skip(msg) { console.log('  ⏭', msg); }
function dry(msg)  { console.log('  [DRY]', msg); }
function warn(msg) { console.warn('  ⚠', msg); }

/** Načte všechny stránky z auto-pagingového iterátoru */
async function listAll(iterable) {
  const items = [];
  for await (const item of iterable) items.push(item);
  return items;
}

// ── Hlavní logika ─────────────────────────────────────────────────────────────

async function migrate() {
  log('');
  log('══════════════════════════════════════════════');
  log('  Stripe TEST → LIVE migrace produktů & cen');
  log(DRY_RUN ? '  Režim: DRY RUN (nic se nevytvoří)' : '  Režim: LIVE (vytváří se reálné záznamy)');
  log('══════════════════════════════════════════════');
  log('');

  // Mapování test price_id → live price_id (výstup na konci)
  const priceMap = {};

  // 1. Načíst všechny aktivní produkty z TEST
  log('▶ Načítám produkty z TEST režimu...');
  const testProducts = await listAll(
    testStripe.products.list({ active: true, limit: 100 })
  );
  log(`  Nalezeno: ${testProducts.length} aktivních produktů\n`);

  // 2. Načíst existující live produkty (pro deduplikaci)
  log('▶ Načítám existující produkty z LIVE režimu...');
  const liveProducts = await listAll(
    liveStripe.products.list({ active: true, limit: 100 })
  );
  // Indexovat podle metadata.test_product_id
  const liveByTestId = {};
  for (const p of liveProducts) {
    if (p.metadata?.test_product_id) {
      liveByTestId[p.metadata.test_product_id] = p;
    }
  }
  log(`  Nalezeno: ${liveProducts.length} live produktů, ${Object.keys(liveByTestId).length} s test_product_id\n`);

  // 3. Projít každý test produkt
  for (const testProduct of testProducts) {
    log(`─────────────────────────────────────────────`);
    log(`📦 Produkt: ${testProduct.name} (${testProduct.id})`);

    // 3a. Deduplikace — existuje už live produkt s tímto test_id?
    let liveProduct = liveByTestId[testProduct.id] || null;

    if (liveProduct) {
      skip(`Live produkt již existuje: ${liveProduct.id} — přeskakuji vytvoření`);
    } else {
      // Připravit payload produktu
      const productPayload = {
        name:        testProduct.name,
        active:      true,
        metadata: {
          ...testProduct.metadata,
          test_product_id: testProduct.id,
        },
      };

      // Volitelné pole — přidat jen pokud jsou vyplněné
      if (testProduct.description)        productPayload.description        = testProduct.description;
      if (testProduct.statement_descriptor) productPayload.statement_descriptor = testProduct.statement_descriptor;
      if (testProduct.unit_label)         productPayload.unit_label         = testProduct.unit_label;
      if (testProduct.tax_code)           productPayload.tax_code           = testProduct.tax_code;
      if (testProduct.images?.length)     productPayload.images             = testProduct.images;

      if (DRY_RUN) {
        dry(`Vytvořil bych produkt: ${JSON.stringify({ name: productPayload.name, metadata: productPayload.metadata }, null, 2)}`);
        liveProduct = { id: `dry_prod_${testProduct.id}` };
      } else {
        liveProduct = await liveStripe.products.create(productPayload);
        ok(`Vytvořen live produkt: ${liveProduct.id}`);
      }
    }

    // 3b. Načíst ceny test produktu
    const testPrices = await listAll(
      testStripe.prices.list({ product: testProduct.id, active: true, limit: 100 })
    );
    info(`Ceny v TEST: ${testPrices.length}`);

    // 3c. Načíst existující live ceny pro tento produkt (deduplikace)
    const livePricesForProduct = DRY_RUN ? [] : await listAll(
      liveStripe.prices.list({ product: liveProduct.id, active: true, limit: 100 })
    );
    const livePriceByTestId = {};
    for (const p of livePricesForProduct) {
      if (p.metadata?.test_price_id) livePriceByTestId[p.metadata.test_price_id] = p;
    }

    // 3d. Vytvořit každou cenu v LIVE
    for (const testPrice of testPrices) {
      const existingLivePrice = livePriceByTestId[testPrice.id];

      if (existingLivePrice) {
        skip(`  Cena ${testPrice.id} → ${existingLivePrice.id} (již existuje)`);
        priceMap[testPrice.id] = existingLivePrice.id;
        continue;
      }

      const pricePayload = {
        product:    liveProduct.id,
        currency:   testPrice.currency,
        active:     true,
        metadata: {
          ...testPrice.metadata,
          test_price_id: testPrice.id,
        },
      };

      // unit_amount nebo custom_unit_amount
      if (testPrice.unit_amount !== null) {
        pricePayload.unit_amount = testPrice.unit_amount;
      } else if (testPrice.custom_unit_amount) {
        pricePayload.custom_unit_amount = testPrice.custom_unit_amount;
      }

      // Recurring (subscription)
      if (testPrice.recurring) {
        pricePayload.recurring = {
          interval:       testPrice.recurring.interval,
          interval_count: testPrice.recurring.interval_count,
        };
        if (testPrice.recurring.trial_period_days) {
          pricePayload.recurring.trial_period_days = testPrice.recurring.trial_period_days;
        }
      }

      // Volitelné pole
      if (testPrice.nickname)      pricePayload.nickname      = testPrice.nickname;
      if (testPrice.tax_behavior)  pricePayload.tax_behavior  = testPrice.tax_behavior;
      if (testPrice.billing_scheme && testPrice.billing_scheme !== 'per_unit') {
        pricePayload.billing_scheme = testPrice.billing_scheme;
      }
      if (testPrice.tiers_mode)    pricePayload.tiers_mode    = testPrice.tiers_mode;
      if (testPrice.tiers)         pricePayload.tiers         = testPrice.tiers;

      const nicknameLabel = testPrice.nickname || testPrice.id;
      const amountLabel   = testPrice.unit_amount !== null
        ? `${(testPrice.unit_amount / 100).toLocaleString('cs-CZ')} ${testPrice.currency.toUpperCase()}`
        : 'custom amount';
      const recurringLabel = testPrice.recurring
        ? ` / ${testPrice.recurring.interval}`
        : ' jednorázově';

      if (DRY_RUN) {
        dry(`  Vytvořil bych cenu: "${nicknameLabel}" — ${amountLabel}${recurringLabel}`);
        const dryLivePriceId = `dry_price_${testPrice.id}`;
        priceMap[testPrice.id] = dryLivePriceId;
      } else {
        const livePrice = await liveStripe.prices.create(pricePayload);
        ok(`  Cena "${nicknameLabel}" — ${amountLabel}${recurringLabel} → ${livePrice.id}`);
        priceMap[testPrice.id] = livePrice.id;
      }
    }

    log('');
  }

  // 4. Výpis mapování
  log('══════════════════════════════════════════════');
  log('  MAPOVÁNÍ cen  TEST price_id → LIVE price_id');
  log('══════════════════════════════════════════════');
  for (const [testId, liveId] of Object.entries(priceMap)) {
    log(`  ${testId}  →  ${liveId}`);
  }
  log('');
  log(DRY_RUN
    ? '✅  Dry run dokončen. Spusť bez DRY_RUN=true pro skutečnou migraci.'
    : '✅  Migrace dokončena. Aktualizuj Payment Links v objednat.html na LIVE price_id.');
  log('');
}

migrate().catch(err => {
  console.error('\n❌  Chyba:', err.message);
  if (err.type === 'StripeAuthenticationError') {
    console.error('   Zkontroluj správnost API klíčů.');
  }
  process.exit(1);
});
