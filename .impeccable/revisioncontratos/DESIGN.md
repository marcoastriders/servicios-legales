---
name: RevisiónContratos — refinamiento editorial existente
description: Sistema RC de serif, verde y papel; extraído de las hojas locales, no del sitio hermano
colors:
  paper: "#f7f4ee"
  surface: "#fffdfa"
  ink: "#202d2b"
  muted: "#53615b"
  primary: "#8b7448"
  sage: "#edf1ea"
  rule: "#d5d9d1"
  brass: "#705b35"
  focus: "#165fcc"
  primary-hover: "#6e5a33"
  white: "#ffffff"
  payment: "#183b66"
  field-border: "#9da9a3"
  footer-text: "#dfe5df"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2.35rem, 4.8vw, 4.4rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.018em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(1.65rem, 2.7vw, 2.45rem)"
    fontWeight: 400
    lineHeight: 1.18
    letterSpacing: "-0.018em"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    lineHeight: 1.7
  label:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontWeight: 650
rounded:
  control: "2px"
  open: "0"
spacing:
  gutter: "clamp(1.25rem, 4vw, 3rem)"
  section: "clamp(3rem, 6vw, 5.5rem)"
  price-panel: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: ".72rem 1.15rem"
  button-payment:
    backgroundColor: "{colors.payment}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: ".72rem 1.15rem"
  input:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: ".6rem .7rem"
---

# Design System: RevisiónContratos

## Overview
Refinamiento del sistema editorial ya implantado: serif, tinta verde y papel cálido. La portada mantiene su composición rc-* de texto y responsabilidad profesional; no adopta el mundo visual de BurofaxLegal. Descripción derivada de código y del encargo, no de una nueva entrevista de marca.

Fuente normativa de implementación: bloque RC de `assets/styles.css`, seguido de `assets/revisioncontratos-polish.css`. El frontmatter registra valores efectivos extraídos, no crea variables nuevas. Brass recoge la sobrescritura del pase, no el valor anterior. Todo selector de la nueva hoja está bajo `.site-revisioncontratos`; se carga solo para RC desde `build.mjs`. Estas instrucciones no autorizan editar CSS compartido, BF ni documentos raíz.

