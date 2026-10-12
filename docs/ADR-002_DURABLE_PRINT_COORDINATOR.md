# ADR-002: reserva y recuperación del par de impresión

Fecha: 12 de octubre de 2026. Estado: **Propuesto**.
Responsable de aceptación y activación remota: Néstor Guerra.
Preparación: coordinador, archivo privado y migración locales; sin despliegue.

## Contexto

El objetivo sigue siendo el piloto completo: entrevista auténtica, libro del yo
futuro, interior de 180–200 páginas, cubierta separada, revisión y preflight de
Lulu, pedido aprobado, pago manual y entrega. No se añaden controles a Tiresias.

Las primitivas de ADR-001 reducen el trabajo de cada render. No resuelven por sí
solas quién posee un trabajo, qué versión se reserva ni qué ocurre si el objeto
se guarda y el proceso termina antes de confirmar su fila. Una aceptación de
escritura no acredita ni el contenido guardado ni el estado final de la base.

Consulta de solo lectura del 12 de octubre: el proyecto compartido
`ncompany-platform` está `ACTIVE_HEALTHY` y usa PostgreSQL 17.6. Existen sesiones,
manuscritos, PDFs y cola literaria. No existen `future_book_print_jobs` ni el RPC
`caronte_enqueue_print`; tampoco la columna `future_book_pdfs.print_job_id`.
El indicador de proveedor solo devuelve ElevenLabs configurado. Eso no prueba
una entrevista nueva ni que existan credenciales útiles de OpenAI/Lulu.

## Opciones y decisión preparada

1. Generar todo en la petición y reservar una versión al final. Menos estados,
   pero no recupera la separación entre objeto y fila ni evita otra versión.
2. Una transacción abierta durante el render y las llamadas externas. No hace
   transaccional el almacenamiento externo y mantiene locks demasiado tiempo.
3. Reserva SQL corta, claim con lease, pasos privados inmutables y recibos de
   objetos. Más operaciones, pero permite comprobar y recuperar cada frontera.

Se prepara la opción 3. No se activa por la existencia de sus pruebas. No añade
servicios, dependencias, modelos, cuentas ni costes distintos de los aprobados.

## Contrato implementado localmente

- Un RPC reserva ID de trabajo, ID del PDF, versión y fecha. El coordinador nunca
  los vuelve a generar en memoria. La entrada liga manuscrito, revisión, fuente
  completa, plantilla/etapas y configuración de Lulu por hash canónico.
- Solo acepta fuente literaria v2 de cinco capítulos, 45–55 mil palabras,
  manuscrito listo y gate editorial pasado. Rechaza salida determinista,
  proveedor degradado y estados de seguridad/revisión pendientes.
- Cada claim usa un token y lease de 140 segundos. Los pasos completados y su
  entrada no se sustituyen. Un worker cuyo lease perdió vigencia no puede guardar
  una nueva intención ni confirmar el paso de otro worker.
- El intento se cuenta antes de recuperar, renderizar o verificar el cierre.
  Máximo tres por paso; los fallos de lectura también consumen ese presupuesto.
  Un error incierto de DB no inicia otra escritura: deja el estado para consulta
  o un claim posterior. La relectura comprueba paso y propietario del trabajo.
- Antes de enviar bytes se persisten ruta reservada, tamaño y SHA-256 esperados.
  El POST privado usa `x-upsert:false`. Se releen todos los bytes tras el intento,
  incluso si su respuesta se pierde. Solo un 404 concluyente significa ausencia.
  Corrupción o indisponibilidad no autorizan sobrescribir ni borrar.
- Si el objeto ya existe y coincide con la intención, se completa el paso sin
  otro render ni POST. Mantiene exactamente el ID y la versión iniciales.
- Para 194 páginas hay 48 etapas de generación y un claim final adicional:
  **49 claims**, no una cadena de 49 llamadas recursivas. El cierre relee interior
  y cubierta, confirma la fila y la sesión en un RPC, y relee el PDF reservado.
- Un trigger preparado impide que la ruta monolítica antigua use una versión
  reservada por la nueva cola. La vinculación `print_job_id` también exige los
  IDs y ámbito correctos. El caso de borrado privado en cascada requiere prueba
  SQL antes de aceptar esta decisión; no se han borrado datos reales.
- `ready_for_print=false` en todos los archivos/fila generados. El coordinador
  no autoriza revisión humana, preflight, dirección, presupuesto, pedido o pago.
  La frontera HTTP futura deberá autenticar y retirar recibos privados del PDF.

