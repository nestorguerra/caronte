# Presupuesto privado de impresión

Corte local del 11–12 de octubre de 2026. Implementación preparada, sin desplegar.
No se ha consultado un presupuesto real, creado un pedido ni efectuado un pago.
La página pública original no incorpora controles nuevos.

## Requisitos y recorrido

Solo operaciones/owner o el acceso administrativo heredado autorizado pueden
consultar el presupuesto. Editor, viewer y support quedan excluidos en el servidor.
La interfaz no es la frontera de seguridad.

1. Releer el PDF aprobado. Interior y cubierta deben tener recibos `NORMALIZED`
   de Lulu y corresponder a los hashes, páginas, SKU y entorno aprobados.
2. Confirmar la dirección completa y autorizar expresamente su envío a Lulu.
   Los campos demasiado largos se rechazan; nunca se recortan a otra dirección.
3. Consultar las opciones disponibles. Solo se envían país, provincia, código
   postal y las banderas de domicilio necesarias; no nombre, calle, teléfono o email.
4. Elegir una opción devuelta por Lulu y calcular el total para una copia.
   El cálculo transmite la dirección confirmada, no la biografía ni el manuscrito.
5. Validar moneda, importes decimales exactos y dirección devuelta. Una advertencia
   o propuesta de dirección distinta exige revisión, sin guardar un precio usable.
6. Cifrar la dirección, guardar el recibo con escritura condicional y releerlo.
   La interfaz vuelve a consultar el recibo antes de anunciar presupuesto confirmado.

El presupuesto no autoriza un gasto. Caduca a los 15 minutos por política local
de Caronte, no por una garantía de precio de Lulu. El botón de revisar aprobación
abre un flujo separado: `CARONTE_PRINT_ORDER.md`. Requiere recalcular y aprobar
expresamente destino, envío, moneda e importe antes de enviar. Una vez reservado
o enviado un intento, el servidor congela su presupuesto y destino.

## Contrato y privacidad

Servicio: `_shared/caronte-print-quote.mjs`. Rutas `adminShippingOptions`,
`adminQuotePrint` y `adminPrintQuote` de `future-book-session`.

El recibo privado queda en `future_book_pdfs.metadata.print_quote`: identificador,
binding exacto de archivos/revisión/entorno, hash de dirección, dirección cifrada,
cantidad, envío, costes y fechas. Usa el cifrado existente del servidor y el hash
de privacidad; no almacena dirección en claro ni añade una tabla o migración.

`publicPdf` elimina ese campo de todas las salidas generales de PDF, incluidas
dashboard y sesión. La salida de presupuesto solo contiene estado, identificación,
desglose y fechas: no dirección, ciphertext, nonce ni hash de destino. La auditoría
solo registra ID/estado y que no hubo pedido/pago. Los errores no copian respuestas
privadas del proveedor. La interfaz borra dirección/consentimiento al salir, fallar
la sincronización o cambiar revisión, archivo o permiso.

Estados: `not_quoted`, `quoted`, `expired`, `invalidated`. El estado se calcula
contra el registro actual; revocar revisión o cambiar archivos/entorno invalida
el recibo anterior. `address_review_required` no crea un recibo usable.

## Costes y contrato Lulu

- `/shipping-options/` usa `country` y `state`; el adaptador transforma su entrada
  canónica `state_code` al campo oficial `state` únicamente para esta operación.
- Presupuesto/pedido usan `country_code` y `state_code`. España exige provincia.
- La moneda del cálculo es la de la cuenta Lulu. Consultar opciones en EUR no
  cambia la cuenta; una respuesta en otra moneda se rechaza.
- La aritmética usa cadenas decimales y BigInt, no redondeos de punto flotante.
- `shipping_cost` ya incorpora manipulación. `fees.HANDLING_FEE` es informativo,
  no se suma otra vez. `fulfillment_cost` y `fees.FULFILLMENT_FEE` representan la
  misma gestión: deben coincidir y se suman una sola vez.
- Se comprueba impresión + envío/manipulación + gestión = total, tanto sin
  impuestos como con impuestos. El descuento ya aplicado se muestra sin restarlo
  otra vez. Importes ausentes/inconsistentes o tasas desconocidas bloquean el cálculo.

Contrato oficial consultado el 11 de octubre:
[OpenAPI Lulu](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml) y
[tasa de gestión por pedido](https://help.api.lulu.com/en/support/solutions/articles/64000265990-per-order-fulfillment-fee).

## Verificación y límites

Pruebas de servicio, ruta real TypeScript y JavaScript real del panel contra límites
DB/proveedor sintéticos. Cubren consentimiento, permisos, cifrado, lectura posterior,
moneda, tasas, totales, caducidad, dirección propuesta, archivo cambiado y fallos.
No demuestran credenciales, Edge/Deno, CAS remoto o disponibilidad real de Lulu.

La fixture privada `scripts/serve-print-admin-proof.mjs` permite abrir el URL local
que imprima, añadiendo `?scenario=quote`. Usa HTML/CSS/JS reales y respuestas
sintéticas claramente identificadas. No pertenece a `src` ni `dist`, no lee claves
y rechaza cualquier acción distinta de las permitidas. No conserva direcciones
en su registro de observaciones. Parar la fixture al terminar.

Prueba en navegador: sin consentimiento no consulta envío; muestra solo `MAIL`
del límite sintético; confirma un desglose sintético; cambiar ciudad borra el precio
y deshabilita envío/cálculo. Consola sin errores/avisos. La pestaña y el servidor
se cerraron. Evidencia privada: `caronte-print-quote-20261011.jpg`, en las
visualizaciones del chat. Su importe no es un precio real ni una estimación comercial.

Pendientes: credenciales y cuenta aprobadas, libro genuino, preflight remoto,
presupuesto real con dirección autorizada, aprobación concreta, verificación
remota del pedido durable/conciliación, pago manual y seguimiento de entrega.
