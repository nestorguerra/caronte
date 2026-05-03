# LicitIA API Contract - Sprint 1 a 6

## Public frontend config

The GitHub Pages frontend reads `config/env.js`.

Required public values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `FUNCTIONS_BASE_URL`
- `APP_ENV`

Payments must stay disabled in Sprint 1:

```js
paymentsEnabled: false
```

## Auth

Auth is handled by Supabase Auth REST endpoints from the frontend using the public anon key.

- `POST /auth/v1/signup`
- `POST /auth/v1/token?grant_type=password`
- `GET /auth/v1/user`
- `POST /auth/v1/logout`

The dashboard must not load private data unless `/auth/v1/user` confirms the access token.

## Edge Functions

### `GET /health`

Returns API and database status.

```json
{
  "ok": true,
  "service": "licitia-api",
  "environment": "production",
  "database": "ok",
  "timestamp": "2026-04-19T20:00:00.000Z"
}
```

### `POST /create-organization`

Requires `Authorization: Bearer <access_token>`.

Creates:

- organization
- owner membership
- free beta subscription
- company profile
- audit event

Request:

```json
{
  "organization": {
    "name": "Empresa S.L.",
    "tax_id": "B00000000",
    "country": "ES",
    "sector": "Consultoria IT"
  },
  "companyProfile": {
    "services_description": "Servicios...",
    "target_cpvs": ["72000000"],
    "certifications": ["ISO 9001"],
    "annual_revenue_range": "500k-2m",
    "employee_range": "11-50",
    "operating_regions": ["Madrid"]
  }
}
```

Legacy compatibility endpoint. Sprint 2 uses `complete-onboarding` for the production flow.

### `POST /complete-onboarding`

Requires `Authorization: Bearer <access_token>`.

Creates or updates:

- organization
- owner membership
- full company profile
- 1-5 saved searches
- first alert rule
- optional team invitations
- free beta subscription with period end
- legal acceptance versions
- audit trail

Request:

```json
{
  "organization": {
    "name": "Empresa S.L.",
    "tax_id": "B00000000",
    "country": "ES",
    "sector": "Consultoria IT"
  },
  "companyProfile": {
    "legal_name": "Empresa S.L.",
    "trade_name": "Empresa",
    "sectors": ["IT"],
    "cnae": "6202",
    "services_description": "Servicios...",
    "target_cpvs": ["72000000"],
    "certifications": ["ISO 9001", "ENS"],
    "business_classification": "Grupo V",
    "annual_revenue_range": "500k-2m",
    "employee_range": "11-50",
    "years_experience": 8,
    "operating_regions": ["Madrid"],
    "min_contract_value_cents": 5000000,
    "max_contract_value_cents": 30000000,
    "target_contract_types": ["Servicios"]
  },
  "savedSearches": [
    {
      "name": "Consultoria IT Madrid",
      "query": "consultoria sistemas ayuntamientos",
      "filters": {
        "cpv": ["72000000"],
        "territory": "Madrid",
        "only_open": true
      }
    }
  ],
  "alertRule": {
    "cadence": "daily",
    "channels": { "email": true }
  },
  "invitations": [
    { "email": "legal@empresa.com", "role": "legal" }
  ],
  "legalAcceptance": {
    "accepted": true,
    "termsVersion": "beta-2026-04",
    "privacyVersion": "beta-2026-04",
    "aiNoticeVersion": "beta-2026-04",
    "communicationsConsent": true
  }
}
```

Response includes `payments.enabled=false` and the free beta message. No card or payment provider data is accepted.

### `POST /onboarding-state`

Requires `Authorization: Bearer <access_token>`.

Returns current user organization, membership, profile, subscription, saved searches, alert rules, invitations, legal acceptance and recent audit events. Used by the cockpit after login.

### `POST /update-company-profile`

Requires `Authorization: Bearer <access_token>`.

Allows owner/admin/bid manager to edit the company profile after onboarding. Writes `company_profile.updated` to `audit_events`.

### `POST /audit-event`

Requires `Authorization: Bearer <access_token>`.

Records controlled client-visible audit events:

- `auth.login`
- `auth.logout`
- `legal.notice_viewed`
- `onboarding.started`
- `onboarding.cancelled`
- `user_settings.updated`
- `onboarding_completed`
- `search_executed`
- `tender_tracked`
- `decision_recorded`
- `proposal_exported`
- `dossier_exported`
- `ops_tab_changed`

