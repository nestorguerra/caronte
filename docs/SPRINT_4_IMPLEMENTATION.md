# Sprint 4 - IA, Go/No-Go, expediente y salud operativa

## Objetivo

Pasar de busqueda/seguimiento a preparacion real de oportunidades:

- scoring explicable Go/No-Go;
- proxy IA server-side sin exponer claves;
- analisis con citas y separacion hecho oficial/inferencia;
- checklist documental, tareas, responsables e hitos;
- panel de salud para operar el producto en beta.

## Backend

Nuevas Edge Functions:

- `decision-score`: calcula score, factores, recomendacion y guarda decisiones manuales auditadas.
- `analyze-tender`: ejecuta proxy IA server-side con limite diario, salida estructurada, citas y log en `ai_runs`.
- `workflow-tender`: crea expediente operativo con checklist, tareas, hitos y calendario ICS.
- `system-health`: resume API/DB, ingesta, notificaciones, IA y carga de trabajo para owner/admin.

Helpers compartidos:

- `_shared/scoring.ts`
- `_shared/ai.ts`
- `_shared/workflow.ts`

## Base de datos

Migracion `202604200003_sprint4_ai_workflow_health.sql`:

- decision y desglose en `tracked_tenders`;
- fuente, historial y AI run en `document_checklists`;
- prioridad, documento, metadatos y cierre en `tasks`;
- recordatorios/exportacion en `milestones`;
- endpoint, success, coste estimado y error en `ai_runs`;
- nueva tabla `task_comments` con RLS multi-tenant.

## Frontend

El cockpit incorpora:

- panel `Decision Go/No-Go y preparacion`;
- acciones desde ficha: calcular score, marcar GO, marcar NO-GO, analizar IA y preparar expediente;
- visualizacion de factores explicables;
- analisis con hechos oficiales, riesgos inferidos y avisos de fallback;
- checklist, tareas e hitos;
- panel `Salud del sistema`.

## Produccion

Todas las funciones autenticadas de usuario siguen con `verify_jwt=false` y validacion en codigo mediante Supabase Auth `/auth/v1/user`, evitando el fallo de tokens `ES256`.

Variables opcionales nuevas:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Sin `OPENAI_API_KEY`, `analyze-tender` devuelve analisis determinista conservador y sigue registrando trazabilidad.
