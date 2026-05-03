# Sprint 3 implementation notes

## Product scope delivered

Sprint 3 covers:

- PB-E01: BOE OpenData ingestion from backend.
- PB-E02: PLACSP Atom open-data ingestion from backend.
- PB-E03: first canonical normalizer for tenders, documents and versions.
- PB-F01: backend tender search with filters and score.
- PB-F02: tender detail with documents, versions and tracking state.
- PB-F03: save/follow tenders with organization status.
- PB-G01: server-side alert rule evaluation with deduplication.
- PB-G02: email notification delivery records and optional Resend integration.

## Official data sources

BOE:

- `https://www.boe.es/datosabiertos/api/boe/sumario/{fecha}`
- Used for daily summary ingestion and section V public-contract notices.

PLACSP:

- Profiles feed: `https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`
- Aggregated platforms feed: `https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom`

The PLACSP pages state that datasets are updated daily, expose up to 500 entries per Atom file, and continue via `atom:link rel="next"`. The current ingestion follows `rel=next` pagination with a bounded `maxPages` limit and normalizes province/island/NUTS signals into autonomous-community labels.

## Database changes

Migration:

```text
supabase/migrations/202604200002_sprint3_official_data_search_alerts.sql
```

Adds:

- `procurement_ingestion_runs`
- source metadata for:
  - `boe_opendata`
  - `placsp_profiles`
  - `placsp_aggregated`
- tender source URL, source timestamps, document count and quality flags
- tender version source URL and fingerprint
- alert last error / pause metadata
- notification subject/body preview/metadata
- indexes for ingestion, search, versions, tracking and deliveries

## Edge Functions

New Sprint 3 functions:

- `ingest-boe`
- `ingest-placsp`
- `search-tenders`
- `tender-detail`
- `track-tender`
- `run-alerts`

Shared parser/normalizer:

- `supabase/functions/_shared/tenders.ts`

## Frontend changes

- Cockpit includes backend tender search.
- Search filters:
  - text
  - CPV
  - contracting body
  - region
  - amount min/max
  - status
  - procedure
  - only open
  - only with documents
- Region matching accepts autonomous communities, provinces and common aliases such as `Euskadi`, `Andalucia`, `Canarias` or `Comunitat Valenciana`.
- Results show score, deadline, CPV and tracking state.
- Tender detail shows official data, documents count, versions count and follow status.
- User can save/follow a tender from the cockpit.
- Owner/admin can manually evaluate alert rules from the cockpit.

## Notifications

`run-alerts` creates deduplicated `alert_events` and `notification_deliveries`.

If `RESEND_API_KEY` and `NOTIFICATION_FROM` are configured, email is sent via Resend. If not, the delivery is kept as `skipped` with `email_provider_not_configured`, so operations can see that the event was generated but no provider is active yet.

## Production notes

- BOE/PLACSP ingestion runs server-side; the browser never calls official feeds directly.
- Ingestion and alert jobs are protected by owner/admin auth or `INGESTION_SECRET`.
- Full historical backfill, deeper CODICE field coverage and provider email setup are the next hardening items.
