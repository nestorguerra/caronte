# Maquetación acotada: SQL y primer recorrido alojado verificados

Corte del 13 de octubre de 2026, 00:14 UTC. Esta implementación no cambia el contrato
literario, los márgenes, las fuentes, el texto ni la plantilla de impresión.
El servidor v28 ya completó una cadena real de siete intervalos y su ensamblaje.
El resto de la maquetación y los PDF alojados siguen pendientes.

## Cálculo y recibos

`createPrintStages().planChapterSlice(source, chapterIndex, options)` calcula un
intervalo completo de párrafos. `size` debe pertenecer al contrato del manuscrito.
`mode` es `counts` o `geometry`. `previous` es el recibo anterior, o `null` al
comenzar. Cada petición acepta como máximo 24 párrafos y 16.000 caracteres.
`maxParagraphs` y `maxCharacters` pueden reducir esos límites, nunca ampliarlos.
Un párrafo que no cabe devuelve `print_slice_paragraph_limit`; no se corta,
omite ni procesa entero fuera del presupuesto.

El recibo `chapter-slice-v1` liga plantilla, versión, fuente, fuentes tipográficas,
capítulo, tamaño, intervalo, límite de trabajo y hash anterior. `startState` y
`state` conservan página y coordenada vertical. `endParagraph` es exclusivo.
Las restas de interlineado conservan el orden del algoritmo anterior. Los mismos
saltos, viudas/huérfanas y blancos finales se mantienen entre procesos distintos.
Los recibos `counts` no contienen prosa. Los de `geometry` contienen solo las
líneas del intervalo. Un hash verifica integridad, no constituye autorización.

`finishChapterSlices(source, chapterIndex, receipts, {size, compact})` exige una
cadena completa, en orden y de una sola identidad. Rechaza intervalos ausentes,
duplicados, alteraciones y predecesores distintos. Une las líneas de la página
compartida sin repetirlas. Su resultado y hash canónico son idénticos a los de
`planChapter`, tanto para geometría como para el recibo compacto. El modo de
recuento requiere `compact: true`; no puede inventar geometría.

`composeLayout(source, countPlans, {geometryPlans, createdAt, proof})` admite los
cinco planes de geometría del tamaño seleccionado. Mantiene la matriz completa
de tamaños, la elección por páginas, los hashes y la validación del texto íntegro.
Comprueba que cada geometría coincide con el recuento correspondiente. Ensambla
sin medir de nuevo los cinco capítulos. La vía anterior permanece disponible
para compatibilidad; el trabajador debe pasar la nueva opción expresamente.

## Coordinador local

El coordinador ya utiliza los intervalos cuando recibe las primitivas nuevas.
Cada claim calcula un intervalo o valida y ensambla recibos existentes. No llama
al cálculo de capítulo entero en esa vía. Conserva las claves originales
`plan:capítulo:tamaño`, sus salidas y sus hashes de entrada. Los pasos derivados
quedan separados: `slice-count`, `slice-geometry`, `selected` y `selection`.

`selectLayoutSize` valida la matriz de recuentos y elige el mismo tamaño que el
algoritmo anterior, sin documento nuevo ni medidas tipográficas. Antes de
componer, deben estar guardadas las cinco geometrías completas del tamaño elegido.
La composición recibe expresamente esos cinco planes. Las partes, el interior,
la cubierta y los controles de Lulu/almacenamiento continúan sin cambios.

La recuperación relee el recibo durable. Si se pierde el acuse de finalización,
el siguiente proceso continúa con el cursor siguiente; no recalcula el intervalo
terminado. Los tres intentos, el lease y las identidades ya iniciadas permanecen.
También se conserva el fingerprint de un caché `geometry` antiguo iniciado,
aunque otros cachés se hayan completado antes. La prueba reprodujo ese caso y
falló antes de la corrección. Los metadatos se leen en páginas de 500 filas;
una prueba de 1.200 filas reproduce el recorte de 1.000 del coordinador anterior.
La geometría completa se descarga solo por claves y en grupos de hasta cinco.

Cuatro pruebas independientes del puente fallaron con el coordinador anterior
y pasan con el nuevo. Selección, paginación y caché antiguo añaden otras tres.
Suite completa actual: 523 = 4 empaquetado + 519 Caronte, sin fallos u omisiones,
más 17 comprobaciones heredadas. `validate`, `build` y diff-check pasan.
Las pruebas de PDF reales siguen generando ambos pares sintéticos, sustituyen
al trabajador y comprueban la geometría y el texto íntegro. No prueban SQL alojado.

Una comprobación privada del puente usó el original ficticio real y la identidad
del plan iniciado `plan:0:12.9`: siete intervalos y un ensamblaje, ocho claims
offline. Conservó los nueve hashes terminados, el input hash iniciado y el hash
exacto de la salida original. La reserva conservó intento 1 y finalizó con intento
2 dentro de la fixture, sin reiniciar su presupuesto. No se generaron PDFs ni
se llamó a proveedores o al servidor. Informe privado
`genuine-sliced-queue-verification.json`: esto NO acredita un avance alojado.

