import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
let src=fs.readFileSync(path.join(root,'build.mjs'),'utf8').replace(/^import .*;\n/gm,'').replace('const root = dirname(fileURLToPath(import.meta.url));',`const root = ${JSON.stringify(root)};`);
src=src.slice(0,src.indexOf('// ---------- build ----------'));
const c=vm.createContext({...fs,...path});
vm.runInContext(src+'\nglobalThis.api={sites,renderOrder,renderIntake,renderPrecios,renderHome,renderService};',c);
const {api}=c;
const site=api.sites.find(s=>s.id==='revisioncontratos');site.paymentPaused=false;
const bf=api.sites.find(s=>s.id==='burofaxlegal');
const html=api.renderOrder(site);
assert(!html.includes('buy.stripe.com'),'public checkout must not expose direct payment links');
assert(!html.includes('order-postal'));
assert(!html.includes('order-territory'));
assert(!html.includes('input type="radio" name="nivel"'));
assert(html.includes('id="order-resumen-titulo"'));
assert(html.includes('id="order-extras"'));
assert(html.includes('IVA incluido (21 %)'));
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var LEVEL='));

async function run({query='',status=200,url='https://checkout.stripe.com/c/pay/test',network=false,pending=false}={}){
 let request,redirect,submit,fetchCount=0;
 const events={},extras=[{checked:false,disabled:false},{checked:false,disabled:false}];
 const f={addEventListener:(e,fn)=>{events[e]=fn;},querySelectorAll:s=>{assert.equal(s,'input[name="extra"]');return extras;}};
 const els={order:f,'order-pagar':{},'order-total':{},'order-iva':{},'order-extras':{},'order-resumen-titulo':{},'order-level-detail':{},'order-base':{},'order-status':{}};
 vm.runInNewContext(script,{document:{getElementById:id=>els[id]},location:{search:query,assign:u=>redirect=u},URLSearchParams,URL,fetch:async(u,opts)=>{request={u,...opts};fetchCount++;if(pending)return new Promise(()=>{});if(network)throw Error('offline');return {ok:status===200,status,json:async()=>({ok:status===200,url})};}});
 submit=events.submit;assert(submit,'checkout must intercept form submit');submit({preventDefault(){}});await new Promise(r=>setImmediate(r));
 return {request,redirect,els,extras,submit,get fetchCount(){return fetchCount;}};
}

for(const [query,key,total] of [['','essential',129],['?nivel=essential&expres=1','essentialExpress',178],['?nivel=essential&consulta=1','essentialCall',178],['?nivel=essential&expres=1&consulta=1','essentialBoth',227],['?nivel=professional','professional',249],['?nivel=blindada','blindada',499]]){
 const r=await run({query});
 assert.deepEqual(JSON.parse(r.request.body),{key});
 assert.equal(r.request.u,'https://intake.marcospera.com/checkout');
 assert.equal(r.redirect,'https://checkout.stripe.com/c/pay/test');
 assert(r.els['order-total'].textContent.includes(String(total)));
 assert(r.els['order-iva'].textContent.includes('21 %'));
 if(query.includes('professional')||query.includes('blindada'))assert.equal(r.els['order-extras'].hidden,true);
}
for(const query of ['?nivel=%22','?nivel=unknown'])assert.equal(JSON.parse((await run({query})).request.body).key,'essential');
const waiting=await run({pending:true});assert.equal(waiting.els['order-pagar'].disabled,true);waiting.submit({preventDefault(){}});assert.equal(waiting.fetchCount,1);
for(const opts of [{status:429},{status:502},{network:true},{url:'http://checkout.stripe.com/x'},{url:'https://checkout.stripe.com.evil.test/x'},{url:'https://evil.test/x'},{url:'https://user@checkout.stripe.com/x'}]){
 const r=await run(opts);assert(!r.redirect);assert.equal(r.els['order-pagar'].disabled,false);assert(r.els['order-status'].textContent);
}

const pricing=api.renderPrecios(site);
for(const level of ['essential','professional','blindada'])assert(pricing.includes(`/contratar/?nivel=${level}`));
assert(!pricing.includes('precio-bump'));
assert(!pricing.includes('expres=1'));
assert(!pricing.includes('consulta=1'));
assert(!pricing.includes('extras-pago'));
for(const page of [pricing,api.renderHome(site),...site.services.map(s=>api.renderService(site,s))])assert(!page.includes('buy.stripe.com'));

const delivery=bf.services.find(s=>s.slug==='burofax-entrega-de-llaves');
const deliveryHtml=api.renderService(bf,delivery);
assert(deliveryHtml.includes('¿Necesitas dejar constancia de que has pedido la entrega de las llaves?'));
assert(deliveryHtml.includes('Enviar el caso y los documentos'));
assert(deliveryHtml.includes('Escribir por WhatsApp'));
assert(!deliveryHtml.includes('presupuestar el requerimiento'));

const pw=process.env.PLAYWRIGHT_MODULE || '/home/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const {chromium}=await import(pw);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
try {
 const ctx=await browser.newContext();let calls=[],response={status:200,body:JSON.stringify({ok:true,url:'https://checkout.stripe.com/c/pay/test'})},offline=false;
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='intake.marcospera.com'){
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'https://revisioncontratos.es','access-control-allow-methods':'POST','access-control-allow-headers':'content-type'}});
   calls.push(route.request());if(offline)return route.abort('failed');return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'https://revisioncontratos.es'},...response});
  }
  if(u.hostname==='revisioncontratos.es'&&route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<h1>Intercepted test checkout</h1>'});
  return route.abort();
 });
 const p=await ctx.newPage();
 for(const [query,key,total] of [['?nivel=essential','essential',129],['?nivel=essential&expres=1','essentialExpress',178],['?nivel=essential&consulta=1','essentialCall',178],['?nivel=essential&expres=1&consulta=1','essentialBoth',227],['?nivel=professional','professional',249],['?nivel=blindada','blindada',499]]){
  calls=[];response={status:200,body:JSON.stringify({ok:true,url:'https://checkout.stripe.com/c/pay/test'})};await p.goto('https://revisioncontratos.es/contratar/'+query);assert((await p.locator('#order-total').textContent()).includes(String(total)));assert.equal(await p.locator('#order-postal').count(),0);assert.equal(await p.locator('#order-territory').count(),0);await p.locator('#order-pagar').click();await p.waitForURL('https://checkout.stripe.com/c/pay/test');assert.deepEqual(calls[0].postDataJSON(),{key});
 }
 await p.goto('https://revisioncontratos.es/contratar/?nivel=essential');
 for(const code of [429,502]){response={status:code,body:JSON.stringify({ok:false})};await p.locator('#order-pagar').click();await p.waitForFunction(()=>document.querySelector('#order-status').textContent.length>0);assert.equal(await p.locator('#order-pagar').isDisabled(),false);}
 offline=true;await p.locator('#order-pagar').click();await p.waitForFunction(()=>!document.querySelector('#order-pagar').disabled);offline=false;
 const no=await browser.newContext({javaScriptEnabled:false});await no.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());const n=await no.newPage();await n.goto('https://revisioncontratos.es/contratar/?nivel=essential');assert(await n.locator('#order-pagar').isDisabled());assert(await n.locator('noscript a[href="/precios/"]').isVisible());assert.equal(await n.locator('a[href*="stripe.com"]').count(),0);await no.close();await ctx.close();
 console.log('PASS checkout UX: level selected on pricing, extras only on order, no postcode/residency, fixed 21% VAT, secure redirect and ethical Burofax CTA');
} finally { await browser.close(); }
