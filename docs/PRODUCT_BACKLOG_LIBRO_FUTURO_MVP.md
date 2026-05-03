# Product Backlog - Libro del Yo Futuro MVP

Fecha: 21/04/2026  
Estado: definicion inicial de producto  
Objetivo: construir un primer producto funcional, subible a produccion, con URL fija, pago en euros simulado, entrevista por voz de 21 preguntas y generacion de PDF final listo para imprenta/Lulu, sin envio automatico todavia.

## Product Goal

Crear una experiencia digital cerrada, intensa y literaria donde una persona accede a una URL fija, atraviesa un pago de 49 EUR simulado, responde por voz a 21 preguntas profundas y recibe un PDF editorial completo: un libro escrito desde la voz narrativa de su yo futuro.

El producto no debe parecer un formulario ni un generador de informes. Debe sentirse como una experiencia privada, rara, opaca y casi ritual, pero tecnicamente robusta y 100% operable.

## Principios del producto

1. Misterio controlado: estetica oscura, acceso sobrio, poca explicacion, sensacion de entorno privado.
2. Funcion real antes que teatro: aunque haya narrativa, el flujo debe funcionar de punta a punta.
3. Voz como unica entrada principal: el usuario responde hablando, no escribiendo.
4. Personalizacion extrema: el libro debe sonar especifico, no generico.
5. No vender prediccion: el producto prepara futuros plausibles, no promete adivinar el futuro.
6. Privacidad radical: minima retencion, consentimiento claro y trazabilidad tecnica.
7. PDF editorial: el resultado debe parecer un libro imprimible, no una exportacion cutre.

## Alcance del MVP productivo

Incluido en esta version:

- URL fija de acceso.
- Landing oscura y opaca.
- Pantalla de precio: 49 EUR.
- Paso de pago preparado, pero simulado.
- Al pulsar pagar, se muestra transicion a pasarela y se continua como pago aprobado.
- Entrevista por voz con 21 preguntas.
- Motor adaptativo basico para repreguntas y tono.
- Transcripcion de respuestas.
- Generacion de manuscrito completo con IA.
- Revision interna automatica del libro antes de PDF.
- Maquetacion PDF lista para imprenta.
- Cola de revision manual del PDF antes de liberarlo al cliente.
- Descarga privada del PDF solo despues de aprobacion interna.
- Back office para sesiones, dashboard operativo, API keys, revision y liberacion de PDFs.
- Logs operativos y errores.
- Politica de privacidad, terminos y aviso de IA.

Fuera de alcance por ahora:

- URL efimera real.
- Pago real con Stripe/checkout/transferencia.
- Bitcoin.
- Envio automatico a Lulu.
- Impresion fisica.
- Influencers, campana viral o novela de marketing.
- App movil nativa.
- Cuenta de usuario completa.
- Marketplace o sistema de invitaciones.

## Supuestos de arquitectura

- Frontend: app web responsive en URL fija.
- Backend: API server-side para pagos simulados, sesiones, voz, IA y PDF.
- Base de datos: PostgreSQL o Supabase Postgres.
- Storage: bucket privado para transcripciones, manuscritos y PDFs.
- Voz: ElevenLabs para voz del agente y, si aplica, proveedor de STT separado para transcripcion.
- IA escritura: GPT-5.4 Pro y Claude 4.7 usados siempre desde backend, nunca desde navegador.
- PDF: generacion server-side con HTML/CSS a PDF o motor editorial equivalente.
- Secretos: todas las API keys en variables de entorno/secret manager.
- Back office: panel privado para operacion, configuracion de proveedores, seguimiento en vivo y aprobacion manual de PDFs.
- Produccion inicial: beta privada con URL fija y pago simulado.

## Flujo principal

1. Usuario entra en la URL fija.
2. Ve una pantalla oscura, minima, con acceso a la experiencia.
3. El sistema presenta el precio: 49 EUR.
4. Usuario pulsa pagar.
5. Se abre una pantalla de "pasarela de pago" simulada.
6. Tras unos segundos, el sistema marca pago como aprobado.
7. La voz explica las reglas: duracion, privacidad, interrupciones y profundidad requerida.
8. El usuario concede permisos de microfono.
9. El agente realiza 21 preguntas por voz.
10. El sistema transcribe y guarda respuestas estructuradas.
11. Al terminar, el usuario confirma nombre/direccion de entrega futura, aunque en MVP solo se usara como dato narrativo.
12. Se genera el libro.
13. Se ejecuta una revision automatica de coherencia, seguridad y calidad literaria.
14. Se genera el PDF final.
15. El PDF queda en cola interna de revision.
16. Un admin verifica el PDF en back office.
17. Si se aprueba, el PDF queda liberado para descarga/envio al cliente.

## Definition of Done global

Una historia solo se considera terminada si cumple:

- Funciona de punta a punta en entorno local y staging.
- No expone API keys en frontend ni en repositorio.
- Tiene estados de carga, error y reintento.
- Registra eventos operativos sin guardar datos sensibles innecesarios.
- Respeta consentimiento, privacidad y borrado basico.
- Tiene tests relevantes segun riesgo.
- El PDF generado se abre correctamente y tiene formato imprimible.
- Ningun PDF se libera al cliente sin aprobacion interna.
- El flujo se puede desplegar de forma reproducible.
- La experiencia mantiene el tono oscuro, privado y premium.

## Releases

### Release 0 - Fundacion tecnica

Objetivo: montar app, backend, base de datos, storage, variables, despliegue y estructura de sesiones.

### Release 1 - Experiencia de acceso y pago simulado

Objetivo: usuario entra por URL fija, ve precio 49 EUR, pasa por pago simulado y llega a la antesala de entrevista.

### Release 2 - Entrevista por voz de 21 preguntas

Objetivo: el usuario puede completar la entrevista hablando, con transcripcion y persistencia segura.

### Release 3 - Generacion literaria del libro

Objetivo: convertir respuestas en manuscrito completo con voz del yo futuro, estructura narrativa y revision automatica.

### Release 4 - PDF editorial y beta productiva

Objetivo: generar PDF final listo para Lulu, back office operativo, aprobacion manual de libros, hardening, legal y despliegue a produccion controlada.

## Epicas y Product Backlog Items

## EPIC A - Identidad, experiencia y acceso

### PB-A01 - Definir nombre operativo y tono del producto

Prioridad: P0  
Tipo: producto/marca  
Descripcion: fijar nombre interno, tono narrativo, vocabulario y reglas de comunicacion.

Criterios de aceptacion:

- Existe nombre operativo.
- Existe manifiesto breve de tono.
- Se prohibe prometer prediccion literal del futuro.
- La promesa principal queda formulada como "futuros plausibles" y "eleccion vital".
- El copy evita sonar a SaaS generico.

### PB-A02 - Landing oscura de acceso fijo

Prioridad: P0  
Tipo: frontend  
Descripcion: crear la primera pantalla de la URL fija con estetica oscura, sobria, opaca y premium.

Criterios de aceptacion:

- La pagina carga rapido en movil y desktop.
- No hay menu publico ni exceso de informacion.
- Hay una accion clara para iniciar.
- La experiencia transmite rareza y privacidad sin parecer una estafa.
- Incluye enlaces discretos a privacidad, terminos y aviso de IA.

### PB-A03 - Pantalla de precio 49 EUR

Prioridad: P0  
Tipo: frontend/producto  
Descripcion: mostrar precio unico de 49 EUR antes del supuesto pago.

Criterios de aceptacion:

- El precio visible es 49 EUR.
- Se explica que el pago da acceso a una sesion de entrevista y generacion de libro.
- No se habla de Bitcoin.
- No se prometen reembolsos automaticos si no existen.
- El usuario acepta terminos antes de continuar.

### PB-A04 - Pasarela de pago simulada

Prioridad: P0  
Tipo: frontend/backend  
Descripcion: implementar el paso de pago como simulacion productiva para beta: al hacer clic en pagar, se simula redireccion y se aprueba el pago.

Criterios de aceptacion:

- Existe evento `payment_started`.
- Existe evento `payment_simulated_approved`.
- La pantalla deja claro internamente que es beta/simulacion.
- No se cobra dinero real.
- El sistema crea una sesion autorizada para la entrevista.
- La arquitectura permite sustituir la simulacion por Stripe u otra pasarela despues.

## EPIC B - Sesiones, seguridad y datos

### PB-B01 - Modelo de sesion

Prioridad: P0  
Tipo: backend/db  
Descripcion: crear la entidad principal de sesion, desde acceso hasta PDF final.

Campos minimos:

- `id`
- `status`
- `created_at`
- `updated_at`
- `payment_status`
- `interview_started_at`
- `interview_completed_at`
- `book_status`
- `pdf_url`
- `privacy_consent_at`

Criterios de aceptacion:

- Cada usuario anonimo recibe una sesion unica.
- Los estados son finitos y auditables.
- Una sesion no puede generar PDF sin entrevista completada.
- Una sesion no puede iniciar entrevista sin pago aprobado o simulado.

### PB-B02 - Consentimiento y privacidad

Prioridad: P0  
Tipo: legal/producto/backend  
Descripcion: registrar consentimiento antes de activar microfono e IA.

Criterios de aceptacion:

- El usuario acepta tratamiento de voz/transcripcion.
- Se explica que el audio puede procesarse tecnicamente para transcribir.
- Se define politica de retencion del audio.
- Se ofrece borrado de datos bajo solicitud.
- Se avisa de que el libro no es terapia, diagnostico ni prediccion garantizada.

### PB-B03 - Almacenamiento privado

Prioridad: P0  
Tipo: backend/storage  
Descripcion: guardar transcripciones, borradores y PDFs en storage privado.

Criterios de aceptacion:

- Ningun PDF queda publico por URL adivinable.
- Las URLs de descarga son firmadas y caducan.
- Los ficheros se separan por sesion.
- El back office puede recuperar PDFs segun permisos.

### PB-B04 - Eventos operativos

Prioridad: P1  
Tipo: backend/observabilidad  
Descripcion: registrar eventos clave para entender embudos y fallos.

Eventos minimos:

- `session_created`
- `payment_started`
- `payment_simulated_approved`
- `mic_permission_requested`
- `interview_started`
- `question_answered`
- `interview_completed`
- `book_generation_started`
- `book_generation_failed`
- `pdf_ready`
- `pdf_downloaded`

Criterios de aceptacion:

- Los eventos no guardan texto sensible salvo referencia de sesion.
- Hay timestamp y estado de sesion.
- Los errores tienen codigo y mensaje seguro.

## EPIC C - Entrevista por voz

### PB-C01 - Voz del agente con ElevenLabs

Prioridad: P0  
Tipo: frontend/backend/integracion  
Descripcion: integrar ElevenLabs para que el agente hable al usuario durante la experiencia.

Criterios de aceptacion:

- La API key vive solo en backend.
- La voz se reproduce correctamente en Chrome, Safari y movil.
- Hay fallback textual minimo solo para errores tecnicos.
- El tono de voz es calmado, oscuro y paciente.
- El usuario puede repetir la pregunta.

### PB-C02 - Captura de microfono y turnos

Prioridad: P0  
Tipo: frontend  
Descripcion: permitir que el usuario responda por voz a cada pregunta.

Criterios de aceptacion:

- Se solicita permiso de microfono de forma clara.
- El usuario ve estado: escuchando, procesando, guardado.
- Puede regrabar una respuesta antes de confirmar.
- Si falla la captura, se puede reintentar.
- No hay campo de texto libre como entrada principal.

### PB-C03 - Transcripcion de respuestas

Prioridad: P0  
Tipo: backend/integracion  
Descripcion: convertir cada respuesta hablada en texto estructurado.

Criterios de aceptacion:

- Cada respuesta queda asociada a una pregunta.
- Se guarda texto transcrito y metadata basica.
- Se marca confianza o calidad de transcripcion si el proveedor lo permite.
- Se puede continuar la entrevista tras fallo puntual.

### PB-C04 - Set inicial de 21 preguntas

Prioridad: P0  
Tipo: producto/IA  
Descripcion: definir las 21 preguntas base de la entrevista.

Criterios de aceptacion:

- Las preguntas cubren identidad, pasado, deseos, miedo, relaciones, ambicion, salud, dinero, trabajo, amor, arrepentimiento, valores y muerte.
- Van de menos invasivas a mas profundas.
- No fuerzan trauma ni diagnostico.
- Permiten respuestas largas.
- Son suficientemente concretas para alimentar un libro personal.

### PB-C05 - Adaptacion basica de preguntas

Prioridad: P1  
Tipo: IA/backend  
Descripcion: adaptar formulacion o repregunta segun respuestas previas.

Criterios de aceptacion:

- El sistema puede hacer una repregunta breve si la respuesta es demasiado superficial.
- No aumenta el numero total por encima de 21 salvo confirmacion de producto.
- La adaptacion queda registrada.
- Las repreguntas no manipulan ni presionan emocionalmente.

## EPIC D - Motor literario del libro

### PB-D01 - Estructura editorial del libro

Prioridad: P0  
Tipo: producto/editorial  
Descripcion: definir la arquitectura del libro final.

Estructura minima:

- Portada.
- Pagina de instrucciones.
- Nota del yo futuro.
- Prologo.
- 7 capitulos.
- Carta final.
- Epilogo practico.
- Pagina legal/aviso IA.

Criterios de aceptacion:

- La estructura se usa en todos los PDFs.
- El tono es literario y personal.
- No parece un informe psicologico.
- Incluye momentos oscuros, felices y pragmaticos.
- Incluye recomendaciones accionables sin sonar a checklist generica.

### PB-D02 - Prompt maestro de generacion

Prioridad: P0  
Tipo: IA  
Descripcion: crear el prompt maestro que convierte entrevista en manuscrito.

Criterios de aceptacion:

- Usa la voz del yo futuro.
- Trabaja con futuros plausibles, no certezas.
- Integra contradicciones del usuario.
- Evita inventar datos concretos no inferibles.
- Tiene reglas de estilo, longitud, capitulos y voz narrativa.
- Incluye instrucciones de seguridad emocional.

### PB-D03 - Pipeline multi-modelo

Prioridad: P1  
Tipo: backend/IA  
Descripcion: usar GPT-5.4 Pro y Claude 4.7 con roles separados.

Propuesta inicial:

- Modelo A: sintetiza perfil vital y mapa de temas.
- Modelo B: redacta capitulos con voz literaria.
- Modelo A: revisa coherencia, riesgos y alucinaciones.
- Modelo B: pule estilo final.

