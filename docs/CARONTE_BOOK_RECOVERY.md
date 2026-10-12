# Recuperación de la escritura

Corte del 12 de octubre de 2026. Publicado, desplegado y activado con autorización
humana específica. Ejecución GitHub 38253812749 completada: el aviso fue aceptado y
el servidor avanzó la revisión del trabajo privado existente. No acredita todavía
un libro completo ni su calidad literaria.

## Problema y recorrido

La cola conserva el trabajo y el identificador del proveedor. El aviso inmediato
`queueBookWake` usa correctamente la URL y la credencial constantes de `service.ts`.
Si falla su transporte, termina con un diagnóstico seguro y no vuelve a intentarlo.
El monitor existente cada treinta minutos no avanza la escritura.

Se prepara un respaldo independiente en `.github/workflows/caronte-book-recovery.yml`.
Su único ejecutable es `scripts/wake-caronte-book-queue.mjs`, sin dependencias nuevas.
Envía una petición `advanceBook` sin `jobId`: el RPC del servidor reclama un trabajo
elegible, no crea otro libro. La selección, lease, fecha de ejecución y bloqueo
de envíos inciertos siguen bajo el contrato de la base de datos y el motor.

Un proceso nuevo que encuentra un ID OpenAI guardado consulta ese ID mediante GET.
No repite el POST para escribir el mismo paso. Sin recibo, el envío incierto queda
bloqueado; el respaldo no lo reanuda, concilia, cancela ni borra automáticamente.
Si el aviso inmediato siguiente se pierde, otra ejecución independiente vuelve
a poder reclamar trabajo elegible. Un lease vigente o una fecha futura no se saltan.

## Activación explícita y sin credenciales publicadas

El trabajo de GitHub exige la variable de repositorio
`CARONTE_BOOK_RECOVERY_ENABLED == 'true'` y la rama predeterminada, también en
ejecuciones manuales. El ejecutable repite el control: sin ese valor exacto no
lee el secreto ni hace una petición. Tras la autorización se verificó `true`.

Entorno operativo preparado: `caronte-book-operations`. El paso recibe solo
`SUPABASE_URL`, `FUNCTIONS_BASE_URL`, el interruptor y
`CARONTE_BOOK_WORKER_SECRET` exclusivo. No recibe claves de modelos, Lulu ni la clave
service-role ni el secreto de imprenta/monitor. La huella SHA256 de Supabase coincide
con la copia privada; el secreto cifrado de GitHub y su ejecución real se verificaron.
El workflow no es CI de pruebas con credenciales de producción, ni despliegue.

El destino debe ser el endpoint estándar HTTPS del mismo proyecto Supabase.
Se rechazan otros orígenes, rutas, puertos no estándar, usuarios y query/hash.
No se siguen redirecciones. El plazo de quince segundos cubre transporte y lectura
del recibo. Cada ejecución hace como máximo una petición, sin retry de POST.
La cancelación HTTP o la pérdida de respuesta no deshacen un trabajo aceptado:
la siguiente recuperación queda gobernada por el lease/recibo remoto.

Los logs solo registran evento, estado, código seguro y
`completionVerified:false`. No imprimen secretos, URLs, entrevista ni respuesta
cruda. Un error termina el ejecutable con código no cero.

## Aceptado no es completado

`{ok:true, accepted:true, jobId:null}` solo demuestra aceptación HTTP del servidor.
El trabajo de Edge puede fallar después. No se etiqueta como libro terminado ni
como salud operativa verificada. Un recibo contradictorio o estado desconocido
se rechaza. `idle` tampoco demuestra una entrega o una generación completa.
Hay que releer progreso, recibos y errores desde el back office/base de datos.

La programación nominal es cada diez minutos fuera del comienzo de la hora.
GitHub documenta retrasos y posibles descartes por carga; solo ejecuta la
programación en la rama predeterminada. No es un SLA de diez minutos ni sustituye
un scheduler con garantías para producción. Fuente primaria consultada el 12:
[Eventos programados de GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Verificación y siguiente decisión

- Doce pruebas de la ruta real cargan `service.ts`, autenticación, CORS, el endpoint
  y el motor. Solo transporte, entorno y lifecycle Edge son sintéticos. Comprueban
  autorización, UUID, claim, aviso, fallo y no exposición de diagnósticos privados.
  Dos conectan el ejecutable nuevo al endpoint nativo: auth real, respuesta HTTP y
  selección sin ID; un secreto incorrecto no llega a reclamar trabajo.
- Catorce pruebas del ejecutable comprueban estado desactivado, destino/credencial,
  una sola petición, recibos exactos, plazos, errores/logs y contrato del workflow.
  El proceso real también se ejecuta desactivado. La sintaxis YAML se parsea localmente.
  Estas pruebas no ejecutan GitHub Actions ni certifican su evaluación remota.
- Dos pruebas adicionales del motor simulan almacenamiento durable y tiempo:
  sustituyen al worker tras perder un aviso; recuperan el mismo ID con un GET, y
  no reactivan un envío incierto. No prueban el lock SQL, reloj o lease de Supabase real.

Antes de activar: aprobación de publicación/despliegue y del uso recurrente de
modelos, credenciales/destino de almacenamiento confirmados, migración/lease/RLS
remotos comprobados, prueba real de interrupción y recuperación, revisión de logs
y presupuesto del piloto. Activar puede continuar llamadas de modelo de pago.
Este corte no autoriza ese gasto ni añade un límite financiero global al motor.

La activación posterior sí recibió autorización expresa para avanzar libros ya
puestos en cola, incluido su consumo de Sol y Opus. No autoriza nuevos pedidos ni
pagos. La clave real fue rechazada al intentar rutas de administración/imprenta.
Una recuperación técnica separada, exclusiva de operador, consumió una aprobación
para repetir solo la primera revisión truncada de Opus (6000 a 16000 tokens).
Conserva el recibo anterior completo y su consumo, exige el mismo hash de texto,
es idempotente tras perder un acuse y rechaza incertidumbre/refusal/segunda repetición.
El trabajador no tiene acceso a esa operación. La revisión repetida terminó y
exigió una reescritura: no se rebajó el criterio editorial para aprobar el texto.

Una tercera unidad detectó `review_evidence_mismatch`. El recibo y consumo se
conservaron, pero la respuesta rechazada antigua no se guardó: su cita no puede
reconstruirse. El corte posterior conserva futuros objetos rechazados en el
diagnóstico privado y terminal, no como salida aprobada. Una reanudación accidental
no consulta ni repite esa generación. La pérdida y el arreglo se reproducen con
el validador literario real y dos nuevas pruebas RED→GREEN; el transporte es sintético.
La persistencia se comprobó también en PostgreSQL nativo y alojado con ROLLBACK.

La aprobación específica `call_e195f69bd1444c19aa15a9da4cdc9775` permite repetir
solo esa tercera revisión con el mismo texto y máximo 16000 tokens. La nueva RPC
de operador `caronte_retry_rejected_review` conserva el recibo entero antes de
limpiar el handle, exige identidad/hash/consumo/estado históricos exactos y rechaza
incertidumbre, otro intento u otra aprobación. Repetir el mismo acuse no reinicia
una petición en marcha. Ni el navegador ni el trabajador tienen acceso a esa RPC.
Una autorización no convierte una respuesta en aprobación literaria.

La recuperación se detiene desactivando su variable. Eso no cancela una petición
ya aceptada ni los avisos que ya funcionan en Edge. No modificar o cancelar trabajos
automáticamente como sustituto de una decisión de operación.
