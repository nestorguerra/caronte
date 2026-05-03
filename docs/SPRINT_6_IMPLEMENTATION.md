# Sprint 6 - Produccion, operaciones y calidad

## Objetivo

Cerrar LicitIA v2 como beta productiva desplegable:

- backups y restauracion organizativa;
- observabilidad de errores;
- administracion de usuarios, invitaciones y organizaciones;
- cockpit operativo sin saltos de scroll;
- checks de release, seguridad, RLS y E2E beta;
- documentacion operativa y matriz de cumplimiento.

## Backend

Nuevas Edge Functions:

- `ops-admin`: endpoint owner/admin para panel operativo, backup ZIP, release checks, bloqueo/desbloqueo de organizacion y reset de invitaciones.
- `observability-event`: captura errores de frontend/backend, minimiza datos, redacta bearer tokens y crea `error_events`.

Ambas funciones se despliegan con `verify_jwt=false` y validacion en codigo, igual que el resto de funciones autenticadas del producto, para evitar el problema del validador automatico con tokens `ES256`.

Variable opcional nueva:

- `APP_ADMIN_EMAILS`: emails separados por coma con vista plataforma multi-organizacion.

## Base de datos

Migracion `202604200005_sprint6_ops_quality_release.sql`:

- amplia `organizations` con `status`, `blocked_at` y `blocked_reason`;
- crea `backup_runs`;
- crea `error_events`;
- crea `internal_alerts`;
- crea `release_checks`;
- activa RLS multi-tenant con politicas owner/admin;
- crea indices para operaciones;
- crea bucket privado `licitia-backups`.

## Frontend

El cockpit pasa de navegacion por scroll a vistas reales:

- `Cockpit`;
- `Oportunidades`;
- `Alertas`;
- `Equipo`;
- `Ajustes y operacion`.

La vista de ajustes incorpora:

- estado operativo;
- backup organizativo;
- errores recientes;
- alertas internas;
- checks P0 de release.

Se anade tracking global de errores de navegador mediante `observability-event`.

## Calidad y release

Nuevo test estatico:

- `scripts/test-production-flows.mjs`

Comprueba:

- alta beta gratuita sin tarjeta;
- login, recuperacion y onboarding corto;
- ausencia de UI/API de pagos;
- cockpit con busqueda, seguimiento, propuesta, dossier y operaciones;
- documentacion minima de runbook y cumplimiento.

`npm test` ejecuta ahora:

```bash
node scripts/test-sprint1.mjs
node scripts/test-production-flows.mjs
```

## Resultado

Con Sprint 6, el producto queda preparado para operar la beta gratuita de primer mes sin pasarela de pagos, con trazabilidad, RLS, observabilidad, backup/export, release checks y documentacion productiva.