Criterios de aceptacion:

- Las llamadas estan versionadas.
- Cada output intermedio se guarda.
- Se puede regenerar un capitulo fallido.
- Los errores de IA no dejan al usuario en pantalla bloqueada.

### PB-D04 - Control de calidad del manuscrito

Prioridad: P0  
Tipo: IA/editorial  
Descripcion: revisar automaticamente el manuscrito antes de PDF.

Criterios de aceptacion:

- Detecta contradicciones graves.
- Detecta promesas de prediccion literal.
- Detecta lenguaje clinico/diagnostico no permitido.
- Detecta contenido demasiado generico.
- Devuelve score de calidad.
- Si falla, regenera secciones concretas.

### PB-D05 - Longitud del libro MVP

Prioridad: P0  
Tipo: producto/editorial  
Descripcion: definir longitud realista para 21 preguntas.

Criterios de aceptacion:

- Longitud objetivo: 35-60 paginas en PDF.
- Cada capitulo tiene entidad propia.
- La carta final es memorable y especifica.
- El libro se puede leer de una sentada.
- El PDF no rellena paginas con artificio.

## EPIC E - PDF editorial

### PB-E01 - Plantilla visual del libro

Prioridad: P0  
Tipo: frontend/pdf/diseno  
Descripcion: crear plantilla PDF oscura/elegante o editorial sobria lista para impresion.

Criterios de aceptacion:

- Tamano compatible con Lulu/Amazon KDP segun decision posterior.
- Margenes internos correctos.
- Tipografia legible.
- Numeracion de paginas.
- Portada y pagina de instrucciones diferenciadas.
- No hay cortes raros de parrafo.

### PB-E02 - Generacion server-side de PDF

Prioridad: P0  
Tipo: backend/pdf  
Descripcion: convertir el manuscrito en PDF final desde backend.

Criterios de aceptacion:

- El PDF se genera sin depender del navegador del usuario.
- Se guarda en storage privado.
- Se puede descargar con URL firmada.
- El fichero tiene nombre estable por sesion.
- Se valida que el PDF abre y pesa menos de un limite razonable.

### PB-E03 - Preparacion Lulu-ready sin envio

Prioridad: P0  
Tipo: backend/operaciones  
Descripcion: dejar el PDF preparado para envio futuro a Lulu via API, sin realizar envio en este MVP.

Criterios de aceptacion:

- El PDF cumple requisitos basicos de imprenta.
- Se guarda metadata necesaria: titulo, autor/nombre, paginas, formato, idioma.
- Existe placeholder de estado `ready_for_print`.
- No se llama a la API de Lulu.
- El back office muestra "listo para envio manual/API futura".

## EPIC F - Back office operativo

### PB-F01 - Vista interna de sesiones

Prioridad: P1  
Tipo: frontend/backend/admin  
Descripcion: crear panel privado para revisar sesiones y estado de generacion.

Criterios de aceptacion:

- Acceso protegido por clave/admin.
- Lista sesiones recientes.
- Muestra estado de entrevista, libro y PDF.
- Permite descargar PDF.
- Permite ver errores tecnicos sin exponer datos sensibles completos.

### PB-F02 - Regeneracion controlada

Prioridad: P1  
Tipo: backend/admin  
Descripcion: permitir regenerar manuscrito o PDF desde back office.

Criterios de aceptacion:

- Solo admin puede regenerar.
- Queda evento de auditoria.
- No borra versiones anteriores sin confirmacion.
- Permite distinguir PDF actual de versiones previas.

### PB-F03 - Configuracion segura de API keys

Prioridad: P0  
Tipo: backend/admin/seguridad  
Descripcion: permitir configurar desde back office las claves de proveedores externos sin exponerlas al frontend ni dejarlas visibles en claro.

Proveedores iniciales:

- ElevenLabs.
- OpenAI / GPT-5.4 Pro.
- Anthropic / Claude 4.7.
- Proveedor de transcripcion.
- Lulu, solo como placeholder futuro.

Criterios de aceptacion:

- Solo admin puede crear, actualizar o desactivar API keys.
- Las claves se guardan en secret manager o almacen equivalente cifrado.
- El panel muestra estado y version enmascarada, no la clave completa en claro.
- Existe boton "probar conexion" por proveedor.
- Existe rotacion de clave con auditoria.
- Si falta una clave obligatoria, el dashboard marca el proveedor como no operativo.
- Ninguna clave viaja al navegador salvo metadatos seguros: configurada/no configurada, ultimos 4 caracteres y fecha de actualizacion si aplica.

### PB-F04 - Dashboard operativo en tiempo real

Prioridad: P0  
Tipo: frontend/backend/admin/observabilidad  
Descripcion: crear dashboard para ver en directo el estado del producto y saber cuanta gente hay en cada fase.

Metricas minimas:

