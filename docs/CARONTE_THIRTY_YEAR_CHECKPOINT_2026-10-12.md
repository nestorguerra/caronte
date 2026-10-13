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

## Publicación 27 verificada: 20:42 UTC

Corte publicado en GitHub main `8ab45215b3602942c442a8f05f9cbe03ef41ed49`.
Pages `38305687011 SUCCESS`: build terminado 20:40:58 y deploy 20:41:31 UTC.
Logs CI releídos: 4 + 486 pruebas, cero fallos, las 17 comprobaciones heredadas,
validate y build correctos. El archivo del usuario SPEC-fulfillment.md permanece
fuera del commit y sin modificaciones. No se publicaron las evidencias privadas.

HTTP 200 a las 20:42:23 UTC. HTML y CSS públicos comparados byte a byte con los
locales y sus hashes originales, sin ningún cambio de página:
HTML `fd5a9ba3b0b3c246f51c6b97df06c321075e5480c2e75798c52858e5fec1b0d7`;
CSS `55d0561bc758d8002e3a6bf9cc4a8cf99960503db131dfab5aae8282decbe7ce`.

Relectura 20:42:22 UTC: Sol terminó el borrador 28 conservando su recibo,
input hash y un único intento; consumo 40.954/9.836. Opus comenzó su revisión
`review:ch_05_u_04:0`, input hash
`45bcdd6144443580b8f6438f29eb26e199d0347e30ebaffe6a3a812cd2a46e04`,
estado started y todavía sin recibo guardado. Es una llamada síncrona en curso,
no aprobación ni pérdida confirmada. No tocar, despertar ni repetir esa etapa.
Trabajo running/review sin error, 27 unidades aprobadas y sin manuscrito final.
Seguimiento ACTIVE con la reserva 27 registrada como consumida. Todos los límites
literarios, de PDF, de aprobación humana antes de Lulu y de no pedidos/pagos
permanecen. El piloto sigue sin completarse.

## Mensajes públicos autorizados: 21:27 UTC

Dos decisiones humanas distintas, ya ejecutadas y consumidas. La autorización
`call_KQPgpfcIem7uIX91Y5ItwrTG` cambió solo las cuatro líneas de arranque que
identifican escritor, revisor, voz e imprenta y explican la revisión de operadores.
Commit `4b0fa31387aeb52dfa6e87aeaedf6841b1e4417f`, Pages `38309547900 SUCCESS`.
La autorización posterior `call_d430a0cfa97e4499938a402b106e68e9` cambió solo
las frases de intervención humana y conservación de datos de la introducción
escrita y hablada. Commit `ae7f86b58f51872ec926a766a240c6c858dcd412`, Pages
`38310471060 SUCCESS`, build 21:26:33 y deploy 21:26:45 UTC. No reutilizar estas
autorizaciones para otras frases, diseños, controles ni cambios de privacidad.

Solo producción JS líneas 71, 140, 141 y 144 en el segundo cambio; el resto es
byte idéntico al corte anterior. Misma voz, parámetros, etiquetas y pausas.
El servidor recibe el texto enviado; el guion de 1459 caracteres cabe en su límite
de 5000. No se inició entrevista ni se generó audio de prueba: esto no acredita
haber oído la nueva introducción. La apertura de verificación anterior creó una
sesión técnica vacía, no otro libro ni llamadas de voz/modelos. Nunca simular pago
o pulsar Enter en esa prueba para aparentar una validación de voz.

Dos pruebas nuevas RED (2 fallos, 7 existentes correctas) → GREEN 9; suite local
494, cero fallos/omitidas, 17 controles heredados, validate, build y sintaxis pasan.
Logs CI releídos: 4 + 490 correctas, 17 controles, validate y build. HTML/CSS HTTP
200 públicos 21:27:11 UTC, byte idénticos a originales/locales, mismos SHA arriba.
JS público exacto `scripts/future-book.js?v=20260908-original-flow`, SHA
`be97f30c1125b12cff76e011dbb33dbf33829adf9bb378a5eb2d8026f38bceb5`,
byte idéntico al local. Página real recargada sin activar entrevista; consola sin
errores ni advertencias. SPEC-fulfillment.md ajeno permanece sin tocar ni publicar.
El arranque terminó y recuperó una entrevista ya activa. No se pulsó ningún control,
no se alteró esa entrevista ni se pidió síntesis de voz. Se conserva la pestaña para
no cerrar el flujo recuperado. El texto nuevo se verificó en el JS servido y sus
dos constantes, no mediante una reproducción de audio ni una nueva aceptación.

El libro no está terminado. Las 30 unidades iniciales pasaron y se leyeron
preliminarmente sus 883 párrafos. Opus longitudinal 0 pidió revisión (no pass),
recibo `msg_011Cfy1UQzUxAw473K6KTrQ4`, hash
`548e5a32fbaaf7e7fec61cb8b9c37fc0a85d03ce700c08ea6c15ad9d2262fcbc`,
218408/11447 tokens. El motor seleccionó 14 unidades por sus ubicaciones;
son etapas editoriales normales autorizadas, no recuperaciones ni repeticiones
de llamadas fallidas. No alterar su plan, prompts o validador mientras avance.

