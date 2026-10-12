# Flujo de imprenta por etapas: contrato y activación pendiente

12 de octubre de 2026. Implementado y probado localmente. **No desplegado**.
Objetivo completo y tareas 07–11 abiertos. No se han creado pedidos ni pagos.

## Contrato HTTP existente, ampliado sin cambiar la página

La función sigue siendo `future-book-session`. HTML/CSS de Tiresias idénticos a
48157ae; no hay controles de cargar demo, muestra de voz ni generadores nuevos.

| Acción | Entrada y autorización | Respuesta |
| --- | --- | --- |
| `generatePdf` | `sessionId` + `publicToken`, fuente literaria aprobada y gate de activación. | `{ok,session,job,pdf}`; reserva una vez. Mientras procesa, `pdf=null`. |
| `getPdfStatus` | Las mismas credenciales de sesión. Solo lectura; no renderiza ni reencola. | Progreso privado mínimo y, al terminar, el par confirmado mediante `publicPdf`. |
| `advancePrint` | Bearer de servicio exacto o autorización del monitor/operador existente. `jobId` UUID opcional, nunca un manifiesto del cliente. | Una sola etapa síncrona: `idle`, `queued`, `blocked` o `ready` con sus IDs aplicables. |
| `adminPrintJobs` / `adminPrintJob` | Administrador con permiso de lectura. Lista paginada `limit=1..100`, `offset=0..10000`, o UUID del trabajo. | Estado, versión, etapas y hashes mínimos; sin fuente ni outputs. |
| `adminResumePrint` / `adminCancelPrint` | Operaciones/propietario, UUID, `expectedRevision` y motivo de 8–1000 caracteres. | Detalle releído y decisión exacta confirmada, o error seguro. |

Se añade `job`; no se cambian tipos ni campos existentes del PDF. El estado público
no incluye fuente completa, outputs de pasos, secretos, tag de credenciales,
presupuesto/dirección cifrados ni recibos privados del pedido. Un PDF `ready` en
la cola **no** significa `ready_for_print`: esta última marca sigue falsa.
Un error del almacenamiento o proveedor no se publica como detalle biográfico.

`CARONTE_PRINT_QUEUE_ENABLED=false` por defecto. La fuente literaria v2 no vuelve
al render monolítico cuando el gate está apagado: devuelve `print_queue_disabled`.
La ruta antigua permanece para manuscritos históricos, no para el libro v2 del
piloto. La prueba antigua del helper monolítico se conserva y se identifica como
histórica; no acredita la nueva ruta HTTP. La nueva prueba carga servicio, auth,
CORS, ruta, coordinador, fuentes y etapas reales con un límite DB/HTTP sintético.

La migración preparada reserva también el estado `pdf_generating` de la sesión.
Una repetición legítima puede consultar/reutilizar ese trabajo sin otra versión.
El cierre SQL preparado confirma el par y pasa la sesión a `pending_review`.
Ni este SQL ni su assertion de estado se han ejecutado todavía en PostgreSQL.

## Cliente

El botón original llama una vez a `generatePdf`. Presenta etapa y progreso en
las superficies existentes. Después consulta `getPdfStatus` cada diez segundos.
Si una consulta falla, espera veinte segundos y vuelve a leer: nunca llama a
`generatePdf` ni a `advancePrint` desde ese reintento.

Recargar una sesión `pdf_generating` recupera el libro y el trabajo de impresión.
Un trabajo bloqueado/cancelado deja de consultarse y no ofrece una finalización
vacía. Un recibo de otra sesión o una respuesta tardía no sustituye la sesión
activa. La consulta del cliente solo observa el avance; cerrar la web no debe
ser el mecanismo que lo detenga. La autonomía remota exige activar y verificar
el disparador siguiente, no se deduce de estas pruebas del navegador.

## Disparador independiente preparado

`scripts/wake-caronte-print-queue.mjs` inicia peticiones HTTP de nivel superior,
no self-wakes recursivos de Edge. Cada una usa la autenticación del monitor y
solo `{action:'advancePrint'}`. El claim SQL seleccionará trabajo elegible.

