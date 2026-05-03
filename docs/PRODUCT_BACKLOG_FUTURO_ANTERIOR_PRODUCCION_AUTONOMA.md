# Product Backlog - Futuro Anterior Produccion Autonoma

Fecha: 22/04/2026  
Estado: backlog post Sprint 6  
Producto: Futuro Anterior / Caronte  
Objetivo: llevar el MVP actual a un producto comercial robusto, seguro y autonomo, capaz de operar como una "sonda espacial": entra trafico, se cobra, se entrevista, se genera un libro de calidad, se produce un PDF imprimible y el sistema se monitoriza y protege solo.

## Diagnostico de partida

El flujo tecnico hasta PDF ya funciona en produccion:

- URL fija publicada.
- Sesion anonima creada en backend.
- Pago simulado aprobado.
- Voz ElevenLabs operativa.
- Entrevista de 21 preguntas.
- Manuscrito generado.
- PDF generado y bloqueado en `pending_review`.
- Back office operativo.

Pero todavia no se puede declarar "100% produccion autonoma" porque:

- OpenAI y Anthropic no estan configurados en produccion; el libro cae a fallback determinista.
- La transcripcion depende demasiado del navegador.
- El PDF es funcional, pero no editorialmente perfecto ni listo para imprenta premium.
- No hay pago real.
- No hay rate limiting fuerte ni control de abuso por coste de IA/voz.
- El back office usa token unico, no autenticacion/roles.
- GitHub Pages no permite headers fuertes como CSP.
- Falta staging real, smoke tests post-deploy y alertas externas.
- Falta politica formal de retencion/borrado automatizado.
- Lulu aun no se llama; solo existe metadata `ready_for_print`.

## Product Goal

Futuro Anterior debe ser una experiencia cerrada, autonoma y literaria en la que el usuario:

1. Entra por una URL.
2. Atraviesa una interfaz terminal/minima.
3. Paga 49 EUR.
4. Escucha a Caronte.
5. Responde por voz a 21 preguntas.
6. El sistema transcribe, interpreta y modela sus respuestas.
7. GPT-5.4 redacta un manuscrito personalizado.
8. Claude revisa coherencia, seguridad y calidad.
9. El sistema reescribe si la calidad no alcanza el umbral.
10. Se genera un PDF editorial listo para imprimir.
11. El back office puede revisar, aprobar, regenerar o liberar.
12. Futuras versiones enviaran a Lulu sin intervencion manual si se cumplen todos los gates.

## Principios de produccion

1. Autonomia real: no depender de acciones humanas para completar el flujo normal hasta PDF.
2. Fallback controlado: si falta IA real, el sistema debe marcar `degraded`, no fingir calidad final.
3. Seguridad por coste: toda llamada a IA/voz/pago debe tener limites, cuotas y trazabilidad.
4. Privacidad radical: voz, transcripcion, manuscrito y PDF son datos sensibles.
5. Experiencia rara, producto serio: la interfaz puede transmitir poca confianza, pero la arquitectura debe ser confiable.
6. Calidad editorial medible: el libro no puede ser solo texto; debe cumplir longitud, estructura, tono, personalizacion y maquetacion.
7. Operacion sin operador: alertas, apagado de emergencia, reintentos, colas y dashboards deben permitir sobrevivir a fallos.

## Epicas

### EPIC A - Proveedores IA y secretos

- PB-A01 - Configurar `OPENAI_API_KEY` en Supabase.
- PB-A02 - Configurar `ANTHROPIC_API_KEY` en Supabase.
- PB-A03 - Validar modelos reales: `FUTURE_BOOK_OPENAI_MODEL` y `ANTHROPIC_MODEL`.
- PB-A04 - Provider health check real para OpenAI, Anthropic, ElevenLabs y futuro Lulu.
- PB-A05 - Bloqueo de generacion final si falta proveedor obligatorio.
- PB-A06 - Gestion segura de claves desde back office con lectura cero.
- PB-A07 - Monitor de coste por sesion y por proveedor.
- PB-A08 - Limites diarios/mensuales de coste.

