# book-engine

## Revisión solicitada el 12 de octubre de 2026: novela del yo +30

Estado: aprobada expresamente por Néstor el 12 de octubre de 2026, incluida la
tolerancia 216–224 páginas y la orden de implementar y publicar. Esta sección sustituye el
objetivo anterior de cuarenta años y 180–200 páginas cuando se implemente.
El código alojado todavía usa ese contrato anterior. No se declara una novela
completa, ni 220 páginas generadas, ni una validación de Lulu concluida.

### Objetivo y supuestos visibles

El lector debe reconocerse en una novela autobiográfica que su propio yo escribe
treinta años después de la entrevista. Una vida posible, no una predicción, un
informe de personalidad, una carta de consejos ni cinco ensayos de autoayuda.
La transformación del individuo, sus relaciones y su mundo debe resultar vivida.
El impacto emocional es una finalidad editorial; ninguna puntuación automática
garantiza la respuesta de una persona.

Se mantienen cinco capítulos amplios, con títulos y estructura temporal propios
de cada vida. Se interpreta «unas 220 páginas» como un objetivo de 220 páginas
físicas de interior A5, con tolerancia editorial propuesta de 216–224, siempre
pares. La cubierta es un PDF independiente y no cuenta como página del interior.
La extensión inicial de trabajo será aproximadamente 55.000–65.000 palabras;
se ajustará después de medir la composición real. Ni contar palabras ni poner
220 en los metadatos demuestra haber producido 220 páginas.

La libertad de construcción permite cronología no lineal, capítulos desiguales
y escenas de distintas duraciones. No permite alterar hechos biográficos,
cambiar modelos, simular entrega, modificar la página o autorizar pedidos/pagos.

### Contrato narrativo

- Narrador: la misma persona, en primera persona, con edad actual confirmada +30
  y año narrativo de la entrevista +30. Su voz ha madurado sin convertirse en
  omnisciente. El yo presente puede ser destinatario del marco narrativo, pero
  la prosa principal es una novela: acontecimientos, escenas, diálogos y tiempo.
- Reconocimiento: detalles de atención, lenguaje, vínculos, hábitos, lugares y
  contradicciones proceden de la entrevista íntegra. Se distribuyen por el libro,
  sin repetir una confesión ni citar respuestas para fingir personalización.
- Causalidad: cada cambio decisivo tiene una raíz, una elección o acontecimiento,
  consecuencias y costes. Las decisiones no siempre llevan al éxito. Los deseos
  no se cumplen todos, ni los temores se convierten automáticamente en castigos.
- Mundo: los cambios externos afectan actos concretos, trabajo, cuidado, intimidad,
  memoria, cuerpo o pertenencia. No son un catálogo de tecnologías ni una previsión
  presentada como cierta. El mundo tiene diferencias, límites y fricciones.
- Emoción: nace de precisión, ambivalencia, afecto, renuncia y reconocimiento.
  No fabricar traumas pasados, enfermedades, delitos o tragedias familiares para
  provocar impacto. No convertir a personas reales en accesorios del protagonista.
- Forma: cinco movimientos dramáticos conectados. Cada capítulo altera lo que
  creíamos entender en el anterior. La apertura sitúa al lector en una escena
  futura; el cierre transforma una imagen o pregunta inicial, sin moraleja,
  lista de tareas, final obligatorio de éxito ni promesa de salvación.

Los cinco movimientos no tendrán títulos ni acontecimientos prefabricados.
Una arquitectura posible es reconocimiento → desplazamiento → consecuencia →
relectura de la identidad → regreso transformado. Es una orientación dramática,
no una plantilla que el escritor deba rellenar para todas las personas.

### Escritura, revisión y rechazo

GPT-6.1 Sol (`gpt-6.1-sol`, esfuerzo `xhigh`) realiza biografía, mundo, arquitectura,
escritura y reescritura. Claude Opus 5.5 (`claude-opus-5-5`) revisa. No hay sustitución
silenciosa por otro modelo ni texto determinista cuando falla un proveedor.

Antes de escribir se conserva un registro de hechos con referencias de fuente y
un registro separado de invenciones futuras. La trayectoria, edades, relaciones,
motivos, fechas y compromisos de escenas forman una continuidad consultable.
Las unidades internas sirven al trabajo reanudable; no aparecen como treinta
minicapítulos ni fuerzan una moraleja o recapitulación por fragmento. Se mantiene
inicialmente la división técnica en seis unidades por capítulo, con presupuestos
de palabras coherentes con el objetivo global, sin confundirla con la forma visible.

El revisor recibe el texto completo de cada unidad y, al final, el manuscrito
completo ordenado con sus fuentes. Debe fundamentar su juicio en pasajes y localizar
defectos; una puntuación sin lectura íntegra no acredita calidad. Dimensiones:
fidelidad biográfica, voz, profundidad, mundo vivido, continuidad, originalidad,
reconocimiento personal y plausibilidad causal. Un aprobado exige al menos 4/5
en cada dimensión y ningún defecto importante o crítico pendiente. Esta es una
barrera editorial, no una medida objetiva del impacto en el lector.

