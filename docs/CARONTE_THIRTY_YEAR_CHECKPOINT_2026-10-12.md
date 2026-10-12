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
- Suite local actual: 486 pruebas completas sin fallos, comprobaciones heredadas,
  validate y build. La adaptación del recibo real de Lulu también pasó 78 pruebas
  enfocadas antes del despliegue.
  Sol reserva 25.000 tokens de razonamiento/salida sin aumentar las palabras de
  prosa exigidas. Opus usa los límites aprobados: 16.000 por unidad y 25.000 final.
- La migración aditiva de cuatro RPC pasó en PostgreSQL nativo y en el servidor
  alojado, con ROLLBACK de las filas sintéticas. Se releen los objetivos 216/224,
  los leases y los permisos exclusivos de servicio. Cero filas de esos tests.
- Servidor desplegado v26: veinte archivos efectivos idénticos al paquete,
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
- Corte funcional publicado: ccae4565915720269e5c65469cd5c5220026ccbf.
  GitHub Pages 38254776015 terminó con éxito y CI verificó 484 pruebas sin fallos,
  las comprobaciones heredadas, validate y build. HTML y CSS públicos releídos
  después del despliegue: idénticos al original 48157ae y al árbol local.
  HTML SHA256: fd5a9ba3b0b3c246f51c6b97df06c321075e5480c2e75798c52858e5fec1b0d7.
  CSS SHA256: 55d0561bc758d8002e3a6bf9cc4a8cf99960503db131dfab5aae8282decbe7ce.

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
terminó y pidió cambios concretos de voz/anclaje. Sol reescribió la primera unidad
y Opus aprobó esa revisión. La segunda unidad también pasó. A las 13:28:59 UTC,
la tercera ya estaba escrita y en revisión real de Opus. A las 13:29:46 UTC quedó
bloqueada por `review_evidence_mismatch`, recibo `msg_011CfxRUKydzgA8N21cEEc4y`.
El identificador y consumo (59.525 tokens de entrada, 4.939 de salida) están
persistidos, pero el motor no conservó la respuesta rechazada. No puede precisarse
qué cita o referencia falló ni recuperarse mediante el transporte actual de Claude.
No se inventa su contenido ni se fuerza una aprobación. Estos avances no acreditan
un manuscrito completo ni su impacto humano.

La prueba de regresión reproduce la pérdida de una revisión con cita falsa usando
el validador literario real. La corrección desplegada conserva el objeto rechazado como
diagnóstico privado y terminal, nunca como salida aprobada ni como log público.
No cambia prompts, modelos, criterios o hashes; tampoco reanuda ese trabajo.
Dos pruebas nuevas pasaron después de fallar antes del arreglo. Las 66 pruebas
enfocadas pasan. La misma persistencia se comprobó en PostgreSQL nativo y alojado con
ROLLBACK; un claim o resume accidental mantiene bloqueada la revisión inválida.
La suite completa de 486 pruebas, validate y build pasan; el servidor v26 fue
releído byte a byte antes de iniciar la recuperación.

La autorización humana `call_e195f69bd1444c19aa15a9da4cdc9775` aprobó una sola
repetición de la tercera revisión, sin reescritura ni otro gasto. La operación
exclusiva de servicio exige esa etapa, el recibo/hash exactos, el estado histórico
conocido y el consumo conservado. Su aprobación
`c78f4202-15db-4e21-9e48-7e022871f004` se consumió una vez: la fila volvió a retry
manteniendo intento y hash. El historial conserva el recibo y consumo anteriores
completos. La relectura confirma esa reserva; el servidor aceptó el aviso, pero
todavía no se confirma el resultado de la nueva revisión. No se reutiliza la
aprobación de la primera truncada. La prueba SQL pasó RED→GREEN en PostgreSQL
nativo y en el servidor, con ROLLBACK: identidad, incertidumbre, segundo intento,
segunda aprobación, acuse perdido y permisos exclusivos de servicio comprobados.