Product metric events must not include query text, proposal text, document contents, email addresses or any other sensitive payload. Use counters, booleans, resource ids and safe workflow labels only.

## Sprint 3 official data, search and alerts

### `POST /ingest-boe`

Protected job endpoint. Accepts either an authenticated owner/admin user or `x-licitia-job-secret` matching `INGESTION_SECRET`.

Ingests BOE OpenData daily summary and stores matching public-contract notices as normalized public `tenders`, `tender_documents` and `tender_versions`.

Request:

```json
{
  "date": "20260420",
  "limit": 80
}
```

### `POST /ingest-placsp`

Protected job endpoint. Accepts either an authenticated owner/admin user or `x-licitia-job-secret` matching `INGESTION_SECRET`.

Ingests PLACSP Atom open-data feeds:

- `source=profiles`: `licitacionesPerfilesContratanteCompleto3.atom`
- `source=aggregated`: `PlataformasAgregadasSinMenores.atom`

The ingestion follows Atom `rel=next` pagination up to `maxPages`, and normalizes territorial data so province, island and NUTS codes can be searched by autonomous community.

Request:

```json
{
  "source": "profiles",
  "limit": 300,
  "maxPages": 2
}
```

### `POST /search-tenders`

Requires `Authorization: Bearer <access_token>`.

Searches backend-normalized public tenders. Filtering and scoring are server-side.

Request:

```json
{
  "sort": "score",
  "limit": 25,
  "filters": {
    "query": "consultoria sistemas",
    "cpv": ["72000000"],
    "contracting_body": "ayuntamiento",
    "region": "Madrid",
    "amount_min_cents": 5000000,
    "amount_max_cents": 30000000,
    "only_open": true,
    "with_documents": true
  }
}
```

The `region` filter accepts autonomous communities, provinces and common aliases. For example, `Andalucia` matches tenders normalized from `Sevilla`, `Malaga` or `ES61`; `Euskadi` matches `Pais Vasco`; `Canarias` matches islands such as `Gran Canaria`.

### `POST /tender-detail`

Requires `Authorization: Bearer <access_token>`.

Returns tender, lots, documents, versions and organization tracking state.

### `POST /track-tender`

Requires `Authorization: Bearer <access_token>`.

Creates or updates organization-specific tracking for a tender.

Allowed statuses:

- `new`
- `analysis`
- `go`
- `no_go`
- `preparing`
- `submitted`
- `discarded`
- `awarded`
- `lost`

### `POST /decision-score`

Requires `Authorization: Bearer <access_token>`.

Calculates explainable Go/No-Go scoring server-side. With `persist=true` or a manual `decision`, it stores the decision in `tracked_tenders` and writes an audit event.

Request:

```json
{
  "tenderId": "uuid",
  "persist": true,
  "decision": "go",
  "reason": "Decision marcada por ventas"
}
```

Response contains `score.total`, `score.recommendation`, `score.confidence` and `score.factors[]` with weight, explanation and evidence.

### `POST /analyze-tender`

Requires `Authorization: Bearer <access_token>`.

Server-side IA proxy for tender analysis. The browser never receives the IA key. The endpoint applies daily limits per organization/user, logs `ai_runs`, validates structured output and falls back to deterministic analysis if the provider is unavailable.

Response sections:

- `official_facts`: amounts, deadlines, CPV and official facts with citations.
- `inferred_risks`: explicit inference, never presented as official text.
- `requirements`: found, inferred or `not_found`.
- `score`: the same explainable scoring object used by Go/No-Go.

### `POST /workflow-tender`

Requires `Authorization: Bearer <access_token>`.

Prepares or updates the execution workflow for a tender: tracked tender, document checklist, tasks, milestones and ICS calendar payload.

Common request:

```json
{
  "action": "bootstrap",
  "tenderId": "uuid",
  "aiRunId": "uuid"
}
```

Supported actions:

- `bootstrap`
- `updateChecklistItem`
- `createTask`
- `updateTask`
- `createMilestone`

### `POST /system-health`

Requires `Authorization: Bearer <access_token>` and owner/admin role.

