# Sprint 0 - Futuro Anterior

Fecha: 21/04/2026  
Producto operativo: `Futuro Anterior`  
Alcance: PB-A01, PB-B01 y PB-H01 del backlog `PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md`.

## Decision de producto

`Futuro Anterior` queda como nombre clave y nombre operativo del MVP. No es todavia la marca definitiva; sirve para construir sin dejar bloqueado el repositorio por naming.

Promesa base:

> Un libro escrito desde una version plausible de tu futuro. No predice lo que va a ocurrir: te prepara para elegir mejor.

Reglas de tono:

- Oscuro, sobrio, privado y literario.
- Nada de lenguaje SaaS visible en la experiencia de usuario.
- Nada de promesas de prediccion literal.
- La IA se presenta como motor narrativo y de proyeccion, no como oraculo.
- El producto debe sentirse como una entrevista privada que termina en una pieza editorial.

## Base tecnica elegida

Se mantiene el stack productivo actual del repositorio:

- Supabase Postgres para persistencia.
- Supabase Edge Functions para operaciones server-side.
- Storage privado en sprints posteriores.
- Secretos solo en entorno/secret manager.
- Frontend fijo en sprints posteriores.

La decision es importante: no se crea otro backend paralelo. El modulo vive dentro de este producto y se despliega con el mismo pipeline.

## Modelo Sprint 0

Migracion:

- `supabase/migrations/202604210001_future_book_sprint0.sql`

Tablas:

- `future_book_sessions`
- `future_book_events`

Estados principales de sesion:

- `created`
- `payment_pending`
- `payment_simulated_approved`
- `awaiting_consent`
- `interview_ready`
- `interview_active`
- `interview_completed`
- `book_generating`
- `book_ready`
- `pdf_generating`
- `pending_review`
- `approved`
- `released_to_customer`
- `blocked`
- `failed`

La tabla usa RLS activado sin politicas publicas. El acceso publico no va directo a Postgres; se hace mediante Edge Functions.

## Funcion Sprint 0

Funcion:

- `supabase/functions/future-book-session/index.ts`

Acciones:

- `createSession`: crea una sesion nueva y registra evento `session_created`.
- `getSession`: consulta estado usando `sessionId` + `publicToken`.

Ejemplo local/staging:

```bash
curl -X POST "$FUNCTIONS_BASE_URL/future-book-session" \
  -H "Content-Type: application/json" \
  -d '{"action":"createSession","source":"fixed_url","locale":"es-ES","timezone":"Europe/Madrid"}'
```

Respuesta esperada:

```json
{
  "ok": true,
  "product": {
    "codeName": "Futuro Anterior",
    "promise": "Futuros plausibles, no predicciones."
  },
  "session": {
    "status": "created",
    "paymentStatus": "not_started",
    "questionCount": 21
  }
}
```

## Entornos

Variables nuevas:

- `FUTURE_BOOK_PRODUCT_CODE=futuro_anterior`
- `FUTURE_BOOK_PRICE_CENTS=4995`
- `FUTURE_BOOK_CURRENCY=EUR`
- `FUTURE_BOOK_DEFAULT_QUESTION_COUNT=21`

Variables ya existentes que siguen aplicando:

- `APP_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

## Definition of Done Sprint 0

- Nombre operativo definido.
- Tono y promesa documentados.
- Migracion con modelo de sesion creada.
- Edge Function capaz de crear una sesion.
- Evento `session_created` persistido.
- Entornos local/staging/production preparados por variables.
- Test estatico Sprint 0 incluido en `npm test`.