Se han leído íntegras las nuevas revisiones 3 de unidades 1, 2, 5 y 7 y sus
revisiones Opus. Sus observaciones menores quedan pendientes del pase definitivo.
Unidad 2 corrige «sentada»; la unidad 7 abre la llamada al cliente sin resolver la
entrega y conserva consentimiento de Elena y costes de cuidado. Sus 16 citas
son literales y únicas. No confundir esa lectura parcial con el manuscrito final.
Relectura 21:23:57 UTC: mismo trabajo queued/revision sin error ni manuscrito,
unidad 7 revision/review completadas/pass, recibos
`resp_0354f0d92ea23abd006acd4e300fa087d2bce26655790a9af7` y
`msg_011Cfy3biHi4XVtWfHHnHcgV`, consumos 35781/11510 y 64750/5457.
Unidad 8 `revision:ch_02_u_02:3` waiting intento 1, recibo
`resp_0d104a592a2ea8bd006acd4fdf394c87d2b936d83e537a0b58`, hash
`b50c21d0c745b796deedea10f3105d8af61b9211db120d880fa24a36e6387987`.
Releída 21:26:24 con mismo recibo/hash, sin error ni diagnóstico. No despertar,
modificar ni repetir. Todas las recuperaciones 1/3/8/9/27 siguen consumidas.
Pendientes: manuscrito definitivo, lectura íntegra final y calidad literaria,
PDF genuinos, revisión humana y aprobación exacta por hashes antes de Lulu.
No pedidos, pagos ni envíos; no declarar listo el piloto.

## Manuscrito auténtico y revisión independiente: 22:47 UTC

El estado de 21:27 queda superado. El mismo trabajo
`fe2add31-e8d0-4757-99cc-5cf7b5d2d3da` llegó a ready/manuscript, sin error,
a las 22:24:00.598029 UTC. Releído de nuevo a las 22:47 UTC: mismo estado y
fecha, sin cambios. Manuscrito durable `0dabfb5d-3010-45e7-8c60-6fdc22a0a719`;
contrato JSON caronte-literary-v3, treinta años, narradora ficticia Ada Marín
de 80 años en 2056. Cinco capítulos, 30 unidades seleccionadas, 886 párrafos,
58.614 palabras. SHA canónico del original congelado:
`2644cd942c4a1d9286605316347301748d3394d202ade81cec72483e7ab5451b`.
Nunca sustituir este personaje ficticio por datos de Néstor o del proyecto Cortex.

Longitudinal 1 completed/pass, intento 1, recibo
`msg_011Cfy88Jdz96gJPoU2y5LuM`, input hash
`8c2ce9fd0538879574948504d08681a133a9f472c00bd6952898045edb9cc64b`,
consumo 217.892/10.680, completado 22:23:47.840752 UTC. Las 12 citas son
literales, únicas y correctamente ligadas. Las cinco secciones ensambladas son
byte idénticas a las 30 salidas definitivas seleccionadas. No se repitió Opus.

El asistente leyó íntegramente esas 30 unidades definitivas y terminó ese pase
a las 22:38:57 UTC. Además releyó las 21 respuestas originales ficticias y sus
68 evidencias biográficas: todas las citas están contenidas literalmente en la
respuesta fuente. Buena voz, costes reales, agencia de los demás y futuro
cotidiano plausible; ritmo repetitivo de presupuesto/permiso/llamada/reflexión.
Se contaron 21 párrafos de marco explícito de edades repartidos por 17 unidades.
Esto es juicio literario, no una garantía de impacto humano ni aprobación de
imprenta. La fila sigue awaiting_human_review; human_review pending y
print_pages_verified false. No sustituir esos estados por el pass automático.

Informe editorial completo y propuesta privada en
`/tmp/caronte-deployment.P4WcDs/genuine-literary-audit.md` y
`genuine-copyedit-proposal.json`, fuera de GitHub. Cuatro propuestas NO aplicadas:
pronombre en ch_02_u_04 P10, errata en ch_04_u_05 P17 y dos ajustes de continuidad
en ch_05_u_06 P12. Primera y dos últimas son interpretativas; segunda es errata.
Las cadenas originales son literales y únicas. Se pidió autorización humana
específica para esas cuatro correcciones. Sin respuesta, no mutar el original,
no transferir el pass anterior a texto nuevo ni hacer otra llamada de pago.
Si se aprueba, preservar original, mapa, nueva identidad y revisión real.

## Interior privado auténtico y panel publicados: 22:47 UTC

