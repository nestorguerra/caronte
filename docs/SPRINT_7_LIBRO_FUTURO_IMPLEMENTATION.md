# Sprint 7 - Futuro Anterior

## Objetivo

Activar la base de IA real para Caronte y evitar que produccion trate un fallback determinista como si fuera un libro final de calidad.

Sprint 7 no introduce pago real ni Lulu. Cierra el primer bloqueo critico detectado en auditoria: el flujo generaba PDF, pero el manuscrito podia caer a `deterministic` si faltaban OpenAI/Anthropic.

## PB incluidos

- PB-A01: configurar `OPENAI_API_KEY` en Supabase.
- PB-A02: configurar `ANTHROPIC_API_KEY` en Supabase.
- PB-A03: validar modelos reales.
- PB-A04: provider health check real.
- PB-A05: bloqueo de generacion final si falta proveedor obligatorio.
- PB-C05: redaccion con GPT-5.4 y fallback marcado como degradado.
- PB-C06: revision con Claude.
- PB-H01: smoke test post-deploy end-to-end hasta PDF.

## Implementacion

### Backend

Archivo principal:

```text
supabase/functions/future-book-session/index.ts
```

Cambios:

- `strictAiProvidersRequired()` activa el modo estricto por defecto en `APP_ENV=production`.
- `providerSecret()` lee secretos desde variables de entorno o desde settings cifrados del back office.
- `missingRequiredProviders('book')` comprueba OpenAI y Anthropic antes de generar libro.
- `blockBookGenerationForMissingProviders()` bloquea la sesion si faltan proveedores obligatorios.
- `buildAiManuscript()` usa OpenAI real cuando hay clave disponible.
- `reviewWithAnthropic()` usa Anthropic real cuando hay clave disponible.
- `provider_chain.degraded=true` marca fallback o revision ausente/fallida.
- `quality_report.status=degraded_provider_fallback` impide confundir un fallback con salida final.
- `generatePdf()` marca `ready_for_print=false` si el manuscrito esta degradado.

### Shared IA

Archivo:

```text
supabase/functions/_shared/ai.ts
```

`callOpenAiJson()` acepta ahora `apiKey` explicita, para poder usar claves guardadas de forma segura desde back office o variables de entorno.

### Back office

Archivo:

```text
src/scripts/future-admin.js
```

El panel de providers muestra `probe=...` para distinguir:

- configurado pero no probado;
- prueba OK;
- prueba fallida;
- placeholder.

### Health checks reales

`adminTestProvider` ahora hace llamada real cuando corresponde:

- OpenAI: `GET /v1/models`.
- Anthropic: `POST /v1/messages` con payload minimo.
- ElevenLabs: `GET /v1/voices`.
- Lulu: placeholder sin llamada live.

El resultado se guarda en `future_book_provider_settings.metadata.last_test_status`.

## Variables necesarias

En Supabase Functions:

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
FUTURE_BOOK_OPENAI_MODEL=gpt-5.4-pro
ANTHROPIC_MODEL=claude-opus-4-7
FUTURE_BOOK_REQUIRE_AI_PROVIDERS=true
```

`FUTURE_BOOK_REQUIRE_AI_PROVIDERS` es opcional. En `APP_ENV=production` el modo estricto se activa por defecto.

## Comportamiento esperado

### Si OpenAI o Anthropic faltan en produccion

- `generateBook` falla.
- La sesion queda `blocked`.
- `book_status=failed`.
- `error_code=required_ai_provider_missing`.
- Se registra evento `book_generation_blocked`.
- El monitor abre alerta P0 `future_book_required_provider_missing`.

### Si la IA falla pero se permite fallback fuera de produccion

- Se genera manuscrito degradado.
- `provider_chain.degraded=true`.
- `quality_report.status=degraded_provider_fallback`.
- El PDF puede generarse para pruebas, pero `ready_for_print=false`.

### Si OpenAI, Anthropic y ElevenLabs estan configurados

- La voz usa ElevenLabs.
- El manuscrito usa OpenAI.
- La revision usa Anthropic.
- El PDF puede marcar `ready_for_print=true` si no hay degradacion.

## Definition of Done

- Back office distingue proveedor configurado de proveedor probado.
- Produccion no genera libro final si faltan OpenAI o Anthropic.
- Fallback determinista queda marcado como degradado.
- PDF de manuscrito degradado no queda `ready_for_print`.
- Hay test estatico Sprint 7 en `npm test`.
- Smoke productivo debe pasar despues de configurar claves reales.

