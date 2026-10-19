// Puerta de calidad sobre dist/: fuentes vivas, anclas BOE, frases prohibidas,
// años en títulos/slugs, canónicos, bloques citables y cross-links entre dominios.
// Uso: node scripts/verify.mjs  → exit 1 si falla algo (bloquea el despliegue).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const DOMAINS = ['burofaxlegal.es', 'revisioncontratos.es'];
const BANNED = ['en el mundo actual', 'es importante destacar', 'cabe señalar', 'en resumen', 'en definitiva', 'en conclusión', 'sumérgete', 'garantizamos'];

let failures = 0;
const fail = (msg) => { failures++; console.error('FALLO:', msg); };
const ok = (msg) => console.log('  ok:', msg);

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const htmlFiles = [];
for (const d of DOMAINS) {
  const dir = join(dist, d);
  if (!existsSync(dir)) { fail(`falta dist/${d}`); continue; }
  for (const f of walk(dir)) if (f.endsWith('.html')) htmlFiles.push([d, f]);
}
console.log(`Páginas HTML: ${htmlFiles.length}`);

const externalLinks = new Set();
let crossLinks = 0;

for (const [domain, file] of htmlFiles) {
  const rel = file.replace(dist, '');
  const html = readFileSync(file, 'utf8');
  const lower = html.toLowerCase();

  // 1. frases prohibidas
  for (const b of BANNED) if (lower.includes(b)) fail(`${rel}: frase prohibida «${b}»`);

  // 2. canónico autorreferente
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canon) fail(`${rel}: sin canonical`);
  else {
    const expectPath = rel.replace(`/${domain}`, '').replace(/index\.html$/, '').replace(/^\//, '/');
    if (!canon[1].startsWith(`https://${domain}/`)) fail(`${rel}: canonical apunta a ${canon[1]}`);
  }

  // 3. años de calendario en <title> y H1
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1] || '';
  const h1 = (html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] || '').replace(/<[^>]+>/g, '');
  if (/\b(19|20)\d{2}\b/.test(title)) fail(`${rel}: año en <title> (${title})`);
  if (/\b(19|20)\d{2}\b/.test(h1)) fail(`${rel}: año en H1 (${h1})`);

  // 4. slugs sin año
  if (/\b(19|20)\d{2}\b/.test(rel)) fail(`${rel}: año en la ruta`);

  // 5. respuesta directa en páginas de contenido (no legales/404)
  if (!/aviso-legal|privacidad|cookies|condiciones|404/.test(rel) && !html.includes('respuesta-directa'))
    fail(`${rel}: falta bloque de respuesta directa`);

  // 6. JSON-LD LegalService + Person canónica
  if (!html.includes('"LegalService"')) fail(`${rel}: falta schema LegalService`);
  if (!html.includes('https://carlamorales.es/#person')) fail(`${rel}: falta Person canónica`);

  // 7. recolectar enlaces externos y cross-domain
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const u = m[1];
    if (u.includes('boe.es') || u.includes('correos.es') || u.includes('ine.es')) externalLinks.add(u);
    const other = DOMAINS.find((d) => d !== domain);
    if (u.includes(`https://${other}/`)) crossLinks++;
  }

  // 8. enlaces de entidad
  if (rel.endsWith('index.html') && !/aviso-legal|privacidad|cookies|condiciones/.test(rel)) {
    if (!html.includes('carlamorales.es')) fail(`${rel}: sin enlace a la entidad carlamorales.es`);
  }
}
ok(`cross-links entre dominios: ${crossLinks}`);
if (crossLinks < 6) fail('cross-links entre dominios insuficientes (<6)');

// 9. coherencia comercial y seguridad del prelaunch de RevisiónContratos
const revisionContent = JSON.parse(readFileSync(join(root, 'content', 'revisioncontratos.json'), 'utf8'));
const revisionHtml = htmlFiles
  .filter(([domain]) => domain === 'revisioncontratos.es')
  .map(([, file]) => readFileSync(file, 'utf8'));