Returns operational health: API/DB state, latest ingestion runs, failed jobs in the last 24h, notification delivery status, IA usage and workload counters.

### `POST /proposal-copilot`

Requires `Authorization: Bearer <access_token>`.

Creates versioned technical proposal drafts for a tender and records model/prompt/output in `ai_runs`. If `OPENAI_API_KEY` is not configured and the user has not provided a local OpenAI key, it returns a conservative deterministic draft with pending-data warnings.

Optional `draft` payload fields:

- `openaiApiKey`: user-provided OpenAI key for this request only. It is not persisted by the Edge Function.
- `openaiModel`: one of `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`.

Drafts are generated with the `sprint5.proposal.v2` prompt. The output length scales with tender amount and official document count, and includes a professional structure, risk controls, compliance matrix and official sources.

Actions:

- `draft`: creates/updates `proposal_projects` and appends a new `proposal_versions` row.
- `export`: returns a generated DOCX as base64 and records an `export_jobs` row.

### `POST /proposal-review`

Requires `Authorization: Bearer <access_token>`.

Reviews a proposal version without overwriting the draft. Returns section scores, risks and actionable suggestions, and stores the review in `proposal_versions.review`.

### `POST /competitive-intel`

Requires `Authorization: Bearer <access_token>`.

Provides competitive intelligence from `award_history` and economic scenario storage.

Actions:

- `dashboard`: returns top awardees, average/median discount and time/body breakdowns.
- `importAward`: records a formalized award and normalizes the awardee into `companies`.
- `saveScenario`: stores a pricing scenario linked to a tracked tender.
- `exportCsv`: returns award history CSV.

### `POST /document-dossier`

Requires `Authorization: Bearer <access_token>`.

Manages document library metadata, tender dossiers and clean ZIP export manifests.

Actions:

- `prepare`: creates a dossier for a tender with required company documents and official references.
- `upsertDocument`: registers private document metadata in `document_library`.
- `list`: lists organization documents and dossiers.
- `export`: returns a clean ZIP as base64 and records `export_jobs`.

### `POST /run-alerts`

Protected job endpoint. Accepts either an authenticated owner/admin user or `x-licitia-job-secret` matching `INGESTION_SECRET`.

Evaluates active `alert_rules`, creates deduplicated `alert_events`, and records `notification_deliveries`.

Email delivery uses Resend if these secrets are configured:

- `RESEND_API_KEY`
- `NOTIFICATION_FROM`

If the email provider is not configured, deliveries are recorded as `skipped` with `email_provider_not_configured`.

## Sprint 6 operations, observability and release readiness

### `POST /ops-admin`

Requires `Authorization: Bearer <access_token>` and owner/admin role in the active organization. Platform-wide views are only available when the user email is included in `APP_ADMIN_EMAILS`.

Default action:

```json
{
  "action": "dashboard"
}
```

Returns organizations visible to the user, latest backups, recent errors, internal alerts, release checks, audit events and invitations.

Supported actions:

- `dashboard`: operational cockpit for owner/admin.
- `exportOrganization`: creates an organization ZIP export as base64 and records `backup_runs`.
- `recordReleaseChecks`: records production release controls for security, E2E beta, frontend, backend/RLS, accessibility and restore test.
- `blockOrganization`: marks an organization as blocked and audits the reason.
- `unblockOrganization`: reactivates a blocked organization.
- `resetInvitation`: resets a pending team invitation.

Response for `exportOrganization`:

```json
{
  "ok": true,
  "backup": { "id": "uuid", "status": "succeeded" },
  "export": {
    "filename": "licitia-org-backup-12345678.zip",
    "mimeType": "application/zip",
    "base64": "UEs..."
  }
}
```

### `POST /observability-event`

Receives frontend, Edge Function, job or database error events. It redacts bearer tokens before storage and records `error_events` with user, organization, URL, fingerprint and context when available. It can also receive anonymous `info` events for non-sensitive UX telemetry such as `signup_started`.

Request:

```json
{
  "source": "frontend",
  "severity": "error",
  "message": "Unexpected UI error",
  "stack": "Error: ...",
  "url": "https://nestorguerra.github.io/licitia-v2-production/app.html",
  "organizationId": "uuid",
  "context": { "screen": "cockpit" }
}
```

Response:

```json
{
  "ok": true,
  "eventId": "uuid"
}
```