Con aprobación expresa se activó un seguimiento de este chat cada quince minutos:
`caronte-completar-la-validaci-n-del-libro`, asociado al mismo chat.
Configuración releída como ACTIVE.
Continúa solo la validación del libro existente y no crea otros libros. Permanece
en silencio ante avances normales; informa de fallos, decisiones o finalización.
No amplía las autorizaciones de costes, reintentos, datos, pedidos ni pagos.

Pendientes: recorrido literario completo y lectura humana; composición del manuscrito auténtico y una
aprobación ligada a su futuro par de PDF antes de preflight Lulu. Los recibos
técnicos sintéticos no se reutilizan para otro libro. El piloto no se declara listo.

## Comprobación de seguimiento: 14:24 UTC

La tercera repetición autorizada terminó con pass, recibo
`msg_011CfxSdjZbK4fdYDvCr5RkJ`, intento 2, mismo hash y consumo 59.525/7.112.
La publicación posterior `78a319e02249a8ae3a37eb42c175e12e0eb61944` terminó en
Pages `38257898379 SUCCESS`. Ambas aprobaciones de repetición están consumidas.

El mismo libro avanzó sin intervención hasta siete unidades aprobadas. La octava,
`ch_02_u_02`, se bloqueó a las 14:11:33 UTC por `review_evidence_mismatch`.
Recibo `msg_011CfxUexUEsQW1REXCWrPRa`, intento 1, entrada 62.423 y salida 5.139;
hash `43d628a12b98aa38a02d2945b376dbf13c7929912c674a9a48895c330c8dbe5f`.
La respuesta original completa está conservada en `diagnostic.artifact`, terminal
y no incierta. No se repitió ni se escribió en producción durante el diagnóstico.

Se leyó toda la unidad y revisión: 29 párrafos y 16 citas exactas y únicas.
Diez referencias son correctas; seis índices apuntan al párrafo siguiente.
Una copia local con solo esos seis índices corregidos pasa el validador ORIGINAL;
la respuesta original sigue fallando, como debe. No se alteraron citas, prosa,
puntuaciones, observaciones ni criterios. La copia canónica propuesta tiene SHA256
`0e7b1a9e90c7947bf2980c1aa71553b2aaf075ec6f1c45c4f8f6ec858e0e27bd`;
el original, `6a87fa4b8ad6e5a98bd890a8c0abd55990602070cd7687b2c77d16fe0870567a`.

Informe y tres JSON privados: `/tmp/caronte-deployment.P4WcDs/unit-eight-evidence-audit.md`.
La conciliación de operador y reanudación de ESTE recibo están preparadas como
propuesta, no implementadas ni autorizadas. Se solicita una decisión humana;
no se sustituye por una llamada pagada ni se reusa una aprobación antigua.
Conservar tres observaciones menores para la lectura completa, incluida una
concordancia de género en la voz de Ada. No declarar aprobación literaria humana.
Mientras no llegue una decisión, seguir comprobando sin repetir esta alerta.

## Conciliación autorizada y verificada: 15:00 UTC

La autorización humana `call_hbOMDt1ZtzrqU1j494Wgy9Sl` aprobó únicamente los
seis números de párrafo de esa revisión. La reserva
`f3f5f2f9-f3bf-4294-9e85-52d4320f7816` se consumió una vez a las 14:59:21 UTC.
La operación `caronte_reconcile_review_references` es SECURITY INVOKER, con
search_path vacío y permisos exclusivos de servicio. No hay nueva ruta de
navegador/trabajador ni un permiso nuevo en sus claves. El cuerpo del servidor
fue releído idéntico al archivo de migración generado por CLI 2.120.0.

