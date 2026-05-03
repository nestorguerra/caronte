# Sprint 4 - Futuro Anterior

## Objetivo

Convertir la entrevista completa de 21 preguntas en un manuscrito privado, estructurado y revisable antes de entrar en la fase de PDF/Lulu.

## PB incluidos

- PB-D01: estructura editorial del libro.
- PB-D02: prompt maestro de redaccion.
- PB-D03: pipeline multi-modelo GPT-5.4 Pro / Claude 4.7 configurable por variables.
- PB-D04: control de calidad editorial y seguridad narrativa.
- PB-D05: manuscrito orientado a 35-60 paginas, pendiente de maquetacion PDF.

## Implementacion

### Backend

- `supabase/functions/future-book-session/index.ts`
  - Nueva accion `generateBook`.
  - Nueva accion `getBookStatus`.
  - Generador determinista de manuscrito si no hay claves IA.
  - Redaccion opcional con OpenAI mediante `callOpenAiJson`.
  - Revision opcional con Anthropic Messages API mediante `ANTHROPIC_API_KEY`.
  - Eventos:
    - `book_generation_started`
    - `book_quality_reviewed`
    - `book_generation_completed`
  - Estado de sesion:
    - `book_generating`
    - `book_ready`

### Base de datos

- `supabase/migrations/202604210003_future_book_sprint4_manuscript.sql`
  - Nueva tabla `future_book_manuscripts`.
  - Campos:
    - `manuscript jsonb`
    - `quality_report jsonb`
    - `provider_chain jsonb`
    - `prompt_version`
    - `quality_score`
    - objetivo de paginas `35-60`
  - RLS activado. El acceso publico sigue pasando por Edge Function.

### Frontend

- `src/tiresias.html`
  - Boton `generar_libro`.
  - Pantalla `manuscript_ready`.
  - Listado de secciones del manuscrito.

- `src/scripts/future-book.js`
  - Funcion `generateBook`.
  - Fallback local `generateLocalManuscript`.
  - Persistencia local `future_book_sprint4_manuscript`.
  - Recuperacion de manuscrito con `getBookStatus`.

- `src/styles/future-book.css`
  - Estilos primitivos para la pantalla de manuscrito.
  - Lista de secciones tipo archivo interno.

## Estructura editorial generada

1. Portada.
2. Hoja suelta de instrucciones.
3. Nota del yo futuro.
4. Prologo.
5. Capitulo 1: lo que funcionaba no bastaba.
6. Capitulo 2: deseo y miedo.
7. Capitulo 3: relaciones.
8. Capitulo 4: trabajo y ambicion.
9. Capitulo 5: dinero, estatus y libertad.
10. Capitulo 6: historia personal y habito.
11. Capitulo 7: amor y peticion final.
12. Carta final.
13. Epilogo practico.
14. Aviso IA y limites.

## Criterios de calidad

El `quality_report` valida:

- Que no se prometa prediccion factual.
- Que no haya consejo clinico, legal, financiero o psicologico sustitutivo.
- Nivel minimo de personalizacion segun respuestas y palabras.
- Estructura editorial suficiente.
- Preparacion para la siguiente fase PDF.

## Variables nuevas

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
FUTURE_BOOK_OPENAI_MODEL=gpt-5.4-pro
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-7
```

Si no existen, el producto sigue funcionando con generacion determinista.

## Estado final

Sprint 4 deja el producto listo para que, despues de la entrevista, el usuario pulse `generar_libro` y vea un manuscrito estructurado. Todavia no genera PDF final ni envia a Lulu.
