# Product: RevisiónContratos

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Personas que necesitan comprender un contrato antes de firmar, especialmente alquiler, arras y préstamos entre particulares. Contexto inferido del contenido existente, no de entrevistas o investigación nueva.

## Product Purpose
Revisión jurídica por Carla Morales: informe de riesgos y recomendaciones; los niveles superiores incorporan llamada, redacción alternativa y negociación según el alcance publicado. La decisión de firmar corresponde al cliente. No garantizar aceptación de cambios, ausencia de riesgos ni resultado de una negociación.

## Operating Context
Sitio revisioncontratos.es generado con Node mediante `build.mjs`, contenido en `content/revisioncontratos.json`. Convive con burofaxlegal.es en el mismo repositorio. Este contexto es exclusivamente RC: los `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` y el brief `build-mjs` de la raíz pertenecen a BurofaxLegal y no deben adoptarse como contrato visual de RC ni modificarse por este pase.

17 rutas públicas de sitemap, 18 HTML contando 404. Conservar URLs, SEO/schema, contacto, IDs del formulario y consentimiento. El pase es refinamiento de la identidad rc-* existente, no rediseño del sitio hermano.

## Capabilities and Constraints
- Tarifas publicadas e invariables en este pase: Esencial de alquiler 79 €, Profesional 199 €, Firma Blindada 399 €, IVA incluido.
- Extras de Esencial: exprés +49 € o consulta +49 €, total 128 € cada combinación; ambos extras, total 177 €. Conservar límites de disponibilidad y alcance; no presentar exprés como garantía universal. Profesional y Firma Blindada incluyen llamada, no exprés de 24 h.
- Contrato a medida es independiente y requiere presupuesto previo; el contenido indica desde 199 €.
- Flujo vigente: comparar niveles, solicitar revisión, enviar contrato por respuesta al correo de confirmación, confirmación del encargo por Carla y pago manual por Bizum o transferencia. El formulario no adjunta archivos y pide descripción de mínimo 30 caracteres.
- Los seis enlaces Stripe se conservan como configuración futura, pero están inactivos y no se renderizan. `paymentPaused: true` protege esta pausa. Backend correcto; configuración fiscal pendiente de domicilio y registros. No se hicieron transacciones reales en este pase.
- `?paquete=` preselecciona un nivel conocido. `pago=confirmado` no verifica ni anuncia un pago; no confiar en parámetros de URL como prueba de cobro.
- No crear testimonios, certificaciones, muestra jurídica no revisada por Carla ni promesas comerciales nuevas.

## Brand Commitments
Preservar serif Georgia, verde oscuro, papel cálido, reglas finas, secciones abiertas y composición rc-*. Mantener retrato existente y responsabilidad profesional visible. No importar fuentes BF ni la composición propia de BurofaxLegal.

## Evidence on Hand
Fuentes: `assets/styles.css` (bloque RC), `assets/revisioncontratos-polish.css`, `build.mjs`, `content/revisioncontratos.json` y diff del pase respecto a HEAD.

Evidencia previa del constructor, leída para documentar, no presentada como auditoría independiente:
- `.impeccable/review/rc-handoff.md`: alcance, base `5400245bcdf361f8c79df5c5f43a2e90d5f726e1`, límites y pendientes.
- `rc-gates.log`: build/verify, analytics con mocks y aislamiento mediante 31 hashes SHA256 de salidas BF y activos originales.
- `rc-qa-51renders.json`: 51 renders anteriores (17 rutas × 1440/390/820 px, altura 844), sin errores JS, overflow corporal ni controles medidos menores de 44 px; hoja RC cargada. Consentimiento/reapertura, persistencia y selección de paquete probados.
- `rc-contrast.json`: seis pares de colores calculados, no auditoría de todos los estados.
- `rc-detector.json`: 234 hallazgos, no detector limpio. Parte de sus comparaciones usa DESIGN de BF y su análisis estático no sustituye CSS calculado vía HTTP.
- 15 capturas finales: inicio, precios, formulario, arras y condiciones, en tres anchos. Su existencia no equivale a inspección visual por este documentador.

## Product Principles
- Distinguir contratación, consulta, envío de datos y verificación real de pago.
- Mostrar precio, alcance y límites antes de decidir.
- Conservar orden comprensible de niveles y agrupar los ocho servicios existentes sin perder enlaces.
- Consentimiento en flujo, sin tapar acciones, con aceptación/rechazo y preferencias reabribles.

## Accessibility & Inclusion
CSS conserva skip link, foco visible, labels y feedback; detalles/FAQ nativos. En QA registrada se comprobaron tamaños de botones/nav/summary, foco de pago de 3 px y foco `analytics-accept` al reabrir preferencias. Zoom CSS 200% solo en precios, sin overflow; no equivale a zoom de navegador/OS ni cubre todas las rutas. Analytics y feedback de intake se ejercitaron con mocks. No hay certificación WCAG, auditoría integral de lector de pantalla, teclado completo, contraste de todos los estados ni prueba real de correo/pago.

## Open Decisions
Revisión independiente de acabado pendiente del padre según handoff; triage de 234 hallazgos; pruebas completas de zoom/contraste/lector de pantalla; reactivación online solo tras completar configuración fiscal y verificar enlaces activos. No commit ni despliegue autorizado en esta tarea. Estos documentos no cambian automáticamente la resolución de contexto del launcher: futuros agentes deben leer explícitamente este directorio RC.

## Estado operacional temporal
Cobro online pausado (`paymentPaused: true`): seis Payment Links conservados pero inactivos. Stripe Tax pendiente de domicilio fiscal y registros; la API Payment Links no admite tasa manual. No reactivar desde este pase. CTA Solicitar revisión → formulario con paquete; Carla confirma encargo y pago por Bizum o transferencia. Plazo después de pago, datos y contrato completo. Backend/Stripe y BurofaxLegal fuera de alcance.

QA release: 8 renders de inicio/precios/cómo funciona/formulario a 390/1440 con asserts efectivos de hoja, consentimiento, selector, persistencia, foco y geometría. `rc-qa-results.json` contiene esa repetición; los 51 renders previos se conservan separados.
