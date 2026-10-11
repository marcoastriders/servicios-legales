import {readFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url))),read=p=>readFileSync(join(root,p),'utf8');
const original=read('content/burofaxlegal.json').replaceAll('Cuéntame','Cuéntanos').replaceAll('Te cuento mi caso','Os cuento mi caso');
for(const p of ['content/burofaxlegal.json','content/revisioncontratos.json','assets/styles.css'])assert.equal(p==='content/burofaxlegal.json'?original:read(p),execFileSync('git',['show','3f5a0cb:'+p],{cwd:root,encoding:'utf8'}),p+' must preserve approved baseline beyond the owner-approved CTA label change');
assert(read('content/burofaxlegal.json').includes('Cuéntame tu caso')&&!read('content/revisioncontratos.json').includes('Cuéntame'),'singular CTA only on burofaxlegal');
const home=read('dist/burofaxlegal.es/index.html'),sibling=read('dist/revisioncontratos.es/index.html');
assert(home.includes('class="bf-opening"')&&home.includes('class="bf-accountability"'));
assert(home.includes('/assets/burofax.css'));assert(!sibling.includes('/assets/burofax.css'));assert(!sibling.includes('bf-accountability'));
const nav=home.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];assert(!nav.includes('/precios/'));
for(const f of ['index','cuenta-tu-caso/index']){const html=read(`dist/burofaxlegal.es/${f}.html`);assert(!html.includes('Cuéntanos'),'stale plural CTA '+f);assert(html.includes('Cuéntame'),'singular CTA missing '+f);}
assert.throws(()=>read('dist/burofaxlegal.es/precios/index.html'),'burofaxlegal.es/precios debe estar retirada');assert(!home.includes('href="/precios/"'),'enlaces internos a /precios/ en portada');
for(const f of ['index','cuenta-tu-caso/index','precios/index'])assert(read(`dist/revisioncontratos.es/${f}.html`).includes('Cuéntanos tu caso'),'sibling CTA label must not change');
assert(home.includes('Te%20cuento%20mi%20caso')&&!home.includes('Os%20cuento'),'WhatsApp default must address Carla in the singular');
assert(read('assets/burofax.css').includes('main > h1'),'reading column centring rule missing');
const expected=JSON.parse(read('.impeccable/review/sibling-baseline.json')),current={};const dir=join(root,'dist/revisioncontratos.es');
function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const f=join(d,e.name);if(e.isDirectory())walk(f);else current[f.slice(dir.length)]=createHash('sha256').update(readFileSync(f)).digest('hex')}}walk(dir);assert.deepEqual(current,expected,'sibling generated files byte-identical');
const css=read('assets/burofax.css');for(const block of css.matchAll(/([^{}]+)\{/g)){const selector=block[1].trim();if(selector.startsWith('@')||selector.startsWith('/*'))continue;for(const part of selector.split(','))assert(part.includes('.site-burofaxlegal'),'unscoped selector '+part)}
for(const file of Object.keys(current)){if(file.endsWith('.html'))assert(!read('dist/revisioncontratos.es'+file).includes('Direction contract'))}
assert(!home.includes('OWN-WORLD')&&!home.includes('seed 33632880'));
const originalPortrait=execFileSync('git',['show','3f5a0cb:assets/carla-morales.png'],{cwd:root});
function pngPixels(buffer){const chunks=[];for(let offset=8;offset<buffer.length;){const size=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);if(type==='IDAT'||type==='IHDR'||type==='PLTE'||type==='tRNS')chunks.push(buffer.subarray(offset+4,offset+8+size));offset+=size+12;}return Buffer.concat(chunks)}
assert.deepEqual(pngPixels(readFileSync(join(root,'assets/carla-morales.png'))),pngPixels(originalPortrait),'portrait pixels unchanged; metadata only');
console.log('BUROFAX DESIGN GATE PASSED · content intact · nav intact · scoped CSS · portrait pixels unchanged · '+Object.keys(current).length+' sibling files byte-identical');
