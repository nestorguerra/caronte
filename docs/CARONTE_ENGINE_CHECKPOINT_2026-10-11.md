# Caronte: corte local del 11 de octubre, ampliado el 12 de octubre de 2026

## Alcance preparado

- Escritor: conserva el modelo configurado. GPT-5.4 Pro y su snapshot reciben el
  esquema íntegro en el prompt sin solicitar Structured Outputs, que no admiten.
  El resultado debe pasar las validaciones locales antes de guardarse.
- Panel: usa datos del servidor. No añade sesiones, pedidos, métricas ni respuestas
  ficticias, ni abre el área privada cuando falla la configuración o autenticación.
- Proceso del libro: muestra etapa, fallo y recibos reales; permite reanudar solo
  fallos admitidos o cancelar trabajos bloqueados, con motivo y lectura del estado
  antes y después. Un envío incierto no se vuelve a enviar automáticamente.
- Indicadores ausentes: se muestran como desconocidos, no como cero, acceso abierto
  o retención configurada. El valor estimado de las sesiones no se llama ingreso
  cobrado; liberar un PDF no se llama entrega física.
- Captura: una respuesta sin transcripción final confirmada no avanza la entrevista.
  Los recibos se vinculan a sesión y captura. Se conserva el texto completo dentro
  del límite explícito; no se acepta una marca de audio pendiente como respuesta.
- Archivo remoto: cada captura usa un objeto privado fijo, creación sin sobrescritura
  y lectura posterior de todos los bytes. El SHA-256 y el tamaño deben coincidir
  antes de transcribir o confirmar la respuesta. Un reintento reconcilia el objeto
  existente y no sustituye una grabación distinta.
- Confirmación: se relee la respuesta de la base de datos y se compara con el texto,
  procedencia, ruta y metadatos enviados; aceptar la escritura no acredita persistencia.
  El navegador verifica captura/sesión/pregunta, texto y checksum del audio tanto al
  guardar como al reproducir la cola. No retira la copia local ante un recibo dudoso.
  Las respuestas breves incluyen su borrador persistido en el recibo de follow-up.
- Reanudación: una respuesta que declara audio capturado pero carece de prueba de
  archivo no cuenta como completada. La retención remota desactivada bloquea el
  guardado de voz antes de llamar al transcriptor; no se ha cambiado esa configuración.
- Espera: `saveAnswer` dispone de 180 segundos en el cliente, frente a los 30
  anteriores. Las otras operaciones conservan sus límites. Esto no modifica el
  timeout del proveedor/Edge ni impide duplicados STT concurrentes.
- Reintentos: la cola conserva todas las entradas y las separa por sesión. Reiniciar
  la interfaz no borra respuestas pendientes. Un fallo de almacenamiento local no
  se anuncia como guardado persistente: mantiene la captura en memoria y avisa.
- Diario local: IndexedDB conserva el audio binario y la transcripción antes del
  envío. Espera al commit de la transacción, no solo al éxito de una petición.
  La conversión a base64 ocurre al preparar el envío; no duplica audio largo en
  localStorage. Los campos admitidos excluyen tokens y credenciales.
- Migración: las entradas antiguas con sesión pasan al nuevo diario con identificador
  estable. Las que no tienen sesión quedan intactas y no se envían bajo otra cuenta.
  Un recibo mínimo impide que una migración interrumpida vuelva a poner en cola una
  captura ya confirmada; ese recibo no conserva la biografía ni el audio.
- Micrófono: los permisos tardíos y callbacks de capturas anteriores no reemplazan
  la sesión nueva. Se liberan los tracks al reiniciar o fallar el arranque. Si falla
  el reconocimiento del navegador, la grabación de audio sigue disponible.
- El HTML del cliente y su CSS siguen iguales. Sí se ha corregido su JavaScript.
- Imprenta local: pdf-lib 1.17.1 y fontkit 1.1.1, autorizados por Néstor, con lock
  de dependencias y fuentes Crimson Text/OFL verificadas por hash. El generador
  mide las líneas con las fuentes incrustadas y conserva todos los párrafos/tildes.
  No añade notas de relleno ni deja imprimir una vista previa de 32 páginas.
- Maquetación: cinco capítulos, edad+40, 45–55 mil palabras, páginas individuales
  A5 con márgenes espejados. Reabre el binario para contar 180–200 páginas físicas.
  La tipografía queda entre 12 y 14 pt; si no cabe, exige revisión del manuscrito.
- Cubierta: PDF independiente, contracubierta/lomo/portada. El flujo completo v2
  solicita dimensiones a Lulu con las páginas reales y el SKU A5. Para una prueba
  privada sintética se permite la fórmula de la guía; nunca pasa por lista para imprimir.
- Archivo de impresión: creación sin sobrescritura de ambos PDF, lectura completa
  posterior y comprobación de tamaño/SHA-256. La fila de PDF y el estado de sesión
  también se releen antes de anunciar finalización. Un objeto o fila incompletos
  impiden confirmar el par. El panel puede abrir la cubierta mediante URL privada.
