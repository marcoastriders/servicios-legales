---
name: BurofaxLegal — Registro de responsabilidad
description: Sistema editorial jurídico aislado de revisioncontratos.es
colors:
  ink: "#183c35"
  ink-deep: "#102e28"
  paper: "#f4f0e6"
  surface: "#fcfaf4"
  primary: "#28594c"
  muted: "#496059"
  sage: "#e5e9dd"
  rule: "#bbbca9"
  brass: "#b7a478"
  brass-light: "#ddceaa"
  focus: "#986a13"
typography:
  display:
    fontFamily: "BF Bodoni, Georgia, serif"
    fontSize: "clamp(3rem, 6.2vw, 5.75rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "BF Bodoni, Georgia, serif"
    fontSize: "clamp(1.85rem, 3vw, 2.7rem)"
    fontWeight: 400
  body:
    fontFamily: "BF Public, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "BF Public, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
rounded:
  square: "0"
spacing:
  gutter: "clamp(1.25rem, 5vw, 4rem)"
  section: "clamp(3.5rem, 8vw, 7rem)"
  group: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    padding: ".9rem 1.25rem"
    height: "48px"
  button-inverse:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: ".9rem 1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: ".8rem"
---

# Design System: BurofaxLegal

## Overview
**Creative North Star: "Registro de responsabilidad"**

Una presencia profesional abierta, no un catálogo de promesas. La tinta verde sostiene regiones completas; el papel cálido permite leer documentación larga. La autora real tiene presencia propia, fuera de una tarjeta comercial.

Sistema extraído de `assets/burofax.css` y del resultado navegador. Se limita a `.site-burofaxlegal`; el otro dominio conserva su hoja, contenido y markup. Selección de dirección delegada expresamente por Marco. Documentación inline bajo rol documenter, sin simular revisión independiente: el padre conserva esa puerta.

**Key Characteristics:**
- Declaración tipográfica ancha.
- Superficies abiertas y reglas finas.
- Responsabilidad profesional visible.
- Controles rectos y contraste explícito.

## Colors
### Primary
Verde de acción y tinta profesional. La inversión usa papel sobre tinta; el CTA primario invierte esos roles en bandas oscuras.
### Neutral
Papel, superficie, salvia y regla establecen lectura y separación sin sombra. Latón claro marca foco sobre tinta.

**The Region Rule.** El color estructura regiones completas, no una colección de badges.

## Typography
Bodoni Moda autohospedada (`BF Bodoni`) aporta contraste y carácter editorial. Public Sans autohospedada (`BF Public`) permite leer cuerpo y controles. Licencias OFL en `assets/fonts/`. Los tamaños fluidos corresponden a los tokens; en móvil, título interior 2.8rem y portada entre 2.9rem y 4rem.

**The Reading Rule.** Prosa y respuestas se limitan a 65ch; no usar mono ornamental ni mayúsculas como sustituto de jerarquía.

## Layout
Contenedor máximo 82rem y lectura 45rem. La portada declara el título a anchura completa, seguido por respuesta y acción; no mantiene el hero dividido con tarjeta del diseño anterior. Responsabilidad profesional abierta debajo. Proceso de tres estaciones, contenido con margen editorial e índice de servicios sin números decorativos. A 60rem, apertura y prosa pasan a columna única; a 48rem, directorio y biografía se apilan; a 30rem, retrato y confianza se apilan. Consentimiento en flujo antes de main, sin cubrir CTA.

## Elevation & Depth
Sin sombras de componentes. Las bandas a sangre se pintan con sombra de expansión y clipping; es extensión de fondo, no elevación. Densidad, fondo y reglas proporcionan separación.

## Shapes
Esquinas rectas; bordes finos. Retrato existente en su encuadre nativo, sin recorte artificial nuevo. El PNG preexistente conserva sus píxeles; se añadió exclusivamente procedencia textual.

## Components
### Buttons
Primario verde sobre papel; primario papel sobre tinta; secundario contorneado. Área mínima 48px. Hover cambia fondo sin desplazar contenido. La acción principal de portada traza una regla de tinta mediante clip-path (420ms, cubic-bezier(.16,1,.3,1)) al recibir hover o foco; permanece parcialmente visible desde el inicio y no oculta contenido. Reduced-motion elimina su transición. Foco visible de 3px, separado 4px; variante clara sobre tinta. Disabled mantiene contexto y bloquea reenvío.
### Inputs / Fields
Campos rectos, padding .8rem y labels Public Sans. Ayuda e IDs accesibles originales intactos. El estado de éxito queda visible y enfocado; error permite reintentar. Ningún ensayo envía datos al backend real.
### Navigation
Marca serif, enlaces funcionales, contacto contorneado. Tres entradas conservadas; no Precios en navegación. En móvil navegación en dos columnas y contacto ancho.
### Professional accountability
Ficha abierta, retrato real grande y texto aprobado. No badges ni testimonios inventados.
### FAQ
Details y summary nativos; abierto usa salvia y conserva navegación por teclado.
### Consent
Aviso en flujo, botones aceptar/rechazar equivalentes y persistencia original. No fijarlo encima del contenido.

## Do's and Don'ts
### Do:
- **Do** aislar toda regla visual bajo `.site-burofaxlegal` y cargar fuentes exclusivamente en ese dominio.
- **Do** conservar contenido jurídico, tarifas quote-first, schema e IDs de formulario.
- **Do** contrastar CTA con valores calculados del navegador.
### Don't:
- **Don't** introducir nuevas promesas, pruebas sociales o precios cerrados por defecto.
- **Don't** modificar el diseño ni texto de revisioncontratos.es.
- **Don't** reconstruir el hero dividido con tarjeta de confianza.
- **Don't** emplear gradientes, glass, icon-card grids ni clichés jurídicos.

No se canoniza defecto: detector manual devolvió `[]`. Revisión independiente de acabado pendiente del padre; esta documentación no sustituye su veredicto.
