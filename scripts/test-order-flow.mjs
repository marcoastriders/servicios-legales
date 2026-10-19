import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
let source = fs.readFileSync(path.join(root, 'build.mjs'), 'utf8');
source = source.replace(/^import .*;\n/gm, '').replace("const root = dirname(fileURLToPath(import.meta.url));", `const root = ${JSON.stringify(root)};`);
source = source.slice(0, source.indexOf('// ---------- build ----------'));
const ctx = vm.createContext({ ...fs, ...path });
vm.runInContext(source + '\nglobalThis.api={sites,renderIntake,renderOrder,renderHome,renderService,renderPrecios,blockCta,llmsTxt};', ctx);
const {api} = ctx;
const rc = api.sites.find(s => s.id === 'revisioncontratos');
const scripts = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for (const paused of [false,true]) {
  rc.paymentPaused = paused;
  const pages = [api.renderHome(rc),api.blockCta(rc),api.renderPrecios(rc),api.renderIntake(rc),api.renderIntake(rc,{customQuote:true}),...rc.services.map(s=>api.renderService(rc,s))];
  if(paused) {
    for(const html of pages) {
      assert(!/href="\/contratar\//.test(html));
      assert(!/href="https:\/\/buy\.stripe\.com\//.test(html));
    }
    assert(!api.llmsTxt(rc).includes('https://revisioncontratos.es/contratar/'));
  }
  const custom = api.renderService(rc,rc.services.find(s=>s.slug==='contrato-a-medida'));
  assert.equal((custom.match(/class="boton" href="\/solicitar-contrato\/"/g)||[]).length,2);
  const quote = api.renderIntake(rc,{customQuote:true});
  assert(quote.includes('https://revisioncontratos.es/solicitar-contrato/'));
  assert(!quote.includes('id="f-paquete"'));
  assert(quote.includes('id="f-privacidad"'));
}
rc.paymentPaused=false;
for(const query of ['?nivel=%22','?nivel=unknown','?nivel=professional','?nivel=blindada','?nivel=essential']){
  let selected='essential';
  const extras=[{checked:false},{checked:false}];
  const f={addEventListener(){},querySelectorAll(){return extras;},querySelector(sel){
    if(sel==='input[name="nivel"]:checked')return {value:selected};
    const m=sel.match(/^input\[name="nivel"\]\[value="(essential|professional|blindada)"\]$/);
    if(m)return {set checked(v){if(v)selected=m[1];}};
    if(sel.includes('expres'))return extras[0]; if(sel.includes('consulta'))return extras[1];
    throw Error('unsafe selector '+sel);
  }};
  const els={order:f,'order-pagar':{},'order-total':{},'order-extras-nota':{}};
  const js=scripts(api.renderOrder(rc)).find(s=>s.includes('var PRICE='));
  vm.runInNewContext(js,{document:{getElementById:id=>els[id]},location:{search:query},URLSearchParams});
  assert.equal(selected,query.includes('professional')?'professional':query.includes('blindada')?'blindada':'essential');
}
for(const customQuote of [false,true]) for(const attached of [false,true]){
  let submit, request;
  const state={setAttribute(){},focus(){}};
  const f={nombre:{value:'Test Client'},email:{value:'test@example.invalid'},telefono:{value:''},asunto:{value:customQuote?'Contrato a medida':'Arras'},caso:{value:'Necesito ayuda con un contrato y sus condiciones.'},website:{value:''},privacidad:{checked:true},adjuntos:{files:attached?[{name:'test.pdf',size:20}]:[]},children:[state],checkValidity:()=>true,reset(){},addEventListener(_,fn){submit=fn;}};
  if(!customQuote)f.paquete={value:'Revisión Esencial — 129 €'};
  class FD {constructor(){this.fields={};}append(k,v){this.fields[k]=v;}}
  const js=scripts(api.renderIntake(rc,{customQuote})).find(s=>s.includes("getElementById('intake')"));
  vm.runInNewContext(js,{document:{getElementById:id=>id==='intake'?f:id==='intake-estado'?state:{}},location:{search:'',hostname:'revisioncontratos.es'},URLSearchParams,FormData:FD,window:{},fetch:async(_,opts)=>{request=opts;return {ok:true,json:async()=>({ok:true})};}});
  submit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  const payload=attached?request.body.fields:JSON.parse(request.body);
  assert.equal(payload.paquete,customQuote?'':f.paquete.value);
  assert.equal(payload.mode,customQuote?'custom_quote':'');
  assert.equal(payload.asunto,customQuote?'Contrato a medida':'Arras');
  if(attached)assert.equal(Object.keys(request.headers).length,0);
  assert(state.innerHTML);
}
assert(fs.readFileSync(path.join(root,'dist/revisioncontratos.es/sitemap.xml'),'utf8').includes('https://revisioncontratos.es/solicitar-contrato/'));
assert(fs.readFileSync(path.join(root,'dist/revisioncontratos.es/solicitar-contrato/index.html'),'utf8').includes(rc.customOrder.h1));
const full=fs.readFileSync(path.join(root,'build.mjs'),'utf8');
assert(full.includes("put('solicitar-contrato/index.html'"));
assert(full.includes("urls.push({ path: '/solicitar-contrato/'"));
assert(!api.llmsTxt(rc).includes('tarjeta o Bizum'));
console.log('PASS: paused CTA gates, quote routes, malformed nivel, JSON/multipart package and quote serialization');