Se corrigió solo el fallo del panel privado que aún exigía 180–200 páginas:
v3 exige 216–224, v2 mantiene 180–200, contrato desconocido bloquea. No cambian
permisos, revisión humana ni gates de recibos inciertos o envíos. Cuatro pruebas
RED→GREEN y suite local/CI 498 sin fallos, 17 controles heredados, validate/build.
Corte GitHub `3af23d705c27a45bda2a033895506de4ae858822`, Pages
`38317146310 SUCCESS`: build 22:33:04, deploy 22:33:17 UTC. Cinco activos públicos
releídos HTTP200 y byte idénticos a locales a las 22:33:57 UTC. HTML/CSS principales
mantienen los SHA originales arriba. Panel recargado tras publicar: acceso privado
visible, sin errores ni advertencias; no se introdujeron credenciales ni se inició
ninguna acción de imprenta. SPEC-fulfillment.md ajeno sigue intacto y no publicado.

Interior local del original auténtico, mismo pdf-lib/fontkit, etapas y fuentes de
producción, sin contenido de prueba sintético. Archivo privado
`/tmp/caronte-deployment.P4WcDs/caronte-ada-interior-original-revision.pdf`:
1.077.623 bytes, SHA256
`09897f4ccab299e0581b362b54b4e6788430e3b0dc3e9c4e356541ddd9090fb1`,
224 páginas físicas A5, cuerpo 12 puntos/interlínea 16,8. Inicios de capítulos
5/49/93/137/181, blancos deliberados de encuadernación, sin truncar texto.
Comprobación independiente pypdf: los 886 párrafos/335.966 caracteres normalizados
idénticos al original; todas las fuentes incrustadas y dimensiones/numeración
comprobadas. Informe `genuine-interior-independent-check.json`.

Se renderizaron las 224 páginas y se inspeccionaron todas en cuatro hojas de
contacto indexadas. También se vieron individualmente las páginas
1/3/5/49/93/137/181/222/223. Sin recortes, solapamientos ni fallos de caracteres
observados en esa cobertura. No equivale a revisar las 224 a máxima resolución
ni a una prueba física. El archivo conserva las cuatro incidencias originales;
es una copia privada de revisión, no aprobación para Lulu ni fila durable del
PDF alojado. Cubierta, recorrido de imprenta alojado, revisión humana y aprobación
de los dos hashes exactos siguen pendientes. No se llamó a modelos, no se
despertó la cola, no se escribieron filas alojadas y no se envió nada a Lulu en
esta comprobación. No pedidos, pagos ni envíos. El piloto sigue sin completarse.

## Cubierta auténtica y diagnóstico alojado reversible: 23:03 UTC

El original, sus 58.614 palabras y las cuatro propuestas editoriales no cambian.
No ha llegado autorización para esas cuatro correcciones; no aplicarlas ni volver
a solicitar la misma decisión. Ninguna autorización anterior permite transferir
el pass de Opus a una edición nueva. La identidad canónica sigue siendo
`2644cd942c4a1d9286605316347301748d3394d202ade81cec72483e7ab5451b`.

La cubierta privada original se compuso con el motor y fuentes de producción:
`/tmp/caronte-deployment.P4WcDs/caronte-ada-cubierta-original-revision.pdf`,
18.719 bytes, SHA256
`fedaf7c39c69afe65ae170c97234d45225c7596ec43c6525d2589d074b30a7c4`.
Consulta real única de autenticación OAuth y medidas a Lulu producción: 224
páginas, SKU `0583X0827.BW.STD.PB.060UC444.MXX`, respuesta 898×613 puntos.
Contraportada/lomo/portada en una página, lomo 40,48 puntos, sangrado 9 puntos.
Recibo privado `genuine-cover-dimensions.json`; no contiene credenciales ni PDF.
No repetir esas consultas para reparar o releer resultados locales ya disponibles.

Comprobación pypdf independiente: hash de cubierta, fuente canónica, vínculo con
interior `09897f4ccab299e0581b362b54b4e6788430e3b0dc3e9c4e356541ddd9090fb1`,
una página, dimensiones/cajas, texto real, sin etiqueta sintética, fuentes
incrustadas. El comprobador inicialmente confundió diez alias internos de recurso
con diez fuentes: se inspeccionaron las referencias y son solo dos objetos y dos
programas incrustados. Se corrigió solo esa cuenta del comprobador, no el PDF,
el motor ni ningún gate, sin repetir Lulu. Informe final
`genuine-cover-independent-check.json`, passed. Render completo 144 ppp
`genuine-cover-review.png` inspeccionado, sin recortes/solapamientos/caracteres
fallidos observados. No equivale a prueba física ni a aprobación humana.

