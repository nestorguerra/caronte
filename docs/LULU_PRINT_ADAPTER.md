# Adaptador Lulu para el piloto

`supabase/functions/_shared/lulu-print.mjs` es un cliente de servidor sin base de
datos ni efectos al importarlo. Requiere Node 24 o un runtime con soporte del
contexto `source` de `JSON.parse` para preservar importes numéricos exactos.

```js
import { createLuluPrintClient } from './lulu-print.mjs';

const lulu = createLuluPrintClient({
  environment: 'sandbox', // production debe elegirse expresamente
  clientKey,
  clientSecret,
  timeoutMs: 15000
});
await lulu.authenticate(); // { environment, expiresAt }; no devuelve el token
```

`fetch`, `now` y `sleep` son inyectables. Las credenciales y el token quedan en el
cierre del cliente. Los errores no contienen cuerpo de petición, respuesta del
proveedor, URL firmada, credenciales ni token. No se escribe en logs.

## Contrato de métodos

Los payloads conservan los nombres oficiales de Lulu; los IDs son enteros positivos.
Las respuestas conservan los campos del proveedor. Los importes numéricos en campos
de coste, precio, impuesto, importe o descuento se devuelven como cadenas exactas.
No se convierten a `Number` para hacer aritmética. La moneda de la respuesta de
presupuesto es autoritativa; pedir opciones de envío en EUR no cambia la moneda
configurada de la cuenta Lulu.

| Método | Entrada |
|---|---|
| `validateInterior` | `{ source_url, pod_package_id }` |
| `getInteriorValidation` | `id` |
| `waitForInteriorValidation` | `id, { timeoutMs, pollIntervalMs, requireNormalized }` |
| `calculateCoverDimensions` | `{ pod_package_id, interior_page_count, unit: 'pt'|'mm'|'inch' }` |
| `validateCover` | `{ source_url, pod_package_id, interior_page_count }` |
| `getCoverValidation` | `id` |
| `waitForCoverValidation` | `id, { timeoutMs, pollIntervalMs }` |
| `shippingOptions` | `{ currency, line_items: [{ page_count, quantity, pod_package_id }], shipping_address: { country, ... } }` |
| `quote` | `{ line_items, shipping_address: { country_code, ... }, shipping_option }` |
| `createPrintJob` | `{ external_id, contact_email, line_items, shipping_address, shipping_level, production_delay }` |
| `getPrintJob`, `getPrintJobStatus`, `getPrintJobCosts` | `id` |
| `reconcilePrintJob` | `externalId, { maxPages: 10, pageSize: 100, timeoutMs: 60000 }` |

Cada línea de pedido requiere `title`, `quantity` y `printable_normalization` con
`pod_package_id`, `interior: { source_url }` y `cover: { source_url }`.
`external_id` de línea es opcional. El del pedido es obligatorio para facilitar
reconciliación, pero **Lulu no garantiza idempotencia por external_id**.

La dirección completa de presupuesto y pedido requiere `name`, `street1`, `city`,
`postcode`, `country_code`, `phone_number`, `email`. Presupuesto, envío y pedido
exigen provincia en los países enumerados por Lulu (incluida España); el pedido
exige `recipient_tax_id` en BR/CL/MX. Lulu valida las reglas restantes.
La entrada canónica de opciones admite `state_code`; el adaptador la convierte
a `state` en `/shipping-options/`, según OpenAPI reverificado el 11 de octubre.
Presupuesto y pedido conservan `state_code`. El servicio y panel de presupuesto
se describen en `CARONTE_PRINT_QUOTE.md`; no crean pedidos ni realizan pagos.
Los PDFs deben estar en HTTPS, sin credenciales URL ni fragmento. Pueden utilizar
URLs firmadas: su vigencia debe cubrir la descarga/normalización del proveedor.
Solo se admiten SKU con el formato actual de seis grupos separados por puntos.

La espera de preflight exige `NORMALIZED` por defecto; `ERROR` termina devolviendo
el fallo real para guardarlo. Solo el interior permite `requireNormalized:false`
para aceptar `VALIDATED` (validación básica, insuficiente para autorizar impresión).
`validation_pending` significa que debe volver a consultarse el mismo ID; no se
debe crear otra validación automáticamente.

Reverificado el 11 de octubre: la introducción OpenAPI documenta también
`NORMALIZING`/`NORMALIZED` para interiores con SKU, aunque el enum reducido de
algunas respuestas solo enumera validación básica. La cubierta solo admite null,
`NORMALIZING`, `NORMALIZED` y `ERROR`. Las consultas verifican el ID solicitado.
Perder la respuesta al crear una validación también es un envío incierto, no un
reintento seguro. El servicio durable se describe en `CARONTE_PRINT_PREFLIGHT.md`.