## Evidencia y límites

Diez pruebas nuevas fallaron antes de implementar las primitivas y pasan después.
Cinco las preparó un agente independiente de la implementación. Usan fuentes y
documentos reales de pdf-lib/fontkit; comprueban texto, posiciones, blancos,
continuidad de proceso, integridad y trabajo tipográfico acotado. No prueban SQL
ni el alojamiento. En el primer corte de primitivas pasó la suite de 4 pruebas
de empaquetado y 504 de Caronte. El corte posterior del coordinador, descrito
arriba, tiene 515 pruebas. Las comprobaciones heredadas, `validate` y `build` pasan.

Una comprobación privada, sin publicar prosa, comparó todos los 105 planes del
original ficticio de treinta años, más las cinco geometrías elegidas. Los planes,
sus hashes y el manifiesto completo de 224 páginas coinciden exactamente con el
algoritmo anterior. También coinciden los nueve hashes ya terminados en la cola.
Se usaron 836 intervalos: máximo 24 párrafos y 11.020 caracteres en ese original.
Esto implica más peticiones; no acredita menor tiempo total o coste operativo.

En tres muestras independientes del runtime nativo, el capítulo entero requirió
465–477 ms de wall time y 13.130 medidas tipográficas. El intervalo más pesado
requirió 119–122 ms y como máximo 2.807 medidas. El ensamblaje compacto terminó
en 15 ms aproximadamente, sin medidas tipográficas. El hash final fue idéntico.
macOS deshabilita explícitamente el temporizador de CPU de ese runtime: **no es
prueba del límite de dos segundos ni de la memoria del servidor alojado**.

## Persistencia y conexión del servidor

La migración `20261013000043_caronte_sliced_print_receipts.sql` conserva el RPC
existente y admite las claves nuevas. Su definición alojada, publicada como
`20261013000456_caronte_sliced_print_receipts`, se releyó idéntica al cuerpo local.
Mantiene SECURITY DEFINER y acceso exclusivamente postgres/service_role;
search_path vacío y referencias cualificadas. No amplía permisos ni intentos.

La reproducción independiente de persistencia falló antes de la migración y
pasó después, tanto en PostgreSQL nativo como alojado, con ROLLBACK y cero
residuos. Conserva los contratos v2/v3, límites UTF-16 de cada intervalo,
predecesores, cursores, selección, lease y recibos inmutables. Sus geometrías y
recuentos son sintéticos: no acreditan medidas tipográficas ni PDFs. El SQL
comprueba identidad y estructura; el renderer comprueba hashes canónicos y texto.

El primer despliegue v27 todavía exponía solo las cinco funciones antiguas en
la fachada perezosa del endpoint. La cola avanzó cuatro planes enteros y volvió
a fallar por CPU. El lote se detuvo; no se ocultó ni reseteó ese intento. Ocho
pruebas independientes ejecutan la función real, sin copiar su lógica: cinco
fallaron por los tres métodos ausentes. La ruta real también reprodujo la vía
antigua. Se añadieron únicamente planChapterSlice, finishChapterSlices y
selectLayoutSize a la fachada. Las 30 pruebas enfocadas y la suite íntegra pasan.
Status/enqueue siguen sin cargar fuentes; autenticación y permisos no cambian.

El servidor v28 se desplegó una vez y sus 20 archivos efectivos exportados
se releyeron byte a byte. El paquete incluye 22: el exportador omite scoring.ts
y territory.ts, dependencias transitivas intactas de HEAD. No afirmar que esos
dos archivos omitidos fueron releídos del exportador.

La prueba real completó siete recibos slice-count:0:13.3, rangos contiguos
0–24–48–72–96–120–144–165, y plan:0:13.3. Conservó su input hash anterior
y terminó intento 2 sin reset; salida canónica igual al plan original congelado.
Los trece recibos previos conservaron sus filas completas. El trabajo quedó
queued/plan, sin error, no ready. Esto acredita esta cadena alojada, no el
presupuesto de todo el libro ni los archivos finales. No se llamó a modelos,
Storage o validación de archivos de Lulu en esta comprobación.

Los pasos iniciados deben conservar su `input_hash` y su presupuesto. Los nuevos
recibos derivados no pueden cambiar las identidades anteriores. Los pasos
completados permanecen inmutables; no se recalculan ni se sustituyen. Deben
verificarse pérdida de proceso, lease, revisión del manuscrito y tres intentos,
con SQL real y ROLLBACK. Estas pruebas de persistencia ya pasaron. Queda continuar
el mismo trabajo alojado y verificar sus archivos auténticos, sin nuevas reservas.

Ninguna prueba autoriza revisión humana, envío de PDF a Lulu, pedido o pago.
