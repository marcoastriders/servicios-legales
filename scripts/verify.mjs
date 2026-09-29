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
  const h1 = html.match(/<h1>([^<]+)<\/h1>/)?.[1] || '';
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
for (const oldPrice of ['59 €', '119 €']) {
  if (revisionAll.includes(oldPrice)) fail(`revisioncontratos.es conserva el precio antiguo ${oldPrice}`);
}
for (const expected of [['Revisión Esencial', 79], ['Revisión Profesional', 199], ['Firma Blindada', 399]]) {
  const tier = revisionContent.pricing.tiers.find((t) => t.name.includes(expected[0]));
  if (!tier || tier.priceValue !== expected[1]) fail(`nivel ${expected[0]} no coincide con ${expected[1]} €`);
}
const expectedPayments = { essential: 79, professional: 199, blindada: 399 };
for (const [key, amount] of Object.entries(expectedPayments)) {
  const url = revisionContent.paymentLinks?.[key] || '';
  if (url !== `https://www.paypal.me/carlamorales95/${amount}EUR`)
    fail(`enlace PayPal ${key} no coincide exactamente con el destino autorizado de ${amount} €`);
}
const alquilerHtml = readFileSync(join(dist, 'revisioncontratos.es', 'revision-contrato-alquiler', 'index.html'), 'utf8');
if (alquilerHtml.includes('Si contratas la opción de contraoferta'))
  fail('la página de alquiler conserva una contraoferta ambigua sin nivel ni precio');
if (!alquilerHtml.includes('Revisión Profesional de 199 €'))
  fail('la página de alquiler no asigna expresamente la contraoferta al nivel Profesional');
if (revisionContent.prelaunch) {
  for (const [domain, file] of htmlFiles.filter(([domain]) => domain === 'revisioncontratos.es')) {
    const html = readFileSync(file, 'utf8');
    const rel = file.replace(dist, '');
    if (!html.includes('<meta name="robots" content="noindex,follow">')) fail(`${rel}: prelaunch sin noindex`);
    if (html.includes('paypal.me') || html.includes('paypal.com/paypalme')) fail(`${rel}: enlace de pago visible durante prelaunch`);
    if (html.includes('<form')) fail(`${rel}: formulario de encargo visible durante prelaunch`);
  }
  ok('revisioncontratos.es prelaunch: noindex, sin pagos ni formularios');
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
