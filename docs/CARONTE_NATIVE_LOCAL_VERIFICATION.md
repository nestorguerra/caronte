# Caronte: verificación nativa local

Fecha: 12 de octubre de 2026. **Pruebas locales verificadas; producción pendiente.**

## Autorización y aislamiento

Néstor autorizó expresamente Supabase CLI 2.120.0 y las descargas de su entorno
nativo experimental. No autorizó con esta decisión publicación, despliegue,
migración del proyecto compartido, nuevas claves ni peticiones pagadas.

Host comprobado: macOS 27.0.1, arm64. CLI oficial 2.120.0 descargada y ejecutada
en `/tmp/caronte-native.EUvuFa`, carpeta raíz con permisos 0700. No instalación
global, cambio de PATH, Docker ni enlace a un proyecto remoto. El archivo
`supabase_2.120.0_darwin_arm64.tar.gz` coincide con el SHA-256 oficial:
`3b8546cc61aeabab6fd1f68edc7f664ebdfa96bdd6a9b18d8d612708f430ae28`.
Esto es comprobación de checksum del release por HTTPS, no firma independiente.

Se descubrieron los comandos con `--help`. `--experimental` no activa por sí
solo este stack: se usó `SUPABASE_EXPERIMENTAL_STACK=1`, según la documentación.
`SUPABASE_HOME` apunta exclusivamente a `.../state`; telemetría desactivada y
releída allí. Los procesos se lanzaron con un entorno mínimo, sin credenciales
de cuentas/proveedores heredadas. Solo datos sintéticos.

El proyecto privado se inicializó en `.../project`, separado del ejecutable
`.../supabase` y del repositorio. El proyecto compartido con LicitIA no se tocó.
Los archivos y caché descargados se conservan; `/tmp` no es almacenamiento
permanente. Los servicios y procesos de pruebas quedaron detenidos.

## PostgreSQL real y concurrencia

PostgreSQL nativo descargado: **17.11**. Es el mismo major 17, pero no el minor
17.6 observado en producción; esta prueba no acredita el servidor alojado.

Se ejecutaron, solo en la base desechable, las doce migraciones históricas de
Caronte y las dos migraciones de colas. La única dependencia ajena copiada fue
`public.touch_updated_at`, sin importar las tablas de aplicación de LicitIA.

`db query --local` funcionó para consultas simples. En esta versión falló ante
los archivos completos: `cannot insert multiple commands into a prepared
statement`. Se usó el **psql 17.11 incluido en la descarga autorizada**, sin otra
instalación, con `-X`, sin archivo de inicio del usuario y `ON_ERROR_STOP=1`.
Las migraciones se cargaron atómicamente con `--single-transaction`.

Resultados verificados:

- `scripts/test-caronte-database.sql`: PASS, con ROLLBACK. Permisos privados,
  idempotencia, lease exclusivo/expirado, recibos inmutables, gate editorial,
  reanudación segura, retención de resultado incierto y cascada de borrado.
- `scripts/test-caronte-print-database.sql`: PASS, con ROLLBACK. Reserva de
  ID/versión, permisos, lease, pasos inmutables, bloqueo de la ruta antigua,
  control CAS/reanudación/cancelación, fuente cambiada y cascada privada.
- Ocho conexiones PostgreSQL simultáneas por cola: los ocho enqueues devuelven
  una sola fila; en imprenta conservan además el mismo ID PDF y versión 1.
  De ocho claims simultáneos por cola, **solo uno gana**. El token ganador se
  compara con el guardado en DB y el estado `running`. Roles de servicio reales.
- Cuatro ejecuciones directas no autorizadas de los RPC de claim, combinando
  `anon`/`authenticated` y ambas colas: todas rechazadas por permisos.
- Relectura posterior: cero sesiones/trabajos de pruebas; cuatro tablas de
  colas con RLS y dos buckets privados. Las filas de concurrencia se eliminaron
  exclusivamente por sus IDs y marca sintética; no se borraron datos reales.

El asesor de seguridad local devuelve un WARN heredado:
`function_search_path_mutable` en `public.touch_updated_at`. No se ocultó ni se
modificó esa función compartida. No se detectaron otros avisos en ese pase.

## Función y generador en runtime nativo

La copia privada de `future-book-session` carga en Edge Runtime **v1.77.4**.
`adminDashboard` devuelve HTTP 200 con las superficies esperadas contra la DB
real. Se usó únicamente un token administrativo sintético de pruebas; no es
verificación de Auth/login de un operador real ni prueba de navegador.

