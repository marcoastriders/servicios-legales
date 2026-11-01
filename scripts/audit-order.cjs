/* Auditoría profunda de /contratar/: geometría, foco, extras, teclado, móvil.
 * Uso: node scripts/audit-order.cjs
 */
const { chromium } = require('/home/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const out = process.argv[2] || '/tmp/audit-order.json';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  });
  const results = [];

  for (const W of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
    const context = await browser.newContext({ viewport: { width: W.w, height: W.h } });
    await context.route('**/googletagmanager.com/**', r => r.abort());
    await context.route('**/intake.marcospera.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://checkout.stripe.com/c/pay/test123' }) }));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    for (const nivel of ['essential', 'professional', 'blindada']) {
      jsErrors.length = 0;
      await page.goto(`https://revisioncontratos.es/contratar/?nivel=${nivel}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('ga_consent_revisioncontratos', 'rejected'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);

      const data = await page.evaluate(() => {
        const $ = id => document.getElementById(id);
        const r = e => e ? e.getBoundingClientRect() : null;
        const y = e => e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
        const res = {};

        // 1. Elementos presentes
        res.elementos = {
          resumen: !!$('order-resumen-titulo'),
          includes: !!$('order-includes'),
          includesItems: $('order-includes') ? $('order-includes').querySelectorAll('li').length : 0,
          extras: !!$('order-extras'),
          total: !!$('order-total'),
          iva: !!$('order-iva'),
          boton: !!$('order-pagar'),
          cambiar: !!document.querySelector('.order-cambiar a'),
          noscript: !!document.querySelector('noscript'),
        };

        // 2. Geometría vertical: beneficios -> extras -> total -> botón
        res.geometria = {
          h1: y(document.querySelector('h1')),
          includes: y($('order-includes')),
          extras: y($('order-extras')),
          total: y($('order-total')),
          boton: y($('order-pagar')),
          nota: y(document.querySelector('.order-nota')),
        };
        res.ordenCorrecto = res.geometria.includes < res.geometria.total && res.geometria.total < res.geometria.boton;

        // 3. Extras visibles solo si essential
        const extrasEl = $('order-extras');
        res.extrasHidden = extrasEl ? extrasEl.hidden || getComputedStyle(extrasEl).display === 'none' : null;

        // 4. Textos
        res.nivelNombre = $('order-resumen-titulo')?.textContent;
        res.totalTexto = $('order-total')?.textContent;
        res.ivaTexto = $('order-iva')?.textContent;
        res.botonTexto = $('order-pagar')?.textContent?.trim();
        res.botonDeshabilitado = $('order-pagar')?.disabled;

        // 5. Overflow
        res.overflow = document.body.scrollWidth > document.documentElement.clientWidth + 1;

        // 6. Botón: contraste y tamaño
        const btn = $('order-pagar');
        const cs = getComputedStyle(btn);
        res.botonCss = { fg: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, peso: cs.fontWeight, h: Math.round(r(btn).height), w: Math.round(r(btn).width) };

        // 7. Checkmarks de beneficios: fuente y color
        const li = $('order-includes')?.querySelector('li');
        if (li) {
          const lcs = getComputedStyle(li, '::before');
          res.check = { content: lcs.content, color: lcs.color };
        }

        // 8. Migas y enlaces auxiliares
        res.migas = [...document.querySelectorAll('.migas a')].map(a => a.textContent.trim());

        // 9. IVA: ¿se muestra desglose con cifra?
        res.ivaConCifra = /IVA incluido \(21 %\): [\d,]+ €/.test(res.ivaTexto || '');

        return res;
      });
      results.push({ width: W.name, nivel, ...data, jsErrors: [...jsErrors] });

      // Interacción: marcar extras (solo essential)
      if (nivel === 'essential') {
        const totalAntes = await page.locator('#order-total').textContent();
        await page.locator('input[value="expres"]').check();
        const totalExpres = await page.locator('#order-total').textContent();
        await page.locator('input[value="consulta"]').check();
        const totalAmbos = await page.locator('#order-total').textContent();
        await page.locator('input[value="expres"]').uncheck();
        const totalConsulta = await page.locator('#order-total').textContent();
        const btnTxt = await page.locator('#order-pagar').textContent();
        results.push({ width: W.name, nivel: 'essential-interaccion', totalAntes, totalExpres, totalAmbos, totalConsulta, btnTxt: btnTxt.trim() });
      }

      // Teclado: tab hasta el botón y Enter (con fetch mockeado)
      if (W.name === 'desktop' && nivel === 'professional') {
        await page.evaluate(() => document.getElementById('order-pagar').focus());
        const focused = await page.evaluate(() => document.activeElement.id);
        const outline = await page.evaluate(() => {
          const b = document.getElementById('order-pagar');
          const cs = getComputedStyle(b);
          return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
        });
        results.push({ width: W.name, nivel: 'professional-teclado', focused, outline });
      }

      // Captura de pantalla
      await page.screenshot({ path: `/tmp/order-${nivel}-${W.name}.png`, fullPage: true });
    }
    await context.close();
  }

  // Falso positivo imagen: comprobar carga real en home RC
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto('https://revisioncontratos.es/', { waitUntil: 'domcontentloaded' });
  const img = await pg.evaluate(() => {
    const i = document.querySelector('img[src*="carla-morales"]');
    return i ? { complete: i.complete, nw: i.naturalWidth, loading: i.loading, rect: i.getBoundingClientRect().top } : null;
  });
  // Forzar scroll por si es lazy
  await pg.evaluate(() => scrollTo(0, 2000));
  await pg.waitForTimeout(800);
  const img2 = await pg.evaluate(() => {
    const i = document.querySelector('img[src*="carla-morales"]');
    return i ? { complete: i.complete, nw: i.naturalWidth } : null;
  });
  results.push({ check: 'imagen-carla', antesScroll: img, despuesScroll: img2 });
  await ctx.close();

  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('OK ->', out);
  await browser.close();
})();
