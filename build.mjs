// Generador estático multi-sitio: burofaxlegal.es + revisioncontratos.es
// Uso: node build.mjs  →  dist/<dominio>/...
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shared = JSON.parse(readFileSync(join(root, 'content/shared.json'), 'utf8'));
const sites = [];
for (const f of ['burofaxlegal', 'revisioncontratos']) {
  sites.push(JSON.parse(readFileSync(join(root, `content/${f}.json`), 'utf8')));
}

const CHECKED = '2026-10-02';

function personGraph() {
  return {
    '@type': 'Person',
    '@id': 'https://carlamorales.es/#person',
    name: 'Carla Morales',
    alternateName: 'Jean Carla Morales Rivero',
    jobTitle: 'Abogada',
    description: 'Abogada civil y mercantil colegiada en el Ilustre Colegio de Abogados de Jerez.',
    url: 'https://carlamorales.es/',
    sameAs: [shared.linkedin, shared.googleBusiness],
  };
}

function legalServiceGraph(site) {
  return {
    '@type': 'LegalService',
    '@id': `https://${site.domain}/#legalservice`,
    name: site.name,
    description: site.description,
    url: `https://${site.domain}/`,
    areaServed: { '@type': 'Country', name: 'España' },
    provider: { '@id': 'https://carlamorales.es/#person' },
    parentOrganization: { '@id': 'https://carlamorales.es/#person' },
  };
}

function jsonLdGraph(site, page, extra = []) {
  const graph = [legalServiceGraph(site), personGraph(), ...extra];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function breadcrumbs(site, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: `https://${site.domain}${it.path}`,
    })),
  };
}

function faqGraph(faqs) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

