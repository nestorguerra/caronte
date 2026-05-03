# Sprint 8 - Entrevista robusta y transcripcion backend

Fecha: 22/04/2026  
Producto: Futuro Anterior / Caronte  
Estado: implementado

## Objetivo

Reducir la dependencia de Web Speech API y dejar la entrevista preparada para produccion: si el navegador captura audio pero no consigue transcribir, el backend recibe el audio, lo transcribe con un proveedor STT y guarda una respuesta util para el motor literario.

## PB cubierto

- PB-B01 - Transcripcion backend real.
- PB-B02 - Subida privada de audio.
- PB-B03 - Reintento de subida.
- PB-B04 - Recuperacion de entrevista.
- PB-B05 - Deteccion de respuestas vacias/superficiales.
- PB-B06 - Motor adaptativo de repreguntas.
- PB-B07 - Medicion de densidad narrativa.
- PB-B08 - Deteccion de abandono.
- PB-B09 - UX de permisos de microfono.

## Cliente

Archivo: `src/scripts/future-book.js`

- `MediaRecorder` elige un MIME compatible entre `audio/webm;codecs=opus`, `audio/webm` y `audio/mp4`.
- Al guardar respuesta se convierte el `Blob` de audio a base64 temporal.
- El payload enviado a `saveAnswer` incluye `audioBase64`, `audioByteLength`, `audioMimeType`, duracion y estado de transcript.
- Si la conexion falla, la respuesta queda en `localStorage` bajo `future_book_sprint8_pending_answers` y se reintenta al recuperar conexion o recargar sesion.
- La entrevista emite heartbeat periodico y eventos de ocultacion/descarga de pagina con `recordInterviewHeartbeat`.
- Si el backend devuelve transcript con `transcript_source=backend`, el cliente sustituye el buffer pendiente por el texto real.

## Backend

Archivo: `supabase/functions/future-book-session/index.ts`

- Nueva accion `recordInterviewHeartbeat`.
- `saveAnswer` normaliza audio, limita tamano, sube a Storage privado y transcribe si el transcript esta pendiente.
- El proveedor STT usa `FUTURE_BOOK_TRANSCRIPTION_API_KEY` o, si no existe, `OPENAI_API_KEY`.
- El modelo por defecto es `gpt-4o-mini-transcribe`.
- Se registran eventos:
  - `answer_transcription_started`
  - `answer_transcription_completed`
  - `answer_transcription_failed`
  - `answer_audio_rejected`
  - `interview_client_interrupted`
- No se guarda `audioBase64` en base de datos.
- `future_book_answers.metadata` incluye `audio_bytes`, `audio_storage_status`, `transcription_status`, `transcription_provider`, `density_score` y `density_band`.
- `future_book_artifacts` guarda el path privado del audio cuando aplica.

## Storage privado

Migracion: `supabase/migrations/202604220003_future_book_sprint8_audio_storage.sql`

- Crea/actualiza bucket privado `future-book-audio`.
- Limite de archivo: 25 MB.
- MIME permitidos: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg`.

Politica operativa:

- `FUTURE_BOOK_STORE_AUDIO=true`: guarda audio en storage privado.
- `FUTURE_BOOK_STORE_AUDIO=false`: descarta audio despues de transcribir y deja metadata `discarded_by_policy`.

## Configuracion

Variables nuevas:

```text
FUTURE_BOOK_TRANSCRIPTION_API_KEY=
FUTURE_BOOK_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
FUTURE_BOOK_STORE_AUDIO=true
FUTURE_BOOK_MAX_AUDIO_BYTES=25165824
```

## Definition of Done

- El audio queda guardado en bucket privado o descartado explicitamente por politica.
- La transcripcion ya no depende solo del navegador.
- Si la red falla al guardar una respuesta, queda cola local de reintento.
- Una recarga recupera la sesion backend y vuelve a la pregunta correcta.
- El sistema marca respuestas pobres por longitud o baja densidad narrativa.
- `npm test`, `npm run validate` y `npm run build` deben pasar antes de deploy.