Prueba de intercambiabilidad: si cambiando el nombre y dos datos la novela podría
servir a otra persona, debe rechazarse. También se rechazan exposición prospectiva
sin escenas, sabiduría uniforme de los personajes, repetición de descubrimientos,
conflictos sin consecuencia, triunfos por inercia y falsa biografía. Los defectos
localizados producen reescritura y nueva revisión. Cambiar una unidad invalida las
aprobaciones ligadas a su hash y exige revisar la continuidad afectada y el conjunto.
Los reintentos tienen límites; agotarlos bloquea la entrega, no fabrica un aprobado.

El primer piloto requiere lectura humana íntegra. Primero se examinan apertura y
una escena contrastante con modelos reales para detectar pronto voz genérica o
premisa débil. Esas muestras no se anuncian como libro terminado. El piloto completo
solo se libera después de lectura del conjunto, revisión y comprobación del PDF.

### Arquitectura y compatibilidad

Stack existente: Supabase/PostgreSQL, TypeScript/JavaScript y las dependencias PDF
ya autorizadas (`pdf-lib` y adaptador de fuentes). Sin dependencias nuevas.

Una nueva versión de contrato debe congelarse por trabajo junto con los modelos,
horizonte, presupuestos de palabras y páginas. No basta cambiar constantes globales:
los trabajos anteriores deben conservar su versión o quedar bloqueados de forma
explícita si esa versión no puede ejecutarse. Nunca reinterpretar una entrevista
o un manuscrito viejo de +40 como +30, ni reutilizar su aprobación editorial.

El nuevo contrato debe llegar a normalización, prompts, validadores, cola, ensamblado,
plan de páginas, trabajador por etapas, controles del PDF y preflight. Lulu calcula
la cubierta y el lomo con el recuento físico final, no con el objetivo de 220.
Los PDF técnicos históricos de 194 páginas conservan identidad y aprobación
exclusivamente técnica. No acreditan el nuevo producto ni se modifican para
representarlo. Los recibos inciertos no se borran ni se reenvían automáticamente.

La página `src/tiresias.html` y su CSS deben permanecer idénticos al original
publicado. Ningún botón, muestra, texto de demo ni campo público nuevo. El flujo
existente muestra progreso real; un error no se presenta como libro listo.
La falta de edad o material suficiente impide escribir y debe resolverse por el
mecanismo existente de entrevista/confirmación, sin adivinar ni añadir controles.

### Código, estilo y comandos

Contratos y prompts: `supabase/functions/_shared/caronte-literary.mjs`.
Cola y modelos: `caronte-jobs.mjs`, `caronte-engine.mjs`, `caronte-models.mjs`.
Imprenta: `caronte-print*.mjs`; integración: `future-book-session/index.ts`.
Pruebas: `scripts/test-caronte-*.mjs`; documentación: este archivo y `docs/`.
Dos espacios y errores explícitos, por ejemplo:
`if (futureAge !== currentAge + contract.horizonYears) fail('future_age_mismatch');`.

Con Node >=24 disponible:
`node scripts/test-caronte-literary.mjs`, `node scripts/test-caronte-engine.mjs`,
`node scripts/test-caronte-print.mjs`, `node scripts/test-caronte-print-preflight.mjs`,
`npm test`, `npm run validate`, `npm run build`.
Si el runtime disponible carece de npm, ejecutar exactamente los comandos de esos
scripts mediante Node, sin instalar herramientas ni omitir controles por comodidad.

### Pruebas, límites y aceptación

Siempre: conservar datos, versiones, fuentes completas y recibos; probar primero
el rechazo de +40 para trabajos nuevos, edades/fechas incoherentes, prosa corta,
reseñas incompletas, edición posterior a aprobación y falsas páginas verificadas.
Probar también compatibilidad de trabajos anteriores, identidad de archivos,
reanudación y consulta del mismo identificador del proveedor tras interrupción.

Pedir nueva decisión: dependencias no acordadas, cambios de seguridad o esquema
no cubiertos, gasto material adicional, datos personales de un piloto nuevo,
dirección de entrega, presupuesto, pedido, pago o repetición de un envío incierto.
Nunca: claves en GitHub, autoaprobación humana, textos sintéticos como novela real,
relleno de páginas, tipografía incómoda para alcanzar longitud, cambios de la página,
pedidos o pagos sin su autorización específica.

Aceptación final: novela completa auténtica de cinco capítulos, voz +30 coherente,
fuentes rastreables, revisiones completas vinculadas a la versión y lectura humana;
interior físicamente comprobado de unas 220 páginas legibles, sin cortes ni pérdida
de texto, fuentes incrustadas y cubierta independiente; ambos archivos normalizados
por Lulu y progreso reanudable sin depender del navegador. La web se relee en su
URL de GitHub y conserva HTML/CSS originales. Un test local, una llamada de modelo,
un PDF sintético o un trabajador en estado idle no cierran el piloto.