## Colors
### Primary
Latón de acción para CTA, enlaces y cifras de precio (pase 2026-10-12: el verde #183f37 se retiró por leerse idéntico al verde #183c35 de BurofaxLegal a simple vista; decisión del titular); latón más oscuro en hover. El verde tinta permanece en texto, pie y superficies oscuras. El azul de pago queda reservado para el flujo futuro; durante la pausa se usa CTA latón Solicitar revisión. Latón oscuro #705b35 (override de polish) separa secciones y marca el nivel destacado; no demuestra certificaciones ni privilegios comerciales.
### Neutral
Papel para fondo, superficie clara para intake, tinta para lectura, muted para respuesta/ayuda, salvia para consentimiento y cabeceras de tabla. Reglas finas delimitan regiones; el pie usa tinta y texto claro.

`rc-contrast.json` registra brass/paper 5.91, muted/paper 5.92, ink/paper 13.00, white/primary 11.63, footer-text/ink 11.15 y primary/white 11.63. Son pares de tokens calculados, no garantía de contraste de todos los elementos, opacidades y estados.

## Typography
Georgia con Times New Roman/serif para títulos; system-ui con fallbacks para cuerpo. No cargar Bodoni/Public Sans de BF para RC. Los roles del frontmatter corresponden al código; h3 base es 1.28rem, títulos de grupos del índice 1.65rem y títulos de paneles de precio 1.55rem. Precios usan serif, peso 400, `clamp(2.5rem,4vw,3.5rem)` y números tabulares.

H1 limitado a 17ch; h1/h2 balancean líneas. Respuesta directa fluida `clamp(1.08rem,1.7vw,1.28rem)` con interlínea 1.65, sin caja de color. Respuesta/párrafos de páginas simples limitados a 70ch además de restricciones de sus contenedores. Submarca .8rem, sin mayúsculas ni tracking ornamental. Bajo 30rem el h1 pasa a `clamp(2.25rem,11vw,3rem)`. La regla heredada bajo 40rem ajusta interlínea corporal a 1.58; no suponer que todos los breakpoints son tokens aislados.

## Layout
Shell 76rem, lectura 44rem, gutter y sección fluidos del frontmatter. Portada grid 1.45fr/1fr, módulo de decisión .85fr/1.15fr; índice abierto con filas texto/precio y grupos de servicios. Interior de servicio: prosa y aside de contratación. La introducción de precio permanece centrada en decidir alcance; tres paneles en orden original y extras agrupados una sola vez.

**Estructura (2026-10-12): dos intentos de diferenciación estructural rechazados por el titular (raíl lateral, masthead editorial + hero espejado); se conserva la cáscara heredada compartida con burofaxlegal.** Queda como diferenciación aprobada: acento latón (paleta) y FAQ de portada a dos columnas a partir de 80rem. No proponer de nuevo estructuras para la cabecera sin petición explícita del titular.

A 56rem se apilan hero/decisión/lectura. En servicios la hoja del pase usa flex columna, aside antes de prosa, prosa con width/max-width 100% y min-width 0; el aside conserva max-width 28rem heredado. A 48rem navegación de dos columnas, precios de una columna, filas de servicios apiladas e intake con padding 1rem. Los paneles pasan a padding 1.25rem 0. A 30rem confianza y acciones se apilan. Retrato de quién revisa tiene además breakpoint heredado de 700px.

Tablas conservan scroll interno; no usar ocultación corporal como sustituto de comprobar geometría. Consentimiento en flujo antes de main, ancho limitado por shell, no overlay. A 56rem envuelve sus acciones.

## Elevation & Depth
Separación por reglas y tonos, no por tarjetas elevadas. Paneles de precio, consentimiento y retrato de quién revisa eliminan sus sombras anteriores. No convertir hallazgos estáticos de dark-glow en descripción de una sombra visible sin comprobar el CSS efectivo.

## Shapes
Controles e intake de esquinas discretas, con radio del frontmatter; paneles, FAQ y directorio abiertos y rectos. Conservar los retratos existentes y su geometría específica: la fotografía de confianza sigue siendo circular, no aplicar una prohibición global de formas redondas.

## Components
### Buttons
Primario verde, pago azul, secundario contorneado; variante inversa en banda CTA. Botón base min-height 46px; regla del pase establece mínimo 44px para button/.boton/summary/nav, y la cascada efectiva puede resolver 44px. No confundir mínimo con altura fija. Hover ya no desplaza: `transform:none`; permanece cambio de fondo/color con transición .15s ease. Reduced-motion desactiva transiciones, animaciones y smooth scroll dentro del scope.

Foco en enlaces, botones, inputs, select, textarea y summary: outline azul de 3px separado 3px. Su presencia en CSS no prueba visibilidad en todos los fondos; ampliar revisión donde corresponda.

### Pricing and service index
Paneles sin radios ni sombras; el segundo conserva borde superior de latón, pero no badge y no reordenación. CTA Solicitar revisión aparece antes de la lista por orden flex; al reactivar, el enlace de envío recupera su lugar: lista order 3, texto postpago order 4. Directorio organiza los ocho servicios en alquiler/condiciones, arras/préstamos y redacción desde cero. No convertir grupos en servicios nuevos.

### Inputs / Fields
Inputs claros, borde field-border, min-height 46px; labels y ayuda existentes. Select a ancho completo en móvil. Checkbox con espacio de label. Conservar IDs, validación, ayuda de mínimo 30 caracteres y mensaje accesible. El archivo se envía posteriormente por correo, no por control de carga inexistente.

### Navigation / Consent / FAQ
Navegación activa subrayada y último enlace como acción verde. Skip link existente. FAQ usa details/summary nativos con reglas y sin cajas. Consentimiento acepta/rechaza, conserva hidden y persistencia; botón de preferencias en pie reabre el aviso y mueve foco a aceptar. No tapar el CTA ni declarar un consentimiento certificado.

## Do's and Don'ts
### Do:
- **Do** leer junto a este archivo `.impeccable/revisioncontratos/PRODUCT.md`; el launcher todavía resuelve documentos raíz de BF.
- **Do** conservar identidad y scope RC, tarifas 79/199/399 y extras 128/177, URLs e IDs.
- **Do** distinguir evidencia automatizada, observación de código y verificación comercial real.
- **Do** revalidar evidencia tras cambios: `node scripts/test-rc-polish.mjs`, analytics con mocks y browser QA según `rc-handoff.md`.
### Don't:
- **Don't** editar documentos raíz, sidecar BF ni UI del hermano para completar este documento. No se genera sidecar: autorización limitada a estos dos Markdown.
- **Don't** afirmar Bizum online disponible, pago confirmado por URL, garantías de resultado o certificación WCAG.
- **Don't** declarar detector limpio: `rc-detector.json` contiene 234 hallazgos pendientes de triage; usa comparaciones BF y análisis estático con límites de carga de activos absolutos.
- **Don't** presentar esta documentación como revisión independiente de acabado o prueba de pagos/emails reales.

Evidencia registrada: 51 renders locales HTTP en 17 rutas a 1440/390/820 × 844, hoja cargada, sin errores JS, overflow corporal ni objetivos medidos menores de 44px; 15 capturas de cinco páginas. Zoom CSS 200% solo precios; foco de pago observado solid/3px. Analytics/intake con mocks; aislamiento previo de 31 hashes según `rc-gates.log`. No se reejecutó navegador ni se inspeccionaron visualmente capturas en esta tarea documental. Pendientes: revisión independiente, teclado/lector de pantalla completos, zoom general y contraste de todos los estados. No certificación ni permiso de publicación.

## Estado operacional temporal
Cobro online pausado (`paymentPaused: true`): seis Payment Links conservados pero inactivos. Stripe Tax pendiente de domicilio fiscal y registros; la API Payment Links no admite tasa manual. No reactivar desde este pase. CTA Solicitar revisión → formulario con paquete; Carla confirma encargo y pago por Bizum o transferencia. Plazo después de pago, datos y contrato completo. Backend/Stripe y BurofaxLegal fuera de alcance.

Repetición release verificada: 8 renders en cuatro rutas a 390/1440, con asserts de hoja, consentimiento en flujo/persistencia/foco, selección de paquete y foco visible del CTA manual; sin overflow ni errores JS. Evidencia en rc-qa-results.json; lote anterior preservado en rc-qa-51renders.json.
