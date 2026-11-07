import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(p, 'utf8');
const route = 'campanas/impago-alquiler/';
const base = 'dist/burofaxlegal.es/';
assert.ok(existsSync(base + route + 'index.html'), 'campaign route must exist');
const html = read(base + route + 'index.html');
const visible = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
assert.match(html, /content="noindex,follow"/);
assert.match(html, /rel="canonical" href="https:\/\/burofaxlegal.es\/campanas\/impago-alquiler\/"/);
assert.match(html, /Borrador de campaña · pendiente de revisión jurídica/);
for (const f of ['sitemap.xml', 'llms.txt']) assert.ok(!read(base + f).includes(route));
assert.equal((html.match(/href="\/cuenta-tu-caso\/\?asunto=impago-alquiler"/g) || []).length, 1, 'one CTA after the article');
assert.equal((html.match(/Enviar mi caso para recibir presupuesto/g) || []).length, 1, 'one CTA after the article');
assert.ok(!html.includes('bf-campaign-hero-action'), 'hero must not contain a conversion panel');
const finalCta = html.indexOf('class="bf-campaign-cta"');
assert.ok(finalCta > html.indexOf('Ejemplo ficticio'), 'CTA must follow the article example');
assert.ok(finalCta > html.indexOf('Fuentes normativas'), 'CTA must follow sources');
assert.ok(html.includes('href="/burofax-impago-alquiler/"'), 'natural link to service page');
const data = JSON.parse(read('content/burofaxlegal.json'));
const campaign = data.campaigns['impago-alquiler'];
assert.equal(campaign.reviewStatus, 'pending');
for (const source of campaign.sources) {
  assert.ok(source.checkedAt);
  assert.ok(html.includes(source.url));
  assert.ok(data.services.find(s => s.slug === 'burofax-impago-alquiler').sources.some(s => s.url === source.url));
}
assert.ok(!existsSync('dist/revisioncontratos.es/' + route));
assert.ok(!read('dist/revisioncontratos.es/cuenta-tu-caso/index.html').includes('subjectIndex'));
const intake = read(base + 'cuenta-tu-caso/index.html');
assert.match(intake, /5 MB por archivo y 10 MB en total/);
const script = [...intake.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("getElementById('intake')"));
for (const [query, expected] of [['?asunto=impago-alquiler', 'Impago de alquiler'], ['?asunto=otro', ''], ['?asunto=toString', ''], ['?asunto=__proto__', ''], ['', '']]) {
  const form = { asunto: {value: ''}, addEventListener() {} };
  vm.runInNewContext(script, {document: {getElementById: id => id === 'intake' ? form : {}}, location: {search: query}, URLSearchParams});
  assert.equal(form.asunto.value, expected, query);
}
assert.match(intake, /<option value="Impago de alquiler">Impago de alquiler<\/option>/);
assert.ok(!/fbq\(|connect\.facebook\.net|graph\.facebook\.com/.test(html));

// Layered advertorial structure: one H1, skim-only H2 chain, highlights, figure, scope table, example.
assert.equal((html.match(/<h1/g) || []).length, 1, 'exactly one H1');
assert.ok(visible.includes(campaign.readTime), 'reading time must render');
for (const h of ['Qué te llevas leyendo esta guía', 'Qué respalda esta guía',
  '1. El contrato: qué datos cambian tu reclamación',
  '2. Las cantidades: qué reclamas y cómo lo acreditas',
  '3. Tus avisos previos: qué contar y qué separar',
  '4. Qué consigue un burofax y qué no',
  '5. Los documentos para recibir un presupuesto cerrado',
  'Cómo funciona, paso a paso',
  'Ejemplo de un caso bien preparado']) {
  assert.ok(html.includes(`<h2>${h}</h2>`), `H2 element missing or demoted: ${h}`);
  assert.ok(visible.includes(h), `H2 missing: ${h}`);
}
assert.equal((html.match(/<section class="bf-campaign-takeaways">[\s\S]*?<\/section>/)[0].match(/<li>/g) || []).length, 3, 'takeaways: 3 items');
assert.ok((html.match(/<strong>/g) || []).length >= 8, 'skimmable bold highlights >= 8');
assert.ok((html.match(/<mark>/g) || []).length >= 2, 'highlighted key lines >= 2');
assert.match(html, /<figure class="bf-flow">/);
assert.match(html, /<figcaption>/);
assert.equal((html.match(/bf-flow-num/g) || []).length, 4, 'flow figure: 4 steps');
assert.match(html, /<caption>Qué incluye el servicio de redacción y qué queda fuera<\/caption>/);
assert.match(html, /<th scope="col">Qué incluye<\/th>/);
assert.match(html, /<th scope="col">Qué no incluye<\/th>/);
assert.match(visible, /Ejemplo ficticio/);
const doclist = html.match(/bf-doccheck[\s\S]*?<\/ul>/)[0];
assert.equal((doclist.match(/<li>/g) || []).length, 7, 'document checklist items');
assert.equal((doclist.match(/<input type="checkbox">/g) || []).length, 7, 'interactive checklist: native checkboxes');
assert.equal((doclist.match(/<label>/g) || []).length, 7, 'interactive checklist: every checkbox labelled');
// No missing space between sentences (numeric citations like 22.4 are masked first).
const badSpacing = visible.replace(/\d+\.\d+/g, 'N.N').match(/[a-záéíóúñ][.,;:](?=[A-ZÁÉÍÓÚÑ¿¡])/g) || [];
assert.deepEqual(badSpacing, [], `missing space after punctuation: ${badSpacing.join(' | ')}`);

const css = read('assets/burofax.css');
assert.match(css, /\.site-burofaxlegal\.page-campaign #analytics-consent\s*\{[^}]*position:\s*static/s, 'campaign cookie notice must not cover the primary CTA');
console.log('PASS campaign route, draft, sources, CTAs, attachment help, valid/invalid subject preselection, unobstructed consent and site isolation');
