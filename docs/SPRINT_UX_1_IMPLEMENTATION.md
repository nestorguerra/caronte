# Sprint UX 1 - Fundacion y shell

## Objetivo

Elevar la herramienta productiva de LicitIA desde un cockpit MVP a una base de SaaS corporativo: sistema visual, shell de aplicacion, navegacion por flujo, busqueda global y accesibilidad base.

## Historias cubiertas

- DUX-001 Sistema visual LicitIA 2026.
- DUX-002 App shell premium y navegacion por flujo.
- DUX-013 Base responsive y accesibilidad AA.

## Cambios de producto

La herramienta autenticada mantiene `/app.html`, pero reorganiza el trabajo en espacios:

- Hoy
- Oportunidades
- Expedientes
- Propuestas
- Inteligencia
- Operaciones
- Ajustes

La vista `Hoy` pasa a ser el punto de entrada operativo: prioridades diarias, busquedas guardadas y salud. Los datos de cuenta y equipo se desplazan a `Ajustes`; operaciones queda separada para administracion.

## Cambios UI

- Shell con sidebar premium, estado activo accesible y usuario persistente.
- Topbar sticky con busqueda global, organizacion activa y estado API.
- Sistema visual con tokens: color, superficies, lineas, radios, sombras, estados y foco.
- Botones con hover, disabled y focus-visible.
- Paneles, metricas, filas y decision cards con jerarquia visual mas sobria.
- Vista de propuestas separada de inteligencia competitiva.
- Seccion de operaciones separada del usuario final.

## Accesibilidad y responsive

- Skip link al contenido principal.
- `aria-current` en navegacion activa.
- `aria-live` en estado de API.
- Label invisible accesible para busqueda global.
- Focus-visible global para enlaces, botones y campos.
- Reduced motion con `prefers-reduced-motion`.
- Sidebar refluye en tablet/movil.
- Busqueda global se adapta a una columna en movil.

## Compatibilidad

Se mantienen los ids y paneles funcionales existentes para no romper:

- busqueda y seguimiento;
- decision GO/NO-GO;
- analisis IA;
- propuesta y dossier;
- inteligencia competitiva;
- operaciones;
- perfil y equipo.

`viewAliases` mantiene compatibilidad con hashes antiguos como `#cockpit`, `#alertas` y `#equipo`.
