# Tareas del piloto

## Cortes del nuevo contrato aprobado +30 / 220 páginas

- [x] A Contrato literario v3 y revisión de ocho dimensiones.
  - Aceptación: +30/216–224; rechazar genérico, hechos inventados y +40 en nuevos trabajos.
  - Verificar: test-caronte-literary; prompts completos y pruebas RED→GREEN.
  - Archivos: contrato/literary y pruebas enfocadas. Depende: aprobación recibida.
- [x] B Cola y persistencia por versión.
  - Aceptación: snapshot inmutable sin claves; bloquear contrato viejo/alterado antes de POST.
  - Verificar: test-caronte-engine/jobs; PostgreSQL real y relectura de objetivos.
  - Archivos: engine/jobs, migración aditiva y pruebas. Depende:A.
- [x] C Imprenta de 216–224 páginas.
  - Aceptación: texto completo, cinco capítulos, tipos legibles, lomo por páginas reales; v2 intacta.
  - Verificar: renderer/stages/engine; relectura independiente y renders.
  - Archivos: print/print-engine/runtime, integración y pruebas. Depende:A,B.
- [x] D Recibos Lulu seguros.
  - Aceptación: ID válido durable; incompleto nunca listo; cero reenvío de intentos inciertos.
  - Verificar: test independiente preflight/route y operaciones reales aprobadas.
  - Archivos: print-preflight y sus pruebas. Depende: identidad de archivos y aprobación.
- [x] E Publicación sin cambios públicos de diseño.
  - Aceptación: servidor releído; Pages success; HTML/CSS idénticos; Sol/Opus efectivos.
  - Verificar: suite, validate/build, readback remoto, hash público. Depende:A–D.
- [ ] F Piloto literario e imprenta completos.
  - Aceptación: novela auténtica revisada íntegra; PDF objetivo; ambos NORMALIZED y lectura humana.
  - Verificar: recibos/uso de modelos, DB, trabajador sin navegador, PDFs y criterio editorial.
  - Archivos: evidencia privada y checkpoint sin credenciales. Depende:E.

Los cortes no autorizan un pedido ni un pago. No marcar F por muestras o fixtures.
Evidencia actual: `../docs/CARONTE_THIRTY_YEAR_CHECKPOINT_2026-10-12.md`.

## Pendientes y evidencia históricos (objetivo anterior)

- [x] 01 Acceso y voz reales con diseño original. Evidencia: Pages 48157ae y prueba
  ElevenLabs v3; no certifica grabación/transcripción/libro.
- [ ] 02 Contrato literario ejecutable. Edad+40, cinco capítulos, fuentes completas,
  prompts por etapa y gates; verificar `node scripts/test-caronte-literary.mjs`.
- [ ] 03 Cola persistente. DB + operaciones claim/complete/fail reanudables; verificar
  `node scripts/test-caronte-jobs.mjs` y dos workers sin doble ejecución. Depende:02.
- [ ] 04 Generación integrada. `generateBook`/`getBookStatus`/worker/progreso del cliente;
  QA real sobre Supabase con interrupción y reanudación. Depende:02,03.
- [ ] 05 Captura íntegra. Voz, audio, transcripción y respuesta conservada de principio
  a fin; error de transcripción no se transforma en una respuesta vacía. Depende:01.
- [ ] 06 Libro completo. 45–55k palabras orientativas, cinco capítulos, revisión
  humana íntegra de voz/continuidad/profundidad; nunca salida determinista. Depende:04,05.
- [ ] 07 Imprenta. Dos PDFs, fuentes embebidas, interior real180–200pp, cubierta con
  lomo correcto; inspección render y preflight Lulu. Depende:06.
- [ ] 08 Adaptador Lulu. OAuth y contratos API probados; verificar
  `node scripts/test-lulu-print.mjs`; sin pedidos de pago en tests automáticos.
- [ ] 09 Back office real. Sin métricas/pedidos showcase; cola, revisión, presupuesto,
  pago externo y estado confirmados; prueba navegador. Depende:04,07,08.
- [ ] 10 Sandbox y pedido aprobado. Cuenta, credenciales, dirección, presupuesto,
  validación de PDFs y no duplicación; verificación remota. Depende:07,08,09.
- [ ] 11 Entrega piloto. Pago confirmado, impresión, tracking y recepción en casa.
  Depende:10. Solo entonces auditar todos los requisitos y cerrar el objetivo.

Checkpoint por corte: pruebas enfocadas, suite completa, build, revisión independiente
y comportamiento real. No marcar tareas por existencia de archivos o tests estáticos.

