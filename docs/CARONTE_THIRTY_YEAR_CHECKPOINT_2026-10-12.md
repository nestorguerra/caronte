# Caronte: contrato a treinta años

Contrato aprobado: novela autobiográfica del mismo sujeto treinta años mayor,
cinco capítulos conectados, 55.000-65.000 palabras como presupuesto de trabajo y
216-224 páginas físicas A5 (objetivo 220). La cubierta no cuenta como interior.
Sol 6.1 escribe con `xhigh`; Opus 5.5 revisa. Ninguna puntuación garantiza impacto
en un lector. La lectura humana completa del piloto sigue siendo obligatoria.

## Evidencia del corte

- Contrato v3 y snapshot de cada trabajo. Los contratos viejos o alterados se
  bloquean antes de llamar a un proveedor. No se reetiquetan libros históricos.
- Revisión en ocho dimensiones: anclaje, voz, profundidad, textura futura,
  coherencia, originalidad, reconocimiento y plausibilidad causal. Cada dimensión
  requiere citas literales verificadas contra la unidad y el párrafo indicados.
- Escritura y revisiones por unidad, seguidas de revisión del manuscrito entero.
  No se recorta el corpus ni se sustituye el libro por texto determinista.
- La composición actual usa pasos de 0,1 pt entre 12 y 14 pt. Mantiene cinco
  capítulos, texto íntegro y tipografía legible. No añade páginas de relleno.
  La composición histórica conserva sus cinco tamaños y su contrato original.
- Prueba real de PDF por etapas, incluyendo pérdida de un recibo y sustitución
  del trabajador: dentro del rango aprobado, cubierta separada y texto completo.
  Esto usa texto sintético; no acredita una novela escrita por un modelo.
- Suite local actual: 484 pruebas completas sin fallos, comprobaciones heredadas,
  validate y build. La adaptación del recibo real de Lulu también pasó 78 pruebas
  enfocadas antes del despliegue.
  Sol reserva 25.000 tokens de razonamiento/salida sin aumentar las palabras de
  prosa exigidas. Opus usa los límites aprobados: 16.000 por unidad y 25.000 final.
- La migración aditiva de cuatro RPC pasó en PostgreSQL nativo y en el servidor
  alojado, con ROLLBACK de las filas sintéticas. Se releen los objetivos 216/224,
  los leases y los permisos exclusivos de servicio. Cero filas de esos tests.
- Servidor desplegado v25: veinte archivos efectivos idénticos al paquete,
  comprobados mediante relectura completa del servidor.
  La configuración efectiva confirma `gpt-6.1-sol` y `claude-opus-5-5` disponibles.
- Lulu conserva IDs fiables aun cuando `errors` falta o es null. El POST no
  autoriza impresión. Un GET del mismo ID con NORMALIZED y errors:null confirma
  el resultado según el contrato oficial; un campo ausente sigue pendiente.
  No se inventan arrays vacíos. IDs, origen, páginas y SKU siguen obligatorios;
  una identidad dudosa o estado desconocido queda bloqueado, sin reenvío.
- PDF técnico privado alojado: 60.300 palabras sintéticas; 224 páginas A5 y
  cubierta de una página. Relectura independiente: todo el cuerpo coincide con
  el texto original, 29 recursos de fuentes incrustados y tamaños exactos.
  Renders del inicio, índice, final y cubierta comprobados. No es una novela.
- Los 105 planes nuevos guardan geometría de menos de 500 bytes por recibo,
  sin duplicar la prosa. Los planes históricos se conservan íntegros e inmutables;
  su geometría derivada se crea de uno en uno. El mismo trabajo alojado terminó
  tras recuperarse de WORKER_RESOURCE_LIMIT, sin cambiar IDs ni fuente ni fecha.
- Lulu producción: interior 4730218 y cubierta 4730221 NORMALIZED mediante
  consultas del mismo ID, aprobados explícitamente para esta prueba técnica.
  Caronte releído: ready_for_print=true, send_to_lulu=false, sin pedido ni pago.
- PostgreSQL nativo y alojado: recuperación exacta de revisión y geometría
  verificadas con filas sintéticas y ROLLBACK. Los permisos siguen exclusivos
  de servicio. El entorno nativo quedó detenido al terminar.
- GitHub Pages del corte anterior 236ef27 desplegado con CI de 479 pruebas.
  HTML y CSS públicos idénticos al original 48157ae y al árbol local. Los cambios
  posteriores de imprenta/recibos se están preparando para la misma publicación.

## Límites y siguientes verificaciones

La repetición previamente aprobada del interior técnico antiguo quedó incierta
por un fallo del operador al capturar su recibo. No se perdió esta incertidumbre
ni se autorizó otro envío. No se creó ningún pedido ni pago.

El trabajador exclusivo de libros se activó con aprobación específica. Las copias
privadas tienen modo 0600, la huella de Supabase coincide y GitHub confirmó su
ejecución 38253812749. La variable está en true. No se entrega al runner la clave
administrativa, la de imprenta ni claves de proveedores. Sus intentos de entrar
en administración/imprenta fueron rechazados.

Una entrevista privada de un personaje ficticio prueba el recorrido literario
real. No contiene datos de una persona real ni acredita consentimiento, captura
de voz, efecto humano o entrega del piloto. No altera la página ni añade demos.
Sol completó biografía, mundo, estructura y la primera unidad. Opus agotó su
límite inicial de 6000 tokens. Una autorización humana permitió repetir una sola
vez esa revisión con 16000; el recibo y consumo previos se conservaron íntegros.
La recuperación exige el mismo hash, rechaza incertidumbre/refusals y otra
repetición; un acuse perdido no reinicia el trabajador. La segunda revisión real
terminó y pidió cambios concretos de voz/anclaje. Sol está reescribiendo la unidad.
Esto acredita proveedores y revisión reales, no el manuscrito completo.

Pendientes: publicación del último corte y relectura de Pages/CI; recorrido
literario completo y lectura humana; composición del manuscrito auténtico y una
aprobación ligada a su futuro par de PDF antes de preflight Lulu. Los recibos
técnicos sintéticos no se reutilizan para otro libro. El piloto no se declara listo.
