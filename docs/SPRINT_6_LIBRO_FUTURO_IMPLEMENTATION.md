# Sprint 6 - Futuro Anterior

## Objetivo

Cerrar lo necesario para abrir beta privada controlada sin ir a ciegas: legal especifico, privacidad/retencion, test e2e, monitorizacion basica, runbook y checklist.

## PB incluidos

- PB-G01: terminos de uso.
- PB-G02: privacidad y retencion.
- PB-H02: tests end-to-end del flujo completo.
- PB-H03: monitorizacion basica.
- PB-H04: runbook operativo.

## Legal publicado

Paginas nuevas:

- `src/legal/futuro-terms.html`
- `src/legal/futuro-privacy.html`

La pantalla publica `src/tiresias.html` enlaza ambos documentos antes de aceptar terminos.

Cobertura:

- obra generada con IA;
- no predice el futuro;
- no es terapia ni consejo medico, legal, financiero o psicologico;
- pago beta simulado;
- uso de datos para voz, transcripcion, manuscrito y PDF;
- proveedores principales;
- retencion recomendada de 30 dias;
- derecho de borrado.

## Monitorizacion

Migracion nueva:

```text
supabase/migrations/202604220002_future_book_sprint6_monitoring.sql
```

Tablas:

- `future_book_monitor_alerts`
- `future_book_runtime_flags`

Backend:

- `adminMonitor`
- `adminToggleAccess`
- `adminDeleteSessionData`
- `accessDisabled`
- `ensureP0Alert`

El monitor calcula:

- acceso abierto/cerrado;
- sesiones fallidas;
- proveedores obligatorios ausentes;
- PDFs `pending_review` mas de 24 horas;
- media de entrevista;
- media de generacion de libro;
- media de generacion PDF.

## Back office

`src/futuro-admin.html` incluye ahora:

- panel `monitor`;
- boton `disable_access` / `enable_access`;
- borrado operativo de datos por `session_id`;
- metricas P0.

En local se guarda el flag de acceso en `localStorage`. En backend se guarda en `future_book_runtime_flags`. En produccion tambien puede forzarse con:

```bash
FUTURE_BOOK_ACCESS_DISABLED=true
```

## Test e2e

Script:

```text
scripts/test-future-book-sprint6.mjs
```

Simula:

1. Crear sesion.
2. Aceptar consentimiento.
3. Pago simulado aprobado.
4. Completar 21 respuestas.
5. Generar manuscrito.
6. Generar PDF.
7. Verificar PDF bloqueado en `pending_review`.
8. Aprobar PDF desde back office.
9. Verificar que sigue requiriendo liberacion manual.
10. Liberar PDF.
11. Verificar descarga y metadata `ready_for_print`.

## Operacion

Documentos nuevos:

- `docs/RUNBOOK_FUTURO_ANTERIOR.md`
- `docs/BETA_CHECKLIST_FUTURO_ANTERIOR.md`

Incluyen:

- como revisar sesiones;
- como descargar y revisar PDFs;
- como regenerar;
- como borrar datos;
- como rotar API keys;
- como desactivar el acceso;
- checklist Go/No-Go de beta privada.

## Estado final

El MVP queda preparado para beta privada: URL fija, pago simulado, entrevista completa, manuscrito, PDF, back office, aprobacion manual, legal visible, monitorizacion basica y operacion documentada.
