# Sprint 1 implementation notes

## Completed in repository

- Source frontend moved to `src/`.
- Production build created with `scripts/build.mjs`.
- GitHub Pages workflow now deploys `dist/`.
- Auth/onboarding shell created:
  - signup
  - login
  - organization creation
  - search preferences
  - free beta plan message
- App shell validates the user session against Supabase Auth.
- Supabase Edge Functions added:
  - `health`
  - `create-organization`
- PostgreSQL migration added with core tables and RLS.
- Validation and Sprint 1 schema tests added.

## External setup

- Supabase project must exist.
- Migrations must be applied.
- Functions must be deployed.
- Supabase Auth email settings must be configured.
- GitHub repository variables required:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `FUNCTIONS_BASE_URL`
- Supabase Functions variables/secrets required:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS`
  - `APP_ENV`

Sprint 2 adds more functions but keeps the same public frontend variables.

## Product limitation after Sprint 1

Sprint 1 is the production foundation. It does not yet include BOE/PLACSP ingestion, advanced search, alerts, RAG, proposal generation or document workflows. Those start in Sprint 2/3 according to `PRODUCT_BACKLOG_PRODUCCION_LICITIA.md`.