- `ready_for_print` permanece falso hasta revisión humana y preflight/normalización
  de ambos archivos por Lulu. Obtener dimensiones no valida el PDF ni crea un pedido.
- Preflight integrado localmente: aprobación humana ligada por hash; verificación
  completa del archivo privado; reserva condicional del intento antes de llamar
  a Lulu; consultas sobre el mismo ID; lectura DB después de cada cambio. Un
  envío incierto/interrumpido no se repite. Solo ambos `NORMALIZED`, sin errores,
  con páginas/SKU/origen coincidentes, permiten «listo para imprimir».
- Panel: muestra interior/cubierta y estados reales por separado. Viewer/support
  no pueden validar. La intervención relee antes/después y acepta JSONB con claves
  reordenadas. Rechazar la revisión revoca la aptitud de impresión.
- Lulu: exige entorno y par OAuth privado, rechaza la clave única antigua y prepara
  una prueba de autenticación real sin pedido. Una configuración distinta no
  hereda como vigente el éxito de la anterior. No se ha ejecutado contra Lulu real.
- Presupuesto (ampliación del 11–12 de octubre): exige revisión/preflight exactos,
  consentimiento de dirección y rol de operaciones; consulta envíos y calcula
  impresión, envío, gestión e impuestos sin duplicar tasas. Guarda dirección
  cifrada y recibo ligado a archivos/destino/envío; relee antes de confirmar.
  Caduca por política local a los 15 minutos y no autoriza pedido/pago. Cambiar
  archivo, aprobación o permiso limpia el formulario privado. Contrato y límites:
  `CARONTE_PRINT_QUOTE.md`. No añade controles a la página pública.
- Pedido (ampliación del 12): aprobación durable de una copia/destino/envío/gasto,
  modo de pago manual declarado, envío desactivado por defecto, verificación de
  archivos/precio, reserva condicional previa al POST y conciliación sin reenvío.
  Consulta identidad, PDFs, costes y estado antes de ofrecer el portal manual.
  Pago en curso no es pago confirmado; enviado no es entregado. Un pago histórico
  no regresa a otro enlace de pago por un estado contradictorio. Ver
  `CARONTE_PRINT_ORDER.md`. No se ha activado el envío, creado o pagado un pedido real.
- Integración corregida: acceso de pedidos usa las constantes reales de `service.ts`.
  Dashboard y detalle leen los metadatos necesarios para recuperar aptitud/marca
  del pedido, pero retiran presupuesto/recibo privados antes de devolver el PDF.
- Recuperación de escritura preparada: disparador independiente desactivado,
  una petición autenticada de claim, destino HTTPS del mismo proyecto, plazo
  completo y logs seguros. No publica ni activa configuración. Un nuevo worker
  consulta el ID guardado; un envío incierto sigue bloqueado. Ver
  `CARONTE_BOOK_RECOVERY.md`. No es una prueba de autonomía remota ni un SLA.
- Credenciales Lulu preparadas: formulario privado de par OAuth, permiso de
  propietario existente, guardado AES-GCM con revisión condicional y relectura,
  prueba OAuth separada. Entorno incompleto no se mezcla con DB. La marca privada
  HMAC cubre el par íntegro; otro par bloquea recibos/pedidos anteriores, sin
  vincular trámites heredados ni reenviarlos. Ver `CARONTE_LULU_CREDENTIALS.md`.
  Ninguna clave real guardada; no se ha contactado con Lulu real.

## Verificación realizada

- 327 pruebas de comportamiento, incluidas 46 del panel, 23 del servidor de
  entrevista, 28 de captura/reintentos, 10 de recibos y 10 del diario: todas pasan,
  sin omitir pruebas. Los nuevos fallos de archivo/confirmación se reprodujeron
  antes de implementar sus correcciones. El contrato cliente/servidor también se
  ejecuta conjuntamente contra límites externos sintéticos.
- 17 comprobaciones heredadas, validación y build: pasan.
- Se ejecutaron directamente los mismos comandos Node del paquete. El runtime
  local tiene Node 24.19.0, pero no `npm`. El pnpm disponible instaló únicamente
  las dos dependencias PDF aprobadas y sus transitivas, sin scripts de instalación.
- El paquete declara Node >=24; el workflow de GitHub ya usaba Node 24. No se ha
  cambiado el runtime del despliegue. Se prepara instalación con pnpm 11.25.0 y
  lock congelado; el lock se verificó localmente, también sin red ni scripts.
- `git diff --check`: sin incidencias.
- Navegador real, panel local sin configuración: acceso privado visible, área de
  trabajo oculta, «Servidor sin configurar» y cero errores/avisos de consola.
- Navegador real, página pública: conserva el terminal original, sin controles de
  libro demo ni muestra de voz; cero errores/avisos de consola durante la carga.
