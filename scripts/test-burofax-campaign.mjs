import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(p, 'utf8');
const route = 'campanas/impago-alquiler/';
const base = 'dist/burofaxlegal.es/';
assert.ok(existsSync(base + route + 'index.html'), 'campaign route must exist');
const html = read(base + route + 'index.html');
assert.match(html, /content="noindex,follow"/);
assert.match(html, /rel="canonical" href="https:\/\/burofaxlegal.es\/campanas\/impago-alquiler\/"/);
assert.match(html, /Borrador de campaña · pendiente de revisión jurídica/);
for (const f of ['sitemap.xml', 'llms.txt']) assert.ok(!read(base + f).includes(route));
assert.equal((html.match(/href="\/cuenta-tu-caso\/\?asunto=impago-alquiler"/g) || []).length, 2);
assert.equal((html.match(/Enviar mi caso para recibir presupuesto/g) || []).length, 2);
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
const css = read('assets/burofax.css');
assert.match(css, /\.site-burofaxlegal\.page-campaign #analytics-consent\s*\{[^}]*position:\s*static/s, 'campaign cookie notice must not cover the primary CTA');
console.log('PASS campaign route, draft, sources, CTAs, attachment help, valid/invalid subject preselection, unobstructed consent and site isolation');