**Incidencia de aislamiento:** la puerta del stack escucha en loopback, pero el
proceso de funciones experimental abrió `*:25034`. Se detectó con `lsof` y se
detuvo inmediatamente el stack. No se continuó probando por esa interfaz ni se
cambió el firewall. Solo había tablas/credenciales locales y datos sintéticos.
No volver a usar ese arranque de funciones con datos o claves reales.

Para verificar el generador, se usó el mismo binario descargado con el indicador
documentado `--ip 127.0.0.1`, puerto 28376 y supervisor privado. Las rutas de
servicio se resolvieron mediante `/private/tmp`: el alias `/tmp` falló en la
resolución de módulos de este artefacto compilado. No se modificó el binario ni
el código de Caronte. Cada petición construyó un user worker nuevo.

La sonda importa las primitivas y el cargador de fuentes originales. Conserva
la fixture de 48.300 palabras y 150 párrafos. Las tres fuentes pasan su checksum.
Veinticinco planes y composición reconstruyen el plan anterior de 194 páginas,
con SHA-256 `7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c`.
Se generan veinte partes, interior y cubierta separados. Todos los archivos
mantienen `proof=true` y `ready_for_print=false`.

La primera sonda de cubierta enviaba dimensiones de prototipo como si fueran
una respuesta externa válida. El generador lo rechazó correctamente. Se corrigió
**solo la sonda**, usando su vía explícita de prueba sin dimensiones de Lulu.
Se conservó el manifiesto; se regeneraron las partes y terminó el par. No se
debilitaron gates ni se atribuyó una llamada ficticia a Lulu.

Relectura independiente con pypdf:

- Interior: 194 páginas físicas A5; cubierta: una página. Sin cifrado.
- Cuerpo completo de las 185 páginas con texto coincide, en orden por página,
  con el manifiesto normalizado: 295.100 caracteres, sin contar separadores
  entre páginas. No es comparable al recuento anterior con otra normalización.
- Diecisiete subconjuntos de fuentes incrustadas, todos con mapa Unicode.
- SHA-256 de ambos PDFs coincide con sus recibos. Renders de páginas 5, 100,
  194 y cubierta inspeccionados: sin recortes o solapes. La 194 es blanco de
  encuadernación. Es revisión visual por muestra, no de las 194 páginas.

**Límites observados:** el runtime imprime `CPU timer: not enabled (need Linux)`.
Los límites configurados en la sonda no se consideran aplicados en macOS.
`Deno.memoryUsage().rss` devuelve 0: RSS no está disponible, no es consumo cero.
Las medidas de wall time/heap de la sonda no son CPU/memoria del alojamiento.
No certifica ni los 2 s de CPU ni los 256 MB de producción. La sonda prueba
primitivas, no el coordinador completo con RPC/Storage bajo carga en Deno.
Tampoco acredita empaquetado/deploy de `static_files`, preflight, modelo o pedido.

## Cierre verificado y pendiente

`stack stop` finalizó con código 0. La consulta posterior del stack lo devuelve
no disponible, sin servicios activos. Los PIDs propios y los puertos usados
62170, 24074, 29267, 30876, 25034 y 28376 ya no existen/escuchan. La sonda nativa
se cerró; no queda una función o base de datos de pruebas corriendo.

Evidencias privadas en `/tmp/caronte-native.EUvuFa`: checksum, `start.log`,
`status.json`, `advisors.json`, `concurrency.mjs`, `stopped-status.json`,
`runtime-probe-active.log`, `rendered/manifest.json`, PDFs/renders y recibos.
Los archivos de status contienen **claves generadas locales**: no copiarlos a
Git, al navegador público ni a informes públicos. No son claves de proveedores.

HTML/CSS de Tiresias siguen idénticos a `48157ae`, comprobado con Git. No hubo
ediciones de comportamiento en el repositorio en este corte; la suite previa
416/416 no se repitió ni se incrementó con estas pruebas privadas. Se documenta
por separado su evidencia real. `git diff --check` se vuelve a comprobar.

Pendientes: verificación CPU/memoria efectiva en Linux/alojamiento, integración
completa DB/Storage/generador, claves/cuenta autorizadas, publicación/despliegue
aprobados, entrevista auténtica, libro literario real y revisión, preflight de
Lulu, presupuesto/pedido/pago aprobados y entrega. El piloto **no está listo**.
El permiso local no autoriza ninguno de esos pasos externos.

Referencias: [runtime nativo](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes),
[activación experimental](https://supabase.com/docs/guides/local-development/running-multiple-local-projects),
[release aprobado](https://github.com/supabase/cli/releases/tag/v2.120.0),
[límites alojados](https://supabase.com/docs/guides/functions/limits).