Ratificación recibida: treinta años, cinco capítulos, 216–224 páginas, Sol, Opus y
Lulu; página intacta y sin demo. Los pedidos y pagos requieren autorización aparte.

## Contrato anterior: histórico de la implementación +40

## Objetivo y aceptación

Producir un manuscrito completo, no una sinopsis extendida: voz en primera persona
del entrevistado exactamente cuarenta años después, dirigido a su yo presente.
Cinco capítulos como movimientos dramáticos diferentes. Objetivo inicial de
45.000–55.000 palabras, ajustado después por maquetación a 180–200 páginas reales.
La cuenta de palabras no constituye una validación del número de páginas.

La biografía presente/pasada procede de respuestas íntegras y referencias de fuente.
El futuro es ficción explícitamente delimitada: relaciones, pérdidas, hallazgos,
decisiones costosas y un mundo transformado vivido en escenas. No fabricar traumas
pasados, sustituir la voz por terapia, usar clichés de autoayuda o repetir moralejas.
La edad debe estar declarada en la entrevista o confirmada: nunca adivinarla.

## Arquitectura y contrato

PostgreSQL/Supabase existente; módulos TypeScript/JavaScript sin nuevas dependencias.
`future_book_jobs` congela la entrevista; `future_book_job_steps` conserva cada
resultado y revisión. Cada paso tiene intento, lease con token y máximo de reintentos.
Un worker reclama un único paso de forma atómica y persiste el resultado antes de
avanzar. Reanudar no vuelve a ejecutar trabajo aprobado ni mezcla entrevistas.

Etapas: registro biográfico → mundo/vida futura → plan de cinco capítulos → unidades
de escritura → revisión completa de cada unidad → revisión longitudinal → manuscrito.
Las revisiones reciben el texto íntegro relevante y evidencias, no dos párrafos.
Reescribir recibe el borrador real y defectos localizados. Un fallo del modelo o
un rechazo editorial nunca entrega un libro listo. Los artefactos finales se
asocian a versión/hash y conservan modelos, prompts, uso y trazabilidad.

`generateBook` devuelve rápidamente `{ok, session, job, manuscript:null}`.
`getBookStatus` devuelve estado/progreso real y el manuscrito solo cuando exista.
No habrá botón demo. La vista actual muestra progreso y permite reanudar.
Autenticación pública sigue usando sesión+token; el worker exige autorización
de servicio. El worker debe poder avanzar con el navegador cerrado.

## Código y comandos

Código: `supabase/functions/_shared/caronte-*`; integración en `future-book-session`.
Migraciones aditivas en `supabase/migrations`; pruebas en `scripts/test-caronte-*`.
Estilo: dos espacios, funciones pequeñas; `if (!job) throw new Error('job_not_found')`.
Comandos con Node >=24: `node scripts/test-caronte-literary.mjs`,
`node scripts/test-caronte-jobs.mjs`, `npm test`, `npm run validate`, `npm run build`.
En este Mac puede anteponerse el directorio Node del runtime de Codex al PATH.

## Verificación y límites

Pruebas de comportamiento: edad+40, cinco capítulos, conservación >1.800 caracteres,
inyección en transcripciones tratada como datos, fallo editorial, límites de longitud,
lease y reintento idempotente. Prueba real de proveedor y trabajo interrumpido/reanudado.
Nunca llamar completa la producción por pasar tests de cadenas de texto.
Siempre preservar sesiones/datos existentes. Cambios de esquema son aditivos.
No introducir dependencias, borrar datos, exponer secretos o aceptar gastos sin
necesidad/autoridad específica. La liberación editorial del primer piloto requiere
lectura del resultado completo, no únicamente una puntuación automática.

## Contrato de salida del escritor

El adaptador conserva el modelo configurado. GPT-5.4 Pro y su snapshot
`gpt-5.4-pro-2026-03-05` reciben el esquema JSON completo en instrucciones de sistema,
porque no admiten Structured Outputs. El resto conserva el contrato `json_schema`.
Referencia: https://developers.openai.com/api/docs/models/gpt-5.4-pro.
No se infiere la compatibilidad de otros modelos a partir de su nombre.

Ambas rutas conservan la entrevista íntegra y el identificador recuperable de la
respuesta. Todo resultado se analiza como JSON y pasa la validación estructural y
literaria local antes de completar un paso. Un formato inválido conserva su recibo
y bloquea el trabajo; no dispara otra petición de pago ni entrega prosa inventada.
La prueba local usa respuestas sintéticas y no acredita calidad o disponibilidad
real del proveedor. Es necesaria una generación auténtica para validar el piloto.
