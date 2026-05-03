# Sprint UX 3 - Propuesta, dossier e inteligencia

## Objetivo

Convertir los modulos de propuesta, dossier e inteligencia competitiva en un workspace de produccion para equipos de licitaciones: fuentes claras, borrador editable, revision accionable, documentacion controlada y lectura economica ejecutiva.

## Historias cubiertas

- DUX-007 Estudio de propuesta.
- DUX-008 Dossier y checklist documental.
- DUX-009 Inteligencia competitiva.

## Cambios de producto

La vista `Propuestas` pasa a una estructura de estudio:

- panel de fuentes con datos oficiales de la ficha activa;
- editor central con version, trazabilidad, indice y preview markdown;
- panel de revision con score por seccion, riesgos y mejoras;
- dossier documental separado con progreso, items, biblioteca y export ZIP.

La vista `Inteligencia` se convierte en un dashboard competitivo:

- KPIs de adjudicaciones, baja media y baja mediana;
- ranking de adjudicatarios recurrentes;
- organismos con mas historico;
- distribucion de bajas;
- escenario economico de oferta;
- lectura ejecutiva de riesgo.

## Cambios UI

- Layout de tres zonas para propuesta: fuentes, editor y revision.
- El dossier deja de competir visualmente con el editor y queda como tablero documental.
- Inteligencia separa mercado, escenario y riesgo para lectura rapida.
- Estados vacios orientados a accion cuando no hay oportunidad seleccionada.
- Pildoras de estado coherentes con el sistema visual existente.
- Responsive: las zonas colapsan a una columna en tablet y movil.

## Cambios funcionales

- `renderProposal` actualiza fuentes, editor y panel de revision de forma independiente.
- `renderProposalReview` ya no se anade dentro del editor; vive en su panel propio.
- `renderDossier` muestra completitud real, obligatorios cubiertos, biblioteca e items.
- `renderCompetitive` alimenta tambien escenario economico y riesgo ejecutivo.
- `handleSaveScenario` actualiza el panel de escenario sin ensuciar el dashboard principal.

## Accesibilidad

- Los espacios principales usan etiquetas `aria-label`.
- Se mantiene navegacion por sidebar y hashes existentes.
- Los botones de accion conservan semantica nativa.
- Los datos clave se presentan como grupos escaneables con texto real, no solo color.

## Limitaciones conocidas

- El editor sigue siendo preview markdown, no edicion WYSIWYG inline.
- El dossier muestra estado y exporta ZIP, pero la subida documental real depende de Supabase Storage y no se ha construido UI de carga avanzada.
- El escenario economico usa una baja base conservadora; falta configurador con coste estimado, margen objetivo y comparativa de multiples escenarios.
