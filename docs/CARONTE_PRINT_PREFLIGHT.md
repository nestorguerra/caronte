# Validación previa de impresión: corte local

`caronte-print-preflight.mjs` integra los trámites asíncronos de Lulu. No crea
pedidos, calcula cobros ni acredita pago o entrega. No se ha publicado este corte.

## Qué autoriza «listo para imprimir»

La aprobación humana queda ligada a sesión, versión, manuscrito y SHA-256 de
fuente/interior/cubierta. El interior debe tener 180–200 páginas físicas, fuentes
incrustadas y una cubierta independiente con dimensiones obtenidas de Lulu para
ese recuento/SKU/entorno. No admite el generador antiguo ni la fórmula de prueba.

Antes de enviar cada archivo se releen sus bytes privados y se verifican tamaño
y hash. Se firma una URL del mismo origen privado durante una hora. Las URL y
respuestas de error del proveedor no se guardan en el estado ni en la auditoría.

El servidor reserva el intento en la fila de PDF mediante actualización condicional
por `updated_at`. Relee la fila antes del POST y después de cada cambio. Una
escritura aceptada sin lectura confirmatoria no permite anunciar progreso.

Cada llamada administrativa hace una sola operación del proveedor: crear o consultar
la validación de un archivo. Los IDs conocidos se conservan para consultar el mismo
trámite. La secuencia típica requiere cuatro llamadas: interior, consulta interior,
cubierta, consulta cubierta; puede requerir más consultas mientras Lulu procesa.

Solo `NORMALIZED` sin errores en ambos archivos permite `ready_for_print=true`.
La especificación oficial de Lulu define ese estado como normalización correcta y
sus ejemplos usan `errors: null`. Se admite ese valor solo en una consulta GET del
mismo ID ya conservado, con origen exacto y comprobaciones de páginas/producto.
Un campo ausente o un `null` en el POST inicial permanece pendiente. Se conserva
la representación real del proveedor; no se inventa una lista vacía de errores.
Fuente: [contrato oficial de Lulu](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml),
consultado el 12 de octubre de 2026. Ningún recibo incierto se vuelve a enviar.
El interior debe confirmar el recuento exacto y el SKU admitido. `VALIDATED` es
validación básica, no normalización completa. La cubierta no admite los estados
`VALIDATING`/`VALIDATED`, exclusivos del interior según la documentación de Lulu.

Un envío sin recibo, un intento interrumpido, archivos cambiados o un fallo de
validación quedan retenidos. No hay reenvío por caducidad, segundo clic, pérdida
de respuesta ni reaprobación del PDF. Revocar la revisión revoca los indicadores
de impresión. Un marcador `normalized` sin recibo íntegro no puede autorizar nada.

## Panel y permisos

`adminPrintStatus` solo consulta la fila. `adminValidatePrint` requiere editor,
operaciones o propietario; no concede permisos a viewer/support. El panel relee
el estado antes y después del cambio, compara los recibos sin depender del orden
de claves JSONB y no muestra un envío incierto como éxito.

Lulu exige el entorno explícito y el par privado `LULU_CLIENT_KEY` /
`LULU_CLIENT_SECRET`. El campo único `LULU_API_KEY` no configura la integración.
El panel elimina ese formulario de Lulu y prepara una prueba OAuth real, sin
pedidos. La prueba histórica queda vinculada a la configuración mediante hash
privado; una rotación no conserva un éxito anterior como prueba vigente. La gestión
segura del par desde el panel todavía no está implementada.

## Verificación y límites

Pruebas locales ejecutan el servicio, la ruta TypeScript y el JavaScript real del
panel con límites externos sintéticos. Cubren doble clic/concurrencia, pérdida
de recibo, archivo incorrecto, páginas/SKU/ID/origen erróneos, errores de proveedor,
revocación de revisión, fallos de lectura y recibos incompletos. No prueban Lulu
real ni el `UPDATE` concurrente de Supabase remoto.

`scripts/serve-print-admin-proof.mjs` abre una fixture HTTP privada en 127.0.0.1,
con puerto aleatorio. Usa el HTML/CSS/JavaScript del panel y sustituye únicamente
sus límites de API. Su encabezado declara datos sintéticos. No lee configuración,
claves ni entrevistas y no entra en `src` ni en el build publicable.

Navegador real: interior y cubierta avanzan por separado; ambos normalizados
muestran «listo para imprimir». El escenario incierto no ofrece el botón de
validación. Cero errores/avisos de consola. La evidencia visual se guarda en la
carpeta de visualizaciones del chat, no en el sitio público.

Pendientes: credenciales y pruebas remotas; recuperación administrativa de un
trámite incierto con evidencia del proveedor; renovación de URL caducada mediante
una nueva decisión explícita; scheduler que consulte IDs conocidos; empaquetado
Deno/Edge; cola de maquetación; presupuesto, aprobación concreta del pedido,
pago y entrega. El límite de lectura DB corta la espera, pero no cancela una
petición REST ya despachada: cualquier reserva tardía mantiene bloqueado el reenvío.

Fuentes primarias consultadas el 11 de octubre de 2026:

- [Lulu OpenAPI: introducción y endpoints de validación](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml).
- [Lulu: archivos requeridos](https://help.api.lulu.com/en/support/solutions/articles/64000254607-what-files-are-required-for-lulu-print-api-production-).
- [PostgREST: filtros y actualizaciones condicionales](https://docs.postgrest.org/en/stable/references/api/tables_views.html).
