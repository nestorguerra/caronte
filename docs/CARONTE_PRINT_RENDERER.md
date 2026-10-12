# Interior y cubierta: corte local

## Contrato

El generador compartido `caronte-print.mjs` usa pdf-lib 1.17.1 y fontkit 1.1.1.
El lock de pnpm conserva también versiones e integridad de las dependencias
transitivas. La instalación no ejecuta scripts de paquetes.

Crimson Text regular, negrita y cursiva se incluyen sin modificar, con su licencia
OFL y procedencia fija. Sus hashes se comprueban antes de incrustarlas. El texto
conserva Unicode y orden de párrafos; un glifo no disponible bloquea la salida,
no desaparece ni se sustituye por una fuente base.

El interior usa 5,83 × 8,27 pulgadas, páginas individuales, texto negro y márgenes
espejados: interior 72 pt, exterior 36 pt. El cuerpo se selecciona entre 12–14 pt
con interlineado 1,4. Se miden las líneas con la fuente real. Hay portadilla,
aviso editorial, índice con páginas y aperturas de capítulo en recto. Solo se
añaden blancos estructurales de recto/encuadernación, nunca notas para llenar.

Se exige fuente de 45–55 mil palabras, cinco capítulos y edad futura = edad
actual + 40. Se vuelve a abrir el binario para contar las páginas físicas. Si no
cabe en 180–200 páginas con estos límites tipográficos, el generador devuelve
`print_pagination_needs_revision`; no recorta el manuscrito.

La cubierta es otro PDF: contracubierta, lomo y portada, con sangrado exterior.
En producción, sus dimensiones se solicitan a Lulu después de conocer las
páginas reales, con el SKU A5 concreto. La fórmula de la guía solo se permite
en una prueba privada marcada explícitamente como sintética.

## Integración y seguridad

`generatePdf` enruta los manuscritos `caronte-literary-v2` al nuevo generador.
Exige entorno explícito y un par OAuth completo. Resuelve primero
`LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` del entorno, o el par cifrado de la base
de datos si no hay variables de credenciales. Un entorno parcial bloquea el
fallback; no mezcla procedencias. `LULU_API_KEY` sigue siendo un campo heredado,
no una credencial suficiente. El panel prepara guardado cifrado y prueba OAuth
separada, verificados solo localmente. Véase `CARONTE_LULU_CREDENTIALS.md`.

Los dos objetos se crean sin sobrescritura en una ruta privada única. Se releen
todos sus bytes y se compara tamaño y SHA-256. No se guarda una fila de PDF
completa si falla uno de los dos objetos. La fila y el estado de sesión se
releen antes de anunciar finalización. El panel dispone de enlace privado
temporal para revisar la cubierta independiente.

El generador mantiene `ready_for_print=false`. El nuevo servicio de preflight
puede cambiarlo solo tras revisión humana ligada por hash y normalización de los
dos PDF en Lulu; véase `CARONTE_PRINT_PREFLIGHT.md`. Solo está comprobado con
límites externos sintéticos. Pedir dimensiones no valida archivos. No crea pedidos ni paga.

## Prueba privada reproducible

1. `node scripts/create-print-proof.mjs`: crea interior y cubierta con una fixture
   sintética original, no una entrevista personal ni una obra del escritor.
2. Python del runtime con pypdf: `scripts/verify-print-proof.py` relee los PDF,
   verifica fuentes, geometría, hashes y todo el texto extraído en orden.
3. Poppler renderiza portadilla, índice, aperturas, cuerpo, última página y cubierta.
   Esos renders deben inspeccionarse; extraer texto no demuestra buen diseño.

Resultado local del 11 de octubre: 48.300 palabras, 150 párrafos, 194 páginas de
interior y una de cubierta. Cuerpo 12,5 pt. Texto extraído íntegro: 295.284 caracteres.
Los artefactos privados quedan en `output/pdf`, fuera del build y excluidos de Git.

## Límites del despliegue y del piloto

Las fuentes se declaran como `static_files` solo en la función Caronte.
Antes de desplegar se debe comprobar su inclusión real en el bundle y probar
su carga en Edge. No se ha ejecutado el runtime Deno/Edge ni verificado consumo
de CPU/memoria en Supabase. La duración local de una fixture repetitiva no
garantiza que un libro real entre en los límites de ejecución del servidor.

El corte del 12 encontró y corrigió medición excesiva de prefijos. La fixture
variada conserva el plan exacto, pero todavía consume una mediana local de
6,4 segundos de CPU frente a los 2 segundos por petición que documenta Supabase.
No es prueba alojada: falta resolver la ejecución por bloques o un trabajador
adecuado antes de activar la ruta. Véase `CARONTE_PRINT_PERFORMANCE.md`.

El resto de configuración compartida de LicitIA no se modifica. No se ha
desplegado esta función, publicado Pages, validado un PDF auténtico en Lulu ni
creado/pagado un pedido. Falta una cola de maquetación/impresión con recuperación
persistente; un fallo puede dejar un objeto privado sin fila final. La regeneración
no debe repetir automáticamente un pedido ni borrar esos objetos sin autorización.

Fuentes primarias consultadas el 11 de octubre de 2026:

- [Lulu Book Creation Guide](https://assets.lulu.com/media/guides/en/lulu-book-creation-guide.pdf).
- [Lulu Print API](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml).
- [Supabase: static_files](https://supabase.com/docs/guides/local-development/cli/config#functions.function_name.static_files).
- [Supabase: dependencias](https://supabase.com/docs/guides/functions/dependencies).
- [pdf-lib: fuentes](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
- [Crimson Text: fuente y licencia](https://github.com/googlefonts/Crimson/tree/4f1458ae64c6c0d9c5fdfbf5095c7fabe0fa063f).