function layout(site, page, { title, description, path, body, extraLd = [], bodyClass = '' }) {
  const url = `https://${site.domain}${path}`;
  const crumbs = breadcrumbs(site, page.crumbs);
  const ld = jsonLdGraph(site, page, [crumbs, ...extraLd]);
  const analyticsId = site.id === 'burofaxlegal' ? 'G-0VJ895YMEX' : site.id === 'revisioncontratos' ? 'G-3T09PQEZP4' : null;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${site.prelaunch ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">'}
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="theme-color" content="${site.accent}">
${site.id === 'revisioncontratos' ? '<meta name="msvalidate.01" content="1160220F5D3BD4A1C4D653274D6DBE01">' : ''}
<link rel="stylesheet" href="/assets/styles.css">
${analyticsId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${analyticsId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500});
  gtag('js', new Date());
  gtag('config', '${analyticsId}', {anonymize_ip: true});
</script>` : ''}
${ld}
</head>
<body class="${bodyClass}${bodyClass ? ' ' : ''}site-${site.id}">
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="cabecera">
  <div class="wrap cabecera-in">
    <a class="marca" href="/">${esc(site.name)}<span class="marca-sub">por Carla Morales · Abogada</span></a>
    <nav class="nav" aria-label="Principal">
      ${site.nav.map((n) => `<a href="${n.path}"${n.path === path ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
${site.prelaunch ? `<aside class="prelaunch" role="status"><div class="wrap"><strong>Sitio en preparación.</strong> Las tarifas, plazos y alcance están pendientes de confirmación profesional. Todavía no se aceptan encargos desde esta web.</div></aside>` : ''}
<main id="contenido" class="wrap">
${body}
</main>
${analyticsId ? `<aside id="analytics-consent" class="analytics-consent" aria-label="Preferencias de cookies" hidden>
  <p><strong>Medición opcional.</strong> Google Analytics solo se activa si aceptas. <a href="/cookies/">Ver detalles</a>.</p>
  <p class="analytics-actions"><button type="button" id="analytics-accept">Aceptar</button> <button type="button" id="analytics-reject">Rechazar</button></p>
</aside>
<script>
(function(){
  var key='ga_consent_${site.id}', banner=document.getElementById('analytics-consent');
  if(!banner) return;
  var choice=localStorage.getItem(key);
  if(!choice) banner.hidden=false;
  function update(value){
    localStorage.setItem(key,value);
    if(window.gtag) window.gtag('consent','update',{analytics_storage:value==='accepted'?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    banner.hidden=true;
  }
  document.getElementById('analytics-accept').addEventListener('click',function(){update('accepted');});
  document.getElementById('analytics-reject').addEventListener('click',function(){update('rejected');});
})();
</script>` : ''}
<footer class="pie">
  <div class="wrap pie-in">
    <div>
      <p class="pie-marca">${esc(site.name)}</p>
      <p>Servicio jurídico online de <strong>Carla Morales</strong>, abogada colegiada en el Ilustre Colegio de Abogados de Jerez. Revisión profesional de cada encargo.</p>
      <p class="pie-enlaces-entidad">
        <a href="https://carlamorales.es/" rel="me">carlamorales.es</a> ·
        <a href="https://tramitesjuridicos.com/" rel="me">Guías en Trámites Jurídicos</a> ·
        <a href="https://jerezlegal.es/" rel="me">Despacho en Jerez</a>
      </p>
    </div>
    <div>
      <p><a href="mailto:${shared.email}">${shared.email}</a><br>
      WhatsApp: <a href="https://wa.me/${shared.whatsappIntl}">${shared.phoneDisplay}</a></p>
      <p class="pie-legal">
        <a href="/aviso-legal/">Aviso legal</a> ·
        <a href="/privacidad/">Privacidad</a> ·
        <a href="/cookies/">Cookies</a> ·
        <a href="/condiciones-del-servicio/">Condiciones del servicio</a>${site.articles?.length ? ' ·\n        <a href="/articulos/">Artículos</a>' : ''}
      </p>
      <p class="pie-copy">© ${year} ${esc(site.name)}</p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// ---------- bloques reutilizables ----------
const blockAnswer = (t) => /^\s*<p[\s>]/i.test(t)
  ? `<div class="respuesta-directa">${t}</div>`
  : `<p class="respuesta-directa">${t}</p>`;

const blockCta = (site, text = null) => site.prelaunch ? `
<div class="cta cta-prelaunch">
  <p class="cta-titulo">Próxima apertura</p>
  <p>La infraestructura y la información están preparadas. El servicio se abrirá cuando Carla confirme personalmente tarifas, plazos y alcance.</p>
</div>` : `
<div class="cta">
  <p class="cta-titulo">${text || esc(site.ctaTitle)}</p>
  <p class="cta-botones">
    <a class="boton" href="/cuenta-tu-caso/">Cuéntanos tu caso</a>
    <a class="boton boton-sec" href="https://wa.me/${shared.whatsappIntl}?text=${encodeURIComponent(site.ctaWhatsapp)}">WhatsApp directo</a>
  </p>
  <p class="cta-nota">${site.id === 'revisioncontratos' ? 'Elige un nivel y cuéntanos tu caso. Carla confirma el alcance, el plazo y la forma de pago antes de empezar.' : 'Carla revisa tu caso y te indica por escrito qué servicio y tarifa corresponden antes de empezar.'}</p>
</div>`;

const blockTrustCarla = (site) => `
<aside class="confianza" aria-label="Quién está detrás del servicio">
  <img class="confianza-foto" src="/assets/carla-morales.png" alt="Carla Morales, abogada" width="120" height="120">
  <div>
    <p class="confianza-nombre">Carla Morales, abogada</p>
    <p>Colegiada en el Ilustre Colegio de Abogados de Jerez. Revisa personalmente cada encargo: tu caso lo estudia una abogada de verdad, no una IA.</p>
    <ul class="confianza-lista">
      <li>Precio y alcance del servicio claros por escrito</li>
      ${site.id === 'revisioncontratos'
        ? '<li>Informe jurídico escrito con riesgos y cambios recomendados</li><li>Documentación tratada bajo secreto profesional</li>'
        : '<li>El coste postal de Correos se informa y se paga aparte, sin sorpresas</li><li>Sin letra pequeña: qué incluye y qué no incluye, por escrito</li>'}
    </ul>
    <p><a href="/quien-revisa/">Conoce a Carla y cómo trabaja</a></p>
  </div>
</aside>`;

const blockTable = (caption, head, rows) => `
<figure class="tabla">
  <table>
    <caption>${esc(caption)}</caption>
    <thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}</tbody>
  </table>
</figure>`;

const blockChecklist = (title, items) => `
<section class="checklist" aria-label="${esc(title)}">
  <h2>${esc(title)}</h2>
  <ul>${items.map((i) => `<li>${i}</li>`).join('\n')}</ul>
</section>`;

const blockFaq = (faqs) => `
<section class="faq">
  <h2>Preguntas que nos hacen los clientes</h2>
  ${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`).join('\n')}
</section>`;

const blockSources = (sources) => `
<section class="fuentes">
  <h2>Fuentes normativas</h2>
  <ul>${sources.map((s) => `<li>${esc(s.label)} — <a href="${s.url}" rel="noopener">${esc(s.precept)}</a></li>`).join('\n')}</ul>
  <p class="comprobado">Comprobado el ${CHECKED}. Los textos enlazados son los consolidados del BOE.</p>
</section>`;

const sections = (list) => list.map((s) => `<section><h2>${esc(s.h2)}</h2>\n${s.html}</section>`).join('\n');

// ---------- páginas ----------
function renderHome(site) {
  const servicesLd = site.services.map((s) => ({
    '@type': 'Service', name: s.title, url: `https://${site.domain}/${s.slug}/`,
    provider: { '@id': `https://${site.domain}/#legalservice` },
  }));
  const body = site.id === 'revisioncontratos' ? `
<section class="hero rc-hero">
  <div class="rc-hero-copy">
    <p class="kicker">${esc(site.kicker)}</p>
    <h1>${site.home.h1}</h1>
    ${blockAnswer(site.home.answer)}
    <p class="hero-botones"><a class="boton" href="/precios/">Ver precios y elegir revisión</a> <a class="boton boton-sec" href="/cuenta-tu-caso/">Cuéntanos tu caso</a></p>
  </div>
  <div class="rc-hero-aside">${blockTrustCarla(site)}</div>
</section>
<section class="rc-decide" aria-labelledby="rc-decide-title">
  <div>
    <p class="kicker">Honorarios claros</p>
    <h2 id="rc-decide-title">Elige cuánto apoyo necesitas</h2>
    <p>Los tres niveles tienen precio cerrado e IVA incluido. Carla confirma el encargo antes del pago por Bizum o transferencia.</p>
  </div>
  <ol class="rc-fee-list">
    ${site.pricing.tiers.map((t) => `<li><a href="/precios/"><span>${esc(t.name)}</span><strong>${esc(t.price)}</strong></a></li>`).join('\n    ')}
  </ol>
</section>
<section class="rc-service-index">
  <p class="kicker">Contratos que revisamos</p>
  <h2>${esc(site.home.servicesTitle)}</h2>
  <ul class="tarjetas">
    ${site.services.map((s) => `<li class="tarjeta"><div><h3><a href="/${s.slug}/">${esc(s.title)}</a></h3><p>${esc(s.teaser)}</p></div><p class="tarjeta-precio">${esc(s.priceLabel)}</p></li>`).join('\n')}
  </ul>
</section>
<section class="rc-learn" aria-label="Información antes de firmar">
  <div class="rc-learn-label"><p class="kicker">Antes de firmar</p><p>Qué revisamos, cómo trabajamos y cuáles son los límites del servicio.</p></div>
  <div class="rc-prose">${sections(site.home.sections)}</div>
</section>
${blockFaq(site.home.faqs)}
${blockSources(site.home.sources)}
${blockCta(site)}` : site.id === 'burofaxlegal' ? `
<section class="bf-hero">
  <div class="bf-hero-copy">
    <p class="kicker">${esc(site.kicker)}</p>
    <h1>${site.home.h1}</h1>
    ${blockAnswer(site.home.answer)}
    <p class="hero-botones"><a class="boton" href="/cuenta-tu-caso/">Cuéntanos tu caso</a> <a class="boton boton-sec" href="/precios/">Ver precios</a></p>
    <ul class="bf-sello">
      <li>Redactado sobre tus hechos</li>
      <li>Revisado por abogada colegiada</li>
      <li>Precio cerrado con IVA incluido</li>
    </ul>
  </div>
  <div class="bf-hero-aside">${blockTrustCarla(site)}</div>
</section>
<section class="bf-proceso" aria-label="Cómo funciona el servicio">
  <ol class="bf-proceso-lista">
    <li><span class="bf-num" aria-hidden="true">01</span><h2>Cuéntanos tu caso con documentos</h2><p>Qué contrato existe, qué se incumplió, desde cuándo y qué quieres conseguir.</p></li>
    <li><span class="bf-num" aria-hidden="true">02</span><h2>Redacción y revisión por abogada</h2><p>Redactamos sobre tus hechos concretos y la abogada revisa plazos y cantidades antes de enviártelo.</p></li>
    <li><span class="bf-num" aria-hidden="true">03</span><h2>Tu aprobación y el envío por Correos</h2><p>Solo cuando apruebas el texto final pasas al envío, que contratas directamente con Correos.</p></li>
  </ol>
  <p class="bf-proceso-link"><a href="/como-funciona/">Cómo funciona el servicio, paso a paso</a></p>
</section>
<section class="bf-aprende" aria-label="Antes de decidir">
  <div class="bf-aprende-label"><p class="kicker">Antes de decidir</p><p>Qué acredita un burofax, por qué lo redacta una abogada y qué no prometemos.</p></div>
  <div class="bf-prosa">${sections(site.home.sections)}</div>
</section>
<section class="bf-indice">
  <p class="kicker">Servicios</p>
  <h2>${esc(site.home.servicesTitle)}</h2>
  <ol class="bf-indice-lista">
    ${site.services.map((s, i) => `<li class="bf-indice-item"><a href="/${s.slug}/"><span class="bf-indice-num">${String(i + 1).padStart(2, '0')}</span><span class="bf-indice-cuerpo"><strong>${esc(s.title)}</strong><span>${esc(s.teaser)}</span></span><span class="bf-indice-precio">${esc(s.priceLabel)}</span></a></li>`).join('\n    ')}
  </ol>
</section>
${blockFaq(site.home.faqs)}
${blockSources(site.home.sources)}
${blockCta(site)}` : `
<section class="hero">
  <p class="kicker">${esc(site.kicker)}</p>
  <h1>${site.home.h1}</h1>
  ${blockAnswer(site.home.answer)}
  <p class="hero-botones"><a class="boton" href="/cuenta-tu-caso/">Cuéntanos tu caso</a> <a class="boton boton-sec" href="/precios/">Ver precios</a></p>
</section>
${blockTrustCarla(site)}
${sections(site.home.sections)}
<section>
  <h2>${esc(site.home.servicesTitle)}</h2>
  <ul class="tarjetas">
    ${site.services.map((s) => `<li class="tarjeta"><h3><a href="/${s.slug}/">${esc(s.title)}</a></h3><p>${esc(s.teaser)}</p><p class="tarjeta-precio">${esc(s.priceLabel)}</p></li>`).join('\n')}
  </ul>
</section>
${blockFaq(site.home.faqs)}
${blockSources(site.home.sources)}
${blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }] }, {
    title: site.home.title, description: site.description, path: '/', body, extraLd: servicesLd, bodyClass: 'home',
  });
}

function renderPrecios(site) {
  const payKeys = ['essential', 'professional', 'blindada'];
  const cards = site.pricing.tiers.map((t, i) => `
    <article class="precio-card${i === 1 ? ' precio-destacado' : ''}">
      ${i === 1 ? '<p class="precio-etiqueta">Para contratos complejos</p>' : ''}
      <h2>${esc(t.name)}</h2>
      <p class="precio-cifra">${esc(t.price)}</p>
      <ul>${t.includes.map((item) => `<li>${item}</li>`).join('')}</ul>
      ${site.paymentLinks?.[payKeys[i]] ? `<p><a class="boton boton-pago" href="${esc(site.paymentLinks[payKeys[i]])}" target="_blank" rel="noopener">Contratar y pagar ${esc(t.price)}</a></p>
      <p class="pago-confirmado"><a href="/cuenta-tu-caso/">Ya he pagado · enviar los datos del contrato</a></p>` : `<p><a class="boton" href="/cuenta-tu-caso/">Cuéntanos tu caso</a></p>`}
    </article>`).join('\n');
  const offersLd = site.pricing.tiers.map((t) => ({
    '@type': 'Offer', name: t.name, price: t.priceValue, priceCurrency: 'EUR',
    url: `https://${site.domain}/precios/`, seller: { '@id': `https://${site.domain}/#legalservice` },
  }));
  const paymentOptions = site.paymentLinks ? `
<section class="pago-opciones">
  <h2>Extras para la Revisión Esencial</h2>
  <p>${esc(site.pricing.paymentNote || '')}</p>
  <div class="extras-pago">
    <a class="boton boton-pago" href="${esc(site.paymentLinks.essentialExpress)}" target="_blank" rel="noopener">Esencial + exprés · 128 €</a>
    <a class="boton boton-pago" href="${esc(site.paymentLinks.essentialCall)}" target="_blank" rel="noopener">Esencial + consulta · 128 €</a>
    <a class="boton boton-pago" href="${esc(site.paymentLinks.essentialBoth)}" target="_blank" rel="noopener">Exprés + consulta · 177 €</a>
  </div>
  <p class="pago-confirmado"><a href="/cuenta-tu-caso/">Después del pago, envía los datos y el contrato</a></p>
</section>` : '';
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · Precios</nav>
<h1>${site.pricing.h1}</h1>
${blockAnswer(site.pricing.answer)}
<section class="precios-grid" aria-label="Precios cerrados, IVA incluido">
${cards}
</section>
${paymentOptions}
${sections(site.pricing.sections)}
${blockFaq(site.pricing.faqs)}
${blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios/' }] }, {
    title: site.pricing.title, description: site.pricing.description, path: '/precios/', body, extraLd: offersLd, bodyClass: 'page-pricing',
  });
}

