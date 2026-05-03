# Sprint 14 - Observabilidad autonoma

## Objetivo

Que Futuro Anterior se vigile solo: ejecutar probes sinteticos, detectar sesiones atascadas, abrir dead letters, registrar SLA/conversion/costes y emitir alertas P0 externas cuando haya fallos criticos.

## PB cubiertos

- **PB-H02 Synthetic monitor periodico**: acciones `runSyntheticMonitor` y `adminRunSyntheticMonitor`.
- **PB-H03 Alertas externas P0**: `FUTURE_BOOK_ALERT_WEBHOOK_URL` con tabla `future_book_alert_deliveries`.
- **PB-H04 Stuck sessions**: `detectStuckSessions()` detecta entrevistas, libros, PDFs y revisiones atascadas.
- **PB-H05 Reintentos controlados**: `adminRetryDeadLetter` reintenta/resuelve entradas controladas.
- **PB-H06 Dead-letter queue**: tabla `future_book_dead_letters`.
- **PB-H07 Runbook por proveedor**: runbook actualizado con acciones ante OpenAI, Anthropic, ElevenLabs, PDF y pago.
- **PB-H08 Dashboard SLA**: tabla `future_book_sla_snapshots` y panel Observabilidad en back office.
- **PB-H09 Conversion por paso**: snapshots de conversion desde sesion creada hasta PDF liberado.
- **PB-H10 Cost anomaly detection**: `costAnomalySnapshot()` con limite `FUTURE_BOOK_DAILY_PROVIDER_CALL_LIMIT`.

## Backend

- Nueva migracion `202604220008_future_book_sprint14_autonomous_observability.sql`.
- Nuevas tablas:
  - `future_book_synthetic_runs`
  - `future_book_dead_letters`
  - `future_book_sla_snapshots`
  - `future_book_alert_deliveries`
- Nuevas acciones:
  - `runSyntheticMonitor`
  - `runAutonomousMonitor`
  - `adminRunSyntheticMonitor`
  - `adminRunAutonomousMonitor`
  - `adminRetryDeadLetter`
  - `adminResolveDeadLetter`

## Back Office

- Nuevo panel Observabilidad.
- Synthetic manual.
- Monitor autonomo manual.
- Dead-letter queue con retry/resolver.
- KPIs de SLA, stuck sessions, conversion y webhook de alertas.

## Operacion periodica

Queda automatizada en GitHub Actions con `.github/workflows/future-book-monitor.yml` cada 30 minutos usando `INGESTION_SECRET`.

Para ejecucion periodica externa alternativa:

```bash
curl -X POST "$FUNCTIONS_BASE_URL/future-book-session" \
  -H "Content-Type: application/json" \
  -H "x-future-book-monitor-secret: $FUTURE_BOOK_MONITOR_SECRET" \
  --data '{"action":"runAutonomousMonitor"}'
```

El mismo secreto tambien acepta `x-licitia-job-secret` si se reutiliza `INGESTION_SECRET`.

## DoD

- Si falla OpenAI, Anthropic, ElevenLabs, pago o PDF, queda alerta/dead-letter o provider status visible.
- Hay synthetic monitor guardado.
- Hay snapshot SLA/conversion/coste.
- Hay dead-letter queue operable.
- Hay alerta externa opcional por webhook.
