# Auditoria de preparacion a produccion post Sprint 6

Fecha: 2026-04-20  
Producto: LicitIA v2  
Repositorio: https://github.com/nestorguerra/licitia-v2-production  
Frontend: https://nestorguerra.github.io/licitia-v2-production/  
Supabase project ref: krvgvbzoflapfzqfdbty  
Commit auditado: 9647da7

## Veredicto ejecutivo

LicitIA esta en buen estado para una beta productiva controlada y gratuita. El frontend se despliega correctamente en GitHub Pages, la separacion entre web corporativa y herramienta productiva esta bien resuelta, el backend Supabase responde, las funciones criticas estan desplegadas, la base de datos tiene RLS multi-tenant y las pruebas locales pasan.

No la marcaria todavia como "100% produccion enterprise" para clientes de pago o clientes con exigencia contractual alta hasta cerrar cuatro frentes: cabeceras de seguridad/CSP, revision manual de accesibilidad y responsive, retencion/borrado formal de datos, y proteccion anti-abuso/rate limiting en endpoints anonimos de observabilidad.

Estado recomendado: go para beta privada de primer mes, no-go para produccion comercial plena sin hardening final.

## Evidencia tecnica ejecutada

Comandos locales ejecutados:

```bash
npm run build
npm run validate
npm test
find src/scripts scripts -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check
```

Resultado:

- Build correcto: genera `dist/`.
- Validacion estatica correcta: `Validation OK`.
- Tests de schema/API/frontend correctos: `Sprint 1+2+3+4+5+6 schema and API tests OK` y `Production frontend/E2E/static checks OK`.
- Parseo JS correcto: `node --check` sin errores.

Verificaciones de despliegue:

- GitHub Pages sirve `/` con HTTP 200.
- GitHub Pages sirve `/acceso.html` con HTTP 200.
- GitHub Pages sirve `/app.html` con HTTP 200.
- GitHub Pages sirve `/scripts/app-shell.js` con HTTP 200.
- `dist/config/env.js` publico contiene:
  - `appEnv: "production"`
  - `appVersion: "9647da720406"`
  - `supabaseUrl: "https://krvgvbzoflapfzqfdbty.supabase.co"`
  - `functionsBaseUrl: "https://krvgvbzoflapfzqfdbty.supabase.co/functions/v1"`
  - `paymentsEnabled: false`

Verificaciones backend:

- `GET /functions/v1/health` devuelve:
  - `ok: true`
  - `environment: production`
  - `database: ok`
- `POST /functions/v1/search-tenders` sin token devuelve `Missing bearer token`, correcto.
- Workflow `Deploy GitHub Pages` ultimo run `24669621920`: success.
- Workflow `Official Data Jobs` ultimo run `24649973025`: success.
- Pasos de job oficial en verde: BOE, PLACSP profiles, PLACSP aggregated y alert rules.

## Fortalezas actuales

### Producto y go-to-market

- La web corporativa se mantiene en la raiz y el acceso productivo va a `acceso.html`.
- El flujo de alta cumple la decision de beta gratuita: no hay pasarela, no hay tarjeta y `paymentsEnabled=false`.
- El onboarding se ha reducido a 7 preguntas y ya permite empezar a trabajar rapido.
- El cockpit cubre los flujos core: busqueda, oportunidad 360, decision Go/No-Go, propuesta, dossier, inteligencia competitiva, operaciones y ajustes.
- Existe un menu de usuario y ajustes de sistema, lo que acerca el producto a SaaS real.

### Arquitectura

- Frontend source-first en `src/` y build reproducible a `dist/`.
- GitHub Pages publica solo `dist/`.
- Supabase Auth queda como identidad central.
- Edge Functions aislan secretos server-side.
- La IA se llama desde backend y tiene fallback determinista.
- Ingestas BOE/PLACSP se ejecutan como jobs protegidos.

### Datos y seguridad backend

- Migraciones con tablas core, onboarding/legal, ingesta, IA, propuestas, dossier, operaciones y observabilidad.
- RLS habilitado en las tablas principales.
- Politicas por `organization_id` y helper `public.is_org_member` / `public.has_org_role`.
- Las funciones de usuario validan sesion en codigo mediante `/auth/v1/user`.
- Las funciones de job aceptan `x-licitia-job-secret` o owner/admin autenticado.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en frontend; solo en funciones server-side.

### Operacion

- Existe runbook operativo.
- Existe matriz de cumplimiento.
- Existe panel de salud, errores, backups, release checks y bloqueo/desbloqueo de organizaciones.
- Hay trazabilidad en `audit_events`, `error_events`, `backup_runs`, `release_checks`.

## Hallazgos criticos y riesgos