### EPIC B - Entrevista, voz y transcripcion robusta

- PB-B01 - Transcripcion backend real con proveedor STT.
- PB-B02 - Subida privada de audio a storage.
- PB-B03 - Reintento de subida si se corta la conexion.
- PB-B04 - Recuperacion de entrevista si el usuario recarga.
- PB-B05 - Deteccion de respuestas vacias, superficiales o incoherentes.
- PB-B06 - Motor adaptativo de repreguntas.
- PB-B07 - Medicion de densidad narrativa por respuesta.
- PB-B08 - Deteccion de interrupcion, abandono y sesion caducada.
- PB-B09 - UX de permisos de microfono y fallback.
- PB-B10 - Prueba automatizada de flujo de voz sin exponer API keys.

### EPIC C - Motor literario Caronte

- PB-C01 - Prompt maestro Caronte v1.
- PB-C02 - Generacion por fases: mapa psicologico, estructura, capitulos, carta final.
- PB-C03 - Modelo de "mapa psicologico" persistente y versionado.
- PB-C04 - Sintesis de patrones, contradicciones, deseos, miedos y relaciones.
- PB-C05 - Redaccion con GPT-5.4 y fallback marcado como degradado.
- PB-C06 - Revision con Claude: coherencia, seguridad, personalizacion y tono.
- PB-C07 - Reescritura automatica si score < umbral.
- PB-C08 - Evaluador automatico de genericidad.
- PB-C09 - Evaluador de promesas prohibidas: no prediccion, no terapia, no diagnostico.
- PB-C10 - Versionado de prompts y outputs.

### EPIC D - PDF editorial e imprenta

- PB-D01 - Motor PDF editorial server-side con HTML/CSS o renderer dedicado.
- PB-D02 - Plantilla A5 premium: portada, pagina suelta, capitulos, carta, aviso IA.
- PB-D03 - Tipografia, margenes, paginacion y estilos de libro real.
- PB-D04 - Generacion de portada sobria y unica.
- PB-D05 - Validacion automatica de PDF: abre, paginas, peso, fuentes, metadata.
- PB-D06 - Storage privado de PDFs con URL firmada.
- PB-D07 - Versionado de PDFs y regeneracion limpia.
- PB-D08 - Preparacion Lulu-ready real: trim size, interior, cover, metadata.
- PB-D09 - Gate `ready_for_print` solo si pasa QA.
- PB-D10 - Descarga cliente segura solo si esta liberado.

### EPIC E - Pago real y facturacion

- PB-E01 - Seleccion proveedor de pago en EUR.
- PB-E02 - Checkout real 49 EUR.
- PB-E03 - Webhooks de pago server-side.
- PB-E04 - Estados: iniciado, pagado, fallido, expirado, reembolsado.
- PB-E05 - Factura/recibo y datos fiscales minimos.
- PB-E06 - Proteccion contra replay de webhook.
- PB-E07 - Reembolso/manual hold desde back office.
- PB-E08 - Modo beta sin cobro configurable por entorno.

### EPIC F - Back office profesional

- PB-F01 - Login admin real con Supabase Auth.
- PB-F02 - Roles: owner, editor, soporte, operaciones.
- PB-F03 - Dashboard de sesiones en tiempo real.
- PB-F04 - Vista de timeline por sesion.
- PB-F05 - Vista de respuestas/transcripciones con permisos.
- PB-F06 - Cola editorial de manuscritos.
- PB-F07 - Cola de PDFs.
- PB-F08 - Acciones: aprobar, rechazar, regenerar, bloquear, liberar.
- PB-F09 - Auditoria de todas las acciones admin.
- PB-F10 - Gestion de proveedores sin exponer secretos.
- PB-F11 - Panel de costes y consumo.
- PB-F12 - Boton de apagado global con motivo.