La clave exclusiva del trabajador de impresión recibió una única prueba HTTP
del endpoint estándar del mismo proyecto: advancePrint con el ID del trabajo
DEL LIBRO, que no coincide con ningún trabajo de impresión. HTTP200/idle a las
22:55:54 UTC. `genuine-print-worker-probe.json` conserva el recibo seguro.
Solo demuestra autenticación y claim vacío para ese ID, no PDF terminado. No
despertar genéricamente otras colas ni repetir avisos por una respuesta idle.
Variable GitHub `CARONTE_PRINT_RECOVERY_ENABLED` releyó true. No se cambiaron
claves, permisos, configuración, página ni proveedores.

Se leyeron las definiciones alojadas actuales de enqueue/claim y sus ACL:
service_role puede ejecutar; anon/authenticated no. La definición v3 admite el
contrato real 216–224/+30/55–65k/5 capítulos. No restaurar la migración inicial
antigua que solo admitía v2. Único trigger relevante: touch_updated_at, leído,
sin red. Diagnóstico SQL privado `genuine-print-enqueue-rollback.sql`: transacción
como service_role, fuente real exacta, hash de entrada de diagnóstico separado
del hash/HMAC de producción, etiqueta last_test_configuration de Lulu como dato
ya probado, no como prueba nueva de configuración efectiva del motor Edge.
Pasaron enqueue, idempotencia de la misma reserva, transición privada a
pdf_generating, claim exacto, lease vigente no reclamable y manuscrito íntegro.
Todo se revirtió con ROLLBACK antes de cualquier worker, archivo o proveedor.

La consulta posterior independiente confirmó cero trabajos de impresión y cero
PDF para la sesión. Filas completas iguales antes/después mediante SHA de JSON
PostgreSQL (estos NO son el hash canónico del manuscrito): manuscrito
`d9f36eb6a9c34193baa24e25a7146e3b9a923325e0d75012ba218b2a5cd73027`,
sesión `5f0c68a106530e56ced7e50742631f32374d2b169dd0ff98c6b01c4a49682328`.
Sesión book_ready/not_generated, manuscrito ready/pending, revisión exacta
22:24:00.598029 UTC. Recibo privado `genuine-print-enqueue-rollback-report.json`.

No se ha encolado una generación real alojada ni escrito objetos en Storage.
Los dos PDF originales son revisión local, no entrega durable ni aprobación.
Faltan la decisión editorial ya solicitada, el recorrido alojado, revisión humana
y aprobación de los DOS hashes exactos finales antes de cualquier validación
de archivos en Lulu. No reutilizar el par técnico sintético ni el envío antiguo
incierto. Ninguna nueva llamada de modelos, pedido, pago, envío o dirección.
El piloto sigue pendiente. No commit/push de estos documentos en este pase;
SPEC-fulfillment.md ajeno continúa intacto y no publicado.

## Primer trabajo PDF auténtico alojado y límite de CPU: 23:27 UTC

El estado de las 23:03 que decía cero trabajos queda superado. Se reservó UNA VEZ,
mediante el RPC existente exclusivo de operador `caronte_enqueue_print`, el trabajo
`0e741054-abf0-434b-8a28-8c332eab304d`, PDF reservado
`5f83a8ec-d4ff-4b05-9aa2-b57b4ef31c1a`, versión 1, creado 23:11:25.432496 UTC.
Misma sesión y manuscrito ficticios, identidad canónica
`2644cd942c4a1d9286605316347301748d3394d202ade81cec72483e7ab5451b`, input de
producción `863a900445736f109ba4a4612cf539ad9e1bb022053bdb293ca8f064b15bd108`.
No volver a ejecutar `genuine-production-print-reservation.sql` ni crear otro trabajo.
La reserva no verifica la ruta pública generatePdf: el panel privado solo regenera
PDF existentes. CLI no tiene token; se usó MCP autenticado, no claves administrativas
extraídas del navegador. La etiqueta de Lulu fue la última configuración ya probada;
el worker mantiene su comprobación contra la configuración efectiva antes de cubierta.

Dos lotes del ejecutable existente, privados y limitados al printJob exacto,
`advance-genuine-print.mjs 1` y `2`, terminaron al primer fallo HTTP546 de cada lote.
El primero completó plan:0:12 hasta plan:0:12.7. Plan:0:12.8 intento1 quedó iniciado,
salida JSON null y output_hash null, sin archivos ni llamadas de proveedor. Los logs
alojados conservan ejecución `4bb3b46b-c118-4014-98b3-dbf65c80f70e`, Shutdown
CPUTime, 2249 ms. No es un timeout incierto de modelo ni un límite acumulado del lote.

