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

const CHECKED = '2026-09-28';

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
<link rel="stylesheet" href="/assets/styles.css">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="cabecera">
  <div class="wrap cabecera-in">
    <a class="marca" href="/">${esc(site.name)}<span class="marca-sub">por Carla Morales · Abogada</span></a>
    <nav class="nav" aria-label="Principal">
      ${site.nav.map((n) => `<a href="${n.path}">${esc(n.label)}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
${site.prelaunch ? `<aside class="prelaunch" role="status"><div class="wrap"><strong>Sitio en preparación.</strong> Las tarifas, plazos y alcance están pendientes de confirmación profesional. Todavía no se aceptan encargos desde esta web.</div></aside>` : ''}
<main id="contenido" class="wrap">
${body}
</main>
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
        <a href="/condiciones-del-servicio/">Condiciones del servicio</a>
      </p>
      <p class="pie-copy">© ${year} ${esc(site.name)}</p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// ---------- bloques reutilizables ----------
const blockAnswer = (t) => `<p class="respuesta-directa">${t}</p>`;

const blockCta = (site, text = null) => site.prelaunch ? `
<div class="cta cta-prelaunch">
  <p class="cta-titulo">Próxima apertura</p>
  <p>La infraestructura y la información están preparadas. El servicio se abrirá cuando Carla confirme personalmente tarifas, plazos y alcance.</p>
</div>` : `
<div class="cta">
  <p class="cta-titulo">${text || esc(site.ctaTitle)}</p>
  <p class="cta-botones">
    <a class="boton" href="https://wa.me/${shared.whatsappIntl}?text=${encodeURIComponent(site.ctaWhatsapp)}">Escríbenos por WhatsApp</a>
    <a class="boton boton-sec" href="mailto:${shared.email}?subject=${encodeURIComponent(site.ctaMailSubject)}">${shared.email}</a>
  </p>
</div>`;

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
  const body = `
<section class="hero">
  <p class="kicker">${esc(site.kicker)}</p>
  <h1>${site.home.h1}</h1>
  ${blockAnswer(site.home.answer)}
  <p class="hero-botones"><a class="boton" href="/precios/">Ver precios</a> <a class="boton boton-sec" href="/como-funciona/">Cómo funciona</a></p>
</section>
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
  const rows = site.pricing.tiers.map((t) => [
    `<strong>${esc(t.name)}</strong>`,
    `${esc(t.price)}`,
    t.includes.join('<br>'),
  ]);
  const offersLd = site.pricing.tiers.map((t) => ({
    '@type': 'Offer', name: t.name, price: t.priceValue, priceCurrency: 'EUR',
    url: `https://${site.domain}/precios/`, seller: { '@id': `https://${site.domain}/#legalservice` },
  }));
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · Precios</nav>
<h1>${site.pricing.h1}</h1>
${blockAnswer(site.pricing.answer)}
${blockTable('Precios cerrados, IVA incluido', ['Servicio', 'Precio', 'Qué incluye'], rows)}
${sections(site.pricing.sections)}
${blockFaq(site.pricing.faqs)}
${blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios/' }] }, {
    title: site.pricing.title, description: site.pricing.description, path: '/precios/', body, extraLd: offersLd,
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
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · ${esc(s.title)}</nav>
<h1>${s.h1}</h1>
${blockAnswer(s.answer)}
<p class="precio-linea">${esc(s.priceLabel)} — <a href="/precios/">ver qué incluye cada nivel</a></p>
${sections(s.sections)}
${blockTable(s.table.caption, s.table.head, s.table.rows)}
${blockChecklist(s.checklist.title, s.checklist.items)}
${blockFaq(s.faqs)}
${blockSources(s.sources)}
<section class="relacionado">
  <h2>${esc(s.crossSell.h2)}</h2>
  <p>${s.crossSell.html}</p>
</section>
${blockCta(site, s.ctaText || null)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name: s.title, path: `/${s.slug}/` }] }, {
    title: s.titleTag, description: s.description, path: `/${s.slug}/`, body, extraLd: serviceLd,
  });
}

function renderSimple(site, p, path, name) {
  const body = `
<nav class="migas" aria-label="Migas de pan"><a href="/">Inicio</a> · ${esc(name)}</nav>
<h1>${p.h1}</h1>
${p.answer ? blockAnswer(p.answer) : ''}
${sections(p.sections)}
${p.faqs ? blockFaq(p.faqs) : ''}
${p.sources ? blockSources(p.sources) : ''}
${p.noCta ? '' : blockCta(site)}`;
  return layout(site, { crumbs: [{ name: 'Inicio', path: '/' }, { name, path }] }, {
    title: p.title, description: p.description, path, body,
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
- [Cómo funciona](https://${site.domain}/como-funciona/): pasos del encargo, plazos y qué recibe el cliente.
- [Quién revisa](https://${site.domain}/quien-revisa/): la abogada que firma el trabajo.

## Servicios
${lines}

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
  put('404.html', render404(site));
  put('sitemap.xml', sitemap(site, urls));
  put('robots.txt', robots(site));
  put('llms.txt', llmsTxt(site));
  put(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
  console.log(`${site.domain}: ${urls.length} URLs generadas`);
}
console.log('IndexNow key:', INDEXNOW_KEY);