- Navegador real, build local actualizado de `tiresias.html`: supera la carga y
  muestra el terminal y acceso originales, sin errores/avisos de consola. No se
  solicitó permiso de micrófono ni se enviaron respuestas desde ese navegador.
- HTML y CSS públicos comparados con los archivos locales y el commit base
  `48157ae`: idénticos. Esta comprobación no acredita que el flujo completo funcione.
- IndexedDB nativo, navegador real: un Blob de 6.291.456 bytes y su texto se guardan,
  la página se recarga y ambos se recuperan íntegros. Se comprueba aislamiento entre
  sesiones y que reimportar una captura confirmada no la reencola. Cero errores/avisos.
  Solo datos sintéticos; sin micrófono, tokens, proveedores ni respuestas personales.
  La fixture está en `scripts/fixtures`, no en `src` ni en el build publicable.
  Se retiraron sus audios/textos sintéticos; quedan los recibos mínimos de la prueba.
- Verificación nativa ampliada: compara el checksum de los 6 MiB completos con los
  bytes originales conocidos; un recibo con checksum distinto conserva la captura.
  Solo el recibo correcto permite retirarla. Cero errores/avisos de consola.
  Evidencia: `caronte-audio-receipts-20261011.jpg`, guardada en la carpeta de
  visualizaciones de este chat. La fixture privada no forma parte de la página pública.
- Supabase, lectura de metadatos el 11 de octubre: proyecto `ACTIVE_HEALTHY`,
  bucket `future-book-audio` privado y límite de 26.214.400 bytes (cliente: 24 MiB).
  La consulta de `storage.objects` muestra políticas acotadas a otros buckets;
  no se añadieron políticas de acceso público, permisos ni objetos de audio reales.
  Estas lecturas no verifican una escritura autenticada de audio desde la Edge Function.
- PDF real de prueba privada: 48.300 palabras sintéticas, 150 párrafos, interior
  de 194 páginas y cubierta de una página. pypdf verifica los binarios escritos:
  todas las fuentes incrustadas, geometría, ausencia de cifrado, hashes y todo el
  texto extraído en orden (295.284 caracteres). No es un libro del modelo/cliente.
- Render de Poppler inspeccionado: portadilla, índice, apertura de capítulos 1/2,
  cuerpo, última página de texto y cubierta. Sin recortes, caracteres ausentes
  ni texto superpuesto en esas páginas. PDF de prueba: `output/pdf`, privado y
  fuera del build. Reproducción y límites: `CARONTE_PRINT_RENDERER.md`.
- Ruta del servidor v2 ejecutada localmente con el generador real y límites
  externos sintéticos: enlaza dimensiones al recuento físico, guarda/relee el par,
  no completa ante fallo de cubierta o pérdida de lectura DB, acepta el orden
  distinto de claves JSONB sin ignorar su contenido. No valida Lulu ni su Edge real.
- Nuevas pruebas de preflight: 13 del servicio durable, 5 de la ruta administrativa,
  3 adicionales de archivo privado y 2 del adaptador Lulu. Reproducen pérdida de
  respuesta, concurrencia, reservas interrumpidas, páginas/SKU/ID/origen incorrectos,
  recibos incompletos, fallos de consulta y revocación de revisión antes de corregirlos.
- Navegador real, fixture privada de impresión: progreso separado y aptitud solo
  al completar ambos archivos; un envío incierto oculta el botón de validación.
  Cero errores/avisos. Tres intervenciones consultan estado antes y después.
  HTML/CSS/JS reales del panel, solo límite API sintético. No lee claves ni llama
  a proveedores. Se cerraron su pestaña y servidor al terminar. Evidencia:
  `caronte-print-preflight-20261011.jpg`. Reproducción: `CARONTE_PRINT_PREFLIGHT.md`.
- HTML/CSS de la experiencia original siguen sin diferencias frente al commit base.
- Presupuesto: 9 pruebas del servicio, 3 nuevas de su ruta y 5 del panel. Comprueban
  cifrado, consentimiento, permisos, aritmética decimal, dirección propuesta,
  caducidad, cambios de archivo/revisión y pérdida de lectura DB. El servidor
  TypeScript y JavaScript reales se ejecutan con límites externos sintéticos.
- Navegador real: formulario privado, rechazo sin consentimiento, método de envío
  devuelto por la fixture, desglose confirmado mediante consulta posterior y
  bloqueo al cambiar dirección. Sin errores/avisos de consola ni acciones de
  pedido/pago. Evidencia `caronte-print-quote-20261011.jpg`; importe sintético,
  nunca un precio comercial. Pestaña temporal y servidor cerrados.
- Primer pase de la suite ampliada: 250/251; una lectura de archivo privado agotó
  el plazo durante el paralelismo por defecto. La prueba aislada pasó en 16 ms.
  Se limita el runner a dos procesos simultáneos: no cambia plazos ni assertions,
  no omite pruebas. El pase completo posterior pasa 251/251, más las 17 comprobaciones
  heredadas, validación y build. No equivale a comprobar carga del servidor real.
