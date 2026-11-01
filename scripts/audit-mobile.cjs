/* Auditoría móvil (390px): tamaños de encabezados/botones, wraps feos, overflow.
 * Uso: node scripts/audit-mobile.cjs <domain>
 */
const { chromium } = require('/home/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const domain = process.argv[2] || 'burofaxlegal.es';
const BASE = `https://${domain}`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/googletagmanager.com/**', r => r.abort());
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const xml = await (await page.goto(`${BASE}/sitemap.xml`)).text();
  const routes = [...xml.matchAll(/<loc>https:\/\/[^/<]+([^<]*)<\/loc>/g)].map(x => x[1]);

  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('ga_consent_' + location.hostname.split('.')[0], 'rejected'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.evaluate(() => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      // Elementos tipográficos grandes (>=24px) y su altura de línea
      document.querySelectorAll('h1,h2,h3,.cta-titulo,.precio-cifra,.boton,.bf-indice-cuerpo strong,.marca').forEach(e => {
        const cs = getComputedStyle(e);
        const fs = parseFloat(cs.fontSize);
        const r = e.getBoundingClientRect();
        if (fs < 24 || r.height < 1) return;
        const lh = parseFloat(cs.lineHeight) / fs;
        // Altura ocupada vs viewport (mucho vertical para poco contenido)
        if (fs >= 32 && r.height > vw * 0.55) {
          out.push(`GRANDE ${fs}px alto=${Math.round(r.height)}px "${e.textContent.trim().slice(0,50)}"`);
        }
        // Line-height excesivo
        if (lh > 1.5) {
          out.push(`LINE-HEIGHT ${lh.toFixed(2)} en ${fs}px "${e.textContent.trim().slice(0,40)}"`);
        }
        // Botones con texto que casi toca los bordes o 2 líneas feo
        if (e.classList.contains('boton') && e.textContent.trim().length > 40) {
          const wraps = Math.round(r.height / (parseFloat(cs.lineHeight) || fs));
          if (wraps > 2) out.push(`BOTON ${wraps} lineas "${e.textContent.trim().slice(0,60)}"`);
        }
      });
      // Palabras largas sin corte posible
      document.querySelectorAll('h1,h2,h3,p,a,li,strong').forEach(e => {
        const t = e.textContent.trim();
        for (const w of t.split(/\s+/)) {
          if (w.length > 22 && !w.includes('-') && !w.includes('/')) {
            const r = e.getBoundingClientRect();
            if (r.width > 0 && r.width <= vw) {
              const ww = (() => { const m = document.createElement('span'); m.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit'; m.textContent = w; document.body.appendChild(m); const x = m.getBoundingClientRect().width; m.remove(); return x; })();
              if (ww > vw - 30) out.push(`PALABRA LARGA ${Math.round(ww)}px "${w.slice(0,30)}"`);
            }
          }
        }
      });
      return out;
    });
    if (issues.length) console.log(`\n### ${route}`);
    [...new Set(issues)].slice(0, 8).forEach(i => console.log('  ' + i));
  }
  await browser.close();
})();
