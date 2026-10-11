import {readFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url))),read=p=>readFileSync(join(root,p),'utf8');
for(const p of ['content/burofaxlegal.json','content/revisioncontratos.json','assets/styles.css'])assert.equal(read(p),execFileSync('git',['show','3f5a0cb:'+p],{cwd:root,encoding:'utf8'}),p+' must preserve approved baseline');
const home=read('dist/burofaxlegal.es/index.html'),sibling=read('dist/revisioncontratos.es/index.html');
assert(home.includes('class="bf-opening"')&&home.includes('class="bf-accountability"'));
assert(home.includes('/assets/burofax.css'));assert(!sibling.includes('/assets/burofax.css'));assert(!sibling.includes('bf-accountability'));
const nav=home.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];assert(!nav.includes('/precios/'));
const expected=JSON.parse(read('.impeccable/review/sibling-baseline.json')),current={};const dir=join(root,'dist/revisioncontratos.es');
function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const f=join(d,e.name);if(e.isDirectory())walk(f);else current[f.slice(dir.length)]=createHash('sha256').update(readFileSync(f)).digest('hex')}}walk(dir);assert.deepEqual(current,expected,'sibling generated files byte-identical');
const css=read('assets/burofax.css');for(const block of css.matchAll(/([^{}]+)\{/g)){const selector=block[1].trim();if(selector.startsWith('@')||selector.startsWith('/*'))continue;for(const part of selector.split(','))assert(part.includes('.site-burofaxlegal'),'unscoped selector '+part)}
for(const file of Object.keys(current)){if(file.endsWith('.html'))assert(!read('dist/revisioncontratos.es'+file).includes('Direction contract'))}
assert(!home.includes('OWN-WORLD')&&!home.includes('seed 33632880'));
const originalPortrait=execFileSync('git',['show','3f5a0cb:assets/carla-morales.png'],{cwd:root});
function pngPixels(buffer){const chunks=[];for(let offset=8;offset<buffer.length;){const size=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);if(type==='IDAT'||type==='IHDR'||type==='PLTE'||type==='tRNS')chunks.push(buffer.subarray(offset+4,offset+8+size));offset+=size+12;}return Buffer.concat(chunks)}
assert.deepEqual(pngPixels(readFileSync(join(root,'assets/carla-morales.png'))),pngPixels(originalPortrait),'portrait pixels unchanged; metadata only');
console.log('BUROFAX DESIGN GATE PASSED · content intact · nav intact · scoped CSS · portrait pixels unchanged · '+Object.keys(current).length+' sibling files byte-identical');