La operación exige el mismo recibo/hash/respuesta original, unidad/etapa/intento,
consumo 62.423/5.139, respuesta terminal completada sin incertidumbre y ausencia
de lease vigente. Deriva SOLO el mapa aprobado de seis índices. Rechaza cualquier
cambio de cita, puntuación, comentario u otro campo, citas ausentes o ambiguas,
issues major y puntuaciones inferiores a cuatro. Conserva diagnostic completo,
identificador, intento, hash, consumo y toda la fila histórica; no hay POST a Opus.
Un acuse repetido no reinicia la siguiente unidad; otra aprobación se rechaza.

La prueba SQL independiente comenzó RED por operación ausente; pasó GREEN en
PostgreSQL nativo, con rol real service_role y también en Supabase alojado.
Todos los cambios sintéticos se revirtieron con ROLLBACK: cero filas residuales.
Se corrigió una fixture de prueba que usaba book_status=blocked, no admitido:
el estado real del motor es failed. No se cambió la restricción ni el validador.
La nueva prueba del motor confirma que el recibo completado salta a la novena
unidad sin volver a consultar ni enviar la revisión octava, mantiene el binding
y no expone su diagnóstico. La suite completa pasa: 4 de paquete y 483 Caronte
(487), comprobaciones heredadas, validate y build. PostgreSQL nativo detenido.

Relectura durable: octava revisión completed/pass, mismo
`msg_011CfxUexUEsQW1REXCWrPRa`, intento 1, hash y consumo intactos, respuesta
original y recibo enteros conservados; copia aprobada y mapa exactos.
La consulta de las 15:00:25 UTC confirma Sol escribiendo `ch_02_u_03`, recibo
`resp_0736a95911588ea3006accf609078087d2883bd7e8c87079c4` guardado, sin error.
No se repitió Opus, no se reescribió la octava unidad y no se tocaron HTML/CSS.
La reserva y las dos antiguas repeticiones están consumidas: nunca reutilizarlas.
El libro completo y el piloto siguen pendientes de revisión literaria/humana/PDF.

## Publicación y nuevo diagnóstico: 15:08 UTC

La conciliación octava se publicó en GitHub main con
`e1bde192f9efb4005a184a4537d897ec55522f3e`; Pages `38267674179 SUCCESS`.
CI confirmó 4 + 483 pruebas sin fallos, validate y build. HTML y CSS públicos
releídos a las 15:08:15 UTC, HTTP 200: hashes originales idénticos a los indicados
arriba. No se cambiaron la página ni el validador ni los proveedores.

Sol terminó `ch_02_u_03`, recibo
`resp_0736a95911588ea3006accf609078087d2883bd7e8c87079c4`.
Su revisión se bloqueó a las 15:06:19 UTC por `review_evidence_mismatch`:
`msg_011CfxYqY2qLR6TshNGrGZb9`, intento 1, entrada 63.703 y salida 4.881.
Respuesta completa conservada, terminal completed y uncertain=false.
Input hash `8b96a7b0fe17d8e94ab88a2bd203928b6eb1c8eed197b569c334497d1ee8823e`.

Lectura íntegra de 32 párrafos y revisión: 16 citas literales y únicas, diez
referencias correctas y seis desplazadas al párrafo siguiente. Solo en una copia
local, los índices evidenceIndex 1,4,7,9,11,15 pasan respectivamente
25→24, 29→28, 27→26, 33→32, 32→31, 23→22. Ese candidato pasa el validador
ORIGINAL; el objeto original sigue fallando. Ningún otro campo cambia.
Original SHA canónico `a9c2c706dd0e7c43776437cea873ede3faf4dd371104428a4786d276319acb49`;
candidato `eae9eb572ffe2abe8b63f9b729595c5a9ad53a34cf7c6e3abbc8aae75d2acf89`.
Informe y JSON privados en `/tmp/caronte-deployment.P4WcDs/unit-nine-evidence-audit.md`.

NO se implementó ni aplicó esta conciliación nueva. La autorización octava está
consumida y no cubre la novena. Se solicita autorización específica; mantener el
libro bloqueado, sin repetir Opus ni reescribir. Conservar las cuatro observaciones
menores (horas, vuelta del cine, atribución de irritación y gesto de la camisa)
para la lectura completa. El diagnóstico no acredita aprobación literaria humana.
Ante estado igual no repetir la alerta ni la solicitud. PostgreSQL local detenido.