- Usuarios/sesiones activas ahora.
- Usuarios en entrevista.
- Usuarios esperando generacion del libro.
- Libros generandose.
- PDFs pendientes de revision.
- PDFs aprobados.
- PDFs bloqueados/rechazados.
- Sesiones con error.
- Tiempo medio de entrevista.
- Tiempo medio de generacion de libro/PDF.

Criterios de aceptacion:

- El dashboard se actualiza automaticamente o con refresco controlado.
- Permite filtrar por estado y fecha.
- Distingue claramente "entrevista activa", "esperando libro", "generando", "pendiente de revision" y "aprobado".
- Permite entrar a la ficha de una sesion desde cada metrica.
- No muestra transcripciones completas en widgets generales.

### PB-F05 - Cola de verificacion editorial de PDFs

Prioridad: P0  
Tipo: admin/editorial/pdf  
Descripcion: impedir que un PDF llegue al cliente hasta que Nestor o un admin lo revise y apruebe manualmente.

Criterios de aceptacion:

- Todo PDF generado entra por defecto en estado `pending_review`.
- El cliente no puede descargar el PDF mientras esta en `pending_review`.
- El back office permite previsualizar el PDF completo.
- El back office permite ver metadata: nombre, paginas, fecha, modelo, prompt version y score de calidad.
- El admin puede aprobar, pedir regeneracion o bloquear el PDF.
- Cada decision queda auditada con usuario, fecha y motivo opcional.
- Si se pide regeneracion, la sesion vuelve a estado controlado y conserva la version anterior.

### PB-F06 - Liberacion manual del libro al cliente

Prioridad: P0  
Tipo: backend/admin/producto  
Descripcion: una vez aprobado el PDF, permitir liberarlo al cliente de forma controlada.

Criterios de aceptacion:

- Solo un PDF `approved` puede pasar a `released_to_customer`.
- La liberacion genera una URL firmada de descarga.
- La URL firmada caduca.
- El admin puede copiar el enlace o activar envio futuro cuando exista canal de envio.
- El estado de sesion muestra claramente si el libro esta aprobado, liberado o pendiente.
- No hay envio automatico a Lulu ni a email en este MVP salvo decision posterior.

## EPIC G - Legal, confianza y limites

### PB-G01 - Terminos de uso

Prioridad: P0  
Tipo: legal/producto  
Descripcion: crear terminos especificos para esta experiencia.

Criterios de aceptacion:

- Explican que es una obra generada con IA.
- Explican que no es terapia ni consejo medico/legal/financiero.
- Explican que no predice el futuro.
- Explican politica de cancelacion/reembolso cuando haya pago real.
- Cubren uso de datos para generar el libro.

### PB-G02 - Privacidad y retencion

Prioridad: P0  
Tipo: legal/backend  
Descripcion: definir y publicar politica de privacidad.

Criterios de aceptacion:

- Indica que se procesan voz, transcripcion y respuestas personales.
- Indica proveedores principales.
- Indica periodo de retencion.
- Indica derecho de borrado.
- Indica contacto operativo.

### PB-G03 - Aviso emocional

Prioridad: P0  
Tipo: producto/legal  
Descripcion: avisar antes de la entrevista y en el libro de que el contenido puede ser intenso.

Criterios de aceptacion:

- El aviso aparece antes de iniciar.
- El aviso aparece en el PDF.
- Recomienda no usar el producto en crisis emocional.
- Usa lenguaje humano, no juridico frio.

## EPIC H - Produccion, despliegue y calidad

### PB-H01 - Entornos local, staging y produccion

Prioridad: P0  
Tipo: devops  
Descripcion: separar configuracion por entorno.

Criterios de aceptacion:

- Variables documentadas.
- Secretos fuera del repo.
- Storage separado por entorno.
- Base de datos staging separada de produccion.
- Build reproducible.

### PB-H02 - Tests end-to-end del flujo completo

Prioridad: P0  
Tipo: QA  
Descripcion: validar que el flujo completo funciona sin intervencion manual.

Criterios de aceptacion:

- Test crea sesion.
- Simula pago aprobado.
- Completa 21 respuestas mock.
- Genera manuscrito mock o real segun entorno.
- Genera PDF.
- Verifica que el PDF queda bloqueado hasta aprobacion.
- Aprueba el PDF desde back office.
- Verifica descarga/liberacion tras aprobacion.

### PB-H03 - Monitorizacion basica

Prioridad: P1  
Tipo: observabilidad  
Descripcion: detectar fallos de entrevista, IA, PDF y storage.

Criterios de aceptacion:

- Logs estructurados.
- Alertas de errores P0.
- Dashboard basico de sesiones fallidas.
- Tiempos medios de generacion visibles.

### PB-H04 - Runbook operativo

Prioridad: P1  
Tipo: operaciones  
Descripcion: documentar como operar el producto en beta.

Criterios de aceptacion:

- Como revisar sesiones.
- Como descargar PDFs.
- Como regenerar un PDF.
- Como borrar datos de un usuario.
- Como rotar API keys.
- Como desactivar el acceso si hay incidente.

