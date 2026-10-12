# Credenciales privadas de Lulu

Corte local del 12 de octubre de 2026. Implementado y probado en local; no
desplegado, no se han guardado claves reales y no acredita acceso a Lulu.

## Configuración y permisos

Lulu requiere un par OAuth: Client Key y Client Secret, con entorno explícito
`sandbox` o `production`. La clave única heredada no se acepta. El panel privado
solo ofrece guardado al permiso administrativo existente de propietario; no se
han ampliado roles, autenticación, RLS, CORS ni permisos de otros operadores.
La prueba OAuth conserva el permiso existente de propietario/operaciones.

Si alguna de `LULU_ENVIRONMENT`, `LULU_CLIENT_KEY` o `LULU_CLIENT_SECRET` está
definida, el servidor gestiona el par. Las tres deben ser válidas. Un entorno
incompleto bloquea el uso: nunca combina una clave del entorno con otra de DB,
ni usa silenciosamente el par almacenado. El panel no modifica esos valores.

Sin ese override, el servidor resuelve una sola fila privada de
`future_book_provider_settings`. El par completo y su entorno se cifran juntos
con el AES-GCM existente. El guardado exige `FUTURE_BOOK_SECRET_KEY` dedicado,
nonce aleatorio y relectura posterior; no sustituye una clave ausente por el
service-role para cifrar este nuevo par. Mantener las claves de cifrado/salt
estables y privadas es responsabilidad del despliegue.

## Guardado verificable

1. El propietario selecciona el entorno e introduce ambas claves. Se admiten
   entre 1 y 2048 caracteres ASCII imprimibles sin espacios por valor. No se
   recortan ni truncan; los valores inválidos se rechazan sin escribir.
2. Confirma el guardado, separado de cualquier autenticación, pedido o pago.
3. El panel envía un UUID y la revisión de la fila que abrió el formulario.
   Una segunda pulsación pendiente no envía otra petición. Vacía los campos
   al enviar; no almacena las claves en localStorage/sessionStorage.
4. El servidor actualiza con comparación de revisión, o crea sin sobrescribir
   una fila concurrente. Relee la fila y descifra el par para comprobarlo antes
   de devolver un resumen público. Un conflicto o fallo no produce éxito.
5. El panel relee el dashboard y exige el mismo UUID, entorno y origen cifrado.
   Una aceptación sin esa confirmación queda «sin confirmar», sin reenvío
   automático. Actualice el panel y revise el estado antes de decidir otro envío.

Los campos se retiran al cerrar sesión o fallar la lectura del dashboard. Un
refresh de fondo conserva la escritura en curso únicamente si el campo sigue
en foco y revisión, origen y permiso no han cambiado. No se promete borrado
criptográfico del heap, del portapapeles ni de un gestor externo de contraseñas.

Guardar solo confirma presencia/persistencia del par, no una conexión funcional.
«Probar OAuth» autentica sin crear pedidos, preserva las claves y relee el recibo.
Una conexión fallida mantiene el par configurado pero muestra prueba fallida.
Un recibo perdido o una rotación concurrente no anuncia prueba verificada.

## Identidad y rotación

La identificación privada usa HMAC-SHA-256 sobre el par íntegro y entorno,
sin truncarlo. La clave HMAC procede de PRIVACY_SALT, SECRET_KEY o service-role
existentes; sin material privado se bloquea. No se devuelve esa marca al panel.
La prueba OAuth solo vale para la misma identificación y fecha confirmada.

El primer preflight de un PDF aprobado enlaza la identificación con su fila,
mediante escritura condicional y relectura. Un par distinto bloquea las
validaciones, consultas de presupuesto y operaciones de pedido anteriores antes
de llamar al proveedor. No enlaza automáticamente un recibo heredado sin marca,
no vuelve a enviar un trámite incierto y no migra pedidos a otra cuenta.

Incluso rotar el Secret de la misma cuenta invalida esa identificación. Hace
falta revisión/reconciliación explícita; ese proceso de migración todavía no
está implementado. Cambiar el salt también invalida las marcas. Restaurar
exactamente el par y salt anteriores recupera su identificación, no prueba la
disponibilidad de la cuenta ni autoriza pedidos.

## Fronteras y evidencia

El navegador, peticiones, respuestas del proveedor y lecturas DB se validan
como entradas no confiables. Solo el servidor con autorización resuelve las
claves. Las respuestas públicas usan campos permitidos: no incluyen claves,
ciphertext, nonce ni HMAC. Los logs de auditoría registran entorno/UUID/resultado,
no el cuerpo de credenciales. El service-role, cifrado y acceso al servidor son
fronteras privilegiadas que deben verificarse en el despliegue real.

Pruebas: nueve del store, dieciocho de rutas nativas con el servicio compartido
real y cuarenta y seis del panel. El test de rutas cifra con AES-GCM real y
verifica resolución desde DB en preflight, presupuesto, pedido y prueba OAuth.
Sus fronteras de proveedor, transporte y DB son sintéticas, no Supabase/Lulu.
El generador PDF usa el mismo resolver; falta comprobarlo en Deno/Edge.

Navegador nativo: consentimiento obligatorio, campos password, vaciado y
relectura, aceptación no confirmada sin reenvío, ninguna advertencia/error de
consola observado. Sin desbordamiento de página en 320/768/1024/1140/1440 px;
las tablas conservan su scroll propio. No se ha realizado auditoría completa
de lector de pantalla, contraste o rendimiento.

El servidor de prueba es privado y solo conserva resúmenes ficticios en memoria;
no recibe secretos reales, no se publica con src/dist y no llama a proveedores.

## Antes del piloto

Faltan autorización/destino para guardar claves reales, despliegue aprobado,
auth/RLS/CAS y runtime remotos, prueba OAuth auténtica y normalización de ambos
PDF. La autorización de dependencias no cubre claves, publicación ni pedidos.
Se mantiene desactivado `FUTURE_BOOK_LULU_ORDERS_ENABLED`.

Sandbox usa cuenta separada y no imprime/envía físicamente. El checkbox del
panel tampoco verifica el modo de pago de la cuenta: guardar una tarjeta en
Lulu puede activar pago automático. No crear pedidos reales hasta confirmar
modo manual, dirección autorizada y aprobación del importe/destino exactos.
Referencias primarias: [sandbox de Lulu](https://help.api.lulu.com/en/support/solutions/articles/64000306383-do-you-have-a-sandbox-environment-)
y [pago automático](https://help.api.lulu.com/en/support/solutions/articles/64000293838-how-do-i-set-up-automatic-payment-fulfillment-for-my-api-orders-).