## Novena conciliación autorizada y verificada: 18:06 UTC

La autorización humana `call_5307ae47b6aa457e8b4ed3b11f1a5ae7` aprobó únicamente
los seis números de párrafo de la novena revisión. La reserva
`e6e1319d-053a-40f7-b447-2d644cbf8f21` se consumió una vez a las
18:02:47.644525 UTC. El estado pendiente de las 15:08 es histórico y queda
resuelto; NO volver a aplicar esa autorización ni las anteriores.

La nueva operación exclusiva de operador `caronte_reconcile_ninth_review_references`
está ligada al recibo `msg_011CfxYqY2qLR6TshNGrGZb9`, hash y seis cambios
exactos indicados arriba. SECURITY INVOKER, search_path vacío y EXECUTE solo para
service_role; sin ruta ni permisos nuevos de navegador o trabajador. El cuerpo
alojado se releyó byte a byte idéntico a la migración CLI 2.120.0. La operación
octava no se modifica. No cambian prompts, prosa, validador, criterios ni modelos.

Relectura durable: novena completed/pass, intento 1, mismo recibo/input hash y
consumo 63.703/4.881. Diagnostic íntegro, fila original e historial previo completos,
mapa exacto y copia validada conservados. La copia pasa el validador original;
el objeto rechazado original sigue fallando. Se comparó la fila completa del
borrador y no cambió. No hubo otra llamada a Opus ni reescritura de la unidad.

La prueba SQL independiente pasó RED por operación ausente y GREEN en PostgreSQL
nativo, con service_role real y también alojado, siempre con ROLLBACK. Se comprobó
cero residuos; la regresión octava pasa. El único arreglo de fixture fue renombrar
una variable ambigua, sin cambiar condiciones ni expectativas. La nueva prueba
del motor salta al décimo borrador sin consultar ni repetir Opus y mantiene el
diagnóstico privado. Suite completa: 4 de paquete + 484 Caronte = 488 pruebas,
sin fallos, más 17 comprobaciones heredadas; validate y build pasan. Se usó el
Node integrado porque npm no estaba disponible, sin instalar dependencias.
PostgreSQL nativo detenido y puerto 24074 libre.

Un aviso inicial con cabecera incorrecta fue rechazado HTTP 400 antes del claim;
no generó etapa ni llamada a un modelo. Una importación posterior falló antes de
HTTP por faltar process en el runtime. El ejecutable existente, con su cabecera
exclusiva correcta, aceptó un único aviso posterior. No se repitió la conciliación.
La consulta durable de las 18:06 confirma nueve unidades aprobadas y Sol escribiendo
`ch_02_u_04`, intento 1, recibo guardado
`resp_0933a961edd38050006acd21878b3487d2b14b48924818111b`, hash
`7bbab8e73ba9b5e2354043b73cb33f4822a55116bd222079cd9017f4bd8c2b92`.
El mismo trabajo continúa sin error; aceptación HTTP no se confunde con finalización.

Las cuatro observaciones menores de la novena siguen pendientes de lectura
completa. Cualquier fallo nuevo exige diagnóstico nuevo y aprobación específica;
no corregir otras referencias automáticamente ni repetir llamadas pagadas.
La página no cambia. Manuscrito completo, lectura literaria íntegra, PDF genuinos,
revisión humana y aprobación de esos archivos exactos antes de Lulu siguen pendientes.
No crear pedidos ni pagos ni declarar listo el piloto.

## Publicación y avance verificados: 18:14 UTC

La recuperación novena se publicó en main:
`c2b35360d7b57565c7c64f30b466733a32a63471`, Pages `38288836269 SUCCESS`.
Build y deploy completados; logs CI: 4 + 484 pruebas, cero fallos, validate y build
correctos. El despliegue esperó sin pedir revisión humana ni cambiar reglas;
no se reinició. HTTP 200 a las 18:13:49 UTC, HTML y CSS públicos idénticos byte
a byte a los archivos locales y a sus hashes originales indicados arriba.

