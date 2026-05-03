# Sprint 9 - Caronte literario v1

Fecha: 22/04/2026  
Producto: Futuro Anterior / Caronte  
Estado: implementado

## Objetivo

Convertir el motor de libro en un flujo literario serio: primero entiende la entrevista, despues construye una arquitectura narrativa, luego escribe el manuscrito y finalmente lo evalua antes de permitir que avance a PDF.

## PB cubierto

- PB-C01 - Prompt maestro Caronte v1.
- PB-C02 - Generacion por fases.
- PB-C03 - Mapa psicologico persistente.
- PB-C04 - Sintesis de patrones.
- PB-C07 - Reescritura automatica por bajo score.
- PB-C08 - Evaluador de genericidad.
- PB-C09 - Evaluador de promesas prohibidas.
- PB-C10 - Versionado de prompts y outputs.

## Flujo nuevo

1. `buildPsychologicalMap`
   - Genera un mapa psicologico-literario desde las 21 respuestas.
   - Usa OpenAI si esta configurado.
   - Si falla en local, crea mapa determinista marcado como degradado.

2. `buildNarrativeOutline`
   - Convierte el mapa en arquitectura editorial.
   - Define el arco central y el rol de cada capitulo.

3. `buildAiManuscript`
   - Usa el prompt maestro `caronte-literary-v1`.
   - Recibe entrevista, mapa y arquitectura.
   - Prohibe predicciones, diagnosticos, terapia y consejo profesional directo.

4. `evaluateCaronteManuscript`
   - Calcula personalizacion, genericidad, estructura y seguridad.
   - Detecta frases genericas y promesas prohibidas.

5. Reescritura automatica
   - Si el manuscrito es demasiado generico o inseguro, se pide una reescritura.
   - Solo se aplica si mejora el score compuesto.

6. Revision Anthropic
   - Claude recibe manuscrito, mapa y evaluacion Caronte.
   - Devuelve riesgos, fixes y notas de personalizacion/seguridad.

## Persistencia

Migracion: `supabase/migrations/202604220004_future_book_sprint9_caronte_maps.sql`

Nueva tabla:

```text
future_book_psych_maps
```

Campos clave:

- `session_id`
- `version`
- `status`
- `prompt_version`
- `map_payload`
- `outline_payload`
- `quality_report`
- `provider_chain`

Tambien se anade:

```text
future_book_manuscripts.psych_map_id
```

## Versionado

Versiones activas:

- `caronte-literary-v1`
- `caronte-map-v1`
- `caronte-outline-v1`
- `caronte-rewrite-v1`

El back office lista los mapas Caronte con sesion, version, prompt, estado y fecha.

## Gates de calidad

El `quality_report` del manuscrito incluye:

- `caronte_evaluation.personalization_score`
- `caronte_evaluation.genericity_score`
- `caronte_evaluation.safety_score`
- `caronte_evaluation.structure_score`
- `caronte_evaluation.prohibited_promise_violations`
- `caronte_evaluation.rewrite`

Estados relevantes:

- `ready_for_human_review`
- `needs_editorial_expansion`
- `needs_caronte_rewrite`
- `blocked_safety`
- `degraded_provider_fallback`

Si el manuscrito queda degradado, generico o bloqueado, el PDF puede generarse para revision, pero `ready_for_print=false`.

## Configuracion

Variable nueva:

```text
FUTURE_BOOK_MAP_MODEL=gpt-5.4-pro
```

## Definition of Done

- El manuscrito tiene mapa previo, estructura y capitulos.
- Hay score de personalizacion y score de seguridad.
- Si el libro es generico, se intenta regenerar automaticamente.
- Prompt y outputs quedan versionados.
- Back office muestra los mapas Caronte generados.
