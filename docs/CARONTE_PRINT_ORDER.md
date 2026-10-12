# Pedido privado de impresión

Corte local del 12 de octubre de 2026. Preparado y probado localmente, no desplegado.
No hay pedido, pago, impresión o entrega reales acreditados. La experiencia pública
mantiene su HTML y CSS originales; los controles nuevos pertenecen al back office.

## Autoridad y pago manual

Solo operaciones/owner y los accesos administrativos heredados pueden aprobar,
enviar, consultar o conciliar pedidos. Editor, viewer y support están excluidos
antes de leer datos privados o llamar a proveedores.

La aprobación exige presupuesto vigente, par exacto revisado y normalizado,
dirección confirmada, una copia, envío, moneda e importe exactos. Se guarda el
operador real y una confirmación separada de que ha comprobado que Lulu no tiene
pago automático activado. Esta declaración humana NO demuestra la configuración
de la cuenta. La API usada no ofrece una comprobación automática de ese ajuste.

`FUTURE_BOOK_LULU_ORDERS_ENABLED` está desactivado por defecto. No se ha activado
en ningún entorno. Solo debe habilitarse después de verificar la cuenta y aprobar
el piloto concreto. Lulu puede cobrar automáticamente al crear un pedido si la
cuenta tiene autopay; no basta con que Caronte carezca de una operación de pago.

Referencia oficial consultada el 12 de octubre:
[Pago automático de Lulu](https://help.api.lulu.com/en/support/solutions/articles/64000293838-how-do-i-set-up-automatic-payment-fulfillment-for-my-api-orders-).
Contrato: [OpenAPI oficial](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml).

## Recorrido y recibos

1. Consultar y aprobar el presupuesto del flujo `CARONTE_PRINT_QUOTE.md`.
2. Escribir el importe y confirmar autorización de pedido y modo manual.
   Guardar/releer la aprobación no envía nada a Lulu.
3. Pulsar envío explícito. El servidor descifra y comprueba el destino, relee
   todos los bytes de ambos PDF privados y firma las mismas rutas durante una hora.
4. Recalcular con Lulu. Dirección, advertencias, moneda y cada componente de
   coste deben coincidir con lo aprobado. Un cambio invalida la aprobación.
5. Reservar mediante escritura condicional un intento estable por PDF/entorno,
   releerlo y comprobar que sigue vigente ANTES de crear el pedido.
6. Crear una sola copia y conservar el identificador recibido. La creación no
   demuestra pago ni permite pagar hasta obtener un recibo completo comprobado.
7. Consultar pedido y costes en Lulu. Comprobar identidad, referencia, destinatario,
   título, cantidad, envío, SKU, fuentes firmadas, páginas físicas, costes y estado.
8. Solo un `UNPAID` confirmado hace menos de dos minutos y con aprobación vigente
   ofrece el portal manual del entorno correcto. Abrirlo no confirma ningún pago.
9. Releer tras pagar. `PAYMENT_IN_PROGRESS` sigue sin confirmar; estados posteriores
   de producción/envío confirman pago. `SHIPPED` no acredita entrega. Solo
   `DELIVERED` verificado con referencia y URL de tracking acredita la entrega
   declarada por el proveedor, no la recepción personal de Néstor.

El cálculo previo no impone un techo de precio atómico en la creación de Lulu.
Puede cambiar entre ambos pasos. Los costes del pedido deben coincidir antes de
ofrecer el portal; sin pago automático no se paga silenciosamente la diferencia.
Las reglas de la cuenta y el precio real siguen pendientes de comprobación humana.

## Pérdida de respuesta y privacidad

La referencia `caronte:<entorno>:<pdfId>` NO convierte `external_id` en una garantía
de idempotencia de Lulu. La reserva DB precede al POST. Pérdida de respuesta o
persistencia interrumpida retiene el intento: no hay reenvío automático.

La conciliación solo consulta, con un máximo de diez páginas y 60 segundos. Exige
una búsqueda completa y un único resultado exacto. Cero resultados, varios o un
límite de paginación alcanzado no autorizan un nuevo pedido. Tras conciliar aún
hay que comprobar PDF/destino/costes antes de pagar. Crear otro par/versionado no
es una recuperación automática permitida de un envío incierto.

La dirección sigue cifrada. `metadata.print_order` guarda el presupuesto vinculado,
la aprobación, hashes de URLs, intento y recibos. No contiene la dirección ni
las URLs firmadas en claro. Las salidas generales de PDF retiran este campo:
solo publican `hasIntent` y si se permite volver a presupuestar. El estado/costes
detallados requieren las rutas privadas. Auditoría mínima: ID/estado/ID Lulu.

Una consulta fallida no conserva la etiqueta de recibo verificado ni el enlace de
pago. Se conserva una marca histórica de pago confirmado: cancelaciones o estados
contradictorios posteriores nunca reabren automáticamente una segunda oportunidad
de pago. No se aceptan lecturas futuras ni estados más antiguos que el último recibo.

Servicio: `_shared/caronte-print-order.mjs`. Rutas: `adminPrintOrder`,
`adminApprovePrintOrder`, `adminSubmitPrintOrder`, `adminSyncPrintOrder` y
`adminReconcilePrintOrder`. La interfaz relee antes y después de las mutaciones,
bloquea concurrencia y no transforma la aceptación en éxito confirmado.

## Evidencia local y pendiente real

13 pruebas del servicio, 5 de pedido/recuperación en la ruta real y 8 nuevas del panel. Cubren
consentimientos, gasto/destino exactos, permisos, caducidad, concurrencia, archivo,
precio cambiado, reserva perdida, conciliación, lecturas incorrectas, pago en
curso, cancelación/regresión de pago y distinción envío/entrega.

Revisión adicional del mismo día: la fixture inicial de la ruta sustituía las
constantes de `service.ts` por funciones y devolvía columnas no pedidas por SELECT.
Eso ocultaba dos fallos: constructor de acceso a archivos incompatible y pérdida
de la marca del pedido/aptitud al recargar listados. La prueba ahora carga el
contrato real de `service.ts` y respeta la proyección de columnas; ambos fallos se
reprodujeron antes de corregirlos. Dashboard y detalle recuperan la marca sin
exponer el recibo privado ni la dirección. El pase inicial y la fixture de navegador
no demostraban esta integración; la corrección sigue siendo local, no un despliegue.

La fixture `scripts/serve-print-admin-proof.mjs` usa el HTML/CSS/JS reales del
panel y sustituye únicamente las fronteras externas. `?scenario=quote` permite
aprobar, enviar una vez y consultar estados ficticios; `?scenario=order_uncertain`
permite conciliar sin crear otro pedido. No lee claves, llama a Lulu ni está
incluida en `src`/`dist`. El importe 17,36 EUR es sintético, no comercial.

Prueba nativa del 12 de octubre: una aprobación, un envío, tres consultas del
proveedor ficticio y una conciliación en el escenario incierto. Recarga conserva
el acceso al registro; sin errores/avisos de consola. No se abrió portal ni tracking.
Evidencia privada `caronte-print-order-20261012.jpg`, en las visualizaciones del
chat, identificada como prueba local. Cerrar pestaña y servidor al terminar.

Pendiente: libro auténtico, revisión íntegra, cuenta y credenciales Lulu,
dirección y precio autorizados, runtime Edge, CAS remoto, acceso/normalización
remotos de PDF, aprobación de despliegue, cuenta sin autopay comprobada, pedido
real, pago manual confirmado, seguimiento y recepción física. No cerrar el piloto
por los resultados sintéticos ni sustituir estos permisos por una continuación.
