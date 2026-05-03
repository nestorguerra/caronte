# Sprint 13 - Seguridad, privacidad y anti-abuso

## Objetivo

Proteger Futuro Anterior antes de abrir trafico real: limitar abuso por coste, minimizar datos sensibles, preparar cabeceras fuertes, automatizar retencion y dejar export/borrado RGPD operativo.

## PB cubiertos

- **PB-G01 Hosting con headers custom**: `vercel.json` y `src/_headers` preparados para hosting con cabeceras. GitHub Pages no permite aplicar CSP/`frame-ancestors` por header.
- **PB-G02 CSP estricta**: CSP por header preparada y CSP meta de compatibilidad en las paginas Futuro.
- **PB-G03 `frame-ancestors none`**: configurado en `vercel.json` y `_headers`; no aplicable por meta en GitHub Pages.
- **PB-G04 Referrer/Permissions policy**: `no-referrer`, `X-Content-Type-Options`, `Permissions-Policy`, COOP/CORP y HSTS preparados.
- **PB-G05 Rate limiting**: `future_book_abuse_events` y `enforceAbuseLimit()` por IP hash, fingerprint hash y sesion.
- **PB-G06 Challenge anti-abuso**: proof invisible cliente-servidor con fingerprint y ventana diaria; challenge si hay volumen anomalo.
- **PB-G07 Retencion automatica**: tabla `future_book_retention_policies` con TTLs por tipo de dato.
- **PB-G08 Borrado por TTL**: `adminRunRetention` ejecuta limpieza de audio, PDFs, respuestas, manuscritos, mapas, eventos y logs antiguos.
- **PB-G09 Export/borrado RGPD**: acciones `exportPrivacyData`, `requestPrivacyErasure`, `adminPrivacyExport` y `adminPrivacyErase`.
- **PB-G10 Subencargados**: privacidad actualizada con Supabase, ElevenLabs, OpenAI, Anthropic, pagos y Lulu.
- **PB-G11 Legal final**: terminos y privacidad reflejan anti-abuso, retencion y limites.
- **PB-G12 Cifrado/aislamiento**: storage privado se mantiene; IP/fingerprint se guardan hasheados, no crudos.

## Backend

- Nueva migracion `202604220007_future_book_sprint13_security_privacy.sql`.
- Nuevas tablas:
  - `future_book_abuse_events`
  - `future_book_retention_policies`
  - `future_book_privacy_requests`
- Nuevas columnas en sesiones:
  - `ip_hash`
  - `fingerprint_hash`
  - `expires_at`
  - `privacy_erased_at`
  - `abuse_score`
  - `risk_flags`
- Rate limits por:
  - `createSession`
  - `startSimulatedPayment`
  - `approveSimulatedPayment`
  - `synthesizeQuestion`
  - `saveAnswer`
  - `generateBook`
  - `generatePdf`
  - `downloadReleasedPdf`
  - export/borrado RGPD

## Frontend

- Fingerprint cliente minimizado con hash.
- Proof invisible anti-abuso basado en dia UTC.
- CSP meta y `no-referrer` en experiencia, admin y legales.

## Back Office

- Panel de seguridad.
- Contadores de bloqueos, challenges, eventos anti-abuso y solicitudes RGPD.
- Botones para simular/ejecutar retencion.
- Export y borrado RGPD por ID de sesion.

## Limitacion de hosting

GitHub Pages no permite cabeceras HTTP custom. Sprint 13 deja los archivos de configuracion listos para Vercel/Netlify/Cloudflare (`vercel.json` y `_headers`) y aplica CSP meta como mitigacion parcial. Para cumplir literalmente `frame-ancestors none` en produccion hay que mover el hosting final a una plataforma que respete headers.

## DoD

- Crear sesiones en masa queda limitado.
- Hay challenge invisible si aparece abuso.
- Hay retencion automatica ejecutable desde back office.
- Hay export/borrado RGPD operativo.
- No se almacena IP cruda para rate limiting.
- Los documentos legales reflejan proveedores reales y politicas actuales.