Último corte local: `../docs/CARONTE_ENGINE_CHECKPOINT_2026-10-11.md`.
416 pruebas de comportamiento y suite heredada pasan; panel sin simulación,
contrato GPT-5.4 Pro y guardado/captura de entrevista corregidos. El diario binario
de audio está conectado al guardado. Un navegador real recupera 6 MiB íntegros
tras recargar y verifica sesión/recibo/migración, con datos sintéticos. El guardado
del servidor crea audio sin sobrescritura, relee todos los bytes y compara la
respuesta persistida con el texto íntegro enviado; el cliente exige ese recibo
antes de retirar su copia local. La prueba nativa confirma que un checksum
incorrecto conserva la captura. Esto no acredita una entrevista real ni una
escritura autenticada de audio en Supabase. Sin publicación ni generación
auténtica todavía. Captura íntegra y piloto permanecen abiertos.

Imprenta preparada en local con las dependencias autorizadas: fixture sintética
de 48.300 palabras, 194 páginas y cubierta independiente. Fuentes incrustadas,
texto íntegro, hashes y renders comprobados. El flujo v2 usa dimensiones de Lulu
por recuento físico y relee el par privado/DB antes de confirmar. No se ha probado
en Edge ni validado con Lulu real. La fixture PDF sigue `ready_for_print=false`;
07 sigue abierta. El servicio de preflight, la ruta administrativa y el panel
ya conservan intentos/IDs y ligan revisión/recibos a los archivos exactos. Solo
ambos normalizados permitirían imprimir; los fallos inciertos quedan retenidos.
OAuth de Lulu sustituye el indicador ficticio y la clave única. Comprobación
local con límites sintéticos y navegador real, sin proveedor/pedido/pago.
Faltan las credenciales, CAS remoto, normalización auténtica y recuperación
administrativa; 08, 09 y 10 siguen abiertas. Véase `CARONTE_PRINT_PREFLIGHT.md`.

Presupuesto y selección de envío preparados en local el 11–12 de octubre:
consentimiento de dirección, cifrado, importes exactos, caducidad y lectura DB.
Una revisión/archivo/dirección distintos invalidan el uso del cálculo anterior.
Prueba de navegador con límite sintético, sin pedidos/pagos ni controles públicos
nuevos. Falta presupuesto real con dirección autorizada, pedido durable aprobado
y confirmación del pago: 09–11 siguen abiertas. Véase `CARONTE_PRINT_QUOTE.md`.

Pedido durable preparado el 12 de octubre: aprobación de gasto/destino, PDFs y
precio releídos, intento reservado antes del POST, conciliación sin reenvío y
consulta real de identidad/costes/estado implementadas. Portal manual solo tras
recibo `UNPAID` reciente; pago en curso no es confirmado y enviado no es entregado.
La marca histórica de pago impide volver a ofrecerlo por regresión de estado.
Prueba de navegador con datos sintéticos, sin errores/avisos. Envío real desactivado
por defecto; ningún pedido/pago/envío creado en proveedor ni cambios publicados.
Falta verificar la cuenta sin autopay, runtime/CAS remoto, credenciales, precio y
dirección autorizados, piloto real. 09–11 siguen abiertas. `CARONTE_PRINT_ORDER.md`.

Revisión adicional del 12: dos fallos de integración estaban ocultos por una fixture
que cambiaba constantes por funciones y devolvía columnas no seleccionadas.
La prueba se corrigió antes del arreglo del constructor de pedidos y los listados.
Dashboard/detalle recuperan la marca del pedido sin divulgar recibo/dirección.
13 pruebas de ruta administrativa pasan con esos contratos reales.

Recuperación independiente preparada: 12 pruebas del worker nativo, 14 del
ejecutable default-off y dos más del motor verifican claim, autenticación,
reanudación con GET sobre el ID guardado y retención de envíos inciertos.
Se prepara workflow local desactivado, sin instalación nueva ni claves/configuración
remotas. GitHub no garantiza un horario; falta activación aprobada, comprobación
de lease/CAS remoto, gasto de modelos y recuperación real. 03–04 siguen abiertas.
Véase `CARONTE_BOOK_RECOVERY.md`. No se ha desplegado ni completado el piloto.