La décima `ch_02_u_04` terminó su revisión con pass:
`msg_011Cfxnz5fCn2M1DiyYbawN7`, intento 1, consumo 64.725/5.885 e input hash
`10dff9837b85980196bfcd79de3e511ca3272d8b3d44a42529800452cf0ad6d5`.
Diez unidades han pasado. Sol ya inició la undécima `ch_02_u_05`, intento 1,
recibo `resp_034b860750716eb7006acd23013d8487d28902b7e2d2a709d7` y hash
`d11143c4a2b5f08da64ec8ed98626a6c79b5c93ac62511fcc221a7ed69120b0a`
guardados. Relectura durable 18:13:51 UTC, mismo trabajo running/draft, sin error.
No despertar, modificar ni repetir proveedores mientras avance normalmente.
Seguimiento ACTIVE cada quince minutos, instrucciones releídas tras actualizar
el estado consumido y conservar todos los límites de revisión, costes y Lulu.
No se ha terminado el manuscrito ni validado su par auténtico de PDF.

## Nuevo diagnóstico y autorización pendiente: 20:22 UTC

El mismo trabajo avanzó sin intervención hasta las primeras 26 unidades aprobadas.
La revisión 27, `ch_05_u_03`, se bloqueó a las 20:17:01 UTC por
`review_evidence_mismatch`. Recibo `msg_011CfxxWtQwV9y6bUAJEeQi9`, intento 1,
consumo 80.303/5.781, cachés cero. El diagnóstico conserva la respuesta íntegra,
terminal `completed` y `uncertain=false`. Input hash y SHA canónico del borrador:
`0953ab1881820113b355cf06373421748fa609276e899962844542552baa4459`.

Se leyeron toda la unidad y la revisión: 29 párrafos, 2.048 palabras y 16 citas
literales, cada una en un único párrafo. Diez referencias son correctas y seis
están desplazadas. SOLO en una copia privada, evidenceIndex 5,7,9,11,13,15 pasan
respectivamente 30→28, 25→24, 31→29, 26→25, 22→21, 24→23.
La copia pasa el validador ORIGINAL sin modificarlo; el original reproduce el
rechazo. Ningún otro campo cambia: prosa, citas, puntuaciones, observaciones,
instrucciones y cobertura permanecen intactos. Las localizaciones escritas dentro
de los comentarios originales no sustituyen las comprobaciones de evidence.
SHA canónico original `41ccd006436ea4e1def130fc1ecfd67a8e8efe6557f1de643090196f05dcea29`;
candidato `3fa555c537948bf7babdc9b5392bd207e4e8600cd93ccff5f8acc00febfb4532`.

El programa privado de auditoría importa el validador real, comprueba identidad,
consumo, terminalidad, hash de entrada y unicidad; no hace peticiones de red ni
modifica la base de datos. Informe y archivos privados modo 0600 en el directorio
0700: `/tmp/caronte-deployment.P4WcDs/unit-twenty-seven-evidence-audit.md`.
Relectura durable a las 20:22:37 UTC: trabajo bloqueado, sin lease, sin manuscrito,
26 IDs aprobados contiguos; fila de revisión y borrador íntegros sin cambios.

NO se implementó ni aplicó esta nueva conciliación y NO existe reserva aprobada.
Se solicita autorización específica para este recibo y mapa. Las autorizaciones
octava y novena y las repeticiones primera y tercera YA ESTÁN CONSUMIDAS; nunca
reutilizarlas. Sin una respuesta humana nueva, no aplicar el candidato, reanudar,
despertar la cola ni repetir llamadas de pago. No cambiar prompts ni rebajar gates.
Tras comunicar este bloqueo y solicitar la decisión, no repetir la alerta.