## Set inicial de 21 preguntas

1. Como te llamas y que version de ti crees que esta entrando ahora en esta experiencia?
2. Que edad tienes y que momento vital dirias que estas atravesando?
3. Que parte de tu vida sientes que esta funcionando mejor de lo que esperabas?
4. Que parte de tu vida estas evitando mirar de frente?
5. Si dentro de 20 anos te arrepintieras de algo de esta etapa, que crees que seria?
6. Que deseo te da verguenza reconocer en voz alta?
7. Que miedo te gobierna mas de lo que te gustaria admitir?
8. Que persona ha cambiado tu vida aunque quiza nunca se lo hayas dicho bien?
9. Que relacion importante estas cuidando poco?
10. Que relacion importante deberias soltar o transformar?
11. Que ambicion te sigue llamando aunque intentes hacerte el practico?
12. Que precio estas pagando por la vida que llevas ahora?
13. Que parte de tu trabajo te da energia real?
14. Que parte de tu trabajo te esta apagando?
15. Que papel tienen el dinero, el estatus y la libertad en tus decisiones?
16. Que historia te cuentas sobre ti que podria no ser verdad?
17. Que habito pequeno, si lo cambiaras, podria alterar tu vida de forma enorme?
18. Que te gustaria que alguien entendiera de ti sin tener que explicarlo?
19. Como te gustaria amar y ser amado en una version mas honesta de tu vida?
20. Si tu yo futuro pudiera pedirte una sola cosa, que crees que te pediria?
21. Que pregunta no te he hecho y, aun asi, sabes que deberia haber aparecido?

## Modelo de datos inicial

### `sessions`

- `id`
- `status`
- `payment_status`
- `created_at`
- `updated_at`
- `privacy_consent_at`
- `interview_started_at`
- `interview_completed_at`
- `book_generation_started_at`
- `book_generation_completed_at`
- `pdf_ready_at`
- `pdf_review_status`
- `pdf_reviewed_at`
- `pdf_released_at`
- `pdf_url`
- `error_code`

### `answers`

- `id`
- `session_id`
- `question_index`
- `question_text`
- `transcript`
- `duration_seconds`
- `created_at`
- `quality_score`

### `book_artifacts`

- `id`
- `session_id`
- `artifact_type`
- `model`
- `prompt_version`
- `content_url`
- `created_at`
- `quality_score`
- `review_status`
- `reviewed_by`
- `reviewed_at`

### `provider_configs`

- `id`
- `provider`
- `status`
- `masked_key`
- `secret_ref`
- `last_tested_at`
- `last_test_status`
- `updated_by`
- `updated_at`

### `admin_audit_events`

- `id`
- `admin_id`
- `session_id`
- `action`
- `metadata`
- `created_at`

### `events`

- `id`
- `session_id`
- `event_type`
- `metadata`
- `created_at`

## API inicial

