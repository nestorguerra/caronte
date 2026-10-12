# ADR-001: maquetación por etapas acotadas

Fecha: 12 de octubre de 2026. Estado: **Propuesto** para el trabajador persistente.
Las primitivas y pruebas existen en local. No hay activación ni despliegue.

## Contexto

Objetivo intacto: libro auténtico de cinco capítulos, 180–200 páginas, interior
A5 y cubierta independiente, revisión humana y preflight de Lulu. Sin controles
de demo ni cambios de diseño en la web pública.

La generación monolítica optimizada consume una mediana local de 6.427 ms de
CPU con texto variado. [Supabase](https://supabase.com/docs/guides/functions/limits)
documenta 2 segundos de CPU por petición y 256 MB de memoria, consultado hoy.
Node/RSS no son los contadores de Edge: no prueban su fallo ni su viabilidad.
Una tarea en segundo plano no elimina esos límites.

## Opciones y decisión preparada

1. Un único render: menos peticiones, pero sin margen CPU local.
2. Un capítulo con los cinco tamaños: ensayo real descartado, pico 1.916 ms.
3. Un capítulo y un tamaño; dibujar hasta diez páginas por etapa; unir al final.
   Menor pico medido, más peticiones y CPU total.
4. Trabajador con mayor presupuesto CPU/memoria. Puede ser necesario si Edge
   no pasa. Cambia coste/configuración: requiere decisión y autorización propias.

Se propone la opción 3, condicionada a prueba alojada y persistencia real.
No se contrata un runtime nuevo ni se habilita la opción 4 automáticamente.
`createPrintStages` comparte corte de líneas y decoradores de la plantilla
existente. Exige la fuente completa y las tres fuentes tipográficas con hashes
fijados. No comparte documentos, cachés ni texto entre trabajos.

| Etapa para este interior de 194 páginas | Llamadas | Contrato |
| --- | ---: | --- |
| Planificar capítulo/tamaño | 25 | Un capítulo y uno de 12/12,5/13/13,5/14 pt; sin valor implícito que haga los cinco. |
| Componer | 1 | Matriz completa sin duplicados; tamaño más próximo a 190 páginas. |
| Dibujar partes | 20 | Rangos canónicos 1–10, 11–20…191–194. |
| Unir interior | 1 | Reabrir bytes exactos; comprobar identidad/hash/recuento/A5; API pública `copyPages`. |
| Cubierta | 1 | Reabrir interior; obtener dimensiones para el recuento físico. |

Son 48 etapas, no 48 llamadas HTTP recursivas. Supabase limita a 30 peticiones
anidadas por traza. El futuro disparador debe despertar etapas independientes,
sin depender del navegador ni de una cadena recursiva.

Los recibos ligan plantilla, versión de etapas, fuente, fuentes tipográficas,
plan, aviso de prueba, rango y bytes. JSON canónico tolera distinto orden de
claves en JSONB. El manifiesto incluye una fecha congelada antes del render:
otro día de intento no altera los bytes. Los hashes sin clave comprueban
integridad/identidad, **no autenticación**. Solo aceptar objetos/recibos privados
con identidad/hash esperados reservados en DB; nunca manifiestos arbitrarios
del cliente. La unión exige como máximo 20 partes/20 MB agregados antes de
procesar PDFs. Errores del parser sin contenido interno.

`ready_for_print=false` hasta revisión humana y validación/normalización
auténticas de ambos PDFs en Lulu. La unión no autoriza la impresión.

## Medición y consecuencias

Fixture privada: 48.300 palabras sintéticas variadas, 150 párrafos, 194 páginas.
Mac arm64, Node v24.19.0, pdf-lib 1.17.1 y fontkit 1.1.1 ya autorizados.
Tres muestras de 48 procesos independientes: 144 etapas, sin cachés heredadas.
Imports excluidos de CPU; lecturas JSON/fuentes, hashes, escritura y relectura
incluidos. RSS sí incluye imports. Cero llamadas externas y pagos.

| Muestra | Pico CPU por etapa, ms | RSS máximo, MiB | CPU acumulada, ms |
| --- | ---: | ---: | ---: |
| 1 | 770 | 177 | 24.548 |
| 2 | 901 | 172 | 24.291 |
| 3 | 818 | 172 | 25.699 |

El primer tramo de la muestra 1 coincidió brevemente con una relectura pypdf
del ensayo anterior. Muestras 2 y 3 sin esa tarea simultánea. No se garantiza
el comportamiento de otros manuscritos o de un isolate. La CPU total crece por
validación/inicialización en cada proceso; se gana margen a costa de trabajo y
peticiones. Sin precio estimado ni reducción de gates. Composición: mayor RSS.

Los veinte fragmentos, interior y cubierta son byte a byte idénticos entre las
tres muestras con igual fecha. El hash del plan completo en la serialización
original sigue `7f3e02233706bf3f1d67b8232c22d8f2bd8ec77ba60f190ab347bb4ab57c391c`.
Hash canónico del mismo plan:
`bb59ed8f3f11910fae3bd8cb768cdd52ffcc04f3ac9f060ab41011ecdd0b8bff`.
Son serializaciones distintas, no cambios de composición.

Pypdf releyó las tres parejas: 295.284 caracteres íntegros, fuentes incrustadas
con ToUnicode, geometría y hashes correctos. Siete renders Poppler inspeccionados:
portadilla, índice, apertura, cuerpo, última página de texto, blanco final y
cubierta. Sin defectos observados allí; no es revisión visual integral ni
auditoría literaria de un libro auténtico.

## Acciones antes de aceptar y activar

- Verificar en SQL la reserva única de ID/versión/fecha/fuente, claim/lease/CAS
  y las assertions preparadas en ADR-002. Implementación local no prueba DB real.
- Probar recuperación de huérfanos por identidad reservada en Storage real;
  sin otra versión, sobrescritura ni borrado. La prueba local conserva los pasos.
- Verificar la conexión local de arranque/consulta/worker/disparador a UI existente
  en el runtime alojado. Mantener desactivada hasta aprobación de despliegue.
- Probar SQL/RLS/CAS, dos workers, interrupción entre objeto/DB y aviso perdido;
  empaquetado Deno y CPU/memoria alojadas con manuscritos auténticos.
- Revisión humana, preflight y aprobación de precio/destino antes de pedidos.
  Solo la entrega real cierra el piloto.

El benchmark conserva JSON/bytes entre procesos, no una cola SQL durable ni
recuperación remota. Después se preparó el coordinador/archivo privado/migración
de [ADR-002](ADR-002_DURABLE_PRINT_COORDINATOR.md). Sus pruebas locales recuperan
objetos entre instancias, pero no ejecutan SQL ni Storage reales. Después se
conectaron arranque/consulta/worker en local con gate default-off; no desplegados.
El servidor publicado sigue sin ese flujo. Ver `CARONTE_PRINT_RECOVERY.md`.
El cierre añade un claim a estas 48 etapas: 49 para el caso de 194 páginas.
Tarea 07 y objetivo completo abiertos.

## Reproducción y evidencias

```sh
node --test scripts/test-caronte-print-stages.mjs
node scripts/benchmark-caronte-print-stages.mjs --output-dir=/ruta/privada/nueva
python scripts/verify-print-proof.py /ruta/privada/nueva/sample-1
```

Carpeta absoluta y escritura `wx`: no sustituye evidencias anteriores. Fallos
observados antes del arreglo: ámbito no acotado por tamaño, rangos no canónicos,
agregado sobredimensionado, detalles de parser y fecha variable del intento.
Trece pruebas enfocadas pasan. Suite declarada ampliada: **347/347 sin skips**,
diecisiete comprobaciones heredadas, validación y build. HTML/CSS idénticos a
48157ae. Ningún control de interfaz añadido/editado en este corte.

Evidencia privada, no publicada ni enviada a Lulu:

- Ensayo descartado: `/tmp/caronte-print-stages.rNtINd`.
- Tres muestras finales: `/tmp/caronte-print-stages-small.2o2QTl`.
- Siete renders inspeccionados: `/tmp/caronte-print-stages-review.9pzhgK`.

Sin nuevas dependencias, credenciales, cuentas, commit, push, despliegue, pedidos
ni pagos en este corte.