### EPIC G - Seguridad, privacidad y cumplimiento

- PB-G01 - Migrar hosting a plataforma con headers custom.
- PB-G02 - CSP estricta.
- PB-G03 - `frame-ancestors none`.
- PB-G04 - `Referrer-Policy` y `Permissions-Policy`.
- PB-G05 - Rate limiting por IP, sesion y fingerprint.
- PB-G06 - Captcha/challenge invisible en creacion de sesion si hay abuso.
- PB-G07 - Retencion automatica de audio, respuestas, manuscritos y PDFs.
- PB-G08 - Borrado automatico por TTL.
- PB-G09 - Export/borrado por solicitud RGPD.
- PB-G10 - Politica de subencargados: Supabase, OpenAI, Anthropic, ElevenLabs, pagos, Lulu.
- PB-G11 - Redaccion legal final de terminos, privacidad y aviso IA.
- PB-G12 - Cifrado/aislamiento de artefactos sensibles.

### EPIC H - Observabilidad y autonomia operativa

- PB-H01 - Smoke test post-deploy end-to-end hasta PDF.
- PB-H02 - Synthetic monitor cada X horas con sesion de prueba y cleanup.
- PB-H03 - Alertas externas por P0.
- PB-H04 - Deteccion de stuck sessions.
- PB-H05 - Reintentos controlados para IA/PDF.
- PB-H06 - Dead-letter queue para fallos irreparables.
- PB-H07 - Runbook de incidentes por proveedor.
- PB-H08 - Dashboard de SLA interno.
- PB-H09 - Metricas de conversion por paso.
- PB-H10 - Cost anomaly detection.

### EPIC I - URL efimera, viralidad y acceso cerrado

- PB-I01 - Generador de enlaces efimeros.
- PB-I02 - TTL de enlace.
- PB-I03 - Un solo uso por enlace.
- PB-I04 - Capacidad de invitaciones limitadas.
- PB-I05 - Kill-switch por campana.
- PB-I06 - Lista de espera opaca.
- PB-I07 - Modo URL fija solo para beta.
- PB-I08 - Proteccion contra indexacion.

### EPIC J - Lulu y fulfillment futuro

- PB-J01 - Integracion Lulu sandbox.
- PB-J02 - Validacion real de metadata Lulu.
- PB-J03 - Generacion de interior PDF e imagen/cover segun especificacion.
- PB-J04 - Orden manual desde back office.
- PB-J05 - Orden automatica si PDF esta aprobado y pago confirmado.
- PB-J06 - Estado de envio y tracking.
- PB-J07 - Politica de no devolucion/destruccion.
- PB-J08 - Manejo de direccion postal y minimizacion de datos.

### EPIC K - Calidad, QA y release

- PB-K01 - Staging separado de produccion.
- PB-K02 - Base de datos staging separada.
- PB-K03 - Tests unitarios de Edge Function.
- PB-K04 - Tests e2e navegador.
- PB-K05 - Tests de PDF con apertura real.
- PB-K06 - Tests de seguridad basicos.
- PB-K07 - Load test controlado.
- PB-K08 - Checklist Go/No-Go de lanzamiento.
- PB-K09 - Rollback documentado.
- PB-K10 - Versionado semantico del producto.

## Sprints

### Sprint 7 - Activar IA real y cerrar modo degradado

Objetivo: que el libro deje de generarse por fallback determinista y pase por GPT/Claude reales, con gates claros.

Items:

- PB-A01 - Configurar `OPENAI_API_KEY` en Supabase.
- PB-A02 - Configurar `ANTHROPIC_API_KEY` en Supabase.
- PB-A03 - Validar modelos reales.
- PB-A04 - Provider health check real.
- PB-A05 - Bloqueo de generacion final si falta proveedor obligatorio.
- PB-C05 - Redaccion con GPT-5.4 y fallback marcado como degradado.
- PB-C06 - Revision con Claude.
- PB-H01 - Smoke test post-deploy end-to-end hasta PDF.

