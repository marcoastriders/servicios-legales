import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
function buildInMemory(text){
 const output={};text=text.replace(/^import .*;\n/gm,'').replace('const root = dirname(fileURLToPath(import.meta.url));',`const root = ${JSON.stringify(root)};`);
 vm.runInNewContext(text,{...fs,...path,console:{log(){}},rmSync(){},mkdirSync(){},cpSync(){},writeFileSync:(file,body)=>output[path.relative(path.join(root,'dist'),file)]=body});return output;
}
const baseline=buildInMemory(execFileSync('git',['show','HEAD:build.mjs'],{cwd:root,encoding:'utf8'}));
const current=buildInMemory(fs.readFileSync(path.join(root,'build.mjs'),'utf8'));
const bf=Object.keys(baseline).filter(k=>k.startsWith('burofaxlegal.es/'));
assert(bf.length>0);for(const key of bf)assert.equal(current[key],baseline[key],`BF must remain byte-identical: ${key}`);
for(const [key,body] of Object.entries(current))if(key.startsWith('revisioncontratos.es/'))assert(!body.includes('buy.stripe.com'),`public direct Stripe bypass: ${key}`);
assert(current['revisioncontratos.es/sitemap.xml'].includes('/solicitar-presupuesto/'));
assert(current['revisioncontratos.es/llms.txt'].includes('/solicitar-presupuesto/'));
assert(current['revisioncontratos.es/condiciones-del-servicio/index.html'].includes('href="/solicitar-presupuesto/"'));
console.log(`PASS ${bf.length} BF files byte-identical, all RC public output has no direct Stripe URLs`);
let src=fs.readFileSync(path.join(root,'build.mjs'),'utf8').replace(/^import .*;\n/gm,'').replace('const root = dirname(fileURLToPath(import.meta.url));',`const root = ${JSON.stringify(root)};`);
src=src.slice(0,src.indexOf('// ---------- build ----------'));
const c=vm.createContext({...fs,...path});vm.runInContext(src+'\nglobalThis.api={sites,renderOrder,renderIntake,renderPrecios,renderHome,renderService};',c);
const {api}=c,site=api.sites.find(s=>s.id==='revisioncontratos');site.paymentPaused=false;
const html=api.renderOrder(site);
assert(!html.includes('buy.stripe.com'),'public checkout must not expose direct payment links');
assert(html.includes('id="order-postal"'));
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var PRICE='));
async function run({query='',postal='28013',confirmed=true,status=200,url='https://checkout.stripe.com/c/pay/test',network=false,pending=false}={}){
 let nivel='essential',request,redirect,submit,fetchCount=0;const events={},extras=[{checked:false},{checked:false}];
 const f={addEventListener:(e,fn)=>{events[e]=fn;},querySelectorAll:()=>extras,querySelector:s=>{
 if(s==='input[name="nivel"]:checked')return {value:nivel};
 const m=s.match(/^input\[name="nivel"\]\[value="(essential|professional|blindada)"\]$/);if(m)return {set checked(v){if(v)nivel=m[1];}};
 if(s.includes('expres'))return extras[0];if(s.includes('consulta'))return extras[1];throw Error('Unsafe selector '+s);
 }};
 const els={order:f,'order-pagar':{},'order-total':{},'order-extras-nota':{},'order-postal':{value:postal},'order-territory':{checked:confirmed},'order-status':{},'order-quote':{}};
 vm.runInNewContext(script,{document:{getElementById:id=>els[id]},location:{search:query,assign:u=>redirect=u},URLSearchParams,URL,fetch:async(u,opts)=>{request={u,...opts};fetchCount++;if(pending)return new Promise(()=>{});if(network)throw Error('offline');return {ok:status===200,status,json:async()=>({ok:status===200,url})};}});
 submit=events.submit;assert(submit,'checkout must intercept form submit');submit({preventDefault(){}});await new Promise(r=>setImmediate(r));return {request,redirect,els,submit,get fetchCount(){return fetchCount;}};
}
for(const [query,key,total] of [['','essential',129],['?expres=1','essentialExpress',178],['?consulta=1','essentialCall',178],['?expres=1&consulta=1','essentialBoth',227],['?nivel=professional','professional',249],['?nivel=blindada','blindada',499]]){
 const r=await run({query});assert.deepEqual(JSON.parse(r.request.body),{key,country:'ES',postal_code:'28013'});assert.equal(r.request.u,'https://intake.marcospera.com/checkout');assert.equal(r.redirect,'https://checkout.stripe.com/c/pay/test');assert(r.els['order-total'].textContent.includes(String(total)));
}
for(const postal of ['','1234','00000','53001','35001','38001','51001','52001','abcde']){const r=await run({postal});assert(!r.request,postal);assert(!r.redirect);}
assert(!(await run({confirmed:false})).request);
const waiting=await run({pending:true});assert.equal(waiting.els['order-pagar'].disabled,true);waiting.submit({preventDefault(){}});assert.equal(waiting.fetchCount,1);
for(const query of ['?nivel=%22','?nivel=unknown'])assert.equal(JSON.parse((await run({query})).request.body).key,'essential');
for(const opts of [{status:429},{status:502},{network:true},{url:'http://checkout.stripe.com/x'},{url:'https://checkout.stripe.com.evil.test/x'},{url:'https://evil.test/x'},{url:'https://user@checkout.stripe.com/x'}]){const r=await run(opts);assert(!r.redirect);assert.equal(r.els['order-pagar'].disabled,false);assert(r.els['order-status'].textContent);r.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(r.els['order-pagar'].disabled,false);}
for(const page of [api.renderPrecios(site),api.renderHome(site),...site.services.map(s=>api.renderService(site,s))])assert(!page.includes('buy.stripe.com'));
for(const attached of [false,true]){
 const q=api.renderIntake(site,{territoryQuote:true});assert(q.includes('id="f-region"'));assert(!q.includes('id="f-paquete"'));assert(q.includes('/solicitar-presupuesto/'));
 let submit,request;const estado={setAttribute(){},focus(){}};
 const f={nombre:{value:'Test'},email:{value:'test@example.invalid'},telefono:{value:''},asunto:{value:'Arras'},region:{value:'Canarias'},caso:{value:'Necesito una revisión de mi contrato de arras.'},website:{value:''},privacidad:{checked:true},adjuntos:{files:attached?[{name:'test.pdf',size:10}]:[]},children:[estado],checkValidity:()=>true,reset(){},addEventListener:(_,fn)=>submit=fn};
 class FD{constructor(){this.fields={};}append(k,v){this.fields[k]=v;}}
 const js=[...q.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("getElementById('intake')"));vm.runInNewContext(js,{document:{getElementById:id=>id==='intake'?f:id==='intake-estado'?estado:{}},location:{hostname:'revisioncontratos.es',search:''},URLSearchParams,FormData:FD,window:{},fetch:async(_,opts)=>{request=opts;return {ok:true,json:async()=>({ok:true})};}});submit({preventDefault(){}});await new Promise(r=>setImmediate(r));const p=attached?request.body.fields:JSON.parse(request.body);assert.equal(p.mode,'territory_quote');assert.equal(p.region,'Canarias');assert(!p.paquete);if(attached)assert.equal(Object.keys(request.headers).length,0);
}
const nojs=html.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];assert(nojs.includes('/solicitar-presupuesto/'));assert(!nojs.includes('stripe.com'));
console.log('PASS fixed checkout: six payloads/totals, territory guards, retries, redirects, quote JSON/multipart and no bypass');