- Pedido: 13 pruebas del servicio, 3 nuevas de la ruta y 8 del panel. El envío
  desactivado y los permisos se prueban en la ruta TypeScript real. Errores de
  lectura/regresión de pago se reprodujeron y corrigieron con pruebas de comportamiento.
- Navegador real, frontera local sintética: aprobación/relectura, un solo envío,
  portal oculto hasta recibo correcto, envío distinto de entrega, persistencia
  tras recarga y conciliación sin nuevo POST. Cero errores/avisos de consola.
  Evidencia `caronte-print-order-20261012.jpg`, claramente sintética; no se abrió
  el portal ni los enlaces de tracking. Sin llamadas reales a proveedor/pedido/pago.
- Supabase, catálogo leído el 12: RLS y trigger de `updated_at` vigentes sobre
  `future_book_pdfs`. No verifica la escritura condicional remota; no se escribió
  ningún pedido, dirección o configuración en Supabase.
- Revisión de integración del 12: la fixture anterior sustituía las constantes
  de `service.ts` por funciones y devolvía columnas no pedidas. Reproducidos cuatro
  fallos al conservar bindings reales y proyección SELECT: TypeError en pedido y
  ausencia de metadatos en listados. Corregido el constructor y ambas consultas;
  13 pruebas de ruta pasan, incluyendo recuperación sin revelar recibos privados.
  El primer pase de 277 y la fixture del navegador no acreditaban ese contrato.
- Doce pruebas independientes del worker cargan servicio/auth/CORS/endpoint/motor
  originales. Comprueban bearer real, secreto de monitor, rechazo sin permisos,
  UUID, fallo seguro y ausencia de soporte Edge. Dos conectan el ejecutable de
  recuperación a la ruta HTTP real, sin sustituir la autenticación.
- Catorce pruebas de recuperación: default-off, destino y clave restringidos,
  una sola petición, plazo incluyendo cuerpo, recibos contradictorios rechazados,
  logs mínimos y proceso real desactivado. YAML parseado localmente. Dos pruebas
  más del motor recuperan el ID con GET tras aviso perdido y retienen un envío
  incierto. Solo fronteras sintéticas; no ejecutan SQL remoto ni GitHub Actions.
- Pase anterior: 307/307 sin skips, 17 comprobaciones heredadas, validación,
  build y `git diff --check`. La experiencia pública mantiene su HTML/CSS originales.
- Corte del par Lulu: nueve pruebas del store y dieciocho de rutas administrativas,
  con AES-GCM real y servicio compartido original. Proveedor/DB siguen siendo
  fronteras sintéticas. Verifican permisos, concurrencia, pérdida de confirmación,
  resolución del par cifrado en preflight/presupuesto/pedido/prueba OAuth y
  preservación de secretos durante la prueba. No acreditan autenticación remota.
- Se reprodujeron y corrigieron dos fallos adicionales antes del cierre: el panel
  aceptaba un recibo de distinto entorno y el helper genérico truncaba el par
  largo antes de identificarlo. Ahora se comprueba entorno/UUID en la relectura
  y HMAC-SHA-256 sobre todos los caracteres, sin salt público de respaldo.
- Navegador nativo con fixture local: sin consentimiento no hay POST; los campos
  password quedan vacíos al enviar; éxito solo tras relectura. Una aceptación
  sin confirmación muestra incertidumbre y no reenvía. Cero errores/avisos
  observados. El formulario conserva nombres accesibles y estado `aria-live`.
  Corregido desbordamiento de grid/formularios del panel en tablet; la página
  cabe en 320/768/1024/1140/1440 px. No constituye auditoría integral de a11y.
  Captura sintética: `/tmp/caronte-lulu-panel-proof-OuiQaq/lulu-local-confirmation.jpg`.
- Pase del par Lulu: 327/327 sin skips, 17 comprobaciones heredadas, validación,
  build y `git diff --check`. `src/tiresias.html` y `src/styles/future-book.css`
  siguen idénticos a 48157ae. Sin commit, push, publicación, despliegue ni
  configuración de credenciales/cuentas/pedidos remotos.
- Corte CPU del 12: prueba independiente falló por 5.713.655 caracteres medidos
  frente a presupuesto 3.543.000, con PDF real y orden/fuente íntegros. El padre
  reejecutó RED. Se conserva el mapa completo por hash tras corregir prefijos:
  1.369.359 caracteres medidos y caché limitada. Seis pruebas adicionales cubren
  las fuentes reales, contexto, límites/rounding, palabras y aislamiento/capacidad.
- Tres muestras completas antes/después: CPU total mediana 14.984 → 6.427 ms.
  Mejora local del 57 %, no demostración de viabilidad en Edge ni memoria alojada.
  No se quitan validaciones ni se cambia tipografía para reducir la carga.
  Pypdf confirma el par nuevo con texto íntegro; siete renders privados revisados.
  Artefactos: `/tmp/caronte-print-performance.HyanSX`; sin sustituir la prueba previa.
  Detalle/mediciones: `CARONTE_PRINT_PERFORMANCE.md`.