Tras releer ese cierre, salida nula y lease expirado, el lote2 permitió la recuperación
normal sin reset ni salto de presupuesto: plan:0:12.8 completed, intento2, SHA
`aaa7d4c7c5cb3a3ba454512064108af5692b67a11fef9459be1030abebce9e07`, exactamente
el obtenido antes en Node. Los ocho planes previos no se repitieron. La siguiente
plan:0:12.9 intento1 volvió a terminar HTTP546 WORKER_RESOURCE_LIMIT; ejecución
`8f5e77fd-1958-42a2-9e8e-40dc62bbe5e4`, CPUTime 2386 ms. Lote2 detenido; no lote3.
Última relectura: nueve planes completed, plan:0:12.9 started con salida JSON null,
output_hash null, job running/plan/error null, updated 23:19:49.33544, lease hasta
23:22:08.556561 UTC. Cero filas PDF; el hash de la fila completa del manuscrito
sigue `d9f36eb6a9c34193baa24e25a7146e3b9a923325e0d75012ba218b2a5cd73027`.
Estos dos lotes no llegaron a part/interior/cover/finish ni Storage/Lulu/modelos.
La recuperación programada puede reclamar después: consultar estado actual antes
de actuar, no suponer que sigue detenido ni despertar otra cola genéricamente.

Sonda privada con Edge nativo v1.77.4-r0 y el original real, aislada sin secretos,
solo loopback 127.0.0.1:24779. La ruta /private/tmp y los assets relativos resolvieron
las limitaciones del artefacto compilado; no se cambió el binario. Plan:0:12.9 tiene
50 páginas, SHA `0f1bf810bc405f3bc60b3f7cb9279ed831f4ecd05f53dcaef7e6e5f1f70f64dc`.
477,55 ms wall local: 13.123 medidas de fuente regular consumen 428,73 ms; negrita
7 llamadas/2,75 ms. CPU timer explícitamente deshabilitado en macOS: esto NO acredita
CPU ni memoria del alojamiento. Las medidas Node previas tampoco lo acreditan.

Un experimento SOLO local desactivó kern en la instrumentación: 386,43 ms y mismo
hash de un plan, pero sin prueba del libro entero ni del presupuesto alojado. No
se conservó en producción. No repetirlo como arreglo ya verificado. La composición
de los planes compactos además remaqueta los cinco capítulos enteros: necesita
división de cálculo y ensamblaje acotados, no bucles de reintentos. Propuesta pendiente
de implementación/pruebas en `genuine-print-slicing-plan.md`; diagnóstico durable
`genuine-print-cpu-diagnosis.json`, ambos en /tmp/caronte-deployment.P4WcDs.
No cambian código de producción, migraciones, permisos, fuentes, página ni libro en
este diagnóstico. No afirmar que se ha implementado o desplegado la división.

Las cuatro propuestas editoriales siguen sin autorización y sin aplicar. El par
local original de 224 páginas sigue siendo revisión, no el par alojado reservado.
No reutilizar esos hashes como si fueran bytes finales del nuevo trabajo. Faltan
la corrección de CPU, recorrido alojado genuino, decisión/revisión humana y aprobación
de los DOS hashes finales antes de Lulu. Ninguna llamada pagada de modelo, envío PDF
a Lulu, pedido, pago o dirección en este pase. No publicar prosa privada ni diagnósticos.
No commit/push; SPEC-fulfillment.md ajeno permanece intacto.

Cierre de esta sonda: supervisor detenido por su sesión propia, puerto24779 sin
listener. PostgreSQL local continúa detenido. El experimento no-kern se retiró
también del harness privado; se conserva solo su medida/limitación en el informe.
Última consulta independiente confirma las nueve etapas terminadas y el mismo
plan:0:12.9 iniciado sin salida; manuscrito completo sin cambios/human_review pending.
GitHub muestra recuperación nominal programada, pero la última ejecución listada
es 38297957211 a las19:29:10 SUCCESS: la programación no prueba un nuevo avance.
No activar ni cambiar scheduler ni volver a avisar manualmente por esa ausencia.
Seguimiento del chat actualizado y releído, ACTIVE cada quince minutos, misma
identidad y destino; no se ha creado uno adicional ni pausado el existente.

## 23:39 UTC — división tipográfica implementada y verificada localmente

Este corte supera únicamente la nota anterior de «propuesta no implementada».
Se añadieron primitivas a `caronte-print.mjs`: `planChapterSlice`,
`finishChapterSlices` y ensamblaje compacto con cinco `geometryPlans` elegidos.
Máximos 24 párrafos/16.000 caracteres, sin cortar párrafos ni omitir texto.
Recibos ligados a fuente, fuentes, tamaño, capítulo, intervalo, cursor y hash
anterior. Las reglas originales de líneas, viudas/blancos/márgenes se conservan.
No se modificaron el coordinador ni el RPC: NO están integradas, migradas,
publicadas ni desplegadas. El servidor aún usa la vía antigua y requiere esa
integración. No afirmar que el fallo alojado se ha corregido.

Diez pruebas nuevas RED→GREEN, cinco independientes de la implementación.
Suite completa 508 = 4 de empaquetado + 504 de Caronte, sin fallos, sin omisiones,
más 17 comprobaciones heredadas. `validate`, `build`, diff-check pasan. Node24.19
y pnpm11.25 incluidos en el runtime existente: npm no está instalado. Se
ejecutaron los scripts exactos de package.json sustituyendo solo su invocador
`npm run` por `node .../pnpm.cjs run`, sin instalar paquetes ni cambiar el script
general para acomodarlo. `test:caronte` incluye los dos archivos nuevos.

