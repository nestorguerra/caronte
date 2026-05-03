# Sprint 2 - Voz, microfono y primer turno

Fecha: 21/04/2026  
Producto operativo: `Futuro Anterior`  
Alcance: PB-C01, PB-C02, PB-C03 y PB-B03 del backlog `PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md`.

## Resultado

Sprint 2 convierte el acceso en una primera entrevista de voz funcional.

Despues del pago simulado, el usuario puede:

1. Pulsar `Comenzar entrevista de voz`.
2. Escuchar la primera pregunta.
3. Grabar su respuesta con microfono.
4. Obtener transcripcion en navegador si esta disponible.
5. Guardar la respuesta asociada a la sesion.

Sprint 3 extendera esto a las 21 preguntas completas.

## Archivos principales

- `src/tiresias.html`
- `src/styles/future-book.css`
- `src/scripts/future-book.js`
- `supabase/functions/future-book-session/index.ts`
- `supabase/migrations/202604210002_future_book_sprint2_voice.sql`
- `scripts/test-future-book-sprint2.mjs`

## Voz del agente

La accion backend `synthesizeQuestion` intenta usar ElevenLabs si existen variables:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`

Si no existen o ElevenLabs falla, la accion queda marcada como error de voz. El frontend no cambia a la voz del navegador: Caronte debe sonar con la voz ElevenLabs configurada o no sonar.

## Microfono y transcripcion

El frontend usa:

- `navigator.mediaDevices.getUserMedia` para pedir microfono.
- `MediaRecorder` para capturar audio.
- `SpeechRecognition` / `webkitSpeechRecognition` si el navegador lo soporta.

Si el navegador no permite transcripcion, se guarda la respuesta como:

```text
[Audio capturado: X segundos. Transcripcion pendiente en backend.]
```

No hay campo de texto libre para responder: la entrada principal sigue siendo la voz.

## Backend Sprint 2

Nuevas acciones en `future-book-session`:

- `startInterview`
- `getCurrentQuestion`
- `synthesizeQuestion`
- `saveAnswer`

Nuevos eventos:

- `interview_started`
- `voice_prompt_requested`
- `voice_prompt_failed`
- `question_answered`

Nuevas tablas:

- `future_book_answers`
- `future_book_artifacts`

`future_book_artifacts` queda como metadata privada para prompts de voz, respuestas de audio, transcripciones, manuscritos y PDFs. El almacenamiento binario completo en bucket privado queda preparado para sprints posteriores.

## Estados

Al iniciar entrevista:

- `status=interview_active`
- `interview_started_at` queda registrado.

Al guardar respuesta:

- Se inserta fila en `future_book_answers`.
- Se registra metadata de audio en `future_book_artifacts`.
- Se emite evento `question_answered`.

## Definition of Done Sprint 2

- La primera pregunta puede sonar por voz.
- El microfono se solicita desde la experiencia.
- El usuario puede grabar y detener respuesta.
- La transcripcion se intenta automaticamente.
- La respuesta queda guardada en backend o modo local.
- No se introduce campo de texto libre para responder.
- Tests estaticos Sprint 2 incluidos en `npm test`.
- Build genera la experiencia completa en `dist/tiresias.html`.

## Prueba manual recomendada

```bash
npm run build
python3 -m http.server 8765 --directory dist --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:8765/tiresias.html
```

Flujo esperado:

- Aceptar condiciones.
- Continuar al pago.
- Esperar aprobacion simulada.
- Pulsar `Comenzar entrevista de voz`.
- Escuchar la pregunta.
- Pulsar `Grabar respuesta`.
- Hablar.
- Pulsar `Detener grabacion`.
- Pulsar `Guardar respuesta`.