### P1 - Falta hardening de cabeceras de seguridad en la capa web

GitHub Pages devuelve HSTS y cache, pero no hay evidencia de estas cabeceras:

- `Content-Security-Policy`
- `X-Frame-Options` o `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`

Impacto: el frontend guarda tokens en `sessionStorage`. Esto no es necesariamente incorrecto para una SPA estatica, pero sin CSP estricta cualquier XSS futuro tendria mas impacto.

Recomendacion:

- Migrar el frontend productivo a un hosting con control de headers, por ejemplo Vercel, Cloudflare Pages o Netlify.
- Aplicar CSP restrictiva permitiendo solo:
  - origen propio,
  - Supabase project,
  - Google Fonts o fuente self-hosted,
  - imagenes corporativas aprobadas.
- Anadir `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` minimo.

### P1 - Falta prueba manual completa de accesibilidad y responsive

El producto tiene skip link, labels, foco visible, aria-live y navegacion por vistas. Aun asi, la propia matriz marca accesibilidad como "requiere revision manual final" y `ops-admin` registra accessibility como warning.

Impacto: riesgo de UX rota en usuarios teclado/lector de pantalla y de problemas en resoluciones reales.

Recomendacion:

- Ejecutar revision manual teclado-only.
- Ejecutar lector de pantalla basico en macOS VoiceOver.
- Pasar Lighthouse/axe en:
  - `/`
  - `/acceso.html`
  - `/app.html` autenticado
- Objetivo minimo: Lighthouse accessibility >= 95.

### P1 - Politica final de retencion/borrado y subencargados sigue abierta

La matriz identifica pendiente la revision contractual de subencargados y decisiones abiertas de retencion de logs, backups y documentos.

Impacto: para beta privada puede valer, pero para cliente real y especialmente sector publico hace falta cerrar RGPD/ENS con criterio formal.

Recomendacion:

- Definir retencion por tipo de dato:
  - cuenta/organizacion,
  - auditoria,
  - errores,
  - backups,
  - documentos,
  - salidas IA.
- Documentar borrado y exportacion.
- Firmar o validar DPA/subencargados: Supabase, Resend si se activa, OpenAI si se activa IA real.

### P2 - Endpoint anonimo de observabilidad admite escritura sin autenticacion

`observability-event` acepta eventos anonimos para metricas no sensibles como `signup_started`. La CORS productiva no refleja origenes no permitidos, lo cual esta bien para navegador. Aun asi, una llamada server-to-server puede insertar eventos anonimos.

Impacto: posible ruido, spam o coste operativo por error_events si alguien lo descubre.

Recomendacion:

- Permitir anonimo solo para eventos whitelisted de baja severidad.
- Rechazar severidad `error`/`critical` si no hay usuario autenticado.
- Anadir rate limiting por IP/fingerprint.
- Anadir un captcha invisible o challenge ligero si el abuso aparece en beta.

### P2 - Buckets privados creados sin politicas explicitas de Storage

Las migraciones crean buckets privados `licitia-documents` y `licitia-backups`, pero no se detectan politicas explicitas sobre `storage.objects`.

Impacto: ahora el producto genera ZIP/base64 inline y document library registra metadatos, por lo que no parece romper el flujo actual. Pero cuando se suban binarios reales a Supabase Storage, faltara una politica clara para lectura/escritura por organizacion.

Recomendacion:

- Definir convencion de paths: `organization_id/...`.
- Crear politicas `storage.objects` para buckets privados:
  - select si el usuario pertenece a la organizacion del path,
  - insert/update/delete solo owner/admin/bid_manager segun caso.
- Evitar URLs publicas permanentes para documentos privados.

### P2 - Backup/restauracion aun no es restore productivo completo

`ops-admin` exporta un ZIP organizativo y deja trazabilidad. El runbook indica que la restauracion productiva es manual y debe probarse en staging.

Impacto: continuidad razonable para beta, insuficiente para SLA real.

Recomendacion:

- Crear entorno staging.
- Ejecutar restore test real con un tenant de prueba.
- Documentar RTO/RPO beta.
- Automatizar validacion post-restore.

### P2 - Falta lockfile/npm audit no aplicable

`npm audit` no se puede ejecutar porque no existe lockfile. Actualmente no hay dependencias npm de runtime, por lo que el riesgo es bajo, pero en cuanto entren dependencias sera necesario.

Recomendacion:

- Mantener cero dependencias si es posible.
- Si se anaden, crear lockfile y activar audit/Dependabot.

### P2 - Landing todavia usa assets externos y texto de "demo"

La landing carga Google Fonts e imagenes de Unsplash. Tambien queda copy de "demo operativa", "demo privada" y "entorno demo".