// Exercise the generated handlers in Chromium; all network is intercepted.
const pw=process.env.PLAYWRIGHT_MODULE || '/home/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const {chromium}=await import(pw);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
try {
 const ctx=await browser.newContext();let calls=[],response={status:502,body:JSON.stringify({ok:false})},offline=false;
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='intake.marcospera.com'){
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'https://revisioncontratos.es','access-control-allow-methods':'POST','access-control-allow-headers':'content-type'}});
   calls.push(route.request());if(offline)return route.abort('failed');
   return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'https://revisioncontratos.es'},...response});
  }
  if(u.hostname==='revisioncontratos.es'&&route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:u.pathname==='/solicitar-presupuesto/'?api.renderIntake(site,{territoryQuote:true}):html});
  if(u.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<h1>Intercepted test checkout</h1>'});
  return route.abort();
 });
 const p=await ctx.newPage();
 for(const [query,key,total] of [['','essential',129],['?expres=1','essentialExpress',178],['?consulta=1','essentialCall',178],['?expres=1&consulta=1','essentialBoth',227],['?nivel=professional','professional',249],['?nivel=blindada','blindada',499]]){
  calls=[];response={status:200,body:JSON.stringify({ok:true,url:'https://checkout.stripe.com/c/pay/test'})};await p.goto('https://revisioncontratos.es/contratar/'+query);assert((await p.locator('#order-total').textContent()).includes(String(total)));await p.locator('#order-postal').fill('28013');await p.locator('#order-territory').check();await p.locator('#order-pagar').click();await p.waitForURL('https://checkout.stripe.com/c/pay/test');assert.deepEqual(calls[0].postDataJSON(),{key,country:'ES',postal_code:'28013'});
 }
 await p.goto('https://revisioncontratos.es/contratar/');await p.locator('#order-territory').check();calls=[];
 for(const code of ['','1234','00000','35001','38001','51001','52001','53001']){await p.locator('#order-postal').fill(code);await p.locator('#order-pagar').click();assert.equal(calls.length,0);}
 for(const code of [429,502]){response={status:code,body:JSON.stringify({ok:false})};await p.locator('#order-postal').fill('07001');await p.locator('#order-pagar').click();await p.waitForFunction(()=>document.querySelector('#order-status').textContent.length>0);assert.equal(await p.locator('#order-pagar').isDisabled(),false);}
 offline=true;await p.locator('#order-pagar').click();await p.waitForFunction(()=>!document.querySelector('#order-pagar').disabled);offline=false;
 for(const attached of [false,true]){
  calls=[];response={status:200,body:'{"ok":true}'};await p.goto('https://revisioncontratos.es/solicitar-presupuesto/');await p.locator('#f-nombre').fill('Test Client');await p.locator('#f-email').fill('client@example.invalid');await p.locator('#f-region').fill('Canarias');await p.locator('#f-asunto').selectOption('Arras');await p.locator('#f-caso').fill('Necesito revisar un contrato de arras antes de firmarlo.');await p.locator('#f-privacidad').check();if(attached)await p.locator('#f-docs').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTest')});await p.locator('#intake-btn').click();await p.waitForFunction(()=>document.querySelector('#intake-estado').textContent.includes('Solicitud recibida'));
  if(attached){const body=calls[0].postDataBuffer().toString();assert(body.includes('name="region"\r\n\r\nCanarias'));assert(body.includes('territory_quote'));}else {assert.equal(calls[0].postDataJSON().region,'Canarias');assert.equal(calls[0].postDataJSON().mode,'territory_quote');}
 }
 const no=await browser.newContext({javaScriptEnabled:false});await no.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());const n=await no.newPage();await n.goto('https://revisioncontratos.es/contratar/');assert(await n.locator('#order-pagar').isDisabled());assert(await n.locator('noscript a[href="/solicitar-presupuesto/"]').isVisible());assert.equal(await n.locator('a[href*="stripe.com"]').count(),0);await no.close();await ctx.close();
 console.log('PASS Chromium: six selections, guarded postal, 429/502/network recovery, quote JSON/multipart, no-JS fallback (all requests intercepted)');
}finally{await browser.close();}