- Apagado por defecto; ni siquiera lee el secreto cuando no está activado.
- HTTPS del mismo proyecto Supabase, sin credenciales en URL, redirects ni tokens
  de servicio/proveedor. Nunca recibe fuente, dirección o PDF del cliente.
- Máximo 50 peticiones por ejecución (límite programático permitido: 60), plazo
  de cuatro minutos para el lote y hasta dos minutos por petición/cuerpo, acotados
  al tiempo restante. Con un único trabajo elegible de 194 páginas, 48 etapas
  de generación, un cierre y una consulta `idle`. Varias sesiones se reparten
  los claims: no se garantiza terminar un libro por cada lote.
- `idle` solo significa que ese claim no encontró trabajo elegible. No demuestra
  que toda la cola esté vacía: pueden existir leases vigentes o reintentos futuros.
- `bounded` conserva el trabajo para otra ejecución. Un bloqueo detiene el lote.
  Un error/timeout incierto nunca repite ese POST dentro de la misma ejecución.
  La siguiente ejecución depende del estado/lease guardado, no de un ID nuevo.
- Rechaza recibos incompletos, IDs incorrectos, campos desconocidos, aceptación
  sin ejecución y errores privados. Logs: estado/cuentas/diagnóstico seguro, sin
  datos del libro, credenciales o respuesta remota íntegra.
- Todas las salidas incluyen `completionVerified:false`: ni una etapa ni un par
  generado acreditan revisión, normalización Lulu, pedido, pago o entrega.

Workflow preparado `.github/workflows/caronte-print-recovery.yml`: horario de
diez minutos y ejecución manual, ambos sujetos al gate y rama predeterminada.
Solo permiso de lectura del repositorio, entorno operativo existente y Node 24.
No instala dependencias, despliega ni recibe claves de proveedores/servicio.
GitHub Actions no garantiza puntualidad ni SLA; requiere verificación y decisión
operativa antes de anunciar una startup autónoma. No se ha activado ni ejecutado.

## Intervenciones en el panel privado

La lista distingue cola no disponible de cola vacía. El detalle muestra pasos,
intentos y huellas, no texto biográfico ni bytes. La paginación no inventa un
recuento total ni constituye una instantánea estable de toda la cola.

Solo un trabajo bloqueado, sin lease ni operación en curso, admite intervención.
Reanudar requiere un único paso fallido con `print_archive_timeout` o
`print_archive_unverified`. No permite eludir fuente cambiada, corrupción,
configuración de Lulu cambiada, gates ni errores desconocidos. La nueva función
SQL preparada relee también el manuscrito aprobado y su revisión/fuente exactas.

La misma transacción preparada conserva los pasos completados y las intenciones
de objetos. Solo reinicia el presupuesto del paso fallido, conservando su historial,
hash/recibo y motivo/operador en `control_history`. Cancela sin borrar datos y sin
modificar pedidos o pagos de Lulu. La reanudación no dispara una cadena recursiva:
el disparador independiente tendrá que estar autorizado y activo.

CAS sobre `updated_at`; la decisión guardada liga acción y revisión anterior.
La ruta y el navegador releen esa decisión tras el intento, incluso con respuesta
perdida. Sin coincidencia exacta no muestran éxito ni repiten el POST. El panel
exige una consulta explícita antes de otra decisión y bloquea clics concurrentes.
El historial SQL aún no está ejecutado ni integrado en el listado global de auditoría.

## Evidencia local

- RED antes del cambio: acción de worker inexistente, render v2 no gated, consulta
  sin progreso, cliente sin polling/recovery y ejecutable ausente.
- Diez pruebas de ruta: autentican con implementaciones originales, reservan la
  misma identidad, procesan dos planes reales mediante peticiones independientes,
  retiran recibos privados y rechazan un par alterado. Una une el ejecutable a la
  ruta/coordinador reales; DB, Storage y proveedor siguen siendo fronteras falsas.
