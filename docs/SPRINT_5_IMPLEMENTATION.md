# Sprint 5 - Propuesta, competidores, simulador y dossier

## Objetivo

Convertir la oportunidad seguida en material de candidatura:

- borrador tecnico versionado;
- revision de propuesta sin sobrescribir;
- historico competitivo y normalizacion de adjudicatarios;
- simulador economico por expediente;
- biblioteca documental, dossier y exportaciones.

## Backend

Nuevas Edge Functions:

- `proposal-copilot`: genera propuesta tecnica en Markdown, versiona en `proposal_versions`, registra `ai_runs` y exporta DOCX.
- `proposal-review`: evalua secciones de la propuesta, devuelve score/riesgos/sugerencias y guarda la revision.
- `competitive-intel`: dashboard competitivo, importacion de adjudicaciones, escenarios economicos y CSV.
- `document-dossier`: biblioteca documental, dossier por expediente y ZIP limpio de manifiesto/checklist.

Helper nuevo:

- `_shared/exports.ts`: DOCX minimo, ZIP limpio y CSV sin depender de librerias externas.

## Base de datos

Migracion `202604200004_sprint5_proposals_competitive_dossier.sql`:

- amplia `proposal_projects` y `proposal_versions`;
- crea `companies`, `company_aliases`, `award_history`;
- crea `economic_scenarios`;
- crea `document_library`, `dossier_packages`, `dossier_items`, `export_jobs`;
- activa RLS multi-tenant;
- crea bucket privado `licitia-documents`.

## Frontend

El cockpit incorpora el bloque `Propuesta, competidores y dossier`:

- generar propuesta desde ficha;
- revisar propuesta;
- exportar DOCX;
- ver inteligencia competitiva;
- crear escenario economico;
- preparar dossier;
- exportar ZIP.

## Limitaciones conocidas

- La subida binaria completa a Storage queda preparada a nivel de bucket/metadatos, pero la UI actual registra documentos y dossiers; el upload binario avanzado se puede pulir en el sprint de UX/operaciones.
- PDF queda trazado como tipo de exportacion, pero la exportacion implementada ahora es DOCX y ZIP.