const revisionAll = revisionHtml.join('\n');
if (!existsSync(join(dist, 'assets', 'carla-morales.png'))) fail('falta la foto local de Carla en dist/assets');
for (const [domain, file] of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  if (html.includes('confianza-foto') && !html.includes('src="/assets/carla-morales.png"'))
    fail(`${file.replace(dist, '')}: el bloque de confianza no usa la foto local de Carla`);
}
for (const oldPrice of ['59 €', '119 €']) {
  if (revisionAll.includes(oldPrice)) fail(`revisioncontratos.es conserva el precio antiguo ${oldPrice}`);
}
for (const expected of [['Revisión Esencial', 129], ['Revisión Profesional', 249], ['Firma Blindada', 499]]) {
  const tier = revisionContent.pricing.tiers.find((t) => t.name.includes(expected[0]));
  if (!tier || tier.priceValue !== expected[1]) fail(`nivel ${expected[0]} no coincide con ${expected[1]} €`);
}
if ('paymentLinks' in revisionContent) {
  const pl = revisionContent.paymentLinks;
  for (const k of ['essential', 'professional', 'blindada', 'essentialExpress', 'essentialCall', 'essentialBoth']) {
    if (!/^https:\/\/buy\.stripe\.com\//.test(pl[k] || '')) fail(`paymentLinks.${k} no es un enlace de pago de Stripe`);
  }
} else {
  fail('revisioncontratos.es no tiene paymentLinks de Stripe (cobro online)');
}
{
  const preciosHtml = readFileSync(join(dist, 'revisioncontratos.es', 'precios', 'index.html'), 'utf8');
  const n = (preciosHtml.match(/boton-pago/g) || []).length;
  if (!revisionContent.paymentPaused) {
    if (n < 6) fail(`precios: solo ${n} botones de pago (esperados al menos 6)`);
    for (const url of Object.values(revisionContent.paymentLinks)) if (!preciosHtml.includes(`href="${url}"`)) fail('precios: enlace online configurado no renderizado');
    if ((preciosHtml.match(/class="precio-bump"/g) || []).length !== 1) fail('precios: falta el bump único de la Revisión Esencial');
    for (const label of revisionContent.ui.extrasLabels) if (!preciosHtml.includes(label)) fail(`precios: falta el extra ${label}`);
    if (/cobro online.*desactivado|Bizum o transferencia|consulta antes de pagar|confirma el encargo.*antes del pago/i.test(preciosHtml + revisionAll)) fail('revisioncontratos: conserva copy de pago manual o contacto previo');
    const intakeHtml = readFileSync(join(dist, 'revisioncontratos.es', 'cuenta-tu-caso', 'index.html'), 'utf8');
    if (!intakeHtml.includes('name="paquete"') || !intakeHtml.includes('name="paquete" required')) fail('intake revisioncontratos: paquete pagado no es obligatorio');
    // order page /contratar/
    const orderPath = join(dist, 'revisioncontratos.es', 'contratar', 'index.html');
    if (!existsSync(orderPath)) fail('revisioncontratos: falta la order page /contratar/');
    const orderHtml = readFileSync(orderPath, 'utf8');
    for (const url of Object.values(revisionContent.paymentLinks)) if (!orderHtml.includes(url)) fail('contratar: enlace Stripe ausente de la order page');
    if (!orderHtml.includes('id="order-total"') || !orderHtml.includes('aria-live="polite"')) fail('contratar: falta el total dinámico accesible');
    if (!orderHtml.includes('<noscript>') || (orderHtml.match(/order-noscript/g) || []).length < 1) fail('contratar: falta el fallback noscript');
    if ((orderHtml.match(/<input type="radio" name="nivel"/g) || []).length !== 3) fail('contratar: deben renderizarse los 3 niveles como radios');
    if (!orderHtml.includes('value="expres"') || !orderHtml.includes('value="consulta"')) fail('contratar: faltan los checkboxes de extras');
    if (!readFileSync(join(dist, 'revisioncontratos.es', 'sitemap.xml'), 'utf8').includes('/contratar/')) fail('sitemap revisioncontratos sin /contratar/');
    const bfAll = htmlFiles.filter(([d]) => d === 'burofaxlegal.es').map(([, f]) => readFileSync(f, 'utf8')).join('\n');
    if (bfAll.includes('href="/contratar/')) fail('burofaxlegal: no debe enlazar a la order page de revisioncontratos');
    if (existsSync(join(dist, 'burofaxlegal.es', 'contratar'))) fail('burofaxlegal: no debe generar /contratar/ (flujo presupuesto)');
  }
  if (revisionContent.paymentPaused) {
    if (existsSync(join(dist, 'revisioncontratos.es', 'contratar'))) fail('revisioncontratos: /contratar/ generada durante la pausa');
    for (const [, file] of htmlFiles.filter(([domain]) => domain === 'revisioncontratos.es')) {
      const html = readFileSync(file, 'utf8');
      if (/buy\.stripe\.com|Contratar y pagar|contrat(?:a|ar) online|pag(?:a|as|ar|ue|ues|o) online|Pago online con tarjeta/i.test(html)) fail(`${file}: cobro online renderizado durante pausa`);
    }
    if (n || !preciosHtml.includes('pago por Bizum o transferencia')) fail('precios: fallback manual ausente o botones de pago en pausa');
    for (const key of ['essential','professional','blindada']) if (!preciosHtml.includes(`/cuenta-tu-caso/?paquete=${key}`)) fail(`precios: falta solicitud ${key}`);
  }
  if (/paypal\.(me|com)/i.test(preciosHtml)) fail('precios: conserva mención de PayPal');
}
const alquilerHtml = readFileSync(join(dist, 'revisioncontratos.es', 'revision-contrato-alquiler', 'index.html'), 'utf8');
if (alquilerHtml.includes('Si contratas la opción de contraoferta'))
  fail('la página de alquiler conserva una contraoferta ambigua sin nivel ni precio');
if (!alquilerHtml.includes('Revisión Profesional de 249 €'))
  fail('la página de alquiler no asigna expresamente la contraoferta al nivel Profesional');
const siteContents = {
  'revisioncontratos.es': revisionContent,
  'burofaxlegal.es': JSON.parse(readFileSync(join(root, 'content', 'burofaxlegal.json'), 'utf8')),
};
const nginxConfig = readFileSync(join(root, 'nginx.conf'), 'utf8');
if (!nginxConfig.includes("connect-src 'self' https://intake.marcospera.com"))
  fail('nginx CSP no permite conectar con intake.marcospera.com');
if (!nginxConfig.includes('location ^~ /assets/'))
  fail('nginx no sirve el directorio compartido /assets/');
for (const [domain, content] of Object.entries(siteContents)) {
  const domainFiles = htmlFiles.filter(([d]) => d === domain);
  if (content.prelaunch) {
    for (const [, file] of domainFiles) {
      const html = readFileSync(file, 'utf8');
      const rel = file.replace(dist, '');
      if (!html.includes('<meta name="robots" content="noindex,follow">')) fail(`${rel}: prelaunch sin noindex`);
      if (html.includes('paypal.me') || html.includes('paypal.com/paypalme')) fail(`${rel}: enlace de pago visible durante prelaunch`);
      if (html.includes('<form')) fail(`${rel}: formulario de encargo visible durante prelaunch`);
    }
  } else {
    for (const [, file] of domainFiles) {
      const html = readFileSync(file, 'utf8');
      const rel = file.replace(dist, '');
      if (!html.includes('<meta name="robots" content="index,follow">')) fail(`${rel}: web abierta sin index,follow`);
      if (html.includes('Sitio en preparación.') || html.includes('Apertura próxima')) fail(`${rel}: conserva aviso de prelaunch`);
      if (html.includes('<p class="respuesta-directa"><p>')) fail(`${rel}: párrafo anidado en respuesta directa`);
    }
    const intake = readFileSync(join(dist, domain, 'cuenta-tu-caso', 'index.html'), 'utf8');
    if (!intake.includes('<form id="intake"')) fail(`${domain}: formulario de encargos no visible tras apertura`);
    ok(`${domain}: abierto, indexable y con formulario operativo`);
  }
}
const revisionHome = readFileSync(join(dist, 'revisioncontratos.es', 'index.html'), 'utf8');
const burofaxHome = readFileSync(join(dist, 'burofaxlegal.es', 'index.html'), 'utf8');
if (!revisionHome.includes('site-revisioncontratos') || !revisionHome.includes('rc-hero') || !revisionHome.includes('rc-fee-list'))
  fail('revisioncontratos.es: falta la composición editorial del rediseño');
if (burofaxHome.includes('rc-hero') || burofaxHome.includes('rc-fee-list'))
  fail('burofaxlegal.es: recibió por error el rediseño de RevisiónContratos');
if (!burofaxHome.includes('site-burofaxlegal') || !burofaxHome.includes('bf-hero') || !burofaxHome.includes('bf-proceso') || !burofaxHome.includes('bf-indice') || !burofaxHome.includes('bf-sello') || !burofaxHome.includes('bf-aprende'))
  fail('burofaxlegal.es: falta la composición del rediseño (bf-hero/bf-proceso/bf-indice/bf-sello/bf-aprende)');
if (revisionHome.includes('bf-hero') || revisionHome.includes('bf-proceso') || revisionHome.includes('bf-indice'))
  fail('revisioncontratos.es: recibió por error el rediseño de BurofaxLegal');
{
  // aislamiento CSS: ningún selector que toque clases bf- puede quedar sin scoping al sitio
  const cssRaw = readFileSync(join(root, 'assets', 'styles.css'), 'utf8');
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    for (const part of m[1].split(',')) {
      if (part.includes('bf-') && !part.includes('site-burofaxlegal'))
        fail(`styles.css: selector bf- sin aislar → «${part.trim()}»`);
    }
  }
  ok('styles.css: selectores bf- todos bajo .site-burofaxlegal');
  // toda la sección de rediseño de BurofaxLegal debe estar scpeada (cubre selectores sin bf-)
  const marker = cssRaw.indexOf('BurofaxLegal · identidad jurídica moderna');
  const end = cssRaw.indexOf('@media (prefers-reduced-motion', marker);
  if (marker === -1) fail('styles.css: falta el marcador de la sección BurofaxLegal');
  const section = cssRaw.slice(cssRaw.indexOf('*/', marker) + 2, end === -1 ? undefined : end).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of section.matchAll(/([^{}]+)\{/g)) {
    for (const part of m[1].split(',')) {
      const sel = part.trim();
      if (!sel || sel.startsWith('@')) continue;
      if (!sel.includes('site-burofaxlegal'))
        fail(`styles.css: selector de la sección BurofaxLegal sin aislar → «${sel}»`);
    }
  }
  ok('styles.css: sección BurofaxLegal entera bajo .site-burofaxlegal');
  if (!/\.site-burofaxlegal\s+\.analytics-consent\[hidden\]\s*\{\s*display:\s*none;\s*\}/.test(cssRaw))
    fail('styles.css: el banner de cookies visible ignora el atributo hidden');
  else ok('styles.css: el banner de cookies respeta [hidden]');
}
if (!revisionHome.includes('G-3T09PQEZP4') || revisionHome.includes('G-0VJ895YMEX'))
  fail('revisioncontratos.es: identificador GA4 incorrecto o mezclado');