function renderService(site, s) {
  const serviceLd = [{
    '@type': 'Service',
    name: s.title,
    description: s.description,
    url: `https://${site.domain}/${s.slug}/`,
    provider: { '@id': `https://${site.domain}/#legalservice` },
    areaServed: { '@type': 'Country', name: 'España' },
    offers: { '@type': 'Offer', price: s.priceValue, priceCurrency: 'EUR', url: `https://${site.domain}/precios/` },
  }, faqGraph(s.faqs)];
  const body = site.id === 'revisioncontratos' ? `
<div class="rc-service-head">
  <nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · ${esc(s.title)}</nav>
  <h1>${s.h1}</h1>
  ${blockAnswer(s.answer)}
</div>
<div class="rc-service-body">
  <div class="rc-prose">
    ${sections(s.sections)}
    ${blockTable(s.table.caption, s.table.head, s.table.rows)}
    ${blockChecklist(s.checklist.title, s.checklist.items)}
    ${blockFaq(s.faqs)}
    ${blockSources(s.sources)}
  </div>
  <aside class="rc-service-aside" aria-label="Precio y contratación">
    <p class="kicker">Revisión profesional</p>
    <p class="precio-linea">${esc(s.priceLabel)}</p>
    <p><a href="/precios/">Comparar los tres niveles</a></p>
    <p><a class="boton" href="/cuenta-tu-caso/">Cuéntanos tu caso</a></p>
    <p class="cta-nota">Carla confirma por escrito el nivel, el alcance y el plazo antes del pago.</p>
  </aside>
</div>
${blockTrustCarla(site)}
<section class="relacionado">
  <h2>${esc(s.crossSell.h2)}</h2>
  <p>${s.crossSell.html}</p>
</section>
${blockCta(site, s.ctaText || null)}` : `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · ${esc(s.title)}</nav>
<h1>${s.h1}</h1>
${blockAnswer(s.answer)}
<p class="precio-linea">${esc(s.priceLabel)} — <a href="/precios/">ver qué incluye cada nivel</a></p>
${sections(s.sections)}
${blockTable(s.table.caption, s.table.head, s.table.rows)}
${blockChecklist(s.checklist.title, s.checklist.items)}
${blockFaq(s.faqs)}
${blockSources(s.sources)}
${blockTrustCarla(site)}
<section class="relacionado">
  <h2>${esc(s.crossSell.h2)}</h2>
  <p>${s.crossSell.html}</p>
</section>
${blockCta(site, s.ctaText || null)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: s.title, path: `/${s.slug}/` }] }, {
    title: s.titleTag, description: s.description, path: `/${s.slug}/`, body, extraLd: serviceLd, bodyClass: 'page-service',
  });
}

function renderSimple(site, p, path, name) {
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · ${esc(name)}</nav>
<h1>${p.h1}</h1>
${p.answer ? blockAnswer(p.answer) : ''}
${path === '/quien-revisa/' ? blockTrustCarla(site) : ''}
${sections(p.sections)}
${p.faqs ? blockFaq(p.faqs) : ''}
${p.sources ? blockSources(p.sources) : ''}
${p.noCta ? '' : blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name, path }] }, {
    title: p.title, description: p.description, path, body, bodyClass: 'page-simple',
  });
}

function renderArticulo(site, a) {
  const path = `/articulos/${a.slug}/`;
  const blogLd = {
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.description,
    datePublished: a.publishedAt,
    dateModified: a.reviewedAt,
    author: { '@type': 'Organization', name: site.name, url: `https://${site.domain}/` },
    publisher: { '@id': `https://${site.domain}/#legalservice` },
    mainEntityOfPage: `https://${site.domain}${path}`,
    inLanguage: 'es',
  };
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · <a href="/articulos/">Artículos</a> · ${esc(a.title)}</nav>
<h1>${esc(a.h1)}</h1>
${blockAnswer(a.answer)}
${a.reviewStatus === 'reviewed' && a.reviewedAt ? `<p class="comprobado">Revisión jurídica de Carla Morales · ${esc(a.reviewedAt)}.</p>` : ''}
${sections(a.sections)}
${blockSources(a.sources)}
${blockTrustCarla(site)}
${blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: 'Artículos', path: '/articulos/' }, { name: a.title, path }] }, {
    title: `${a.title} | ${site.name}`, description: a.description, path, body,
    extraLd: [blogLd], bodyClass: 'page-article',
  });
}