- Pase del corte de líneas: 334/334 sin skips, 17 comprobaciones heredadas, validación,
  build y diff limpio. HTML/CSS públicos idénticos a 48157ae. Sin publicación,
  despliegue, dependencias nuevas, credenciales, llamadas Lulu ni pedidos/pagos.
- Maquetación por etapas preparada después: 25 planes capítulo/tamaño, composición,
  veinte partes para 194 páginas, unión y cubierta. Fuente/fuentes/plan/rango/bytes
  ligados a recibos; fecha congelada y hash canónico permiten relectura sin caché.
  No son una cola SQL ni están conectadas al worker/arranque/consulta reales.
- Se descartó el primer ensayo por capítulos: pico CPU local 1.916 ms. Tres
  muestras finales de 48 procesos independientes dan 770/901/818 ms de pico,
  con 24,3–25,7 s de CPU acumulada y 172–177 MiB RSS. Node no certifica Edge.
  El futuro disparador no puede ser una cadena recursiva de 48 peticiones.
- Los tres pares finales y sus veinte fragmentos son byte a byte idénticos;
  mismo plan completo anterior. Pypdf confirma texto íntegro, fuentes, hashes y
  dimensiones en los tres. Siete renders nuevos revisados sin defectos observados.
  Artefactos privados: `/tmp/caronte-print-stages-small.2o2QTl`.
  Decisión/medidas/límites: `ADR-001_PRINT_STAGES.md`, estado Propuesto.
- Pase de las primitivas: 347/347 sin skips, 17 comprobaciones heredadas, validación
  y build pasan. HTML/CSS públicos idénticos a 48157ae. Sin interfaz nueva,
  publicación, despliegue, dependencias nuevas, credenciales, Lulu ni pedidos/pagos.
- Relectura pública adicional el 12: `tiresias.html` y `styles/future-book.css`
  responden HTTP 200 y sus bytes son exactamente los de 48157ae. El lector web
  genérico no pudo abrir la página; GET directo sí la releyó. Esto verifica los
  archivos publicados, no una entrevista nueva ni disponibilidad del backend.
- Coordinador de imprenta preparado después: reserva única de trabajo/PDF/versión/
  fecha, fuente aprobada congelada, lease, recibos inmutables, tres intentos por
  paso y relectura de propietario/estado antes de escribir bytes. Persiste la
  intención antes del POST privado sin sobrescritura y recupera el objeto correcto
  si se perdió la confirmación DB, sin otro render/POST/versión. El cierre atómico
  propuesto liga el par reservado y vuelve a leer su fila. Ver `ADR-002_DURABLE_PRINT_COORDINATOR.md`.
- Integración del coordinador con generador y fuentes reales: 49 claims mediante
  instancias nuevas, pérdida forzada de confirmación del primer fragmento y
  recuperación con un único POST. Veinte partes y dos PDFs finales. DB/Storage/
  dimensiones de Lulu sintéticos; no demuestra reinicio de proceso ni SQL real.
- Par privado nuevo: `/tmp/caronte-print-engine-proof.swtJV4`. pypdf verifica 194
  páginas interiores, una cubierta, todas las fuentes, hashes, dimensiones y
  texto íntegro de 295.284 caracteres. Ocho renders revisados sin defectos
  observados. Fuente sintética y `ready_for_print=false`; no es libro del cliente.
- Pase del coordinador: 367/367 sin skips, 17 comprobaciones heredadas, validación,
  build y diff limpio. HTML/CSS originales siguen idénticos a 48157ae. Se corrigieron
  tras RED los reintentos de recuperación/cierre sin límite, hash final incorrecto,
  checkpoint no releído y detalles privados de transporte. Las assertions SQL no
  se han ejecutado y no forman parte de las 367 pruebas.
- Supabase, lectura del 12 posterior a ese pase: servidor activo, PostgreSQL 17.6,
  sesiones/manuscritos/PDF/cola literaria presentes. Cola/RPC/columna de imprenta
  nuevos ausentes. Solo ElevenLabs aparece configurado en la tabla de proveedores.
  Sin cambios remotos. No confundir la existencia de la cola literaria con su
  contrato verificado o con un libro completo generado.
- Conexión de imprenta preparada después: ruta v2 reservada/default-off, consulta
  de trabajo sin render ni encolado, worker autenticado de una etapa síncrona,
  fuentes cargadas solo al procesar y recibos privados retirados del PDF público.
  La migración prepara también `pdf_generating` en la sesión y permite el reintento
  de la misma reserva. SQL/assertion modificados, no ejecutados ni aplicados.
