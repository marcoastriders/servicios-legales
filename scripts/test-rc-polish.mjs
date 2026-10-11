import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const manifest=JSON.parse(readFileSync(join(root,'.impeccable/review/rc-baseline.json')));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const siblingFiles=walk(join(root,'dist/burofaxlegal.es')).map(f=>f.slice(join(root,'dist').length+1)).sort();
assert.deepEqual(siblingFiles,Object.keys(manifest).filter(f=>f.startsWith('burofaxlegal.es/')).sort(),'sibling exact route/file set');
for(const [path,hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(readFileSync(join(root,'dist',path))).digest('hex'),hash,path);
const pages=walk(join(root,'dist/revisioncontratos.es')).filter(p=>p.endsWith('.html'));
assert.equal(pages.length,18); // 17 public sitemap routes plus 404
for(const path of pages){const html=readFileSync(path,'utf8');assert(html.includes('/assets/revisioncontratos-polish.css'));assert(!html.includes('class="kicker"'));assert(!html.includes('class="precio-etiqueta"'));assert(html.includes('id="analytics-preferences"'));assert(!/buy\.stripe\.com|pag(?:a|as|ar|ue|ues|o) online|Contratar y pagar/i.test(html),'paused checkout: '+path);}
const blockedOnline=/pag(?:a|as|ar|ue|ues|o) online/i;
for(const variant of ['paga online','pagas online','pagar online','pague online','pagues online','pago online']) assert(blockedOnline.test(variant),variant);
const data=JSON.parse(readFileSync(join(root,'content/revisioncontratos.json')));
assert.deepEqual(data.pricing.tiers.map(t=>t.priceValue),[79,199,399]);
assert.equal(data.home.serviceGroups.flatMap(g=>g.slugs).length,8);
assert(readFileSync(join(root,'dist/revisioncontratos.es/cuenta-tu-caso/index.html'),'utf8').includes('Mínimo 30 caracteres'));
console.log(`RC polish PASS: ${pages.length} HTML, 17 public routes; ${Object.keys(manifest).length} sibling/original-asset hashes unchanged; prices, groups, helpers, preferences, no kickers`);