Par OAuth de Lulu preparado en el panel privado: solo propietario, autorización
de guardado independiente, AES-GCM, revisión condicional y relectura de UUID y
entorno. Las claves se vacían al enviar y no se muestran en respuestas públicas.
El par del entorno prevalece completo; si está incompleto no mezcla/fallback.
Prueba OAuth separada con persistencia confirmada. La identificación HMAC abarca
las claves enteras y otro par bloquea recibos anteriores, sin reenvío ni migración
automática. Nueve pruebas del store, dieciocho de rutas y cuarenta y seis del panel.
Navegador nativo: consentimiento, campos vacíos, confirmación perdida, consola y
cinco tamaños de pantalla; solo datos ficticios. Falta autorización/destino para
claves reales, runtime/RLS/CAS remoto y reconciliación de rotaciones. No se ha
publicado ni configurado ninguna cuenta; 08–11 siguen abiertas.
Véase `CARONTE_LULU_CREDENTIALS.md`.

Carga de maquetación medida el 12: una prueba independiente reproduce exceso
de medidas con líneas variadas. Corregido antes de seguir con la cola de PDF:
76 % menos caracteres medidos, caché limitada y plan completo idéntico. Tres
mediciones nuevas reducen CPU local mediana de 15 a 6,4 segundos. No basta para
declarar viable una petición Edge de 2 segundos. Pypdf y renders comprueban
el par sintético nuevo, sin sustituir la prueba previa ni usar servicios externos.
Primitivas de bloques medidas y verificadas en local; falta conectarlas a la
cola persistente y comprobar el runtime alojado, o decidir un trabajador adecuado.
07 sigue abierta.
Sin despliegue ni publicación. Véase `CARONTE_PRINT_PERFORMANCE.md`.

Ampliación por etapas: 25 planes capítulo/tamaño, composición, hasta veinte
partes, unión y cubierta. Trece pruebas nuevas comprueban recuperación desde
JSON/bytes, fecha estable, límites y rechazos. Tres parejas sintéticas idénticas
entre procesos, 194 páginas completas, relectura independiente y siete renders
revisados. Pico CPU local inferior a un segundo en 144 etapas; no prueba Edge.
En aquel corte la ruta seguía monolítica. Después se prepararon claim/lease/CAS de imprenta y
archivo privado locales, no se activaron ni verificaron en el servidor remoto.
Ningún pedido, pago, interfaz de demo ni despliegue. Tarea 07 abierta.
Decisión Propuesta y evidencia: `ADR-001_PRINT_STAGES.md`.

Coordinador de imprenta preparado: IDs/versión/fecha reservados una sola vez,
entrada y pasos completos inmutables, lease exclusivo, tres intentos por paso,
checkpoint releído e intención guardada antes del POST sin sobrescritura.
Recupera objeto/DB separados sin otro render/POST/versión. Verifica por separado
los dos binarios y la fila final; nunca declara aptitud para imprimir.
Trece pruebas de motor y siete de archivo privado; prueba integrada con PDF real,
49 instancias/claims, 194 páginas y cubierta. DB/Storage/Lulu siguen siendo límites
sintéticos. Pypdf y ocho renders revisados, no libro auténtico ni entrega.
La migración y las assertions SQL están preparadas pero no ejecutadas/aplicadas.
Consulta viva del 12: PostgreSQL 17.6, cola literaria presente, cola/RPC/columna de
imprenta ausentes. Después se integraron rutas, cliente y disparador locales,
default-off. Panel de cola preparado; falta SQL/activación y worker completo en Edge con
autorización. 07 y objetivo completos siguen abiertos.
Decisión Propuesta: `ADR-002_DURABLE_PRINT_COORDINATOR.md`.

Conexión HTTP preparada después: `generatePdf` reserva/relee el mismo trabajo,
`getPdfStatus` solo consulta y retira recibos privados; `advancePrint` exige
autorización y termina exactamente una etapa. No cae al render monolítico v2.
Cliente con progreso/polling/recarga en superficies existentes, sin HTML/CSS nuevos.
Disparador independiente acotado a 50 peticiones/cuatro minutos, default-off,
recibos estrictos y sin repetir POST incierto. Workflow preparado, no activado.
Diez pruebas de ruta, siete de cliente y ocho de recuperación; los planes/fuentes
reales se conectan con auth original. SQL/proveedores siguen sintéticos, no piloto.
Suite 392/392 sin skips y comprobaciones declaradas pasan. Véase
`CARONTE_PRINT_RECOVERY.md`. 07–11 permanecen abiertos.
Navegador real con API sintética: progreso, recarga y revisión recuperados,
un solo inicio de generación y cero errores/avisos. Sin validación de Lulu ni
entrevista/piloto auténticos. Pestaña/servidor privados cerrados.