- Cliente: progreso y consulta en la interfaz original; reintenta solo lecturas,
  rechaza otra sesión y recupera tras recarga sin otro encolado. Disparador HTTP
  independiente acotado/default-off y workflow preparado; sin cadena Edge recursiva.
  Contrato y límites: `CARONTE_PRINT_RECOVERY.md`. Detalle y controles de cola
  añadidos después al panel privado; contrato SQL aún no ejecutado.
- Pase tras los controles privados: 403/403 sin skips, diecisiete comprobaciones heredadas,
  validación y build. Diez pruebas de ruta nuevas, siete de cliente y ocho de
  disparador, incluido ejecutable contra auth/ruta/coordinador y planes reales.
  No ejecutan PostgreSQL, GitHub Actions, Deno/Edge ni proveedores reales.
- Navegador nativo, API local sintética: el botón original inicia/progresa,
  recargar recupera el trabajo y termina en `pending_review`, 194 páginas y
  `lulu_ready=false`. Se relee el registro del servidor: un solo `generatePdf`
  y solo consultas de avance. Cero errores/avisos de consola. Capturas privadas
  `caronte-print-queue-20261012.png`/`caronte-print-recovered-20261012.png` en las
  visualizaciones del chat; pestaña/servidor cerrados. No prueba un libro auténtico
  ni autonomía remota. Workflow YAML parseado con Ruby, no activado/ejecutado.
- Control privado PDF preparado después: lista paginada y detalle sin fuente ni
  outputs. Operador, motivo, revisión vigente y trabajo bloqueado sin lease.
  Reanuda solo fallos de archivo recuperables; no salta gates ni fuente cambiada.
  El SQL conserva etapas terminadas/intenciones, reinicia solo el paso fallido y
  audita decisión/motivo/operador en su transacción. No ejecutado ni desplegado;
  el historial no está en la auditoría global todavía. Ruta/cliente releen la
  decisión exacta; sin confirmación bloquean acciones sin otro POST. Once pruebas
  nuevas, suite 403/403 sin skips y comprobaciones declaradas pasan. Navegador
  nativo sintético: reanudar, cancelar y resultado incierto; una mutación por caso,
  etapa terminada conservada, cero errores/avisos. Capturas privadas
  `caronte-print-admin-resume-20261012.png` y
  `caronte-print-admin-unconfirmed-20261012.png`; pestaña/servidor cerrados.
  HTML/CSS públicos intactos. No proveedor/pedido/pago, claves, commit/push,
  publicación, SQL remoto ni cambio de permisos/configuración en este corte.

- Perfil HTTP completo posterior: tres recorridos sintéticos y 147 procesos
  nuevos en total. Cada par conserva 194 páginas, plan completo y hashes de sus
  recibos. Pico CPU de petición 1.762 ms; RSS total de prueba hasta 291 MiB.
  Incluye compilador/VM y servidores sintéticos: no es una medida de límites Edge.
  Sin optimización de producción ni servicios externos. Tres tests de perfil
  RED→GREEN, sin skips. Evidencia y método: `CARONTE_PRINT_WORKER_PROFILE.md`.
  Se ha solicitado por separado autorización para Supabase CLI 2.120.0 y su
  entorno nativo experimental; no descargados/instalados. La aprobación de
  pdf-lib/fontkit no cubre esa herramienta ni el despliegue remoto.
- Pase completo después del perfil: **406/406 sin skips**, diecisiete
  comprobaciones heredadas, validación/build y diff sin incidencias. Pypdf relee
  los tres pares: 194 + 1 páginas, fuentes incrustadas/Unicode, geometría A5,
  295.284 caracteres de cuerpo completos en orden y hashes coincidentes.
  Sin libro auténtico, pruebas SQL/Edge, preflight de proveedor ni publicación.
- Captura/transcripción endurecida después: el plazo de 60 segundos ahora cubre
  POST y lectura íntegra del cuerpo, no solo cabeceras. Se abortan petición/reader
  y se limpian timer/listener. Cabeceras tardías no reviven la transcripción.
  Error HTTP cancela el cuerpo sin leerlo; fallos de transporte/timeout devuelven
  un recibo seguro `saved:false`, `needsTranscription:true`, sin próximo paso.
  No registra errores crudos del proveedor. El audio privado ya verificado queda
  intacto y el cliente mantiene Blob, texto e ID de captura para un reintento.
- Lectura STT por fragmentos con UTF-8 estricto: una secuencia inválida no se
  transforma silenciosamente en palabras con caracteres de sustitución.
  El envelope JSON tiene límite de 2 MiB; exceso se rechaza, nunca se recorta.
  Se conserva el límite completo de 200.000 caracteres: prueba con cada carácter
  escapado en JSON, y otra con tildes repartidas entre chunks.
