# Caronte: verificación del servidor, 12 de octubre de 2026

Este corte amplía, sin sustituir, las pruebas locales anteriores.

## Ejecutado y releído

- Función `future-book-session`, proyecto `jbisqvqdouvufhzzotde`: versión 10,
  ACTIVE. Los veinte archivos conservados por el
  empaquetador remoto coinciden con el artefacto enviado. Las dos dependencias
  ajenas al grafo activo se eliminan durante el empaquetado.
- El paquete de texto incorpora los tres binarios originales de Crimson Text
  y su licencia OFL. El empaquetador y el lector verifican sus SHA-256. No se
  cargan fuentes desde un servicio externo. El despliegue convencional conserva
  sus archivos estáticos; `package-caronte-edge.mjs` reproduce el artefacto para
  la API oficial de despliegue que solo admite archivos de texto.
- Se preservó la versión 8 para recuperación antes del despliegue. No se han
  cambiado Auth, permisos globales ni otras funciones del proyecto compartido.
- OpenAI: clave privada guardada fuera del control de versiones y cifrada en
  Caronte; lectura autenticada de modelos y generación mínima real completadas.
  Esta generación breve no verifica un libro de 45–55 mil palabras.
- ElevenLabs: consulta real de la voz Javier — Mature and Commanding correcta.
  Una consulta de configuración no acredita todavía la reproducción completa
  de una entrevista desde GitHub.
- Lulu: par nuevo, autorizado por el propietario, guardado cifrado y confirmado
  en la base de datos; `adminTestProvider` devuelve HTTP 200, `liveProbeOk:true`,
  `persistenceVerified:true`, entorno production, comprobación real OAuth.
  No se ha creado, pagado ni enviado ningún pedido.
- La comparación de `tested_at` acepta el mismo instante expresado con `Z` o
  `+00:00`. Una diferencia de un milisegundo o una confirmación ausente siguen
  rechazándose. El fallo remoto se reprodujo antes de corregirlo.
- Cola de imprenta: migración remota `20261012090838`,
  `caronte_durable_print_jobs`, correspondiente al SQL preparado
  `202610120001_caronte_durable_print_jobs.sql`.
- Aserciones SQL del libro y de impresión ejecutadas en el servidor real dentro
  de transacciones revertidas: exclusión de leases, reservas estables,
  checkpoints inmutables, recuperación, prevención de envíos inciertos, CAS,
  aislamiento de versiones y borrado en cascada. Ninguna sesión sintética
  de esas pruebas permanece. Las tablas nuevas tienen RLS y no permiten
  acceso directo de anon/authenticated; sus RPC son de servicio.
- La función acepta el origen HTTPS de GitHub y rechaza un token administrativo
  incorrecto. Los avisos previos del asesor del proyecto compartido permanecen;
  no se presenta el proyecto entero como libre de avisos.
- 422 pruebas de comportamiento, 17 comprobaciones heredadas, validación y
  compilación correctas; cero pruebas omitidas. Auditoría de las dependencias
  PDF de producción: cero vulnerabilidades notificadas.
- `src/tiresias.html` y `src/styles/future-book.css` siguen idénticos al commit
  original `48157ae`. No se han añadido controles ni modo de demostración.

## Pendiente en este corte

- Publicación y relectura de los nuevos archivos funcionales en GitHub Pages.
- Clave y comprobación real del revisor Anthropic.
- Validación del trabajo PDF completo bajo los límites reales del servidor,
  persistencia de sus binarios privados y normalización de ambos archivos por
  Lulu. Fuentes incluidas y OAuth correcto no acreditan esas etapas.
- La cola de PDF y los disparadores independientes siguen desactivados mientras
  se comprueba el runtime. El envío de pedidos Lulu sigue desactivado.
- El piloto completo y la entrega física no se han verificado.

Las credenciales no se incluyen en este documento ni en GitHub.

## Corte posterior: publicación y PDF alojado

- GitHub Pages publicó el commit `f4d47a88e0022d1de5c92632db5b93445d6da786`.
  Su ejecución `38232081660` terminó con éxito. GET público de la página,
  CSS y módulos funcionales: HTTP 200 y bytes iguales al artefacto previsto.
  HTML y CSS conservan los bytes del original; no se añadió ningún control
  ni modo de demostración. Navegador público: cero errores/avisos observados.
- ElevenLabs generó audio real a través de `synthesizeQuestion`: MP3 de 44.347
  bytes con `eleven_multilingual_v2` y una introducción expresiva de 90.741
  bytes con `eleven_v3`. No se usó fallback del navegador. Esto acredita la
  síntesis, no una entrevista completa ni una escucha física en el equipo.
