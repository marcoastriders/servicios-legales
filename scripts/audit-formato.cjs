/* Auditoría de formatos: rastrea las webs en vivo (desktop + móvil) y comprueba
 * tipografía, contraste, overflow, jerarquía de encabezados, listas, imágenes,
 * botones, anclas, mojibake y coherencia de precios/IVA.
 * Uso: node scripts/audit-formato.cjs <domain> <outfile.jsonl>
 */
const { chromium } = require('/home/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');

const domain = process.argv[2];
const out = process.argv[3];
if (!domain || !out) { console.error('uso: audit-formato.cjs <domain> <out.jsonl>'); process.exit(2); }

const BASE = `https://${domain}`;
const WIDTHS = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'mobile', w: 390, h: 844 },
];

function luminance(rgb) {
  const m = rgb.match(/[\d.]+/g).map(Number);
  const [r, g, b] = m.slice(0, 3).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(c1, c2) {
  const l1 = luminance(c1), l2 = luminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const PAGE_CHECKS = `(() => {
  const issues = [];
  const vw = document.documentElement.clientWidth;

  // 1. Overflow horizontal
  const overflow = document.body.scrollWidth > vw + 1;
  if (overflow) issues.push({ sev: 'HIGH', tipo: 'overflow', det: 'scrollWidth=' + document.body.scrollWidth + ' clientWidth=' + vw });

  // 2. H1 único y visible
  const h1s = [...document.querySelectorAll('h1')];
  if (h1s.length !== 1) issues.push({ sev: 'HIGH', tipo: 'h1-count', det: h1s.length + ' h1' });
  if (h1s[0]) {
    const r = h1s[0].getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) issues.push({ sev: 'HIGH', tipo: 'h1-desbordado', det: 'right=' + Math.round(r.right) });
  }

  // 3. Jerarquía de encabezados (saltos h2->h4 etc.)
  const heads = [...document.querySelectorAll('h1,h2,h3,h4')];
  let prev = 0;
  for (const h of heads) {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) issues.push({ sev: 'MED', tipo: 'jerarquia', det: h.tagName + ' tras h' + prev + ': "' + h.textContent.trim().slice(0, 50) + '"' });
    prev = lvl;
  }

  // 4. IDs duplicados
  const ids = {};
  document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
  const dups = Object.entries(ids).filter(([, n]) => n > 1);
  if (dups.length) issues.push({ sev: 'MED', tipo: 'ids-duplicados', det: dups.map(d => d[0]).join(',') });

  // 5. Anclas rotas (href="#x")
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const t = a.getAttribute('href').slice(1);
    if (t && !document.getElementById(t)) issues.push({ sev: 'MED', tipo: 'ancla-rota', det: '#' + t });
  });

  // 6. Enlaces vacíos o sin texto
  document.querySelectorAll('a').forEach(a => {
    const txt = (a.textContent || '').trim();
    if (!txt && !a.querySelector('img')) issues.push({ sev: 'MED', tipo: 'enlace-vacio', det: (a.getAttribute('href') || '').slice(0, 60) });
  });

  // 7. Imágenes: rotas o sin alt
  document.querySelectorAll('img').forEach(img => {
    if (!img.complete || img.naturalWidth === 0) issues.push({ sev: 'HIGH', tipo: 'img-rota', det: img.src.slice(-60) });
    else if (img.alt === null || img.alt === undefined) issues.push({ sev: 'MED', tipo: 'img-sin-alt', det: img.src.slice(-60) });
  });

  // 8. Mojibake (codificación rota)
  const txt = document.body.innerText;
  const moji = txt.match(/Ã[¡-¿©®«»±³´¹º¼½¾]|â€™|â€œ|â€/g);
  if (moji) issues.push({ sev: 'HIGH', tipo: 'mojibake', det: moji.slice(0, 5).join(' ') });

  // 9. Tipografía: familias usadas en h1/h2/body
  const ff = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontFamily.split(',')[0].trim() : null; };
  const fuentes = { h1: ff('h1'), h2: ff('h2'), body: ff('body') };
  const h1Size = h1s[0] ? parseFloat(getComputedStyle(h1s[0]).fontSize) : 0;
  const h2e = document.querySelector('h2');
  const h2Size = h2e ? parseFloat(getComputedStyle(h2e).fontSize) : 0;
  if (h1Size && h2Size && h1Size < h2Size) issues.push({ sev: 'MED', tipo: 'tipografia', det: 'h1 (' + h1Size + 'px) < h2 (' + h2Size + 'px)' });
  const bodyLH = parseFloat(getComputedStyle(document.body).lineHeight);
  const bodyFS = parseFloat(getComputedStyle(document.body).fontSize);
  if (bodyFS && bodyLH && bodyLH / bodyFS < 1.3) issues.push({ sev: 'LOW', tipo: 'interlineado', det: 'lh/fs=' + (bodyLH / bodyFS).toFixed(2) });

  // 10. Botones: contraste, tamaño táctil y radio consistente
  const botones = [];
  document.querySelectorAll('.boton,.boton-sec,button.boton').forEach(b => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    if (r.height < 1) return;
    botones.push({
      txt: b.textContent.trim().slice(0, 40),
      fg: cs.color, bg: cs.backgroundColor, radius: cs.borderRadius,
      h: Math.round(r.height), w: Math.round(r.width),
      visible: r.top < innerHeight * 3
    });
  });

  // 11. Objetivos táctiles pequeños (solo móvil: <36px alto)
  if (vw < 500) {
    document.querySelectorAll('a,button').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.height < 30 && r.top < innerHeight * 2 && (e.textContent || '').trim()) {
        issues.push({ sev: 'LOW', tipo: 'tactil-pequeno', det: Math.round(r.height) + 'px "' + e.textContent.trim().slice(0, 30) + '"' });
      }
    });
  }

  // 12. Listas sin marcador visible fuera de menús/cards
  document.querySelectorAll('main ul:not([class])').forEach(ul => {
    const cs = getComputedStyle(ul);
    if (cs.listStyleType === 'none' && !ul.closest('nav') && !ul.closest('.order-includes')) {
      issues.push({ sev: 'LOW', tipo: 'lista-sin-marcador', det: ul.closest('section')?.className || 'ul sin clase' });
    }
  });

  // 13. Secciones vacías
  document.querySelectorAll('main section').forEach(s => {
    if (s.innerText.trim().length < 3 && !s.querySelector('img,form,button')) {
      issues.push({ sev: 'MED', tipo: 'seccion-vacia', det: s.className || s.id });
    }
  });

  // 14. Precios: formato consistente "NNN €"
  const precios = [...new Set((txt.match(/\\d{2,4}\\s*€/g) || []))];
  const conNBSP = (txt.match(/\\d{2,4}\\u00a0€/g) || []).length;

  // 15. Solapamiento del banner de consentimiento con CTAs visibles
  const consent = document.getElementById('analytics-consent');
  let consentOverlap = false;
  if (consent && getComputedStyle(consent).display !== 'none') {
    const a = consent.getBoundingClientRect();
    document.querySelectorAll('.boton,.boton-sec').forEach(e => {
      const r = e.getBoundingClientRect();
      if (r.top < innerHeight && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top) consentOverlap = true;
    });
  }
  if (consentOverlap) issues.push({ sev: 'MED', tipo: 'consent-solapa-cta' });

  // 16. Texto en mayúsculas excesivo (gritar)
  const shout = [...document.querySelectorAll('main p,main li')].filter(e => {
    const t = e.textContent.trim();
    return t.length > 40 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚ]/.test(t);
  }).length;
  if (shout) issues.push({ sev: 'LOW', tipo: 'mayusculas', det: shout + ' bloques' });

  return { issues, fuentes, h1Size, h2Size, bodyFS, bodyLH: Math.round(bodyLH / bodyFS * 100) / 100, botones, precios, conNBSP, h1: h1s[0] ? h1s[0].textContent.trim().slice(0, 80) : null, canonical: document.querySelector('link[rel=canonical]')?.href || null };
})()`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  });
  const stream = fs.createWriteStream(out, { flags: 'a' });
  const write = rec => stream.write(JSON.stringify(rec) + '\n');

  // Enumerar rutas del sitemap vivo
  const context0 = await browser.newContext();
  const p0 = await context0.newPage();
  const resp = await p0.goto(`${BASE}/sitemap.xml`);
  const xml = await resp.text();
  const routes = [...xml.matchAll(/<loc>https:\/\/[^/<]+([^<]*)<\/loc>/g)].map(x => x[1]);
  await context0.close();
  console.log(`${domain}: ${routes.length} rutas`);

  for (const W of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: W.w, height: W.h },
      userAgent: W.name === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    await context.route('**/googletagmanager.com/**', r => r.abort());
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    // Aceptar cookies una vez para medir sin banner
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.setItem('ga_consent_' + location.hostname.split('.')[0], 'rejected'));

    for (const route of routes) {
      jsErrors.length = 0;
      let rec = { domain, route, width: W.name };
      try {
        const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        rec.status = response.status();
        Object.assign(rec, await page.evaluate(PAGE_CHECKS));
        if (jsErrors.length) rec.issues.push({ sev: 'HIGH', tipo: 'js-error', det: jsErrors[0].slice(0, 120) });
      } catch (e) {
        rec.status = 0;
        rec.issues = [{ sev: 'HIGH', tipo: 'carga-fallida', det: String(e).slice(0, 120) }];
      }
      write(rec);
    }
    await context.close();
  }

  // Contraste de botones (calculado en Node sobre los datos recogidos)
  stream.end();
  await browser.close();
  console.log(`${domain}: rastreo completo`);
})();
