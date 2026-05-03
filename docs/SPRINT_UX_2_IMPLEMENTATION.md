# Sprint UX 2 - Oportunidades y ficha 360

## Objetivo

Convertir el flujo central de LicitIA en una experiencia SaaS enterprise: buscar, comparar, seleccionar y decidir oportunidades sin perder contexto.

## Historias cubiertas

- DUX-004 Busqueda enterprise de oportunidades.
- DUX-005 Ficha 360 de licitacion.
- DUX-006 Modelo visual de decision GO/NO-GO.

## Cambios de producto

La vista `Oportunidades` ahora se organiza como un workspace de seleccion:

- barra principal de busqueda;
- ordenacion visible;
- filtros rapidos;
- filtros avanzados plegados;
- chips de filtros activos;
- resumen de resultados;
- seleccion multiple;
- tabla/listado enterprise;
- ficha 360 lateral persistente.

La ficha 360 agrupa el contexto de una licitacion en tabs:

- Resumen;
- Documentos;
- Decision;
- Tareas;
- Propuesta;
- Auditoria.

## Cambios UI

- Tabla responsive con score, oportunidad, organismo, importe, plazo, estado y accion.
- Filas seleccionables por teclado y click.
- Estado activo de fila al abrir ficha.
- Inspector lateral sticky en desktop.
- Estado vacio orientado a accion.
- Badges por estado y urgencia de deadline.
- Panel GO/NO-GO con drivers: `Por que sube` y `Por que baja`.

## Cambios funcionales

- Los filtros se reflejan en URL query params.
- La busqueda global del shell ejecuta la busqueda en `Oportunidades`.
- La seleccion multiple mantiene contador local.
- `NO-GO` pide confirmacion antes de auditar la decision.
- Se mantiene compatibilidad con endpoints existentes.

## Accesibilidad

- Filas de oportunidad navegables con teclado.
- Checkboxes con `aria-label`.
- Tabs de ficha con `role=tablist` y `aria-selected`.
- Estados de resultado y filtros con `aria-live` donde aplica.
- Layout responsive: tabla densa en desktop y cards en movil.

## Limitaciones conocidas

- La seleccion multiple es local y aun no ejecuta acciones masivas reales.
- Los saved views quedan preparados como patron visual, pero falta persistencia backend especifica.
- La ficha 360 usa los datos ya disponibles por `tender-detail`; algunos tabs muestran placeholders si no se ha generado expediente/propuesta.