- Lulu OAuth de producción y persistencia de la comprobación confirmados.
  La cubierta usa su respuesta real de dimensiones para el SKU A5,
  194 páginas: 893 × 613 puntos, con lomo de 35,48 puntos.
- La primera etapa binaria descubrió el formato alojado de Storage: un objeto
  ausente puede devolver HTTP 400 con `statusCode:404`. El cliente solo
  aceptaba HTTP 404 y se detenía antes del POST. Cinco regresiones fallaron
  antes de la corrección; después pasaron junto a los casos negativos.
  La corrección inspecciona como máximo 4 KiB bajo el plazo existente y exige
  el código y mensaje exactos de objeto ausente. JWT, permisos, bucket ausente,
  JSON ambiguo, cuerpos excesivos, corrupción y tiempos agotados siguen
  bloqueando la escritura. Nunca se permite sobrescribir el objeto reservado.
- La versión 12 desplegada con esta corrección se releyó: los veinte archivos
  conservados coinciden con el paquete enviado. El trabajo técnico privado
  `afa6e66f-eb38-4f0b-824d-518964d9a87f` pasó a `ready`, sin error, en el
  servidor real. Su fuente es sintética, no salida de modelos ni entrevista
  personal. Sesión `59135164-8c29-4b28-a1e4-36b6b2b5df68`, PDF
  `af57b558-fe63-42d1-a9b1-d517b838eb46`; se mantienen privados.
- Interior A5: 194 páginas, 48.300 palabras de fuente, 726.937 bytes.
  Cubierta separada: una página, 19.168 bytes. Lectura íntegra y SHA-256
  verificados por el servidor. Las fuentes están incrustadas. Reapertura y
  extracción local: los 300 marcadores de inicio/fin de párrafo aparecen
  exactamente una vez, y se conservan los cinco capítulos. Las páginas en
  blanco son los reversos de separación previstos y el cierre par.
  Revisión visual de portada, índice, inicios de capítulo, cierre y cubierta:
  sin recortes detectados en las páginas revisadas. No es una garantía de
  rendimiento universal ni una normalización de Lulu.
- `review_status:pending_review`, `ready_for_print:false`, `send_to_lulu:false`.
  No se ha registrado aprobación humana ficticia ni se ha creado pedido.
- La cola se activó solo para esta prueba mediante el interruptor de Caronte.
  Tras terminar se restauró `CARONTE_PRINT_QUEUE_ENABLED=false` y se confirmó
  `print_queue_disabled` en el servidor. El disparador de GitHub continúa
  apagado; no se ha guardado una credencial del trabajador en GitHub.
- Tras corregir Storage: 437 pruebas de comportamiento sin fallos ni skips,
  17 comprobaciones heredadas, validación y build correctos. Este recuento
  corresponde al corte anterior a las pruebas nuevas del permiso exclusivo.
- Corte final de código: versión 14 ACTIVE, veinte archivos releídos y todos
  iguales al artefacto enviado. Bundle SHA-256
  `893454cb8e99ae98057d55bebd4eafd9ad20d06ef0a493774521e0329729dfb7`.
  El permiso exclusivo usa `CARONTE_PRINT_WORKER_SECRET` y solo se reconoce
  mediante `x-caronte-print-worker-secret` dentro de `advancePrint`.
  El runner no lee el secreto general del monitor; su workflow solo recibirá
  el secreto exclusivo, si se autoriza. No se ha creado ni guardado esa clave.
  Nueve casos nuevos prueban la ruta, el runner, el rechazo de otros carriers,
  once rutas ajenas a PDF y la compatibilidad con operadores existentes.
  Cinco casos fallaron antes del cambio; los 33 casos enfocados pasan después.
  Batería final: 446 pruebas sin fallos ni skips, las 17 comprobaciones heredadas,
  validación y build correctos. El lanzador ejecutó las 21 órdenes `node` de
  los scripts de package.json porque este runtime no incluye `npm`.
- API de la versión final: `accessStatus` y la consulta autorizada del PDF
  técnico devuelven HTTP 200 con el origen GitHub correcto; el PDF sigue con
  `ready_for_print:false`. La cola apagada devuelve `print_queue_disabled`;
  una credencial sintética no configurada se rechaza antes de avanzar un
  trabajo de PDF o de libro. No se ha debilitado la autenticación.

### Pendiente real para el piloto

Autorización y conexión de Anthropic; creación autorizada del permiso exclusivo
del trabajador PDF y activación/verificación del disparador; aprobación humana
de los archivos y normalización real por Lulu; entrevista y libro completos
con proveedores. La generación técnica de un PDF no cierra esos puntos.
Pedidos, pagos y entrega física siguen fuera de esta prueba y desactivados.
