import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

function harness(site, choice, response = {ok:true, body:{ok:true}}) {
  const calls=[], handlers={}, store=new Map(choice ? [[`ga_consent_${site}`,choice]] : []);
  function element() { return {hidden:true, listeners:{}, addEventListener(type,fn){this.listeners[type]=fn;}, setAttribute(k,v){this[k]=v;}, focus(){this.focused=true;}}; }
  const ids=Object.fromEntries(['analytics-consent','analytics-accept','analytics-reject','intake','intake-btn','intake-estado'].map(id=>[id,element()]));
  ids['intake-estado'].hidden=false;
  const f=ids.intake;
  for(const name of ['nombre','email','telefono','asunto','caso','website']) f[name]={value:name==='website'?'':`PRIVATE_${name}@example.invalid`};
  f.privacidad={checked:true}; f.children=[ids['intake-btn'],ids['intake-estado']];
  f.checkValidity=()=>true; f.reportValidity=()=>{}; f.reset=()=>{f.resets=(f.resets||0)+1;};
  const sandbox={console, location:{hostname:`${site}.es`}, localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}, document:{getElementById:id=>ids[id],addEventListener:(type,fn)=>{handlers[type]=fn;}}, fetch:async()=>{if(response.throw)throw Error('offline'); return {ok:response.ok,json:async()=>{if(response.badJson)throw Error('JSON');return response.body;}};}};
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  const html=readFileSync(new URL(`../dist/${site}.es/cuenta-tu-caso/index.html`,import.meta.url),'utf8');
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if(!/src=|application\/ld\+json/.test(match[1])) vm.runInContext(match[2],sandbox);
  }
  sandbox.gtag=(...args)=>calls.push(args);
  return {sandbox,ids,store,calls,handlers,html,async submit(){f.listeners.submit({preventDefault(){}}); await setImmediate();},click(href){handlers.click({target:{closest:()=>({getAttribute:()=>href})}});}};
}

for(const site of ['burofaxlegal','revisioncontratos']) {
  // Run the real gtag bootstrap again to inspect stored-consent restoration.
  const h=harness(site,'accepted');
  const queued=Array.from(h.sandbox.dataLayer, args=>Array.from(args));
  assert(queued.some(args=>args[0]==='consent'&&args[1]==='update'&&args[2].analytics_storage==='granted'),`${site}: accepted reload restores consent`);
}
for(const site of ['burofaxlegal','revisioncontratos']) {
  for(const choice of ['accepted','rejected',undefined]) {
    const h=harness(site,choice);
    assert.equal(typeof h.sandbox.trackLegalEvent,'function');
    h.sandbox.trackLegalEvent('generate_lead');
    h.click('https://wa.me/123456?text=PRIVATE_case');
    h.click('mailto:PRIVATE_email@example.invalid');
    h.click('/precios/');
    assert.equal(h.calls.filter(c=>c[0]==='event').length,choice==='accepted'?3:0);
    if(choice==='accepted') {
      assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[['event','generate_lead',{}],['event','contact_click',{contact_method:'whatsapp'}],['event','contact_click',{contact_method:'email'}]]);
      const count=h.calls.length;
      for(const [event,params] of [['unknown',{}],['generate_lead',{email:'PRIVATE'}],['contact_click',{contact_method:'PRIVATE'}],['contact_click',{contact_method:'email',url:'PRIVATE'}],['contact_click',{}],['toString',{}]]) h.sandbox.trackLegalEvent(event,params);
      assert.equal(h.calls.length,count,'strict allowlist rejects unsafe payloads');
      h.store.set(`ga_consent_${site}`,'rejected');
      h.sandbox.trackLegalEvent('generate_lead');
      assert.equal(h.calls.length,count,'consent checked on every call');
      h.store.set(`ga_consent_${site}`,'accepted');
      h.sandbox.gtag=undefined;
      assert.doesNotThrow(()=>h.sandbox.trackLegalEvent('generate_lead'));
    }
    const lead=harness(site,choice);
    await lead.submit();
    assert.equal(lead.calls.filter(c=>c[0]==='event'&&c[1]==='generate_lead').length,choice==='accepted'?1:0);
    assert.equal(lead.ids['intake-estado'].hidden,false,'success live region remains visible');
    assert.equal(lead.ids['intake-estado'].focused,true);
    assert.equal(lead.ids['intake-estado'].tabindex,'-1');
    assert(!JSON.stringify(lead.calls).includes('PRIVATE'),'no form PII in analytics');
  }
  for(const response of [{ok:false,body:{ok:true}},{ok:true,body:{ok:false}},{ok:false,body:{ok:false}},{throw:true},{ok:true,badJson:true}]) {
    const h=harness(site,'accepted',response); await h.submit();
    assert.equal(h.calls.filter(c=>c[0]==='event').length,0,'failed requests never count as leads');
    assert.equal(h.ids['intake-btn'].disabled,false);
  }
  const h=harness(site);
  h.ids['analytics-accept'].listeners.click();
  assert.equal(h.store.get(`ga_consent_${site}`),'accepted');
  assert.equal(h.ids['analytics-consent'].hidden,true);
  h.ids['analytics-reject'].listeners.click();
  h.sandbox.trackLegalEvent('generate_lead');
  assert.equal(h.calls.filter(c=>c[0]==='event').length,0);
}
console.log('Analytics tests passed: both sites; consent, reload, allowlist, contacts, intake success/failure, PII and accessible feedback');