function renderArticulosIndex(site) {
  const intro = '<p>Guías prácticas sobre el burofax: qué es, cuándo hace falta, cómo enviarlo y qué constancias pedir. Cada artículo cita sus fuentes oficiales de Correos y del BOE.</p>';
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · Artículos</nav>
<h1>Artículos sobre burofax</h1>
${blockAnswer(intro)}
<ul class="tarjetas">
  ${site.articles.map((a) => `<li class="tarjeta"><h3><a href="/articulos/${a.slug}/">${esc(a.title)}</a></h3><p>${esc(a.description)}</p></li>`).join('\n')}
</ul>
${blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: 'Artículos', path: '/articulos/' }] }, {
    title: `Artículos sobre burofax | ${site.name}`,
    description: 'Guías prácticas sobre burofax con fuentes oficiales: qué es, cuándo hace falta, cómo enviarlo y qué constancias conservar.',
    path: '/articulos/', body, bodyClass: 'page-simple',
  });
}

function renderIntake(site) {
  const isRevision = site.id === 'revisioncontratos';
  const asuntos = site.intake.asuntos.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('\n        ');
  const packageFields = isRevision ? `
  <p class="campo"><label for="f-paquete">Paquete elegido</label>
    <select id="f-paquete" name="paquete">
      <option value="Todavía no he confirmado el encargo">Todavía no he confirmado el encargo / tengo dudas</option>
      <option value="Revisión Esencial — 79 €">Revisión Esencial — 79 €</option>
      <option value="Esencial + exprés — 128 €">Esencial + exprés — 128 €</option>
      <option value="Esencial + consulta — 128 €">Esencial + consulta — 128 €</option>
      <option value="Esencial + exprés + consulta — 177 €">Esencial + exprés + consulta — 177 €</option>
      <option value="Revisión Profesional — 199 €">Revisión Profesional — 199 €</option>
      <option value="Firma Blindada — 399 €">Firma Blindada — 399 €</option>
    </select></p>` : '';
  const submitLabel = isRevision ? 'Enviar los datos del contrato' : 'Enviar mi caso a Carla';
  const caseHelp = isRevision
    ? 'Qué contrato es, quién eres en la operación, qué te preocupa y qué quieres conseguir. Después podrás adjuntarlo respondiendo al email.'
    : 'Qué ha pasado, fechas aproximadas, qué documentos tienes y qué quieres conseguir. Cuanto más contexto, mejor valoración.';
  const successMessage = isRevision
    ? '<strong>Datos enviados.</strong> Revisa tu email y responde al mensaje de confirmación adjuntando el contrato en PDF o fotos legibles.'
    : '<strong>Caso enviado.</strong> Carla lo revisará personalmente y te responderá con el servicio y presupuesto que correspondan. Te llegará una confirmación a tu email.';
  const formBody = site.prelaunch ? `
<section class="cta cta-prelaunch">
  <h2>Apertura próxima</h2>
  <p>El canal de encargos se abrirá cuando Carla confirme personalmente tarifas, plazos y alcance del servicio. Si tu asunto no puede esperar, escribe directamente a <a href="mailto:${shared.email}">${shared.email}</a>.</p>
</section>` : `
<form id="intake" class="intake" novalidate aria-describedby="intake-estado">
  <p class="campo"><label for="f-nombre">Tu nombre completo *</label>
    <input id="f-nombre" name="nombre" type="text" autocomplete="name" required maxlength="120"></p>
  <p class="campo"><label for="f-email">Tu email *</label>
    <input id="f-email" name="email" type="email" autocomplete="email" required maxlength="200"></p>
  <p class="campo"><label for="f-telefono">Teléfono (opcional)</label>
    <input id="f-telefono" name="telefono" type="tel" autocomplete="tel" maxlength="40"></p>
  <p class="campo"><label for="f-asunto">¿De qué va tu asunto? *</label>
    <select id="f-asunto" name="asunto" required>
      <option value="">Selecciona una opción</option>
      ${asuntos}
    </select></p>
  ${packageFields}
  <p class="campo"><label for="f-caso">Cuéntanos tu historia completa *</label>
    <span class="campo-ayuda" id="f-caso-ayuda">${caseHelp}</span>
    <textarea id="f-caso" name="caso" rows="9" required minlength="30" maxlength="8000" aria-describedby="f-caso-ayuda"></textarea></p>
  <p class="campo campo-oculto" aria-hidden="true"><label>Website <input name="website" type="text" tabindex="-1" autocomplete="off"></label></p>
  <p class="campo campo-check"><input id="f-privacidad" name="privacidad" type="checkbox" required>
    <label for="f-privacidad">He leído la <a href="/privacidad/">política de privacidad</a> y acepto que mis datos se usen para responder a mi consulta. *</label></p>
  <p class="campo"><button class="boton" type="submit" id="intake-btn">${submitLabel}</button></p>
  <p id="intake-estado" role="status" aria-live="polite"></p>
</form>
<script>
(function(){
  var f=document.getElementById('intake'),estado=document.getElementById('intake-estado'),btn=document.getElementById('intake-btn');
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(!f.checkValidity()){estado.textContent='Revisa los campos marcados: faltan datos obligatorios o el texto es muy corto.';f.reportValidity();return;}
    btn.disabled=true;btn.textContent='Enviando…';estado.textContent='';
    var prefijo='';
    if(f.paquete){prefijo+='Paquete: '+f.paquete.value+'\\n';}
    if(f.pago&&f.pago.value.trim()){prefijo+='Identidad de pago: '+f.pago.value.trim()+'\\n';}
    if(prefijo){prefijo+='\\n';}
    var data={nombre:f.nombre.value.trim(),email:f.email.value.trim(),telefono:f.telefono.value.trim(),asunto:f.asunto.value,caso:(prefijo+f.caso.value.trim()).slice(0,8000),web:location.hostname.replace(/^www\\./,''),website:f.website.value,privacidad:f.privacidad.checked};
    fetch('https://intake.marcospera.com/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok&&j.ok,error:j.error};});})
      .then(function(res){
        if(res.ok){
          f.reset();
          Array.from(f.children).forEach(function(el){if(el!==estado)el.hidden=true;});
          estado.innerHTML='${successMessage}';
          estado.setAttribute('tabindex','-1');
          estado.focus();
        }
        else{btn.disabled=false;btn.textContent='${submitLabel}';estado.textContent='No se pudo enviar ('+(res.error||'error')+'). Si persiste, escribe a ${shared.email}.';}
      })
      .catch(function(){btn.disabled=false;btn.textContent='${submitLabel}';estado.textContent='Sin conexión con el servidor. Inténtalo de nuevo o escribe a ${shared.email}.';});
  });
})();
</script>`;
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · Cuéntanos tu caso</nav>
<h1>${site.intake.h1}</h1>
${blockAnswer(site.intake.answer)}
${formBody}
${blockTrustCarla(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: 'Cuéntanos tu caso', path: '/cuenta-tu-caso/' }] }, {
    title: site.intake.title, description: site.intake.description, path: '/cuenta-tu-caso/', body, bodyClass: 'page-intake',
  });
}

