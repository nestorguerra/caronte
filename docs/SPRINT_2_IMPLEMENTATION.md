# Sprint 2 implementation notes

## Product scope delivered

Sprint 2 covers:

- PB-B03: free beta plan model without payment gateway.
- PB-C04: activity audit for auth, onboarding, organization/profile and invitations.
- PB-C05: beta terms, privacy policy, AI notice and recorded acceptance.
- PB-D01: organization creation plus team invitations.
- PB-D02: richer company profile with completion progress and post-onboarding edit.
- PB-D03: 1-5 initial saved searches and first alert rule.
- PB-D05: free beta plan activation without card.
- PB-M01: login/register/recover password/onboarding UX.

## Database changes

Migration:

```text
supabase/migrations/202604200001_sprint2_onboarding_legal_audit.sql
```

Adds:

- `organization_invitations`
- `user_legal_acceptances`
- richer `company_profiles` fields:
  - sectors
  - cnae
  - min/max target contract value
  - target contract types
  - onboarding progress
  - completed timestamp
- indexes for invitations, legal acceptance, saved searches, alert rules and subscriptions
- beta plan feature metadata
- subscription `current_period_ends_at` backfill

## Edge Functions

New Sprint 2 functions:

- `complete-onboarding`
- `onboarding-state`
- `update-company-profile`
- `audit-event`

Existing compatibility function updated:

- `create-organization`

## Frontend changes

- Register/login/recover password tabs.
- Four-step onboarding:
  1. organization
  2. company profile
  3. saved searches, alert and invitations
  4. legal acceptance and free beta activation
- Static legal pages:
  - `/legal/terms.html`
  - `/legal/privacy.html`
  - `/legal/ai-notice.html`
- Cockpit now loads backend onboarding state.
- Cockpit shows plan, profile progress, saved searches, invitations and recent audit.
- Company profile can be edited after onboarding.

## Production notes

- No payment gateway is implemented.
- No card data is requested or stored.
- Invitations are registered in the database. Transactional email delivery belongs to Sprint 3 notification work.
- Official BOE/PLACSP ingestion remains Sprint 3.
