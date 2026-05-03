# Caronte

Producto autonomo para entrevista privada, generacion de manuscrito y PDF final.

- Produccion: https://nestorguerra.github.io/caronte/
- Experiencia cliente: https://nestorguerra.github.io/caronte/futuro.html
- Back office: https://nestorguerra.github.io/caronte/futuro-admin.html
- Backend: Supabase Edge Function `future-book-session`

## Flujo operativo

1. El usuario entra en la experiencia y confirma el acceso.
2. Caronte inicia la entrevista por voz.
3. Las respuestas se guardan en backend con cola de recuperacion.
4. El sistema genera manuscrito con IA real cuando los proveedores estan configurados.
5. El PDF queda versionado y revisable desde back office.

## Configuracion publica de GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` necesita estas variables de repositorio:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `FUNCTIONS_BASE_URL`

El monitor autonomo necesita el secreto:

- `INGESTION_SECRET`

Nunca subas claves privadas al frontend. Las keys de OpenAI, Anthropic, ElevenLabs y Lulu se guardan en Supabase/back office como secretos o configuracion write-only.

## Desarrollo local

```bash
npm run validate
npm test
npm run build
npm run serve
```

URLs locales:

- http://127.0.0.1:8765/
- http://127.0.0.1:8765/futuro.html
- http://127.0.0.1:8765/futuro-admin.html

## Contratos de produccion implementados

- Modulo Futuro Anterior Sprint 8: transcripcion backend, bucket privado `future-book-audio`, `FUTURE_BOOK_TRANSCRIPTION_MODEL` y `FUTURE_BOOK_STORE_AUDIO`.
- Modulo Futuro Anterior Sprint 9: mapas psicologicos versionados en `future_book_psych_maps`, prompt `caronte-literary-v1` y `FUTURE_BOOK_MAP_MODEL`.
- Modulo Futuro Anterior Sprint 10: PDFs privados en `future-book-pdfs`, compatibilidad legacy `pdf_base64` y estado `ready_for_print`.
- Modulo Futuro Anterior Sprint 12: back office con `future_book_admin_users`, detalle `adminSessionDetail` y mutacion `adminPatchSessionStatus`.
- Modulo Futuro Anterior Sprint 13: hardening con `future_book_abuse_events`, `FUTURE_BOOK_PRIVACY_SALT` y nota operativa: GitHub Pages no permite headers dinamicos server-side.
- Modulo Futuro Anterior Sprint 14: observabilidad con `future_book_synthetic_runs`, workflow `future-book-monitor.yml`, `FUTURE_BOOK_MONITOR_SECRET` y `FUTURE_BOOK_ALERT_WEBHOOK_URL`.
- Modulo Futuro Anterior Sprint 15: acceso viral con `future_book_access_campaigns`, `FUTURE_BOOK_ACCESS_MODE` y `FUTURE_BOOK_REQUIRE_INVITE`.