function render404(site) {
  const body = `
<h1>Página no encontrada</h1>
<p>La dirección que buscas no existe o se ha movido. Esto es lo más útil desde aquí:</p>
<ul>
  <li><a href="/">Volver al inicio de ${esc(site.name)}</a></li>
  <li><a href="/precios/">Precios del servicio</a></li>
  <li><a href="https://tramitesjuridicos.com/guias/">Guías jurídicas en Trámites Jurídicos</a></li>
</ul>`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }] }, {
    title: `Página no encontrada | ${site.name}`, description: 'Página no encontrada.', path: '/404.html', body,
  });
}

function sitemap(site, urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>https://${site.domain}${u.path}</loc><lastmod>${CHECKED}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
}

function robots(site) {
  return `# ${site.domain} — ${site.name}
User-agent: *
Allow: /

# Crawlers de IA / buscadores generativos: permiso explícito
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: https://${site.domain}/sitemap.xml
`;
}

function llmsTxt(site) {
  const lines = site.services.map((s) => `- [${s.title}](https://${site.domain}/${s.slug}/): ${s.llmsTeaser}`).join('\n');
  return `# ${site.name} — ${site.tagline}

> ${site.llmsSummary}
${site.prelaunch ? '\n> Estado: sitio en preparación. Tarifas, plazos y alcance pendientes de confirmación profesional; todavía no acepta encargos.\n' : ''}

## Páginas
- [Inicio](https://${site.domain}/): qué es el servicio y cómo pedirlo.
- [Precios](https://${site.domain}/precios/): tarifas cerradas con IVA incluido.
- [Cuéntanos tu caso](https://${site.domain}/cuenta-tu-caso/): ${site.id === 'revisioncontratos' ? 'envío de datos para que Carla confirme el nivel, el alcance, el plazo y la forma de pago' : 'formulario para que Carla valore el caso e indique el servicio y presupuesto que correspondan'}.
- [Cómo funciona](https://${site.domain}/como-funciona/): pasos del encargo, plazos y qué recibe el cliente.
- [Quién revisa](https://${site.domain}/quien-revisa/): la abogada que firma el trabajo.

## Servicios
${lines}
${site.articles?.length ? `\n## Artículos\n${site.articles.map((a) => `- [${a.title}](https://${site.domain}/articulos/${a.slug}/): ${a.description}`).join('\n')}\n` : ''}
## Contacto
- Email: ${shared.email}
- WhatsApp: ${shared.phoneDisplay}

## Entidad
${site.name} es un servicio de Carla Morales (Jean Carla Morales Rivero), abogada colegiada en el Ilustre
Colegio de Abogados de Jerez (España). Entidad canónica: https://carlamorales.es/ — perfiles:
${shared.linkedin} · ${shared.googleBusiness}
Propiedades de la misma entidad: https://tramitesjuridicos.com/ (guías jurídicas) · https://jerezlegal.es/ (despacho local).
`;
}

// ---------- build ----------
const INDEXNOW_KEY = 'sl7f2k9m4x8q1w3e6r5t8y2u4i6o0p3a';
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });

for (const site of sites) {
  const dir = join(out, site.domain);
  const urls = [{ path: '/', priority: '1.0' }, { path: '/precios/', priority: '0.9' }, { path: '/como-funciona/', priority: '0.7' }, { path: '/quien-revisa/', priority: '0.6' }];
  const put = (rel, content) => { const f = join(dir, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };

  put('index.html', renderHome(site));
  put('precios/index.html', renderPrecios(site));
  put('cuenta-tu-caso/index.html', renderIntake(site));
  urls.push({ path: '/cuenta-tu-caso/', priority: '0.9' });
  put('como-funciona/index.html', renderSimple(site, site.pages.comoFunciona, '/como-funciona/', 'Cómo funciona'));
  put('quien-revisa/index.html', renderSimple(site, site.pages.quienRevisa, '/quien-revisa/', 'Quién revisa'));
  for (const s of site.services) {
    put(`${s.slug}/index.html`, renderService(site, s));
    urls.push({ path: `/${s.slug}/`, priority: '0.8' });
  }
  for (const lp of ['avisoLegal', 'privacidad', 'cookies', 'condiciones']) {
    const names = { avisoLegal: 'Aviso legal', privacidad: 'Política de privacidad', cookies: 'Política de cookies', condiciones: 'Condiciones del servicio' };
    const slugs = { avisoLegal: 'aviso-legal', privacidad: 'privacidad', cookies: 'cookies', condiciones: 'condiciones-del-servicio' };
    put(`${slugs[lp]}/index.html`, renderSimple(site, site.pages[lp], `/${slugs[lp]}/`, names[lp]));
    urls.push({ path: `/${slugs[lp]}/`, priority: '0.2' });
  }
  if (Array.isArray(site.articles) && site.articles.length) {
    put('articulos/index.html', renderArticulosIndex(site));
    urls.push({ path: '/articulos/', priority: '0.7' });
    for (const a of site.articles) {
      put(`articulos/${a.slug}/index.html`, renderArticulo(site, a));
      urls.push({ path: `/articulos/${a.slug}/`, priority: '0.6' });
    }
  }
  put('404.html', render404(site));
  put('sitemap.xml', sitemap(site, urls));
  put('robots.txt', robots(site));
  put('llms.txt', llmsTxt(site));
  put(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
  console.log(`${site.domain}: ${urls.length} URLs generadas`);
}
console.log('IndexNow key:', INDEXNOW_KEY);