- Siete pruebas del cliente: progreso, solo lecturas, fallo transitorio, estados
  terminales, identidad y recarga sin reencolar. Ocho pruebas del disparador:
  un par de 49 etapas, límites, HTTP/cuerpo inciertos, recibos y CLI real default-off.
- Suite completa tras los controles privados: **403/403 sin skips**, diecisiete comprobaciones heredadas,
  validación y build pasan. Se conserva la integración de PDF real de ADR-002.
- Fixture privada de navegador: `scripts/serve-print-client-proof.mjs`. Sirve
  módulos/HTML/CSS originales con una configuración y API sintéticas; solo el
  título de la pestaña identifica la prueba. No está en `src` ni en `dist`.
- Navegador nativo: botón original → progreso con generación deshabilitada →
  recarga → `pending_review`, 194 páginas y `lulu_ready=false`. Observaciones
  releídas en el servidor de la fixture: una única petición `generatePdf`, tres
  consultas de avance y ninguna llamada a `advancePrint` desde el cliente.
  Cero errores/avisos de consola antes/después. Título/libro claramente sintéticos;
  esta prueba no valida un PDF, SQL ni proveedor reales. Pestaña/servidor cerrados.
- Capturas privadas revisadas: `caronte-print-queue-20261012.png` y
  `caronte-print-recovered-20261012.png`, en la carpeta de visualizaciones de este
  chat. La segunda muestra el estado final de revisión, no impresión ni entrega.
- Workflow parseado con el YAML incorporado de Ruby: gate, permisos de lectura,
  tres pasos y timeout de diez minutos verificados. PyYAML no estaba disponible;
  no se instaló. Parsear el archivo no demuestra una ejecución de GitHub Actions.
- Once pruebas nuevas de administración: roles, privacidad, revisión condicional,
  estados activos/errores inseguros, pérdida de aceptación, falta de confirmación,
  selección distinta y concurrencia del cliente. El SQL sigue preparado, no ejecutado.
- Navegador nativo con `serve-print-admin-proof.mjs`: reanudar, cancelar y resultado
  no confirmado. Una sola mutación por escenario; etapa completada conservada;
  estado incierto mantiene ambos botones deshabilitados. Cero errores/avisos.
  Límites de API sintéticos, sin fuente del cliente, proveedor, pedido ni pago.
  Capturas `caronte-print-admin-resume-20261012.png` y
  `caronte-print-admin-unconfirmed-20261012.png`; pestaña/servidor cerrados.
- Perfil completo posterior: 147 procesos nuevos del sistema operativo, tres
  pares sintéticos íntegros y 406/406 tests declarados sin skips. Pico CPU local
  de petición 1.762 ms; RSS total hasta 291 MiB. Incluye VM, compilador y servidor
  REST sintético: no acredita la memoria/CPU Edge. Volumen de relecturas, método,
  pruebas independientes y permiso separado del entorno nativo:
  [perfil del trabajador](CARONTE_PRINT_WORKER_PROFILE.md).

## Antes de activar

1. Aprobar y probar/aplicar la migración en el proyecto compartido. Comprobar
   SQL/RLS, claim/lease/CAS, trigger de reservas y cascada privada de ADR-002.
2. Verificar empaquetado de fuentes y CPU/memoria del **worker completo** en
   Deno/Edge, incluidos JSON, RPC y relecturas. Node no prueba esos límites.
3. Probar los controles administrativos preparados contra SQL real: CAS, historial,
   conservación de recibos, permisos, reanudación segura y cancelación sin borrado.
4. Configuración Lulu real, prueba OAuth y dimensiones auténticas. Después,
   entrevista/libro completos, revisión humana y preflight de ambos PDFs.
5. Despliegue/gates/scheduler autorizados y recuperación alojada con fallo forzado.
   Aprobación de presupuesto/dirección exactos y cuenta sin autopay antes del pedido.
   Pago manual confirmado, tracking y recepción: solo entonces cerrar el piloto.

No hubo commit/push, publicación, SQL remoto, activación de scheduler, guardado de
claves, llamadas pagadas, pedidos, pagos ni cambios de permisos en este corte.