Se conserva para lectura completa la repetición de la espera en cenas, la pregunta
del yo presente y la enumeración poco escénica de tareas. Se han leído íntegramente
de forma preliminar las unidades 1–18 y la 27, no el manuscrito final. El resto de
la novela, revisión longitudinal, lectura integral, PDF genuinos y autorización
humana ligada a sus archivos exactos antes de Lulu siguen pendientes.
No se modificaron HTML/CSS, servidor, proveedores ni publicaciones en este diagnóstico.
No hay pedidos, pagos ni envíos; el piloto todavía no está listo.

## Conciliación 27 autorizada y verificada: 20:37 UTC

El estado pendiente anterior es histórico. Néstor aprobó específicamente
`call_1afcaaf62b8047af96a7beb8337a91ae`: solo los seis números del mapa anterior,
sin repetir Opus ni reescribir la unidad. La reserva nueva
`27bea901-4866-4c82-86c5-37dce0cc0264` se consumió UNA VEZ a las
20:36:04.683030 UTC. JAMÁS reutilizar esta autorización ni las anteriores.

RPC exclusivo `caronte_reconcile_twenty_seventh_review_references`, migración
`20261012203353`, SECURITY INVOKER, search_path vacío, ejecución solo service_role.
Recibo/hash/consumo/mapa quedan fijos; cualquier otro cambio o cita ambigua se
rechaza. El cuerpo alojado coincide byte a byte con el local. Los cuerpos y
permisos de las operaciones octava y novena no cambiaron. El validador original,
prompts y HTML/CSS permanecen intactos. No se desplegó otra versión de Edge.

Pruebas RED→GREEN de ausencia y restricciones, PostgreSQL 17.11 nativo y alojado,
service_role y ROLLBACK; cero residuos sintéticos. Regresiones octava y novena
locales siguen pasando. La suite completa verificó 4 + 486 pruebas sin fallos,
las 17 comprobaciones heredadas, validate y build. Dos pruebas enfocadas se
repitieron únicamente tras ajustar el nombre local a la versión de migración
asignada por el servidor. PostgreSQL local detenido y puerto 24074 libre.
Un primer arranque local sin la ruta de su clave sintética falló antes de aceptar
conexiones; se diagnosticó y arrancó con la ruta privada ya existente. No se
cambiaron claves, dependencias, permisos generales ni procesos de producción.

Relectura durable 20:36:25 UTC: revisión 27 completed/pass, mismo recibo
`msg_011CfxxWtQwV9y6bUAJEeQi9`, intento 1, input hash
`0953ab1881820113b355cf06373421748fa609276e899962844542552baa4459`, consumo
80.303/5.781 y cachés cero. Respuesta original, fila completa anterior e historial
previo conservados; copia validada y mapa exacto añadidos al historial. Solo
cambiaron seis evidence.paragraphIndex. El borrador y los otros 61 pasos fueron
comparados completos y permanecen intactos. Evidencias privadas modo 0600.

Un único aviso con el ejecutable existente fue aceptado. No se repitió Opus.
Relectura 20:37:20 UTC: 27 unidades aprobadas, mismo trabajo queued/draft sin
error. Sol inició `ch_05_u_04`, intento 1, recibo
`resp_06ff67e4f7bc7b95006acd44e8af1487d2a686f0df6b541375`, input hash
`c44148c18803dfe6b1189657385555cc1e6329cff0fa068b4f9bc986a894cd6b`
guardados. No despertar ni modificar nada mientras avance normalmente.

Se leyeron preliminarmente completas las unidades 19 y 20 durante la espera;
el alcance de lectura real es ahora 1–20 y 27. No sustituye la lectura de las
30 unidades finales ni acredita revisión humana. Conservar las tres observaciones
menores de la revisión 27 para ese pase. El manuscrito, revisión longitudinal,
lectura íntegra, PDF genuinos y aprobación humana ligada a sus hashes antes de
Lulu siguen pendientes. No pedidos, pagos ni envíos; el piloto no está listo.