Verificación privada completa sobre el original congelado, sin generar PDFs:
105 planes compactos y cinco geometrías elegidas iguales a los del código previo.
Mismo manifiesto íntegro de 224 páginas, 886 párrafos. SHA layout
`74ffbc70d143e0467a2616b2e396c4487aba61dff3018b7203384808f76bba9a`, manifest
`817df1e48eeb6046a029311e719f23571b23ffd45261924c8361c0b0efe903c3`.
Los nueve hashes durables coinciden. 836 intervalos, máximos 24 párrafos y
11.020 caracteres. Fuente canónica original sin cambios. Informe privado
`genuine-slices-verification.json`, permisos0600; no publicar su prosa ni su
corpus. Los 836 cortes son más peticiones: no prometer menor tiempo/coste total.

Sonda nativa nueva, loopback24779, sin secretos: tres muestras originales completas
465,31/477,26/476,20 ms wall y13.130 medidas/184.300 caracteres medidos.
Máximo intervalo119,04/119,34/121,54ms, máximo2.807 medidas/34.652 caracteres
medidos por petición; el texto fuente de cada intervalo conserva su límite.
Ensamblaje14,87/15,10/14,69ms, cero medidas. Mismo hash canónico de la salida
plan:0:12.9 `0f1bf810bc405f3bc60b3f7cb9279ed831f4ecd05f53dcaef7e6e5f1f70f64dc`.
Informe privado `genuine-slices-native-profile.json`0600. CPU timer deshabilitado
en macOS: no acredita CPU/memoria alojadas. No se usó no-kern ni otro ajuste de
fuentes. Supervisor detenido por su sesión propia, exit0, puerto24779 libre.

Relectura alojada independiente en este pase: mismo trabajo reservado
0e741054-abf0-434b-8a28-8c332eab304d y nueve planes completados; plan:0:12.9
started intento1, hash de entrada
`d26d79ac6bb2329ed8226de305b93208c0927d19a4d3236f9b76a8f24bab2d5b`, salida/hashnull.
No se reanudó, avisó, reseteó ni creó otra reserva. No operaciones pagadas,
Storage, envío a Lulu, pedidos o pagos. Cuatro cambios editoriales siguen
pendientes de decisión, sin aplicar. `SPEC-fulfillment.md` ajeno intacto.
HTML/CSS sin editar. No commit/push ni publicación de este corte local.

Continuación segura: leer `docs/CARONTE_PRINT_SLICES.md`; integrar la programación
durable y la geometría seleccionada, preservar el hash iniciado y los nueve
recibos, probar RPC/leases/inmutabilidad con ROLLBACK y mismas ACL. Solo después
migrar/desplegar y comprobar este trabajo real. No enviar claves nuevas antes
de migración comprobada ni sustituir la definición v3 por la inicial v2. No
repetir lotes idénticos del worker antiguo ni ampliar intentos. Piloto pendiente.

Seguimiento existente actualizado y releído a las23:40:39UTC: misma identidad,
chat destino, ACTIVE y quince minutos; conserva silencio ante estado ya comunicado.
Registra expresamente la implementación LOCAL y el puente/RPC/alojamiento aún
pendientes, no una corrección alojada ficticia. HTML/CSS locales releídos iguales a
sus dos hashes originales. No listener en24779ni24074. Goal sigue activo, sin
marcarlo completo ni bloqueado mientras queda progreso técnico dentro del alcance.

## 23:53 UTC — puente de cola implementado y verificado LOCALMENTE

Este corte supera la nota anterior de coordinador local sin integrar. Se añadió
`selectLayoutSize`, elección pura sobre la matriz completa. `createPrintEngine`
ya programa `slice-count:i:size:start`, `slice-geometry:i:size:start`, `selected:i:size`
y `selection`, todos stage plan, y compone solo tras cinco geometrías completas.
Límites 24 párrafos/16.000 caracteres, fuente/cursor/cadena originales. En la vía
nueva no llama a `planChapter` entero ni remaqueta todo el libro al componer.
Mantiene la API vieja para fixtures/compatibilidad, no para el runtime nuevo.

Las claves y los descriptors originales permanecen exactos. Los derivados no
alteran hashes de entrada de planes, cachés geometry antiguos ni etapas binarias.
También conserva intentos/lease y retoma tras un acuse de completion perdido.
La prueba de un caché antiguo ya iniciado falló por input_changed antes de corregir
su exclusión. Paginación de metadatos en páginas500 y lectura dirigida de cuerpos
en grupos<=5; la regresión1.200filas reproduce RED en el coordinador de HEAD
(solo1.000 leídas), GREEN en el nuevo. Bootstrap inicial de esa comparación falló
por import bare desde data:; se resolvió el import existente, no se cambió la prueba.

