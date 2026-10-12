# Perfil local del trabajador completo de imprenta

Fecha: 12 de octubre de 2026. Estado: **medido en Node; no certificado en Edge**.
No modifica la página pública ni activa el procesamiento remoto.

## Qué se ha medido

`scripts/benchmark-caronte-print-worker.mjs` conecta la ruta HTTP TypeScript,
autenticación de monitor, JSON, coordinador, archivo privado, generador,
pdf-lib/fontkit, fuentes y cliente OAuth/dimensiones de Lulu originales.
DB/Storage/Lulu son fronteras sintéticas locales. No llama a proveedores ni usa
credenciales reales. La autenticación no se reemplaza por un permiso incondicional.

Tres ejecuciones consecutivas, sin modificar el código entre ellas. Cada libro
requiere **49 procesos nuevos del sistema operativo**, uno por petición:
25 planes, composición, veinte partes, interior, cubierta y cierre.
La reserva inicial usa el coordinador real, pero no la ruta `generatePdf`; no
forma parte de la medida de CPU de `advancePrint`.

La fuente es la fixture privada de 48.300 palabras y 150 párrafos, con la misma
permutación determinista que ADR-001. No es una entrevista ni un libro auténtico.
Cada ejecución confirma una fila de PDF y 22 objetos: veinte partes y el par
final. Reabre los binarios: interior de **194 páginas**, cubierta de una página.
Los hashes de ambos coinciden con sus recibos persistidos. El plan conserva todos
los párrafos en orden y su SHA-256 permanece:
`7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c`.

## Resultados observados

Host verificado: macOS arm64, Apple M5 Pro, Node 24.19.0. Sin optimización entre
muestras: la variación observada no demuestra una mejora de implementación.

| Muestra | Máximo CPU de petición | Máximo CPU del proceso | Máximo RSS del proceso | CPU acumulada de peticiones |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1.762 ms | 2.874 ms | 291 MiB | 71.681 ms |
| 2 | 1.587 ms | 2.612 ms | 280 MiB | 54.105 ms |
| 3 | 1.185 ms | 1.899 ms | 281 MiB | 38.609 ms |

En cada muestra: 49 peticiones medidas, ninguna por encima de 2.000 ms de CPU;
24 procesos por encima del umbral local de 256 MiB. Este umbral instrumental
no acredita la contabilidad de memoria del proveedor. Se conservan los excesos
en el informe: no se ocultan ni se convierten en una aprobación del runtime.

Por libro: 459 respuestas REST y **233.728.388 bytes** de JSON REST sintético
(aproximadamente 223 MiB). La petición de cierre relee 11.078.268 bytes de JSON.
Es volumen serializado local, no tráfico real medido en Supabase. Apunta a revisar
el coste de relecturas, sin retirar gates, recibos o verificaciones para acelerar.

Evidencia privada:
`/tmp/caronte-worker-profile.pQXudt/summary.json` y
`sample-{1,2,3}/measurements.json`, con sus estados y binarios respectivos.
Los informes no imprimen fuente, payloads privados ni credenciales. Siempre
mantienen `fixtureOnly=true`, `hostedRuntimeVerified=false`,
`readyForPrint=false` y `externalRequests=0`.

Una relectura independiente con pypdf comprueba los tres pares: 194 + 1 páginas,
sin cifrado, geometría A5, todas las fuentes incrustadas con mapa Unicode,
295.284 caracteres de cuerpo extraídos en orden y SHA-256 coincidentes con DB.
No sustituye la revisión visual completa ni una validación de Lulu real.

## Qué significan y qué no significan esas medidas

- `requestCpuMs`: diferencia de CPU alrededor del handler y lectura de respuesta.
  Incluye el generador y el código real, pero también el servidor REST/Storage
  sintético ejecutado dentro del mismo proceso. Incluye su parsing, serialización
  y parte del archivo local. La fixture codifica el resultado REST dos veces:
  una para `Response.json` y otra para contar bytes. No es CPU pura del handler
  alojado ni una cota garantizada de CPU Edge.
- `processCpuMs` y RSS: incluyen imports, compilador TypeScript de Node, VM,
  hidratación de toda la DB sintética, renderer y persistencia de la fixture.
  No representan el baseline ni la memoria de un isolate Deno/Supabase.
- La reserva, el transporte de red, PostgreSQL, locks, RLS, RPC SQL y scheduler
  reales no están medidos. El estado en disco permite nuevos procesos, pero no
  prueba aislamiento SQL, concurrencia remota ni recuperación del alojamiento.
- No se verificó aquí una entrevista, generación de modelo, preflight de Lulu,
  dimensiones auténticas, pedido, pago, envío o entrega.

Por tanto, el par completo funciona en esta frontera local, pero **no se acepta
su viabilidad alojada por estas cifras**. No se ha aplicado una optimización de
producción en este corte. Reducir el doble encoding de la instrumentación, si se
hace, requerirá una línea base nueva antes de comparar resultados.

## Siguiente comprobación y permisos

La [documentación actual de límites de Edge](https://supabase.com/docs/guides/functions/limits)
declara 2 segundos de CPU por petición y 256 MB de memoria. Deben medirse el
runtime, funciones y fuentes efectivos; un test Node no los certifica.

La [guía oficial de runtimes nativos](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)
permite un entorno local sin Docker en macOS 14+ con Apple Silicon. Es
experimental, descarga servicios y sus procesos no tienen aislamiento de
contenedor. Se propone Supabase CLI **2.120.0**, cuya
[publicación oficial](https://github.com/supabase/cli/releases/tag/v2.120.0)
se verificó sin descargar ni instalar.

La autorización de esa herramienta y sus descargas llegó después. La instalación
privada se completó: PostgreSQL/ACL/concurrencia reales pasan y las primitivas en
Edge Runtime nativo generan el par sintético. No certifica límites Edge: el timer
CPU de este runtime no está habilitado en macOS y RSS devuelve 0/no disponible.
Todos los procesos propios se detuvieron. Método, incidentes y límites:
[verificación nativa local](CARONTE_NATIVE_LOCAL_VERIFICATION.md). No configura
ni modifica el proyecto compartido, ni autoriza publicación o despliegue.

Probar el runtime local no demuestra por sí solo el empaquetado desplegable de
fuentes ni los límites del alojamiento real. Según la
[guía de despliegue](https://supabase.com/docs/guides/functions/deploy), la activación
es una acción separada. La configuración local de `static_files` está preparada;
no se han enviado fuentes, funciones o migraciones al servidor.

## Reproducción y regresión

```sh
node scripts/benchmark-caronte-print-worker.mjs --output-dir=/ruta/privada/nueva
node --test scripts/test-caronte-print-profile.mjs
```

La carpeta de salida debe ser absoluta y nueva. No se sobrescriben PDFs existentes.
Tres tests nuevos: recibo final completo, excesos/privacidad y rechazo de CLI
inválido antes de crear artefactos o conectar a proveedores. RED por módulo
inexistente antes de implementar; GREEN 3/3 después, sin skips.
El benchmark completo se ejecutó una vez (tres muestras); no se repitió para
obtener cifras más favorables. La suite declarada se ejecuta por separado.

Pase final declarado: **406/406 sin skips**, diecisiete comprobaciones heredadas,
validación y build pasan. `git diff --check` no presenta incidencias; HTML/CSS de
Tiresias idénticos a `48157ae`. Las assertions SQL siguen sin ejecutarse: no se
incluyen en esas 406 pruebas.

No hubo commit/push, publicación, instalación adicional, SQL remoto, guardado de
claves, llamadas pagadas, pedido, pago o cambio de permisos/configuración.