- `POST /api/v1/sessions`
- `POST /api/v1/sessions/:id/consent`
- `POST /api/v1/sessions/:id/payment/start`
- `POST /api/v1/sessions/:id/payment/simulate-approved`
- `GET /api/v1/sessions/:id/questions/current`
- `POST /api/v1/sessions/:id/answers`
- `POST /api/v1/sessions/:id/interview/complete`
- `POST /api/v1/sessions/:id/book/generate`
- `GET /api/v1/sessions/:id/book/status`
- `GET /api/v1/sessions/:id/pdf/download-url`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/sessions`
- `GET /api/v1/admin/sessions/:id`
- `POST /api/v1/admin/sessions/:id/regenerate`
- `GET /api/v1/admin/providers`
- `POST /api/v1/admin/providers/:provider/key`
- `POST /api/v1/admin/providers/:provider/test`
- `GET /api/v1/admin/pdf-review`
- `POST /api/v1/admin/pdf-review/:artifactId/approve`
- `POST /api/v1/admin/pdf-review/:artifactId/reject`
- `POST /api/v1/admin/pdf-review/:artifactId/request-regeneration`
- `POST /api/v1/admin/sessions/:id/release-to-customer`

## Plan de sprints

Cadencia recomendada: sprints de 1 semana. Si el equipo es pequeno, asumir 7 semanas reales para llegar a beta productiva controlada. Si hay dos personas tecnicas trabajando en paralelo, los sprints 3 y 4 pueden solaparse parcialmente.

### Sprint 0 - Producto, tono y base de produccion

Objetivo: cerrar la base conceptual y tecnica para no empezar a construir sobre humo.

Items incluidos:

- PB-A01 - Definir nombre operativo y tono del producto.
- PB-B01 - Modelo de sesion.
- PB-H01 - Entornos local, staging y produccion.

Entregables:

- Nombre operativo o nombre clave decidido.
- Manifiesto de tono y promesa del producto.
- Modelo inicial de base de datos.
- Proyecto desplegable en local/staging.
- Variables y secretos separados por entorno.

Criterio de salida:

- Se puede crear una sesion en backend y verla persistida.
- El equipo tiene claro que el producto prepara futuros plausibles, no predice el futuro.

### Sprint 1 - Acceso, precio y pago simulado

Objetivo: construir el primer tramo completo de la experiencia hasta dejar al usuario autorizado para iniciar entrevista.

Items incluidos:

- PB-A02 - Landing oscura de acceso fijo.
- PB-A03 - Pantalla de precio 49 EUR.
- PB-A04 - Pasarela de pago simulada.
- PB-B02 - Consentimiento y privacidad.
- PB-G03 - Aviso emocional.

Entregables:

- URL fija con landing oscura.
- Pantalla de precio con 49 EUR.
- Flujo de pago simulado.
- Consentimiento antes de microfono e IA.
- Aviso emocional en lenguaje humano.

Criterio de salida:

- Un usuario puede entrar, aceptar terminos, pulsar pagar y llegar a la antesala de entrevista con una sesion autorizada.

### Sprint 2 - Voz del agente y captura de respuestas

Objetivo: hacer que la experiencia deje de ser una web y empiece a sentirse como una entrevista privada por voz.

Items incluidos:

- PB-C01 - Voz del agente con ElevenLabs.
- PB-C02 - Captura de microfono y turnos.
- PB-C03 - Transcripcion de respuestas.
- PB-B03 - Almacenamiento privado.

Entregables:

- Backend proxy para ElevenLabs.
- Reproduccion de voz del agente.
- Permisos de microfono.
- Grabacion/regrabacion de respuestas.
- Transcripcion guardada por sesion.
- Storage privado para audio/transcripciones si aplica.

Criterio de salida:

- El agente puede formular una pregunta por voz, el usuario responde hablando y la transcripcion queda asociada a la sesion.

### Sprint 3 - Entrevista completa de 21 preguntas

Objetivo: completar la entrevista de principio a fin con 21 preguntas, estados robustos y eventos operativos.

Items incluidos:

- PB-C04 - Set inicial de 21 preguntas.
- PB-C05 - Adaptacion basica de preguntas.
- PB-B04 - Eventos operativos.

Entregables:

- Las 21 preguntas integradas en el flujo.
- Progreso visible y recuperable dentro de la sesion.
- Repregunta basica si la respuesta es demasiado superficial.
- Eventos del embudo guardados.
- Estados de error/reintento.

Criterio de salida:

- Un usuario puede completar las 21 preguntas y dejar la sesion marcada como entrevista completada.

### Sprint 4 - Motor literario del libro

Objetivo: convertir la entrevista en un manuscrito personal, especifico y literario.

Items incluidos:

- PB-D01 - Estructura editorial del libro.
- PB-D02 - Prompt maestro de generacion.
- PB-D03 - Pipeline multi-modelo.
- PB-D04 - Control de calidad del manuscrito.
- PB-D05 - Longitud del libro MVP.

Entregables:

- Arquitectura editorial cerrada.
- Prompt maestro versionado.
- Pipeline GPT-5.4 Pro / Claude 4.7 preparado desde backend.
- Generacion de manuscrito por capitulos.
- Revision automatica de coherencia, seguridad y calidad.
- Regeneracion parcial si falla el control de calidad.

Criterio de salida:

- A partir de una entrevista completada, el sistema genera un manuscrito de 35-60 paginas con voz consistente del yo futuro.

### Sprint 5 - PDF, Lulu-ready y back office operativo

Objetivo: transformar el manuscrito en un PDF imprimible y dar al equipo una consola real para operar la beta, configurar proveedores y aprobar libros antes de liberarlos.

Items incluidos:

- PB-E01 - Plantilla visual del libro.
- PB-E02 - Generacion server-side de PDF.
- PB-E03 - Preparacion Lulu-ready sin envio.
- PB-F01 - Vista interna de sesiones.
- PB-F02 - Regeneracion controlada.
- PB-F03 - Configuracion segura de API keys.
- PB-F04 - Dashboard operativo en tiempo real.
- PB-F05 - Cola de verificacion editorial de PDFs.
- PB-F06 - Liberacion manual del libro al cliente.

Entregables:

- Plantilla editorial PDF.
- Generacion server-side.
- Descarga privada con URL firmada solo tras aprobacion.
- Metadata preparada para Lulu.
- Estado `ready_for_print`.
- Estado `pending_review` para PDFs nuevos.
- Back office con sesiones, dashboard, proveedores, revision, descarga y regeneracion.
- Configuracion segura de API keys con prueba de conexion.
- Cola de PDFs pendientes de revision.

Criterio de salida:

- Una sesion completada produce un PDF revisable por back office, bloqueado para el cliente hasta que un admin lo aprueba y lo libera manualmente.

### Sprint 6 - Legal, monitorizacion y beta productiva

Objetivo: cerrar lo necesario para subir a produccion controlada sin ir a ciegas.

Items incluidos:

- PB-G01 - Terminos de uso.
- PB-G02 - Privacidad y retencion.
- PB-H02 - Tests end-to-end del flujo completo.
- PB-H03 - Monitorizacion basica.
- PB-H04 - Runbook operativo.

Entregables:

- Terminos publicados.
- Politica de privacidad y retencion.
- Test e2e del flujo completo.
- Monitorizacion de errores P0.
- Runbook operativo.
- Checklist final de beta.

Criterio de salida:

- El producto se puede abrir a beta privada: URL fija, pago simulado, entrevista completa, libro generado, back office operativo, PDF aprobado antes de liberarse y operacion documentada.

## Cobertura del PB por sprint

| Item | Sprint |
| --- | --- |
| PB-A01 - Definir nombre operativo y tono del producto | Sprint 0 |
| PB-A02 - Landing oscura de acceso fijo | Sprint 1 |
| PB-A03 - Pantalla de precio 49 EUR | Sprint 1 |
| PB-A04 - Pasarela de pago simulada | Sprint 1 |
| PB-B01 - Modelo de sesion | Sprint 0 |
| PB-B02 - Consentimiento y privacidad | Sprint 1 |
| PB-B03 - Almacenamiento privado | Sprint 2 |
| PB-B04 - Eventos operativos | Sprint 3 |
| PB-C01 - Voz del agente con ElevenLabs | Sprint 2 |
| PB-C02 - Captura de microfono y turnos | Sprint 2 |
| PB-C03 - Transcripcion de respuestas | Sprint 2 |
| PB-C04 - Set inicial de 21 preguntas | Sprint 3 |
| PB-C05 - Adaptacion basica de preguntas | Sprint 3 |
| PB-D01 - Estructura editorial del libro | Sprint 4 |
| PB-D02 - Prompt maestro de generacion | Sprint 4 |
| PB-D03 - Pipeline multi-modelo | Sprint 4 |
| PB-D04 - Control de calidad del manuscrito | Sprint 4 |
| PB-D05 - Longitud del libro MVP | Sprint 4 |
| PB-E01 - Plantilla visual del libro | Sprint 5 |
| PB-E02 - Generacion server-side de PDF | Sprint 5 |
| PB-E03 - Preparacion Lulu-ready sin envio | Sprint 5 |
| PB-F01 - Vista interna de sesiones | Sprint 5 |
| PB-F02 - Regeneracion controlada | Sprint 5 |
| PB-F03 - Configuracion segura de API keys | Sprint 5 |
| PB-F04 - Dashboard operativo en tiempo real | Sprint 5 |
| PB-F05 - Cola de verificacion editorial de PDFs | Sprint 5 |
| PB-F06 - Liberacion manual del libro al cliente | Sprint 5 |
| PB-G01 - Terminos de uso | Sprint 6 |
| PB-G02 - Privacidad y retencion | Sprint 6 |
| PB-G03 - Aviso emocional | Sprint 1 |
| PB-H01 - Entornos local, staging y produccion | Sprint 0 |
| PB-H02 - Tests end-to-end del flujo completo | Sprint 6 |
| PB-H03 - Monitorizacion basica | Sprint 6 |
| PB-H04 - Runbook operativo | Sprint 6 |

## Criterios para declarar MVP listo

- La URL fija funciona en produccion.
- Un usuario puede iniciar y completar el flujo sin ayuda.
- El pago simulado desbloquea la entrevista.
- Las 21 preguntas se hacen por voz.
- Las respuestas se transcriben y guardan.
- Se genera un libro completo con voz narrativa consistente.
- El PDF se genera y queda en cola de revision.
- El back office permite ver sesiones, metricas en vivo, proveedores/API keys y cola editorial.
- El PDF solo se descarga o libera al cliente despues de aprobacion manual.
- No hay secretos expuestos.
- Hay terminos, privacidad y aviso de IA.
- El sistema no envia nada a Lulu todavia.

## Riesgos principales

1. Latencia alta en voz/IA/PDF: mitigar con estados claros y procesos asincronos.
2. Resultado literario generico: mitigar con pipeline de perfilado, revision y regeneracion parcial.
3. Sensacion de estafa por estetica opaca: mitigar con legal discreto, precio claro y ejecucion impecable.
4. Privacidad sensible: mitigar con minima retencion, storage privado y consentimiento explicito.
5. Coste de IA superior al precio: medir coste por sesion desde el primer dia.
6. Usuario abandona durante entrevista: guardar progreso y permitir recuperar en MVP si el enlace fijo lo permite.

## Siguiente decision de producto

Antes de implementar, hay que fijar:

- Nombre publico o nombre clave.
- Proveedor de transcripcion.
- Stack final de frontend/backend.
- Formato fisico objetivo del libro para Lulu.
- Politica de retencion de audio.
- Si el usuario podra recuperar sesion si cierra la pestana.
