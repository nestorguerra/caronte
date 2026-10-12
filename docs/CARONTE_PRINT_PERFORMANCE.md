# Maquetación: carga medida y límite de ejecución

Corte privado del 12 de octubre de 2026. No es una entrevista, libro de cliente,
validación Lulu ni prueba de disponibilidad del servicio público.

## Reproducción antes de cambiar el código

La fixture repetitiva ocultaba carga mediante aciertos de caché. Dos permutaciones
deterministas mantienen 48.300 palabras, 150 párrafos y los mismos caracteres,
pero producen líneas variadas. Ese texto carece de valor literario.

Un agente independiente reprodujo el fallo en un test nuevo, sin modificar
producción. Usa documentos y fuentes reales e instrumenta la API pública
`PDFFont.widthOfTextAtSize`, no el embedder privado. Antes: 295.250 caracteres
de fuente, 148.650 llamadas y 5.713.655 caracteres medidos. Solo fallaba el
presupuesto de trabajo, 12 veces la fuente: 3.543.000 caracteres. El orden,
integridad y ausencia de mutación pasaban. El padre volvió a ejecutar RED.

También se registró antes del arreglo el hash del plan completo de esa fixture:
`7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c`.
Incluye páginas, líneas, anchuras exactas, tamaños, posiciones, márgenes y aperturas.

## Cambio conservado

`caronte-print-wrap.mjs` contiene medición y corte de líneas, compartidos por
cuerpo, títulos y cubierta. Evita medir cada prefijo creciente. Reutiliza las
anchuras de palabras y comprueba aditividad en fronteras de palabras. Cada línea
emitida se mide con la fuente real. Una diferencia de composición detectada
vuelve al algoritmo anterior para ese párrafo. Cerca del límite usa el prefijo
medido, para no cambiar la decisión por redondeo.

La caché pertenece a un render y una fuente. Máximo: 16.384 entradas y 1.048.576
caracteres UTF-16 de claves. Una clave mayor no se retiene. FIFO solo provoca
nuevas medidas exactas; no elimina texto. No equivale a bytes de heap ni limita
las cachés internas de fontkit. No se comparte texto entre clientes ni se registra.

El test independiente pasa con 28.779 llamadas y 1.369.359 caracteres medidos:
76 % menos trabajo. El hash del plan anterior sigue idéntico. Se conservan los
cinco tamaños candidatos y todos los gates; no se reduce validación por velocidad.
Seis pruebas adicionales comparan el algoritmo original con las tres fuentes
reales, texto variado y tildes; comprueban límites exactos, redondeo, normalización,
composición no aditiva, palabras no divisibles, aislamiento y límites de cachés.
El presupuesto no impone tiempos de una máquina concreta. El camino exacto
puede costar más; producción sigue usando los activos Crimson Text verificados.

## Mediciones completas antes/después

Comando: `node scripts/benchmark-caronte-print.mjs --fixture=varied`.
Tres procesos nuevos por fase, sin otra verificación de PDF simultánea. Mac
arm64, Node v24.19.0, dependencias fijadas. Imports y construcción de fixture
excluidos en todas las fases. Incluye carga/hash de fuentes, validación, cinco
candidatos, ambos PDF, relectura y hashes. Dimensiones de cubierta sintéticas:
cero peticiones externas, cero pagos. Todas las muestras: 194 páginas/48.300 palabras.

| Fase | Muestra | Tiempo real, ms | CPU usuario, ms | CPU sistema, ms | RSS máximo, MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Antes | 1 | 13.998 | 14.283 | 186 | 286 |
| Antes | 2 | 14.480 | 14.772 | 212 | 284 |
| Antes | 3 | 16.874 | 17.058 | 353 | 276 |
| Fronteras de palabra | 1 | 7.351 | 7.895 | 228 | 276 |
| Fronteras de palabra | 2 | 7.045 | 7.546 | 204 | 271 |
| Fronteras de palabra | 3 | 5.662 | 6.094 | 152 | 265 |
| Caché limitada, final | 1 | 5.846 | 6.290 | 137 | 279 |
| Caché limitada, final | 2 | 5.890 | 6.439 | 137 | 262 |
| Caché limitada, final | 3 | 5.679 | 6.187 | 143 | 269 |

