# Sprint 3 - Entrevista completa de 21 preguntas

Fecha: 21/04/2026  
Producto operativo: `Futuro Anterior`  
Alcance: PB-C04, PB-C05 y PB-B04 del backlog `PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md`.

## Resultado

Sprint 3 convierte la primera prueba de voz en una entrevista completa:

1. El usuario empieza la entrevista tras pago simulado.
2. El sistema recorre 21 preguntas.
3. Cada respuesta queda guardada con indice y transcripcion.
4. Si una respuesta es demasiado corta, el sistema hace una repregunta sin aumentar el contador.
5. Al guardar la pregunta 21, la sesion pasa a `interview_completed`.

## Archivos principales

- `src/futuro.html`
- `src/scripts/future-book.js`
- `src/styles/future-book.css`
- `supabase/functions/future-book-session/index.ts`
- `scripts/test-future-book-sprint3.mjs`

## Preguntas

El set de 21 preguntas queda duplicado en frontend y backend para que:

- el modo local funcione sin backend;
- el backend productivo sea la fuente real cuando Supabase este configurado;
- Sprint 4 pueda reutilizar las respuestas para crear el manuscrito.

## Repregunta basica

Si una respuesta transcrita tiene menos de 12 palabras y no es una respuesta pendiente de transcripcion, el sistema devuelve:

```text
needsFollowUp=true
```

La UI reproduce una repregunta para el mismo indice. Esa repregunta no incrementa el total de 21 preguntas.

Evento registrado:

- `question_followup_requested`

## Eventos operativos

Eventos cubiertos hasta Sprint 3:

- `session_created`
- `privacy_consent_accepted`
- `payment_started`
- `payment_simulated_approved`
- `interview_started`
- `voice_prompt_requested`
- `voice_prompt_failed`
- `question_followup_requested`
- `question_answered`
- `interview_completed`

## Estados

Durante entrevista:

```text
status=interview_active
```

Al terminar pregunta 21:

```text
status=interview_completed
interview_completed_at=<timestamp>
```

## Definition of Done Sprint 3

- Hay 21 preguntas integradas.
- El contador muestra `q_xx / 21`.
- Cada respuesta avanza a la siguiente pregunta.
- Las respuestas superficiales disparan repregunta.
- La repregunta no aumenta el contador.
- La entrevista cierra en `interview_completed`.
- Tests Sprint 3 incluidos en `npm test`.

## Prueba manual recomendada

```bash
npm run build
python3 -m http.server 8765 --directory dist --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:8765/futuro.html
```

Flujo esperado:

- Aceptar condiciones.
- Pasar pago simulado.
- Abrir microfono.
- Responder las 21 preguntas.
- Probar una respuesta muy corta para ver la repregunta.
- Comprobar que al final aparece `interview_completed`.