Definition of Done:

- Back office muestra OpenAI, Anthropic y ElevenLabs configurados.
- Un flujo real genera manuscrito con proveedor OpenAI.
- Claude devuelve revision real o error trazado.
- Si falta OpenAI/Anthropic, el PDF no se marca como listo para produccion.
- `npm test` y smoke productivo pasan.

### Sprint 8 - Entrevista robusta y transcripcion backend

Objetivo: hacer que la entrevista no dependa de la suerte del navegador.

Items:

- PB-B01 - Transcripcion backend real.
- PB-B02 - Subida privada de audio.
- PB-B03 - Reintento de subida.
- PB-B04 - Recuperacion de entrevista.
- PB-B05 - Deteccion de respuestas vacias/superficiales.
- PB-B06 - Motor adaptativo de repreguntas.
- PB-B07 - Medicion de densidad narrativa.
- PB-B08 - Deteccion de abandono.
- PB-B09 - UX de permisos de microfono.

Definition of Done:

- Audio queda guardado en storage privado o se descarta explicitamente segun politica.
- Transcripcion no depende solo de Web Speech API.
- Una recarga no destruye una entrevista pagada.
- El sistema puede continuar o cerrar limpiamente una sesion interrumpida.

### Sprint 9 - Caronte literario v1

Objetivo: convertir respuestas en un libro con arquitectura narrativa seria, no en informe largo.

Items:

- PB-C01 - Prompt maestro Caronte v1.
- PB-C02 - Generacion por fases.
- PB-C03 - Mapa psicologico persistente.
- PB-C04 - Sintesis de patrones.
- PB-C07 - Reescritura automatica por bajo score.
- PB-C08 - Evaluador de genericidad.
- PB-C09 - Evaluador de promesas prohibidas.
- PB-C10 - Versionado de prompts y outputs.

Definition of Done:

- Manuscrito tiene mapa previo, estructura y capitulos.
- Hay score de personalizacion y score de seguridad.
- Si el libro es generico, se regenera automaticamente.
- Se puede comparar version de prompt/output desde back office.

### Sprint 10 - PDF editorial real

Objetivo: que el PDF parezca un libro imprimible y no una exportacion tecnica.

Items:

- PB-D01 - Motor PDF editorial server-side.
- PB-D02 - Plantilla A5 premium.
- PB-D03 - Tipografia, margenes y paginacion.
- PB-D04 - Portada sobria y unica.
- PB-D05 - Validacion automatica de PDF.
- PB-D06 - Storage privado con URL firmada.
- PB-D07 - Versionado de PDFs.
- PB-D08 - Preparacion Lulu-ready real.
- PB-D09 - Gate `ready_for_print`.
- PB-D10 - Descarga cliente segura.

Definition of Done:

- PDF abre en Preview/Chrome/Adobe.
- PDF tiene portada, paginas interiores y aviso IA.
- PDF no se almacena como base64 principal en DB.
- Metadata Lulu se valida contra especificacion.
- Back office puede previsualizar y descargar version exacta.

### Sprint 11 - Pago real 49 EUR

Objetivo: sustituir el bypass por cobro real, manteniendo modo beta configurable.

Items:

- PB-E01 - Seleccion proveedor de pago.
- PB-E02 - Checkout real 49 EUR.
- PB-E03 - Webhooks server-side.
- PB-E04 - Estados de pago completos.
- PB-E05 - Recibo/factura minima.
- PB-E06 - Proteccion contra replay.
- PB-E07 - Reembolso/manual hold.
- PB-E08 - Modo beta sin cobro por entorno.

Definition of Done:

- Nadie inicia entrevista sin pago real o flag beta autorizado.
- Webhooks son idempotentes.
- Pago fallido no consume IA.
- Back office ve pagos y puede resolver incidencias.