Controles privados PDF preparados después: lista paginada, detalle mínimo y
reanudación/cancelación solo bloqueadas y sin lease. Motivo, CAS y decisión
releída; sin confirmación no repite la operación. Reanudar solo recuperaciones
seguras de archivo; conserva la fuente, las etapas completas y las intenciones.
SQL de control/historial preparado, no ejecutado. Once pruebas nuevas, suite
403/403 sin skips, validación/build y navegador nativo pasan. Tres escenarios
sintéticos: reanudar, cancelar y resultado incierto. Una mutación por escenario,
sin proveedores/pedidos/pagos; pestaña/servidor cerrados. HTML/CSS públicos
idénticos a 48157ae. No desplegado; 07–11 y objetivo siguen abiertos.

Perfil completo posterior: tres libros sintéticos, 49 procesos nuevos por libro,
194 páginas y cubierta; el plan y los recibos binarios se conservan. Máximo CPU
de petición 1.762 ms; RSS del proceso de prueba hasta 291 MiB. Incluye VM,
compilador y servidores sintéticos, por lo que no acredita límites Edge. Cada
libro relee unos 223 MiB de JSON sintético. Ningún servicio externo, instalación,
despliegue ni optimización de producción. La herramienta Supabase CLI/entorno
nativo se ha propuesto por separado y sigue pendiente de permiso; la aprobación
de las dependencias PDF no lo sustituye. Véase `CARONTE_PRINT_WORKER_PROFILE.md`.
Relectura independiente de los tres pares: texto íntegro, fuentes incrustadas,
geometría y hashes coincidentes. Suite 406/406 sin skips, diecisiete controles
heredados, validación/build y diff sin incidencias. SQL/Edge siguen pendientes.

Transcripción endurecida después: plazo total de 60 segundos para petición/cuerpo,
cancelación efectiva del reader y errores seguros sin avanzar ni retirar el audio.
UTF-8 inválido y envelope >2 MiB se rechazan sin sustituir o cortar texto. Una
transcripción completa de 200.000 caracteres escapados sigue siendo aceptada.
Nueve tests nuevos del servidor y uno del cliente: 61/61 enfocadas pasan, sin skips.
Prueba HTTP local nativa cancela la conexión incompleta; Blob e ID se conservan
para reintento. Servidor cerrado; sin STT pagado, cambios de voz/UI, instalación,
claves, despliegue o publicación. Aún faltan STT/archivo/DB reales en Edge, lock
durable contra duplicados y entrevista auténtica. La tarea 05 sigue abierta.
Pase final: 416/416 sin skips, diecisiete comprobaciones heredadas, validación,
build y diff sin incidencias. HTML/CSS de Tiresias siguen idénticos a 48157ae.

Contraste remoto posterior de solo lectura: código real de la función v8 aún usa
STT truncado a 12.000 caracteres, generación monolítica con borrador determinista,
objetivo de 35–60 páginas y PDF beta 32–80 con cubierta dentro del interior.
No incluye los nuevos motores/workers. Seis RPC literarios privados presentes;
enqueue/checkpoint/finish coinciden con el SQL local. No acredita su ejecución.
Cola de imprenta ausente. No se leyeron entrevistas, usuarios, claves ni pedidos;
sin escrituras remotas o peticiones pagadas. No hacer aún el piloto con ese flujo.
Sigue pendiente el permiso de CLI/entorno nativo, destino de la clave y despliegue.
Últimos tests locales 416/416, sin repetirlos ni llamarlos verificación remota.

Autorización posterior recibida: CLI 2.120.0 y entorno nativo instalados en una
carpeta privada. Dos baterías SQL pasan en PostgreSQL 17.11, con ROLLBACK; ocho
enqueues y ocho claims simultáneos por cola dan una fila y un ganador. Permisos
reales, fuentes Deno y par sintético de 194 + 1 páginas verificados; sin prueba
del coordinador completo ni CPU alojada. Runtime macOS no aplica timer CPU.
Se detectó/cerró una escucha de funciones en todas las interfaces; la sonda
posterior se limitó a loopback. Todos los procesos/puertos propios cerrados.
No cambios de comportamiento del repositorio, publicación o llamadas pagadas.
No se cuentan estas assertions como más tests Node ni se cierran 03/07–11.
Evidencia: `CARONTE_NATIVE_LOCAL_VERIFICATION.md`. La autorización de la herramienta
local ya no está pendiente; siguen los destinos de claves y despliegue específico.