Cuatro pruebas de puente preparadas por agente independiente: RED 0/4, GREEN4/4.
Agente interrumpido tras acabar. Selección/paginación/caché añaden tres pruebas.
Suite FINAL515=4+511, sin fallos/cancelaciones/omisiones, más17checks heredados.
`validate`, `build`, diff-check pasan. Mismo Node24.19 y pnpm existente, sin instalar.
Pruebas PDF reales conservan el layout legado194 y el contrato v3/216–224,
texto completo, cinco geometrías, partes y recuperación sin segunda subida.
No equivalen a la CPU/SQL/Storage del servidor alojado.

Comprobación privada NUEVA del coordinador sobre el original ficticio congelado,
sin repetir la comparación105planes completa ni generar PDF: siete count-slices
para plan:0:12.9 y un ensamblaje (ocho claims offline). Los nueve recibos previos
permanecen intactos en la fixture, mismo input
d26d79ac6bb2329ed8226de305b93208c0927d19a4d3236f9b76a8f24bab2d5b,
attempt1→2 sin reset, salida SHA
0f1bf810bc405f3bc60b3f7cb9279ed831f4ecd05f53dcaef7e6e5f1f70f64dc exacta.
Fuente SHA2644cd942c4a1d9286605316347301748d3394d202ade81cec72483e7ab5451b
sin cambios. `verify-genuine-sliced-queue.mjs` e informe
`genuine-sliced-queue-verification.json` privados0600. Fixture explícita: cero
providerCalls/productionWrites/PDFs, no reanudación del trabajo real.

Relectura alojada independiente: nueve completed con sus nueve hashes originales,
plan:0:12.9 sigue started intento1, inputd26d79…/salida null/hashnull. RPC actual
caronte_checkpoint_print_job releído; SECURITY DEFINER existente, ACL exclusivamente
postgres/service_role y search_path public,pg_temp. No se alteró ni amplió permiso.
Sigue sin admitir claves nuevas. NO hay migración nueva, deploy, commit ni push
de este corte. No mandar el coordinador nuevo antes de SQL probado y migrado.

GitHub público HTTP200: HTML SHAfd5a9ba3b0b3c246f51c6b97df06c321075e5480c2e75798c52858e5fec1b0d7
y CSS SHA55d0561bc758d8002e3a6bf9cc4a8cf99960503db131dfab5aae8282decbe7ce
iguales a originales/locales. JS público idéntico al local publicado, SHA
be97f30c1125b12cff76e011dbb33dbf33829adf9bb378a5eb2d8026f38bceb5,
introducción aprobada confirmada. No audio generado ni controles/diseño nuevos.
SPEC-fulfillment.md ajeno intacto. Cuatro cambios editoriales pendientes sin aplicar.

Siguiente paso: migración generada con CLI para las claves nuevas, guardas estrictas
de intervalos/predecesor/selección/fuente y mismas ACL; RED→GREEN en PostgreSQL
nativo y alojado mediante ROLLBACK, cero residuos. Mantener el contrato v3 y los
recibos/attempts ya existentes. Solo después desplegar y probar el único trabajo
real bajo CPU alojada, sin otro enqueue ni lote antiguo repetido. No modelos
pagados, envíoPDFLulu, pedidos, pagos o direcciones en este corte. Piloto pendiente.

Seguimiento existente actualizado y releído al cierre23:55UTC: misma identidad,
nombre, chat destino, ACTIVE, quince minutos y prompt exacto confirmado. El corte
nuevo distingue coordinador LOCAL integrado de SQL/deploy/alojamiento pendientes.
No duplicado ni pausa. Puertos24779/24074 sin listener; sesiones de pruebas
terminadas exit0. Goal sigue activo. No alertas repetidas ni nueva solicitud editorial.

## 13 de octubre, 00:14 UTC — persistencia y primera cadena alojada verificadas

Este corte supera las notas anteriores de SQL y servidor sin integrar. La CLI
existente generó 20261013000043_caronte_sliced_print_receipts.sql. El proyecto
alojado registra 20261013000456_caronte_sliced_print_receipts: timestamps distintos.
Cuerpo del RPC alojado releído idéntico al local. SECURITY DEFINER existente,
ACL postgres/service_role, search_path ahora vacío y referencias cualificadas.
Mantiene v2/v3, tres intentos e inmutabilidad, sin nuevas tablas ni permisos.
Valida intervalos UTF-16/24/16000, predecesores, cursores y selección completa.
SQL valida estructura/identidad; renderer valida integridad canónica/texto.

