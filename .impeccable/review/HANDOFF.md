# Paquete para finish reviewer fresco

Estado: implementación verificada, NO veredicto independiente de ship. El padre revisa y después decide publicación. Sin commits, push ni deploy.

## Solicitud / decisiones confirmadas
Rediseño ambicioso de burofaxlegal.es; usuario delega diseño y autoriza publicar tras pruebas. Preservar contenido jurídico, quote-first desde 99 EUR IVA incluido según complejidad, envío Correos aparte, URLs, SEO/schema, formulario y consentimiento. No reintroducir pestaña Precios. No modificar revisioncontratos.es. Aislar CSS por body class y markup por site.id. Sin pagos ni imágenes generativas autorizados.

## Artifact / contract
Worktree: `/home/hermes/.hermes/cache/scratch/bf-design-worktree`.
Baseline: `3f5a0cb2ffdff4ef59e2c1204fad11c48c55f3c6`.
Contrato: `.impeccable/surfaces/build-mjs.md`, Direction contract, seed 33632880, assigned index 3.
Code-led; no approved comp ni referencia de catálogo elegida. Todos los challengers declined; disciplinas registradas en contrato. No hooks instalados. Detector manual una vez: `.impeccable/review/detector.json` = `[]`.
Mundo: Registro de responsabilidad, título monumental a anchura completa en tinta verde, respuesta/acción debajo, ficha profesional abierta fuera del hero, retrato existente, índice editorial sin numeración ornamental. Forma candidata 3 conforme roll. Papel cálido, Bodoni Moda/Public Sans autohospedadas.
Craft-floor: `/home/hermes/.hermes/skills/creative/impeccable/reference/craft-floor.md`.

## Required screenshots
`.impeccable/review/desktop.png` (1440x900 viewport, full page), `mobile.png` (390x900), `tablet.png` (768x900). Capturas adicionales de /precios/, /cuenta-tu-caso/, /burofax-impago-alquiler/, /quien-revisa/ a 390/768/1440: comprobar nombres reales en manifest.json. Cache CDP disabled; fuentes listas; GTM bloqueado solo en QA. Dos rounds de capturas como máximo. Desktop/mobile finales abiertos y validados: carga completa sin recortes relevantes. Baseline público: baseline-1440.png, baseline-390.png, baseline-dom.json.

## Evidence / gates
- `node --check build.mjs`: exit 0.
- `node build.mjs && node scripts/verify.mjs`: PUERTA SUPERADA, gate-log.txt.
- `node scripts/verify-burofax-design.mjs`: contenido JSON y shared stylesheet intactos, nav sin Precios, CSS aislado, 22 archivos sibling byte-identical, píxeles PNG intactos.
- Docker producción `bf-design-review:local`, contenedor `bf-design-review`, localhost:18123. `docker-e2e.json`: ambos Hosts 200, robots index, formulario presente, CSP intake, PNG firma correcta, precio cards 0/3, assets/fonts 200. Metadatos internos 404.
- `qa-results.json`: todas las 19 rutas sitemap móvil390, h1 único sin overflow; 15 combinaciones de cinco rutas a390/768/1440; zoom200% cinco rutas; foco teclado/skip/CTA; accept/reject + persistencia reload; sin intersección banner/CTA.
- 12 pares color/fondo medidos, mínimo 5.951338241216647:1.
- Formulario: loading disabled, éxito visible aria-live/status y foco, error400 y fallo red recuperables. Todo interceptado; ningún formulario real enviado, ningún pago.
- Sin pageerrors.

## Files changed
Tracked: build.mjs (solo link CSS sitio, composición home y posicionamiento en flujo consentimiento del sitio); assets/carla-morales.png (solo texto de procedencia, datos de imagen idénticos).
New: assets/burofax.css; assets/fonts/*.ttf y licencias OFL; scripts/qa-burofax.cjs; scripts/verify-burofax-design.mjs; PRODUCT.md; DESIGN.md; .impeccable/design.json; .impeccable/surfaces/build-mjs.md; .impeccable/review/*.
No content JSON ni nginx.conf ni estilos compartidos editados.

## Integration boundary / remaining
Otro agente modificó build.mjs en el árbol activo con conversiones y restauración consentimiento al reload. Se aislaron las pruebas en worktree; esas modificaciones NO se revirtieron ni se incluyeron en este diff. El padre debe aplicar implementation.patch (no copiar build.mjs entero), copiar nuevos archivos y repetir pruebas sobre integración analítica + diseño antes de publicar. Scripts de invariantes se comparan contra baseline puro: adaptación consciente requerida para aceptar los cambios de analítica del otro agente en sibling, preservando markup visual.
Los checks de consentimiento de este paquete prueban UI/persistencia, no el arreglo GA de reload del otro agente. La imagen nativa contiene su propio encuadre; no se fabricó nueva foto.
El agente paralelo ya consolidó analítica en d44bb6ea99ddf792be660a6ccf5937be4bdff31f. El patch original contra 3f5a0cb no aplica directo; usar `/home/hermes/plans/burofaxlegal-design-integrated-d44bb6e.patch`, generado preservando analítica y validado con `git apply --check` exit0. Ningún patch se aplicó al árbol activo. Nuevos archivos: `/home/hermes/plans/burofaxlegal-design-new-files.tar.gz`.

Pendiente exclusivamente finish reviewer independiente, integración de ambos diffs y pruebas finales del árbol integrado; no autoproclamación de ship. Documenter se ejecutó inline por falta de delegación en este agente. DESIGN.md/sidecar describen build observado y podrán actualizarse tras fixes del reviewer.