Impacto: para beta no bloquea; para producto premium puede parecer menos productivo y depender de terceros para imagenes.

Recomendacion:

- Sustituir "demo" por "beta privada" o "entorno de validacion".
- Self-host de fuentes o fallback corporativo.
- Sustituir Unsplash por assets propios/product screenshots cuando haya capturas reales.

### P3 - CI/CD correcto pero no endurecido al maximo

GitHub Actions usa actions por tag (`@v4`) y Node 24. Correcto para velocidad, pero no es hardening completo.

Recomendacion:

- Pin de actions por SHA si se quiere supply-chain hardening.
- Anadir job de headers/security cuando se migre de GitHub Pages.
- Anadir smoke test post-deploy contra `/`, `/acceso.html`, `/app.html`, `/health`.

## Areas auditadas

### Alta, login y onboarding

Estado: apto para beta.

Evidencia:

- `src/index.html` tiene login, register, recovery y onboarding de 7 preguntas.
- Confirmacion por email esta configurada en Supabase templates.
- `authRedirectTo()` vuelve a `acceso.html`.
- `verifyTokenHash` usa `/auth/v1/verify`.
- No se detecta UI/API de pagos.

Riesgo residual:

- Probar manualmente un alta real de principio a fin despues de cada cambio en Supabase Auth templates.

### Web corporativa y acceso a herramienta

Estado: apto para beta.

Evidencia:

- `/` es la web corporativa.
- CTA lleva a `./acceso.html`.
- No enlaza al viejo `dashboard.html`.
- Footer mantiene "Fundadora: Ana Perez".

Riesgo residual:

- Copy de demo debe evolucionar a copy de beta/producto.

### Cockpit productivo

Estado: funcionalmente completo para beta.

Incluye:

- Hoy
- Oportunidades
- Expedientes
- Propuestas
- Inteligencia
- Operaciones
- Ajustes
- Menu de usuario

Riesgo residual:

- Necesita prueba manual autenticada en navegador con usuario real por cada vista.

### Busqueda, seguimiento y datos oficiales

Estado: apto para beta.

Evidencia:

- Jobs BOE/PLACSP han corrido en verde.
- `search-tenders` esta protegido por token.
- Ingestas registran runs y trazabilidad.

Riesgo residual:

- Las fuentes oficiales pueden cambiar XML/Atom.
- Falta monitorizacion externa de frescura diaria con alerta fuera de la propia app.

### IA, propuesta y dossier

Estado: apto para beta con expectativas claras.

Evidencia:

- IA se ejecuta server-side.
- Hay fallback determinista si no existe `OPENAI_API_KEY` o falla proveedor.
- Se registran `ai_runs`.
- DOCX/ZIP se generan como base64 y se auditan.

Riesgo residual:

- Para produccion comercial, revisar minimizacion de prompts y politica de retencion de outputs IA.

### Operaciones

Estado: buena base operativa beta.

Evidencia:

- Health endpoint OK.
- Panel de operaciones implementado.
- Backup inline.
- Release checks.
- Error capture.
- Workflow de jobs oficiales.

Riesgo residual:

- Falta restore test real.
- Falta monitor externo/alerta fuera de GitHub Actions/Supabase.

## Checklist de salida a produccion plena

Bloqueantes antes de vender a cliente real:

1. Hosting con cabeceras de seguridad y CSP.
2. Auditoria manual de accesibilidad y responsive.
3. Politica formal de retencion/borrado y subencargados.
4. Politicas de Supabase Storage antes de subir documentos privados reales.
5. Restore test en staging documentado.
6. Smoke test post-deploy automatizado.
7. End-to-end manual con usuario real:
   - alta,
   - confirmacion email,
   - login,
   - onboarding 7 preguntas,
   - busqueda,
   - seguimiento,
   - decision Go/No-Go,
   - propuesta,
   - dossier,
   - backup,
   - logout.

Deseables antes de abrir mas beta:

1. Sustituir assets externos o documentar terceros.
2. Cambiar copy de "demo" por "beta privada".
3. Rate limiting en observabilidad anonima.
4. Dependabot/audit si aparecen dependencias.
5. Pruebas de rendimiento sobre busqueda con volumen mayor.

## Conclusion final

El producto ha pasado de MVP a una beta productiva bastante seria: tiene alta real, onboarding corto, backend, base de datos, RLS, jobs oficiales, IA server-side, operaciones y despliegue publico. Lo que falta no es "hacer producto", sino cerrar hardening de produccion: seguridad web, accesibilidad manual, cumplimiento formal, storage privado y continuidad.

Mi recomendacion es lanzar beta privada con usuarios controlados y cerrar los P1 antes de presentar LicitIA como producto enterprise plenamente listo.