Reproducción independiente scripts/test-caronte-print-slices-database.sql:
RED real antes, GREEN después, PostgreSQL nativo17.11 y alojado/service_role,
BEGIN/ROLLBACK, cero residuos. También pasó la prueba SQL anterior. Fixtures
sintéticas, no mediciones ni PDF. Advisors antes/después sin nuevos hallazgos
de este RPC; advertencias del proyecto compartido intactas. Antes/después de
pruebas/migración: jobMD5 1859d2d8c22bf9688b97318c3f88160e, diez pasosMD5
a92ca44ccd069b1436d903da9e23d925, manuscritoMD5
871f809535eb2cd4ec1fa1204f44f264, cero sesiones sintéticas residuales.
PostgreSQL nativo detenido/24074 libre. MD5 de cola históricos: los claims
reales posteriores avanzaron filas legítimamente.

v27 se desplegó una vez, pero la fachada perezosa de index.ts todavía exponía
solo cinco funciones antiguas. El primer lote limitado avanzó cuatro planes
enteros y se detuvo en petición5 HTTP546, plan:0:13.3 started1/salida null.
Execution8dd7e975-d7db-4088-83ea-76485b401133, cierreCPUTime2212ms.
genuine-print-sliced-first-batch.jsonl privado preservado. No repetir ni reset.
Ese fallo NO prueba la vía nueva: la conexión faltaba. Hijo TDD independiente
preparó test-caronte-print-lazy-adapter.mjs, ejecuta la función real sin copiarla:
RED3/8, cinco fallos exactos por métodos ausentes. Main confirmó RED y la ruta
real vio plan:0:12 en vez de slice-count. Cambio mínimo: añadir
planChapterSlice/finishChapterSlices/selectLayoutSize al array de la fachada.
GREEN30/30 enfocadas; suite íntegra523=4+519, sin fallos/skips/cancelaciones,
17legacy, validate/build/diff-check pasan. Hijo acabado e interrumpido.
Status/enqueue no cargan fuentes. Sin nuevas dependencias/configuración.

v28 desplegado una vez: única diferencia efectiva respecto a v27, ese array.
Sus20archivos efectivos exportados releídos byte a byte contra el paquete22.
El exportador omite scoring.ts y territory.ts, transitivos intactos de HEAD;
no afirmar relectura alojada de esos dos omitidos. ACTIVE/verify_jwt=false
existente, autenticación/CORS unchanged. Batch nuevo de ocho claims al MISMO
trabajo, exit0 y ninguna546: siete slice-count:0:13.3 completed1,
rangos0–24–48–72–96–120–144–165, más ensamblaje plan:0:13.3 completed2.
Input anterior exacto d319ddbe240d317528d4f812e902d1afe2288f55579ccaae61924bc1ce93da38,
output169c4bc73c5cf45e73125af8775eb10a882567ac872a1a76504f5ed558ff2a15.
Record del cálculo original chapter0/size13.3 acredita mismo hash y52páginas
de ESE capítulo, no52del PDF final. Los trece recibos previos conservan sus
filas completas; source/input del trabajo iguales. Jobqueued/plan/errornull,
leaseNULL/updated00:13:57.163275. No ready/PDF/Storage/modelos/envíoPDFLulu.

Después se inició un lote NUEVO hasta60claims/240s al printJob único, ledger
exclusivo wx genuine-print-sliced-wired-following-batch.jsonl. No repetir
mientras esté activo ni sin relectura durable. Más peticiones no implica
menor duración/coste total. Esta evidencia no certifica todo el PDF alojado.

HTML/CSS públicos HTTP200 a00:14UTC, idénticos a originales/locales, mismos
SHAfd5a9ba3b0b3c246f51c6b97df06c321075e5480c2e75798c52858e5fec1b0d7
y55d0561bc758d8002e3a6bf9cc4a8cf99960503db131dfab5aae8282decbe7ce.
Cuatro propuestas editoriales pendientes sin aplicar ni nueva pregunta.
Sin pedido/pago/dirección; SPEC ajeno intacto. Publicación GitHub de este
corte aún pendiente: deploySupabase no equivale a commit/push/Pages.
Piloto pendiente de archivos auténticos alojados, revisión humana y ambos
hashes exactos aprobados antes de Lulu. Todas las recuperaciones consumidas.

Recuperación segura: parar nuevos claims ante fallo, releer recibos y lease,
sin reset/replay incierto. Preservar migración aditiva y pasos derivados; no
restaurar a ciegas el RPC viejo que rechaza las claves nuevas, ni v27 que
calcula capítulos enteros. Paquetes previos conservados para análisis, no
reversión segura automática. No improvisar flags/permisos/gastos nuevos.

Preparación de publicación: tres commits de código/pruebas, 41fe4b3 (primitivas),
fffc1d1 (persistencia), b3d7b2c (coordinador/endpoint). Auditoría pnpm11.25 sobre
lockfile vigente: seis dependencias, cero avisos conocidos de todas las severidades
a00:17UTC. Comprobación fechada, no garantía frente a riesgos desconocidos.
Sin instalación ni cambio del lockfile. Guías de Git/publicación aplicadas a
este arreglo, no una certificación global. No cambiar diseño ni flags ajenos.