if (!burofaxHome.includes('G-0VJ895YMEX') || burofaxHome.includes('G-3T09PQEZP4'))
  fail('burofaxlegal.es: identificador GA4 incorrecto o mezclado');
const revisionPricing = readFileSync(join(dist, 'revisioncontratos.es', 'precios', 'index.html'), 'utf8');
if (!revisionContent.prelaunch) {
  if (/paypal\.(me|com)/i.test(revisionPricing)) fail('precios: conserva enlace o mención de PayPal');
  if ((revisionPricing.match(/class="precio-card/g) || []).length !== 3) fail('precios: no hay exactamente tres columnas/tarjetas');
}

// puerta de honorarios variables de BurofaxLegal (presupuesto cerrado, sin tarifas cerradas ni página de precios)
const burofaxContent = siteContents['burofaxlegal.es'];
const burofaxAll = htmlFiles.filter(([d]) => d === 'burofaxlegal.es').map(([, f]) => readFileSync(f, 'utf8')).join('\n');
const burofaxSitemap = readFileSync(join(dist, 'burofaxlegal.es', 'sitemap.xml'), 'utf8');
if (existsSync(join(dist, 'burofaxlegal.es', 'precios'))) fail('burofaxlegal.es: la página /precios/ sigue generada (retirada: el presupuesto se cierra bajo demanda)');
if (burofaxAll.includes('href="/precios/"')) fail('burofaxlegal.es: quedan enlaces internos a /precios/');
if (burofaxSitemap.includes('/precios/')) fail('burofaxlegal.es: el sitemap sigue listando /precios/');
if (Array.isArray(burofaxContent.pricing.tiers) && burofaxContent.pricing.tiers.length)
  fail('burofaxlegal.es: conserva pricing.tiers (honorarios variables, sin tarifas cerradas)');
if (!burofaxContent.pricing.quoteFrom) fail('burofaxlegal.es: falta pricing.quoteFrom (ancla «desde 99 €»)');
if (burofaxContent.pricing.quoteFrom !== 'desde 99 €') fail(`burofaxlegal.es: quoteFrom inesperado «${burofaxContent.pricing.quoteFrom}»`);
if (!burofaxAll.includes(burofaxContent.pricing.quoteFrom)) fail('burofaxlegal.es: falta la ancla de precio «desde» en las páginas servidas');
for (const oldPrice of ['79 €', '149 €', '249 €']) {
  if (burofaxAll.includes(oldPrice)) fail(`burofaxlegal.es conserva el precio cerrado ${oldPrice}`);
}
{
  const bfIntake = readFileSync(join(dist, 'burofaxlegal.es', 'cuenta-tu-caso', 'index.html'), 'utf8');
  if (!bfIntake.includes('id="f-telefono" name="telefono" type="tel" autocomplete="tel" required')) fail('intake burofaxlegal: el teléfono debe ser obligatorio');
  if (!bfIntake.includes('name="adjuntos" type="file"')) fail('intake burofaxlegal: falta el campo de adjuntos');
  if (!bfIntake.includes("fd.append('adjuntos'")) fail('intake burofaxlegal: falta el envío multipart de adjuntos');
  if (bfIntake.includes('name="paquete"')) fail('intake burofaxlegal: no debe tener el campo de paquete');
}

// 10. pie de pagina: enlaces de identidad y legales en TODAS las paginas de ambos dominios
{
  const sharedJson = JSON.parse(readFileSync(join(root, 'content', 'shared.json'), 'utf8'));
  const footerWanted = [sharedJson.linkedin, 'https://carlamorales.es/', '/aviso-legal/', '/privacidad/', '/cookies/', '/condiciones-del-servicio/'];
  for (const siteDir of ['burofaxlegal.es', 'revisioncontratos.es']) {
    for (const page of ['index.html', 'cuenta-tu-caso/index.html', 'privacidad/index.html']) {
      const html = readFileSync(join(dist, siteDir, page), 'utf8');
      const footer = html.slice(html.indexOf('<footer'));
      if (!footer || footer.length < 50) fail(`${siteDir}/${page}: sin footer`);
      for (const want of footerWanted) if (!footer.includes(`href="${want}"`)) fail(`${siteDir}/${page}: el footer no enlaza ${want}`);
      if (footer.includes('undefined')) fail(`${siteDir}/${page}: footer con undefined`);
    }
  }
}

// 11. artículos del blog: presencia, sitemap y estado de revisión
{
  const burofaxContent = siteContents['burofaxlegal.es'];
  const articles = Array.isArray(burofaxContent.articles) ? burofaxContent.articles : [];
  const sm = readFileSync(join(dist, 'burofaxlegal.es', 'sitemap.xml'), 'utf8');
  ok(`burofaxlegal.es artículos en JSON: ${articles.length}`);
  if (articles.length === 0) fail('burofaxlegal.es: articles vacío o ausente (docs 38-41 no aplicados)');
  for (const a of articles) {
    const rel = `/burofaxlegal.es/articulos/${a.slug}/index.html`;
    const file = join(dist, 'burofaxlegal.es', 'articulos', a.slug, 'index.html');
    if (!existsSync(file)) fail(`artículo sin generar: ${rel}`);
    else {
      const html = readFileSync(file, 'utf8');
      if (!html.includes('respuesta-directa')) fail(`${rel}: sin bloque de respuesta directa`);
      if (!html.includes('"BlogPosting"')) fail(`${rel}: sin schema BlogPosting`);
      if (/\b(19|20)\d{2}\b/.test(a.slug)) fail(`${rel}: año en slug`);
      if (!sm.includes(`/articulos/${a.slug}/`)) fail(`sitemap sin artículo: ${a.slug}`);
      if (a.reviewStatus !== 'reviewed') fail(`${rel}: reviewStatus=${a.reviewStatus} (artículo sin revisar publicado)`);
      if (!a.reviewedAt) fail(`${rel}: sin reviewedAt`);
    }
  }
  if (!sm.includes('/articulos/')) fail('sitemap sin el índice /articulos/');
}

// 10. archivos de descubrimiento
for (const d of DOMAINS) {
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
    if (!existsSync(join(dist, d, f))) fail(`${d}: falta ${f}`);
  }
  const sm = readFileSync(join(dist, d, 'sitemap.xml'), 'utf8');
  const n = (sm.match(/<loc>/g) || []).length;
  ok(`${d} sitemap: ${n} URLs`);
  if (n < 10) fail(`${d}: sitemap con menos de 10 URLs`);
}

// 10. fuentes externas vivas + anclas BOE
console.log(`\nVerificando ${externalLinks.size} enlaces externos...`);
for (const url of [...externalLinks].sort()) {
  const [base, anchor] = url.split('#');
  try {
    const res = await fetch(base, { headers: { 'User-Agent': 'Mozilla/5.0 (verificacion-fuentes)' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) { fail(`${url}: HTTP ${res.status}`); continue; }
    if (anchor && base.includes('boe.es')) {
      const body = await res.text();
      if (!body.includes(`name="${anchor}"`) && !body.includes(`id="${anchor}"`)) {
        fail(`${url}: ancla #${anchor} no existe en el BOE`);
        continue;
      }
    }
    ok(`${url}`);
  } catch (e) {
    fail(`${url}: ${e.message}`);
  }
}

console.log(failures ? `\n${failures} FALLOS` : '\nPUERTA SUPERADA');
process.exit(failures ? 1 : 0);