- Reproducción RED antes de corregir: deadline retirado al llegar cabeceras,
  excepción privada de lectura, cuerpo de error leído, envelope desmesurado,
  cancelación del reader tras liberar su lock y corrupción UTF-8 aceptada.
  Nueve pruebas nuevas del servidor y una del cliente; 61/61 enfocadas sin skips.
  Conexión HTTP nativa a un servidor efímero 127.0.0.1: cuerpo incompleto,
  cancelación real de socket, una sola petición, ninguna respuesta/avance y audio
  intacto. Reloj de 60 segundos adelantado de forma controlada; servidor cerrado.
  DB/archivo/proveedor son sintéticos; no se ejecutó STT real ni Deno/Edge.
  Solo código backend y tests; ElevenLabs y HTML/CSS/JS públicos sin cambios
  adicionales en este corte. Sin instalación, credenciales, gasto o publicación.
- Último pase completo tras estas correcciones: **416/416 sin skips**, diecisiete
  comprobaciones heredadas, validación y build pasan. Diff sin incidencias;
  HTML/CSS de Tiresias idénticos al commit base `48157ae`. Sin proveedores reales,
  PostgreSQL/Deno locales, despliegue ni entrevista/pedido/entrega auténticos.

## Contraste remoto de solo lectura del 12 de octubre

Consultados metadatos del proyecto, catálogo SQL y fuente desplegada mediante
Supabase. No se ejecutaron RPC de trabajo ni se recuperaron entrevistas, claves,
direcciones o pedidos. No se hizo una petición pagada ni se modificó el servidor.

- Proyecto `ncompany-platform`: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.111. Ese estado
  no prueba modelos, transcripción, imprenta, scheduler o entrega.
- Función `future-book-session`: **versión 8**, registro de actualización
  `2026-05-31T13:12:31.702Z`. Se leyó su código, no solo la etiqueta ACTIVE.
  Tiene cuatro archivos: endpoint, servicio, CORS y adaptador AI antiguo.
  No contiene `createBookEngine`, `createPrintEngine`, `advanceBook`,
  `advancePrint`, `renderPrintBundle` ni el nuevo lector STT.
- STT publicado aún usa `safeLongText(...,12000)`, acepta el cuerpo bruto cuando
  falla JSON y retira el timeout al llegar cabeceras. La corrección local no está
  publicada. No usar ese flujo como prueba de captura íntegra para el piloto.
- `generateBook` publicado sigue siendo monolítico, con borrador determinista,
  vía degradada y objetivo almacenado **35–60 páginas**. La cola literaria nueva
  no está conectada a ese endpoint. `generatePdf` usa el generador antiguo,
  cubierta dentro del interior y contrato beta de **32–80 páginas**; no el par
  independiente de imprenta de 180–200 páginas.
- Existen seis RPC literarios con `search_path=public,pg_temp`, EXECUTE solo de
  servicio (anon/authenticated denegados). Las tablas de trabajos y pasos tienen
  RLS y SELECT directo denegado a anon/authenticated. Los cuerpos de enqueue,
  checkpoint y finish coinciden con la migración local, retirando solo whitespace
  exterior. Esto acredita presencia/contrato, no ejecución o concurrencia real.
- No existen tablas/RPC de imprenta. No se ha aplicado la migración preparada.
- Tabla de administradores: RLS activo, sin políticas en catálogo. Los grants
  SELECT por sí solos no acreditan acceso a filas. No se consultaron sus usuarios
  ni se probó una ruta privada sin autenticación. La configuración de secretos y
  `APP_ENV` en el alojamiento sigue sin verificar: no se infiere de estos datos.
- Revalidación local: no hay Deno/Supabase CLI/Docker/psql en PATH. La autorización
  solicitada para CLI 2.120.0 + entorno nativo no ha llegado. Sigue pendiente el
  destino aprobado de la clave OpenAI y el despliegue específico de Caronte.

La siguiente prueba relevante es del SQL/runtime efectivos, no otra fixture que
declare funcionar. Requiere el permiso ya solicitado para el entorno privado;
después, las credenciales y el despliegue aprobados. No activar el pipeline en el
proyecto compartido sin esa verificación. No se repitió la suite sin cambios de
código: el último pase local sigue siendo 416/416; no se presenta como pase remoto.