## Fallos y envío

`LuluPrintError` expone `code`, `operation`, `httpStatus`, `field`, `reason`, `retryable`,
`uncertain` y `reconciliationRequired`. No realiza reintentos automáticos.
`retryable` solo orienta operaciones seguras. Tras enviar un pedido, un timeout,
fallo de red, HTTP 408/5xx o respuesta de éxito ilegible/incompleta produce
`submission_uncertain`, `uncertain:true`, `reconciliationRequired:true` y
`retryable:false`. El servicio debe persistir ese estado y reconciliarlo antes de
permitir otro POST. Un fallo de OAuth anterior al envío no marca pedido incierto.

## Reconciliación de un pedido incierto

`reconcilePrintJob(externalId, options)` solo consulta `/print-jobs/` usando
`search`, `ordering=id`, `page` y `page_size`. La búsqueda del proveedor cruza
varios campos; el cliente acepta únicamente `job.external_id === externalId`,
con comparación sensible a mayúsculas y sin recortar o transformar la referencia.
Rechaza referencias de entrada con espacios exteriores.

| `outcome` | Evidencia y siguiente acción |
|---|---|
| `matched` | Una coincidencia exacta tras completar la búsqueda. Devuelve `printJob`; verificar artefactos/importe y persistir su ID antes de continuar con consultas de estado. |
| `not_found` | Búsqueda completa sin coincidencias exactas. No demuestra que un POST anterior no se haya aceptado; mantener el bloqueo y volver a reconciliar cuando proceda. |
| `ambiguous` | Dos o más IDs de pedido coinciden exactamente, aunque estén cancelados. No elige un pedido; mantener el bloqueo y resolver la duplicidad. |

Toda respuesta contiene `resubmitAllowed:false`, `matchingJobIds`, `matchCount`,
`searchComplete`, `pagesScanned`, `recordsScanned`, `checkedAt` y
`reconciliationRequired`. `printJob` es nulo salvo en `matched`.
`ambiguous` puede finalizar anticipadamente: sus coincidencias son las observadas,
no necesariamente la lista completa de duplicados. Solo `matched` deja
`reconciliationRequired:false`; ninguno de los resultados autoriza crear otro pedido.

Máximos aceptados: 100 páginas, 100 registros por página y 120 segundos. El plazo
incluye OAuth, petición y lectura del cuerpo. Los límites, fallos HTTP/red, páginas
malformadas, recuentos cambiantes, solapamiento de IDs o paginación inconsistente
producen `reconciliation_incomplete`, con `reconciliationRequired:true`,
`resubmitAllowed:false` y `reason`. `retryable:true` permite repetir únicamente la
consulta de reconciliación; nunca el POST original.

El enlace `next` se verifica contra el origen y ruta de Lulu y la siguiente página
esperada. Cada GET se reconstruye desde los parámetros originales, conservando
la referencia. Ninguna URL recibida decide el destino del token bearer.
Lulu no documenta que la búsqueda sea un snapshot ni una garantía de visibilidad
inmediata. Este método recupera evidencia; la aplicación debe mantener el bloqueo
persistente y comparar la versión aprobada de los archivos antes de asociar un pedido.

El adaptador no implementa el bloqueo transaccional, la aprobación de gasto,
persistencia de hashes/IDs, caducidad de presupuestos, verificación editorial,
autenticación del administrador ni registro/validación de webhooks. Estas funciones
corresponden al servicio que lo integra. Importarlo no demuestra integración.

## Pago y evidencia

`lulu.paymentPortalUrl` y `luluPaymentPortalUrl(environment)` apuntan a la raíz
documentada del Developer Portal. El operador accede allí a su pedido y lo paga.
No existe método `pay` en este adaptador. Abrir el portal no confirma pago.
La cuenta puede tener autopago: crear un pedido de producción puede desencadenar
cobro. El servicio debe obtener la aprobación concreta antes de llamar al método.

Fuentes oficiales verificadas el 8 de septiembre de 2026:

- [OpenAPI Lulu](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml)
- [Developer Portal](https://developers.lulu.com/)
- [Portal sandbox](https://developers.sandbox.lulu.com/)
- [Pago manual y automático](https://help.api.lulu.com/en/support/solutions/articles/64000293838-how-do-i-set-up-automatic-payment-fulfillment-for-my-api-orders-)

Prueba sin red ni gasto: `node scripts/test-lulu-print.mjs`.
La verificación de producción requiere credenciales, PDFs reales aprobados y un
pedido piloto autorizado con lectura de estado y seguimiento de entrega.