### Sprint 12 - Back office de operacion real

Objetivo: que el operador tenga control profesional sin tocar base de datos.

Items:

- PB-F01 - Login admin real.
- PB-F02 - Roles admin.
- PB-F03 - Dashboard realtime.
- PB-F04 - Timeline por sesion.
- PB-F05 - Vista de respuestas/transcripciones.
- PB-F06 - Cola editorial de manuscritos.
- PB-F07 - Cola de PDFs.
- PB-F08 - Acciones de revision.
- PB-F09 - Auditoria admin.
- PB-F10 - Gestion de proveedores.
- PB-F11 - Panel de costes.
- PB-F12 - Apagado global.

Definition of Done:

- Token unico deja de ser el mecanismo principal.
- Cada accion queda auditada.
- Hay roles y permisos.
- Un operador puede resolver una sesion rota sin consola SQL.

### Sprint 13 - Seguridad, privacidad y anti-abuso

Objetivo: proteger el sistema antes de abrir trafico real.

Items:

- PB-G01 - Migrar hosting con headers custom.
- PB-G02 - CSP estricta.
- PB-G03 - `frame-ancestors none`.
- PB-G04 - Referrer/Permissions policy.
- PB-G05 - Rate limiting.
- PB-G06 - Challenge anti-abuso.
- PB-G07 - Retencion automatica.
- PB-G08 - Borrado por TTL.
- PB-G09 - Export/borrado RGPD.
- PB-G10 - Subencargados.
- PB-G11 - Legal final.
- PB-G12 - Cifrado/aislamiento.

Definition of Done:

- Cabeceras verificadas en produccion.
- Crear sesiones en masa esta limitado.
- Hay retencion automatica.
- Los documentos legales reflejan proveedores reales.
- No hay secretos ni datos sensibles accesibles desde frontend.

### Sprint 14 - Observabilidad autonoma

Objetivo: que el producto se vigile solo.

Items:

- PB-H02 - Synthetic monitor periodico.
- PB-H03 - Alertas externas P0.
- PB-H04 - Stuck sessions.
- PB-H05 - Reintentos controlados.
- PB-H06 - Dead-letter queue.
- PB-H07 - Runbook por proveedor.
- PB-H08 - Dashboard SLA.
- PB-H09 - Conversion por paso.
- PB-H10 - Cost anomaly detection.

Definition of Done:

- Si falla OpenAI, Anthropic, ElevenLabs, pago o PDF, salta alerta.
- Sesiones atascadas se marcan solas.
- Hay reintento automatico donde sea seguro.
- Hay apagado automatico si se dispara el coste.

### Sprint 15 - URL efimera y acceso viral controlado

Objetivo: pasar de URL fija beta a mecanismo de acceso misterioso y controlado.

Items:

- PB-I01 - Generador de enlaces efimeros.
- PB-I02 - TTL de enlace.
- PB-I03 - Un solo uso.
- PB-I04 - Invitaciones limitadas.
- PB-I05 - Kill-switch por campana.
- PB-I06 - Lista de espera opaca.
- PB-I07 - Modo URL fija solo beta.
- PB-I08 - Proteccion contra indexacion.

Definition of Done:

- Un enlace caduca solo.
- Un enlace usado no se puede reutilizar.
- Se puede cerrar una campana sin redeploy.
- La URL fija queda solo para pruebas internas.

### Sprint 16 - Lulu sandbox y fulfillment controlado

Objetivo: preparar impresion fisica sin activar envio masivo todavia.

Items:

- PB-J01 - Integracion Lulu sandbox.
- PB-J02 - Validacion real de metadata.
- PB-J03 - Interior y cover segun especificacion.
- PB-J04 - Orden manual desde back office.
- PB-J08 - Direccion postal y minimizacion.

Definition of Done:

- Se puede crear una orden sandbox.
- Lulu acepta interior/cover.
- La direccion se guarda minimizada y protegida.
- Ninguna orden real se dispara sin aprobacion.

### Sprint 17 - Lulu automatico y entrega fisica

Objetivo: automatizar el envio fisico cuando el sistema ya sea fiable.

Items:

- PB-J05 - Orden automatica si PDF esta aprobado y pago confirmado.
- PB-J06 - Estado de envio y tracking.
- PB-J07 - Politica de no devolucion/destruccion.
- Integracion con emails/transaccionales de estado.
- Reintentos y alertas de fulfillment.

Definition of Done:

- Un libro aprobado puede enviarse automaticamente.
- El estado de Lulu vuelve al back office.
- Fallos de envio crean alerta.
- Se puede pausar fulfillment sin pausar entrevistas.

### Sprint 18 - QA final, staging y lanzamiento

Objetivo: declarar el producto listo para produccion comercial controlada.

Items:

- PB-K01 - Staging separado.
- PB-K02 - DB staging separada.
- PB-K03 - Tests unitarios Edge Function.
- PB-K04 - Tests e2e navegador.
- PB-K05 - Tests de PDF.
- PB-K06 - Tests de seguridad.
- PB-K07 - Load test controlado.
- PB-K08 - Checklist Go/No-Go.
- PB-K09 - Rollback.
- PB-K10 - Versionado semantico.

Definition of Done:

- Staging reproduce produccion sin datos reales.
- Release se valida con smoke end-to-end.
- Hay rollback documentado.
- Se puede abrir una beta de pago sin depender de intervencion manual.

## Prioridad recomendada

### P0 antes de lanzar con trafico real

- OpenAI y Anthropic reales.
- Bloqueo de fallback determinista como resultado final.
- Transcripcion backend.
- PDF editorial real.
- Pago real o beta cerrada con cupos.
- Rate limiting.
- Back office con auth real.
- Storage privado para audio/PDF.
- Smoke test post-deploy.
- Alertas P0 externas.

### P1 antes de campana viral

- URL efimera.
- Kill-switch por campana.
- Cost limits.
- Staging real.
- CSP y hosting con headers.
- Retencion automatica.
- Monitor sintetico.

### P2 para escala

- Lulu automatico.
- Tracking fisico.
- Facturacion completa.
- Analitica de conversion.
- Load testing.
- Personalizacion avanzada del libro.

## Mapa rapido por sprint

| Sprint | Tema | Resultado esperado |
| --- | --- | --- |
| 7 | IA real | GPT/Claude activos y fallback degradado |
| 8 | Voz/STT | Entrevista recuperable y transcripcion backend |
| 9 | Caronte | Motor literario multi-fase |
| 10 | PDF | Libro imprimible, privado y versionado |
| 11 | Pago | Cobro real 49 EUR |
| 12 | Back office | Operacion profesional con roles |
| 13 | Seguridad | CSP, rate limits, privacidad y legal |
| 14 | Autonomia | Alertas, reintentos y synthetic monitoring |
| 15 | URL efimera | Acceso viral controlado |
| 16 | Lulu sandbox | Fulfillment probado sin envio real |
| 17 | Lulu automatico | Envio fisico automatizable |
| 18 | QA/release | Produccion comercial controlada |

## Criterio final de "sonda espacial"

El producto solo se considera autonomo si durante una prueba de 20 sesiones consecutivas:

- 20/20 crean sesion.
- 20/20 completan pago o beta-token.
- 20/20 completan entrevista o quedan recuperables.
- 20/20 generan manuscrito con IA real.
- 20/20 pasan revision Claude o regeneran automaticamente.
- 20/20 generan PDF valido.
- 20/20 quedan en estado final correcto.
- 0 secretos se exponen.
- 0 PDFs quedan publicos.
- 0 sesiones consumen coste ilimitado.
- Todas las incidencias generan alerta o estado accionable.