Se consultó el changelog oficial. El visor no admite su MIME markdown; lectura
alternativa desde Node tuvo HTTP 200. El proyecto observado permanece en 17.6,
no se asume actualizado por un anuncio de 17.11 ni se hace upgrade. Fuente:
[cambio de PostgreSQL 15.19/17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
Sin cambios de funciones/SQL/permisos, instalación, claves, commit/push o publicación.

## Lo que no se ha hecho ni verificado

Actualización posterior a la autorización local del 12 de octubre: CLI 2.120.0
instalada en privado, PostgreSQL real/SQL/ACL/concurrencia pasan. La función carga
en el runtime nativo; las primitivas generan 194 páginas y cubierta sintéticas.
El timer CPU está deshabilitado en macOS y RSS no disponible: no certifica Edge
ni el coordinador completo DB/Storage. Todos los procesos propios detenidos,
sin publicación, claves reales, llamadas pagadas o cambios remotos. Informe:
[verificación nativa local](CARONTE_NATIVE_LOCAL_VERIFICATION.md). La solicitud de
herramienta ya está autorizada; los bloques anteriores conservan el corte previo.

Este corte no se ha publicado ni desplegado. No se ha generado un libro auténtico,
validado un interior/cubierta auténticos en Lulu, pagado un pedido ni verificado
una entrega. Las pruebas de proveedor usan respuestas sintéticas y no
acreditan su disponibilidad real o calidad literaria.

La creación segura de la clave OpenAI fue solicitada mediante el selector de la
plataforma. Falta la confirmación del destino local para crearla y guardarla; aún
no se ha creado ni escrito. No sustituir ese permiso por una continuación automática.

También siguen pendientes las credenciales del revisor y Lulu, la activación y
prueba remota de recuperación y un scheduler con garantías de producción,
la entrevista completa, el despliegue aprobado y el piloto con revisión humana.
Las tareas del piloto permanecen abiertas: este corte no es el producto terminado.

Para imprenta, faltan prueba del empaquetado de fuentes en Deno/Edge y medición
de CPU/memoria con un manuscrito real. Solo se ha preparado `static_files` de la
función Caronte; no se ha alterado la configuración compartida de LicitIA. Falta
aplicar y verificar la migración de imprenta preparada y activar el disparador
independiente autorizado. La cola/acciones del panel se prepararon en local con
CAS y decisión releída; no verificadas en SQL. Arranque/consulta/worker/
cliente están conectados localmente, default-off. Coordinador y recuperación
de objetos privados probados localmente, no en SQL/Storage remotos.
La fixture variada optimizada sigue excediendo en Node el presupuesto CPU
documentado para una petición alojada; no es medición Edge. Resolver/probar
el trabajador completo por bloques y unión final, o decidir un trabajador adecuado con
coste/configuración/despliegue autorizados. `waitUntil` no elimina esos límites.
La gestión cifrada del par OAuth de Lulu desde el panel, la prueba OAuth y el trámite
de preflight están implementados localmente, no verificados remotamente. Falta
comprobar el CAS con el trigger de Supabase real, la descarga/normalización con
URL firmada y la recuperación explícita de trámites inciertos. No borrar objetos
ni publicar sin aprobación.
La rotación del par/salt bloquea recibos anteriores; falta un proceso explícito
para revisar/migrar esa configuración sin repetir un trámite o pedido previo.
El presupuesto también está implementado solo en local: no se ha enviado una
dirección real a Lulu ni confirmado precio/IVA/envío auténticos para el piloto.
El flujo de pedido aprobado y conciliación está preparado localmente, pero no
se ha verificado con Lulu real ni se ha comprobado el modo manual de la cuenta.
El interruptor de envío no se ha activado. La creación de un pedido Lulu puede
cobrar si la cuenta tiene pago automático; el checkbox del panel no verifica
esa configuración. Un enlace al portal nunca se presenta como pago confirmado.

Límites pendientes de la captura: IndexedDB también está sujeto a cuota, modo privado,
borrado del navegador y política de expulsión. El audio se guarda al pulsar guardar,
no de forma continua mientras se habla. La prueba cubre recarga del mismo navegador,
no recuperación de credenciales tras perder la sesión o cambiar de dispositivo.
Falta una política de
recuperación/retención de esas entradas y de los objetos de audio privados que queden
sin respuesta tras un fallo de transcripción. El recibo evita repetir un guardado
ya confirmado; no equivale a un lock persistente de llamadas STT concurrentes.
La prueba de archivo remoto está implementada y probada localmente, también para
follow-up, pero aún no desplegada ni verificada con un audio real en Supabase.
La política de almacenamiento remoto no se ha modificado. Las entradas heredadas corruptas se preservan, pero
necesitan recuperación antes de poder reproducir automáticamente la cola.
Las pruebas ejecutan el código real con límites externos sintéticos: no acreditan
el runtime Deno, autenticación real, micrófono real, disponibilidad STT ni durabilidad
del proveedor. El texto original que anuncia autonomía total tampoco demuestra
que esa operación esté disponible hoy.

El timeout de lectura STT se endureció después y se probó en Node/HTTP local;
falta verificarlo en Deno/Edge y con el proveedor real. No acota toda la ruta
`saveAnswer`: consultas DB, configuración y eventos aún pueden bloquearse.
También quedan pendientes el lock persistente de STT y la migración/recuperación
de respuestas históricas que declaraban audio capturado sin su prueba de archivo.
No borrar ni reescribir esas fuentes para que las comprobaciones aparenten éxito.
Abortar una llamada no confirma cancelación/facturación del proveedor. Un reintento
puede repetir STT mientras no haya un recibo/lease durable; no se da por resuelto.

Referencia del contrato de commit: [MDN: IDBTransaction complete](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).
Referencia de creación/sobrescritura: [Supabase: Standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
Referencia de cancelación de lectura: [MDN: AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort).