Mediana CPU total: 14.984 → 6.427 ms, reducción del 57 %. Mediana de tiempo real:
14.480 → 5.846 ms. Todas las muestras finales mejoran todas las iniciales.
Ambos cambios de corte de líneas se conservan; no hubo ensayos descartados en
esa fase. RSS alto y variable:
no se presenta como memoria válida en Edge.

Benchmark y test independiente usan permutaciones distintas. Cada comparación
antes/después mantiene su algoritmo/semilla. El hash solo acredita la fixture
independiente, no la otra.

## Relectura y revisión privada

La prueba admite `--fixture=varied --output-dir=/ruta/absoluta`. Nuevo par en
`/tmp/caronte-print-performance.HyanSX`, sin sustituir `output/pdf`.
`verify-print-proof.py` admite ese directorio. Pypdf verifica fuentes, geometría,
hashes y texto completo: 295.284 caracteres, 194 páginas y una cubierta. Sigue
`ready_for_print=false`. Poppler renderizó portadilla, índice, apertura, cuerpo,
última página de texto, blanco de encuadernación y cubierta. Inspeccionadas las siete imágenes: sin
recortes, solapamientos ni glifos ausentes observados. No es auditoría visual
de todas las páginas ni revisión editorial de un libro auténtico.

Pase local: 334/334 sin skips, 17 comprobaciones heredadas, validación, build y
diff sin errores. HTML/CSS públicos idénticos a 48157ae. Sin cambios de interfaz,
dependencias nuevas, commit, push, despliegue, credenciales, Lulu real, pedidos ni pagos.

## Decisión de ejecución pendiente

[Supabase](https://supabase.com/docs/guides/functions/limits), consultado el 12 de
octubre: 2 segundos de CPU por petición alojada y 256 MB de memoria.
[`waitUntil`](https://supabase.com/docs/guides/functions/background-tasks) no
elimina los límites CPU/memoria/vida del worker.

CPU de proceso Node y RSS no son contador/heap de un isolate Supabase. Estas
muestras no prueban un fallo real de Edge, pero no dejan margen para declarar
viable la generación completa inline. No activar esa ruta basándose en la
fixture repetitiva o en una tarea en segundo plano.

Antes del despliegue hay que resolver y probar una de estas vías:

- Cola persistente por bloques pequeños, con composición y unión finales
  también medidas dentro del presupuesto del runtime existente.
- Trabajador con CPU/memoria adecuadas. Elección, coste, configuración y despliegue
  requieren una decisión y autorización concretas.

Ambas necesitan versión/ID estables, claim/lease y relectura de objetos/fila,
para recuperar interrupciones sin versiones ni pedidos duplicados. Esa cola
no se ha implementado aquí. Sin empaquetado/prueba Deno, medición alojada o
preflight auténtico. La tarea 07 y el piloto completo siguen abiertos.

## Ampliación: etapas acotadas, aún sin cola persistente

Implementadas primitivas privadas: 25 planes capítulo/tamaño, composición,
partes de hasta diez páginas, unión y cubierta separada. Se exige un tamaño
explícito, recibos completos, rangos canónicos, identidad de trabajo, fecha
congelada y relectura de bytes. No son una cola SQL ni están conectadas a la ruta.

Se descartó el primer ensayo de cinco planes de capítulo: pico 1.916 ms de CPU
local. Al dividir además por tamaño, tres muestras de 48 procesos independientes
dan picos de 770/901/818 ms y RSS de 177/172/172 MiB. CPU acumulada:
24.548/24.291/25.699 ms. Más peticiones y trabajo total a cambio de menor pico.
Imports excluidos de CPU, incluidos en RSS; las muestras no certifican Edge.

Los tres interiores y cubiertas finales y sus veinte fragmentos son idénticos
en bytes con la misma fecha de trabajo. El plan completo conserva el hash
anterior. Pypdf confirma las tres parejas completas; siete renders nuevos
inspeccionados sin defectos observados. Texto sintético, `ready_for_print=false`.

Último pase: 347/347 sin skips, diecisiete comprobaciones heredadas, validación
y build pasan. Sin interfaz nueva ni activación remota. Detalle de las medidas,
sesgos, ensayo descartado, contratos y acciones pendientes:
[`ADR-001_PRINT_STAGES.md`](ADR-001_PRINT_STAGES.md), estado Propuesto.