La migración prepara RLS, privilegios solo de servicio, `SKIP LOCKED`, control
condicional de fuente/lease y funciones con `search_path` restringido. Se consultó
la documentación de la versión real: [locks de PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html)
y [seguridad de funciones](https://www.postgresql.org/docs/17/sql-createfunction.html).
Leer el contrato no acredita su ejecución ni su concurrencia real.

## Evidencia y límites

Actualización posterior autorizada del 12 de octubre: migraciones y las dos
baterías SQL ejecutadas con éxito en PostgreSQL nativo 17.11, solo en la base
desechable. Ocho enqueues/claims simultáneos por cola conservan una fila/un lease;
permisos y cascadas privados comprobados. Primitivas PDF en Deno nativo generan
el par sintético, pero no el coordinador completo DB/Storage/Deno ni los límites
alojados. Procesos detenidos; sin activación remota. Evidencia y límites:
[verificación nativa local](CARONTE_NATIVE_LOCAL_VERIFICATION.md).

Se reprodujeron antes de corregir: reintento sin límite en recuperación/cierre,
confirmación de PDF con hash de cubierta incorrecto, aceptación de checkpoint
sin relectura y exposición de detalles de transporte privado. Las pruebas
comprueban pérdida de respuesta, objeto/DB separados, concurrencia de lease,
worker antiguo, configuración rotada y bloqueo sin sobrescritura.

Una integración usa el coordinador y el generador/fontkit/fuentes reales. Un
worker nuevo se construye para cada claim. Se interrumpe después del primer
fragmento privado y antes de su confirmación DB; otro worker recupera el objeto
sin repetir el POST. Genera y reabre un interior de **194 páginas** y una cubierta.
Son 22 objetos binarios: veinte partes y el par final. DB, Storage y dimensiones
de Lulu son fronteras sintéticas. Reconstruir una instancia no simula reiniciar
un proceso del sistema operativo ni acredita durabilidad remota.

Prueba privada: `/tmp/caronte-print-engine-proof.swtJV4`. pypdf comprueba geometría,
hashes, todas las fuentes incrustadas y los 295.284 caracteres extraídos en orden.
Ocho renders inspeccionados: páginas 1/2/3/5/6/193/194 y cubierta. Sin defectos
observados en esas imágenes; no es revisión visual de las 194 páginas ni libro
auténtico. La fuente y el informe indican que se trata de una fixture sintética.

Suite declarada: **367/367 sin skips**, diecisiete comprobaciones heredadas,
validación, build y diff sin incidencias. HTML/CSS originales idénticos a 48157ae.
Las assertions SQL privadas están preparadas, **no ejecutadas** ni contadas en
esas 367 pruebas. No hay PostgreSQL/Deno locales para probarlas aquí.

Los picos CPU/RSS de ADR-001 miden primitivas en Node, no este coordinador con
JSON/RPC/relecturas ni el runtime Edge. Después se midieron tres recorridos del
trabajador HTTP completo con 49 procesos nuevos por libro: pico de CPU de petición
1.762 ms y RSS total hasta 291 MiB. La instrumentación incluye VM/compilador y
servidores sintéticos locales: no equivale a CPU/memoria Edge. Método, cifras y
límites: [perfil del trabajador completo](CARONTE_PRINT_WORKER_PROFILE.md).
Las pruebas sintéticas no certifican el scheduler SQL, RLS, trigger, aislamiento
de transacciones, empaquetado Deno ni límites del servidor alojado.

## Consecuencias y acciones pendientes

- Se conservan fuente completa y progreso privado: aumenta almacenamiento y
  operaciones. Hay que incluirlos en la política autorizada de retención.
- Un estado bloqueado no se reanuda sin decisión/acción explícita. Se conectaron
  después detalle, lista y controles del panel privado con CAS y relectura de
  decisión. SQL/historial preparados, no ejecutados; recibos completados intactos.
- Se conectaron después `generatePdf`/`getPdfStatus`, worker y consultas del cliente
  en el código local, con gate default-off. La ruta v2 ya no cae al render
  monolítico, pero el servidor publicado no se ha actualizado. Contrato/evidencia:
  [recuperación de imprenta](CARONTE_PRINT_RECOVERY.md).
- Se preparó un disparador independiente default-off; no depende del navegador ni
  encadena 49 peticiones dentro de Edge. Aún no activo ni con horario/SLA probado.
- Probar la migración y assertions en PostgreSQL autorizado y luego concurrencia,
  pérdida objeto/DB, privilegios y cascada privados. Aplicar al proyecto compartido
  exige aprobación de despliegue y una vía de recuperación preparada.
- Verificar fuentes/empaquetado/CPU/memoria en Deno/Edge con libro auténtico, o
  elevar una decisión concreta de runtime/coste. No activar solo por tests Node.
- Credenciales, entrevista completa, calidad literaria, preflight de Lulu y
  aprobación exacta de gasto/destino siguen pendientes. Solo la entrega real
  permite cerrar el objetivo. Tarea 07 continúa abierta.

No hubo commit, push, publicación, migración remota, guardado de claves, llamada
pagada a modelo/Lulu, pedido, pago ni cambio de configuración en este corte.
