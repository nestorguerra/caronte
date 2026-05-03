# Product Backlog de Produccion - LicitIA v2

Fecha: 19/04/2026  
Base: `AUDITORIA_PRODUCCION_LICITIA.md`  
Objetivo: convertir LicitIA de MVP/demo estatica en producto SaaS productivo para busqueda, seguimiento y preparacion de licitaciones publicas en Espana.

## Product Goal

LicitIA debe estar lista para produccion al completar este backlog: usuarios reales, alta y onboarding completo, datos oficiales normalizados, alertas server-side, IA gobernada con trazabilidad, seguridad por diseno, auditoria operativa, despliegue reproducible en GitHub Web para el frontend y backend gestionado para servicios productivos.

El primer mes sera gratuito. No se implementa pasarela de pagos en esta version. El flujo de alta debe incluir el paso de plan/facturacion, pero al llegar a pago mostrara: "Durante el primer mes LicitIA es gratuita. No tienes que introducir tarjeta ni metodo de pago. Te avisaremos antes de activar cualquier plan de pago."

## Supuestos de arquitectura

- Frontend publico y app web: GitHub Pages / GitHub Web desde este repositorio.
- Backend/API: Supabase Edge Functions, Cloudflare Workers, Render/Fly.io o equivalente. Recomendacion inicial: Supabase por velocidad: Auth, Postgres, Storage, RLS y funciones serverless.
- Base de datos: PostgreSQL.
- Storage: bucket privado para documentos oficiales, propuestas y exports.
- IA: llamadas siempre desde backend. Nunca desde el navegador.
- Jobs: funciones programadas/worker para ingestion, alertas y reconciliacion.
- Pagos: fuera de alcance para el primer mes, pero el modelo de planes debe quedar preparado.

## Definition of Done global

Una historia solo se considera terminada si cumple:

- Implementada en entorno dev y validada en staging.
- Tests automatizados relevantes: unitarios, integracion o e2e segun riesgo.
- Sin secretos en frontend ni en repositorio.
- Logs estructurados para errores y acciones criticas.
- Permisos multi-tenant probados.
- Documentacion minima actualizada.
- Migraciones versionadas si toca base de datos.
- Revisada contra privacidad, seguridad y trazabilidad.
- Desplegada mediante pipeline reproducible.

## Release Plan

### Release 0 - Fundacion productiva

Objetivo: abandonar la demo localStorage-only y montar base real: repo, frontend moderno, backend, auth, DB, seguridad y entornos.

### Release 1 - Alta, onboarding y cockpit minimo

Objetivo: usuario real puede registrarse, crear organizacion, completar perfil de empresa y entrar a un dashboard conectado a backend.

### Release 2 - Datos oficiales, busqueda y seguimiento

Objetivo: ingestion oficial BOE/PLACSP, busqueda productiva, guardado de oportunidades y seguimiento por expediente.

### Release 3 - Alertas, IA y documentos

Objetivo: alertas fiables, IA server-side con citas, checklist documental, propuesta y calendario operativo.

### Release 4 - Hardening de produccion

Objetivo: observabilidad, compliance, backups, auditoria, rendimiento, seguridad final y salida a beta gratuita.

## Epicas y Product Backlog Items

## EPIC A - Repositorio, arquitectura y despliegue

### PB-A01 - Reestructurar proyecto frontend productivo

Prioridad: P0  
Tipo: tecnica  
Descripcion: migrar la app estatica monolitica a una estructura mantenible sin perder el look actual: `src/`, componentes, rutas, servicios, estilos y build.

Criterios de aceptacion:
- Existe proyecto frontend con build reproducible.
- `index.html` y `dashboard.html` dejan de ser archivos monoliticos como fuente principal.
- El branding actual de LicitIA se conserva.
- La app se puede ejecutar localmente y compilar para GitHub Pages.
- El build final solo publica artefactos necesarios.

### PB-A02 - Configurar GitHub Pages / GitHub Web como despliegue frontend

Prioridad: P0  
Tipo: devops  
Descripcion: dejar el frontend desplegado desde GitHub Actions hacia GitHub Pages.

Criterios de aceptacion:
- Workflow con build, test y deploy.
- No publica `LicitIA.zip`, `__MACOSX`, `.DS_Store` ni archivos temporales.
- `.gitignore` ampliado.
- `.nojekyll` mantenido si aplica.
- Variables publicas separadas de secretos.
- Existe entorno `staging` y `production` documentado.

### PB-A03 - Backend gestionado y API base

Prioridad: P0  
Tipo: backend  
Descripcion: crear API productiva para autenticar, leer/escribir datos y ejecutar operaciones sensibles.

Criterios de aceptacion:
- API con health check `/health`.
- API versionada: `/api/v1`.
- CORS restringido al dominio de GitHub Pages/staging.
- Rate limiting basico.
- Logs estructurados.
- Errores normalizados.
- Ninguna API key de OpenAI/Telegram/servicios externos se expone al frontend.

### PB-A04 - Entornos y configuracion

Prioridad: P0  
Tipo: devops  
Descripcion: separar local, staging y produccion.

Criterios de aceptacion:
- Variables por entorno documentadas.
- Secretos en secret manager/proveedor, no en GitHub plano.
- Base de datos staging separada de produccion.
- Buckets de storage separados.
- Se puede promocionar una version de staging a produccion.

## EPIC B - Base de datos y modelo multi-tenant

### PB-B01 - Disenar esquema PostgreSQL inicial

Prioridad: P0  
Tipo: backend/db  
Descripcion: crear modelo de datos productivo.

Tablas minimas:
- `organizations`
- `users`
- `organization_members`
- `plans`
- `subscriptions`
- `company_profiles`
- `procurement_sources`
- `tenders`
- `tender_lots`
- `tender_documents`
- `tender_versions`
- `saved_searches`
- `tracked_tenders`
- `alert_rules`
- `alert_events`
- `tasks`
- `milestones`
- `document_checklists`
- `proposal_projects`
- `proposal_versions`
- `ai_runs`
- `audit_events`
- `notification_deliveries`

Criterios de aceptacion:
- Migracion versionada.
- Indices para busqueda por texto, CPV, fecha, estado, importe, organismo y tenant.
- Campos `created_at`, `updated_at`, `created_by` donde aplique.
- Relaciones con FK.
- Borrado logico en entidades de usuario/tenant cuando aplique.

### PB-B02 - Row Level Security y aislamiento por organizacion

Prioridad: P0  
Tipo: seguridad/db  
Descripcion: impedir que una organizacion vea datos privados de otra.

Criterios de aceptacion:
- RLS activa en tablas tenant-owned.
- Tests que prueban que usuario A no puede leer datos de tenant B.
- Roles: owner, admin, bid_manager, legal, finance, viewer.
- Politicas documentadas.

### PB-B03 - Modelo de planes sin cobro

Prioridad: P0  
Tipo: producto/backend  
Descripcion: dejar preparado el modelo comercial sin pasarela de pago.

Criterios de aceptacion:
- Existe plan `free_beta_month`.
- Alta crea suscripcion gratuita con fecha de inicio y fin estimada.
- Estado de suscripcion: `trialing_free`, `active_free`, `expired`, `payment_required_future`.
- No hay integracion Stripe/TPV en esta version.
- API devuelve mensaje de gratuidad cuando el flujo llega a pago.

## EPIC C - Seguridad, autenticacion y cumplimiento base

### PB-C01 - Registro de usuarios

Prioridad: P0  
Tipo: producto/auth  
Descripcion: permitir alta real con email y contrasena/passwordless.

Criterios de aceptacion:
- Registro con email.
- Verificacion de email.
- Politica de contrasena si se usa password.
- Recuperacion de contrasena.
- Bloqueo o throttling ante intentos repetidos.
- No existe credencial demo visible en produccion.

### PB-C02 - Login seguro y sesiones reales

Prioridad: P0  
Tipo: auth  
Descripcion: sustituir `sessionStorage` como barrera de acceso.

Criterios de aceptacion:
- Sesion firmada/JWT gestionada por backend/proveedor auth.
- Logout invalida sesion local.
- Expiracion/refresh controlado.
- Dashboard no carga datos privados sin token valido.
- Tests e2e de acceso denegado sin login.

### PB-C03 - MFA opcional

Prioridad: P1  
Tipo: seguridad  
Descripcion: permitir segundo factor para owners/admins.

Criterios de aceptacion:
- MFA activable/desactivable por usuario.
- Recuperacion segura documentada.
- Admin puede exigir MFA para la organizacion.

### PB-C04 - Auditoria de actividad

Prioridad: P0  
Tipo: seguridad/compliance  
Descripcion: registrar acciones criticas.

Eventos minimos:
- Login/logout.
- Cambio de perfil empresa.
- Cambio de roles.
- Alta/baja de usuarios.
- Creacion/edicion de alertas.
- Decision Go/No-Go.
- Generacion IA.
- Exportacion de documentos.
- Descarga de CSV/DOCX/PDF.

Criterios de aceptacion:
- Eventos escriben en `audit_events`.
- Incluyen actor, organizacion, recurso, accion, timestamp e IP/user-agent si disponible.
- Panel admin puede consultar eventos.
- No se guardan secretos en logs.

### PB-C05 - Politicas legales y privacidad

Prioridad: P0  
Tipo: legal/producto  
Descripcion: incorporar terminos basicos para beta gratuita.

Criterios de aceptacion:
- Pantalla/links a politica de privacidad.
- Terminos de uso beta.
- Aviso de IA: apoyo a decision, no sustituto de revision juridica/profesional.
- Consentimiento para comunicaciones operativas.
- Registro de aceptacion con version.

## EPIC D - Alta, onboarding y activacion

### PB-D01 - Flujo de alta de organizacion

Prioridad: P0  
Tipo: producto  
Descripcion: tras registrarse, el usuario crea o acepta invitacion a una organizacion.

Criterios de aceptacion:
- Crear organizacion con nombre, CIF opcional, sector y pais.
- Owner inicial queda asignado.
- Puede invitar miembros por email.
- Onboarding no permite entrar al cockpit sin organizacion activa.

### PB-D02 - Onboarding paso 1: perfil empresarial

Prioridad: P0  
Tipo: producto  
Descripcion: recoger datos necesarios para scoring y alertas.

Campos minimos:
- Nombre fiscal/comercial.
- CIF/NIF opcional.
- Sectores.
- CPV objetivo.
- CNAE opcional.
- Descripcion servicios.
- Facturacion anual por tramos.
- Empleados por tramos.
- Anos de experiencia.
- Certificaciones: ISO, ENS, otras.
- Clasificacion empresarial.
- Ambito geografico.
- Importes min/max.
- Tipos de contrato objetivo.

Criterios de aceptacion:
- Progreso de completitud.
- Validaciones de formato.
- Datos guardados en backend.
- Se puede editar despues.

### PB-D03 - Onboarding paso 2: preferencias de busqueda

Prioridad: P0  
Tipo: producto  
Descripcion: configurar intereses iniciales.

Criterios de aceptacion:
- Usuario define 1-5 busquedas guardadas iniciales.
- Puede elegir CPV, palabras clave, territorio, importe, organismo y plazo.
- Se crea al menos una regla de alerta sugerida.

### PB-D04 - Onboarding paso 3: equipo y roles

Prioridad: P1  
Tipo: producto  
Descripcion: invitar equipo y asignar roles.

Criterios de aceptacion:
- Invitar por email.
- Asignar rol.
- Reenviar/cancelar invitacion.
- Auditoria registra cambios.

### PB-D05 - Onboarding paso 4: plan gratuito temporal

Prioridad: P0  
Tipo: producto  
Descripcion: simular paso de plan/facturacion sin cobrar.

Criterios de aceptacion:
- Muestra plan "Beta gratuita - primer mes".
- Al pulsar continuar hacia pago aparece mensaje de gratuidad.
- No pide tarjeta.
- Crea suscripcion gratuita.
- Se informa que se avisara antes de cualquier cobro futuro.

Texto requerido:
"Durante el primer mes LicitIA es gratuita. No tienes que introducir tarjeta ni metodo de pago. Te avisaremos antes de activar cualquier plan de pago."

### PB-D06 - Primera experiencia guiada

Prioridad: P1  
Tipo: producto/frontend  
Descripcion: guiar al usuario hasta su primera oportunidad real.

Criterios de aceptacion:
- Checklist de onboarding visible.
- CTA: "Buscar primeras licitaciones".
- Se precargan filtros desde perfil.
- Se sugiere guardar 3 oportunidades o crear 1 alerta.

## EPIC E - Ingestion oficial de datos

### PB-E01 - Ingestion BOE server-side

Prioridad: P0  
Tipo: backend/data  
Descripcion: mover consulta BOE del navegador al backend.

Criterios de aceptacion:
- Job diario consulta BOE OpenData.
- Guarda items de seccion V.A.
- Guarda HTML/PDF/XML cuando aplique o sus enlaces versionados.
- Reintentos y logs.
- Sin proxies CORS publicos.

### PB-E02 - Ingestion PLACSP Datos Abiertos

Prioridad: P0  
Tipo: backend/data  
Descripcion: incorporar PLACSP como fuente principal.

Criterios de aceptacion:
- Job descarga/procesa datasets oficiales.
- Normaliza licitaciones publicadas, agregadas y formalizaciones.
- Identifica expediente, lote, CPV, organismo, estado, importe, fechas, procedimiento y enlaces.
- Deduplica con BOE cuando sea posible.
- Guarda version de origen y fecha de ingestion.

### PB-E03 - Normalizador de expedientes y lotes

Prioridad: P0  
Tipo: backend/data  
Descripcion: crear entidad canonica de licitacion.

Criterios de aceptacion:
- Una licitacion puede tener N lotes.
- Cambios de estado generan version.
- Documentos quedan asociados al expediente/lote.
- Identificador canonico estable.
- Conflictos de fuente quedan marcados para revision.

### PB-E04 - Descarga y almacenamiento de documentos oficiales

Prioridad: P1  
Tipo: backend/storage  
Descripcion: almacenar documentos relevantes para analisis y auditoria.

Criterios de aceptacion:
- Storage privado.
- Metadatos: tipo, fuente, fecha, hash, tamano, url original.
- Evita duplicados por hash.
- Control de acceso por usuario/tenant si el documento queda asociado a trabajo privado.

### PB-E05 - Reconciliacion y control de calidad de datos

Prioridad: P1  
Tipo: data/observabilidad  
Descripcion: comprobar cobertura diaria.

Criterios de aceptacion:
- Dashboard interno muestra items BOE, PLACSP, errores, duplicados y retrasos.
- Alerta interna si ingestion falla.
- Reporte de cambios relevantes por dia.

## EPIC F - Busqueda y oportunidad comercial

### PB-F01 - Buscador avanzado

Prioridad: P0  
Tipo: producto/frontend/backend  
Descripcion: reemplazar filtro simple por busqueda productiva.

Filtros minimos:
- Texto.
- CPV.
- Organismo.
- Territorio.
- Importe min/max.
- Fecha publicacion.
- Fecha limite.
- Estado.
- Tipo contrato.
- Procedimiento.
- Solo abiertas.
- Solo con documentos/pliegos.

Criterios de aceptacion:
- Resultados paginados.
- Orden por relevancia, fecha limite, importe y score.
- Busqueda en backend, no en navegador.
- Tiempo respuesta objetivo: < 2s para consultas normales.

### PB-F02 - Ficha de licitacion productiva

Prioridad: P0  
Tipo: producto  
Descripcion: mostrar detalle completo y trazable.

Criterios de aceptacion:
- Datos basicos y fuente.
- Lotes.
- Fechas clave.
- Importes.
- CPV.
- Documentos.
- Historial de cambios.
- Enlaces oficiales.
- Estado de seguimiento interno.

### PB-F03 - Guardar y seguir licitaciones

Prioridad: P0  
Tipo: producto  
Descripcion: permitir que una organizacion siga expedientes.

Criterios de aceptacion:
- Usuario guarda oportunidad.
- Estado interno: nueva, en analisis, go, no_go, preparando, presentada, descartada, adjudicada, perdida.
- Responsable asignado.
- Notas internas.
- Historial de cambios.

### PB-F04 - Scoring explicable Go/No-Go

Prioridad: P0  
Tipo: producto/IA  
Descripcion: sustituir score opaco por factores explicables.

Factores minimos:
- Encaje CPV/servicio.
- Territorio.
- Importe.
- Solvencia economica.
- Solvencia tecnica.
- Certificaciones.
- Experiencia.
- Plazo restante.
- Competencia historica.
- Riesgo documental.

Criterios de aceptacion:
- Score total y score por factor.
- Cada factor explica datos usados.
- Usuario puede marcar decision final manual.
- Decision manual queda auditada.

## EPIC G - Alertas y notificaciones productivas

### PB-G01 - Reglas de alerta server-side

Prioridad: P0  
Tipo: backend/producto  
Descripcion: las alertas deben ejecutarse aunque el navegador este cerrado.

Criterios de aceptacion:
- Reglas guardadas en backend.
- Worker programado evalua reglas.
- Deduplicacion por expediente/lote/version.
- Registro de eventos.
- El usuario puede pausar/reactivar reglas.

### PB-G02 - Notificaciones por email

Prioridad: P0  
Tipo: backend/producto  
Descripcion: canal base de notificacion.

Criterios de aceptacion:
- Envio email transaccional.
- Plantilla con oportunidad, score, plazo y enlace.
- Registro de entrega/error.
- Preferencias por usuario.

### PB-G03 - Digest semanal

Prioridad: P1  
Tipo: producto  
Descripcion: resumen semanal de oportunidades y cambios.

Criterios de aceptacion:
- Digest configurable.
- Incluye nuevas oportunidades, vencimientos y cambios de estado.
- No se envia si usuario lo desactiva.

### PB-G04 - Telegram/Teams/Slack via backend

Prioridad: P2  
Tipo: integracion  
Descripcion: canales externos sin exponer tokens en frontend.

Criterios de aceptacion:
- Tokens guardados cifrados/secretos.
- Envio desde backend.
- Test de canal.
- Auditoria de cambios.

## EPIC H - IA gobernada y copiloto

### PB-H01 - Proxy IA server-side

Prioridad: P0  
Tipo: backend/IA  
Descripcion: centralizar llamadas IA.

Criterios de aceptacion:
- Frontend nunca ve API key de IA.
- Limites por organizacion/usuario.
- Logs de uso: modelo, tokens/coste estimado, endpoint, exito/error.
- Redaccion o minimizacion de datos sensibles cuando sea posible.

### PB-H02 - Schemas de salida estructurada

Prioridad: P0  
Tipo: IA/backend  
Descripcion: evitar regex sobre texto IA.

Criterios de aceptacion:
- Schemas JSON para scoring, resumen, requisitos, criterios, checklist, propuesta.
- Validacion estricta.
- Errores recuperables.
- Tests con fixtures reales.

### PB-H03 - Analisis de licitacion con citas

Prioridad: P0  
Tipo: IA/producto  
Descripcion: extraer informacion usando documentos oficiales.

Criterios de aceptacion:
- Cada importe, plazo, solvencia y criterio incluye fuente/documento/pagina o fragmento.
- Si no hay evidencia, se marca "no encontrado".
- La IA no inventa requisitos.
- Usuario ve diferencia entre dato oficial e inferencia.

### PB-H04 - Copiloto de propuesta tecnica

Prioridad: P1  
Tipo: IA/producto  
Descripcion: generar borradores trazables y editables.

Criterios de aceptacion:
- Borrador por expediente/lote.
- Usa perfil empresa y pliegos.
- Advierte datos pendientes.
- Versionado de borradores.
- Export DOCX/PDF.
- Registro de prompts/modelo/output.

### PB-H05 - Evaluacion y mejora de propuesta

Prioridad: P1  
Tipo: IA/producto  
Descripcion: revisar borradores con criterios del pliego.

Criterios de aceptacion:
- Score por seccion.
- Riesgos y faltantes.
- Sugerencias accionables.
- No sobreescribe sin confirmar.

### PB-H06 - Evaluacion IA con gold set

Prioridad: P1  
Tipo: calidad/IA  
Descripcion: medir precision antes de confiar en recomendaciones.

Criterios de aceptacion:
- Dataset de expedientes reales anotados.
- Metricas: exactitud de plazos, importes, CPV, requisitos, decision Go/No-Go.
- Umbrales minimos para release.
- Regression tests por cambio de prompt/modelo.

## EPIC I - Checklist, tareas y calendario

### PB-I01 - Checklist documental por expediente

Prioridad: P0  
Tipo: producto  
Descripcion: convertir checklist demo en modulo productivo.

Criterios de aceptacion:
- Checklist por expediente/lote.
- Items automaticos con fuente.
- Items manuales.
- Estado: pendiente, en curso, validado, no aplica.
- Responsable y fecha limite por item.
- Historial de cambios.

### PB-I02 - Tareas y responsables

Prioridad: P0  
Tipo: producto  
Descripcion: coordinar trabajo de preparacion.

Criterios de aceptacion:
- Crear tareas vinculadas a expediente/documento.
- Asignar usuario.
- Comentarios.
- Fechas y prioridades.
- Vista por responsable.

### PB-I03 - Calendario de hitos

Prioridad: P0  
Tipo: producto  
Descripcion: plazos criticos con recordatorios fiables.

Criterios de aceptacion:
- Hitos automaticos desde fuentes oficiales cuando existan.
- Hitos manuales.
- Recordatorios por email.
- Export ICS.
- Cambio de plazo genera alerta.

### PB-I04 - Comentarios y actividad

Prioridad: P1  
Tipo: producto  
Descripcion: trazabilidad colaborativa.

Criterios de aceptacion:
- Comentarios por expediente.
- Menciones a usuarios.
- Timeline de actividad.
- Auditoria de acciones relevantes.

## EPIC J - Inteligencia competitiva y simulador economico

### PB-J01 - Historico de adjudicaciones

Prioridad: P1  
Tipo: data/producto  
Descripcion: construir base competitiva real desde formalizaciones oficiales.

Criterios de aceptacion:
- Adjudicatario normalizado.
- Importes base/adjudicacion.
- Rebaja.
- CPV/organismo/territorio.
- Lote si aplica.
- Fuente y fecha.

### PB-J02 - Normalizacion de competidores

Prioridad: P1  
Tipo: data  
Descripcion: agrupar variantes de nombre y UTEs.

Criterios de aceptacion:
- Tabla de `companies`.
- Alias de empresa.
- Marcado de UTE.
- Confianza del matching.
- Correccion manual por admin.

### PB-J03 - Dashboard competitivo

Prioridad: P1  
Tipo: producto  
Descripcion: sustituir datos demo por analitica real.

Criterios de aceptacion:
- Top adjudicatarios por CPV/organismo.
- Rebaja media/mediana.
- Concentracion.
- Evolucion temporal.
- Export CSV.

### PB-J04 - Simulador economico productivo

Prioridad: P1  
Tipo: producto  
Descripcion: mantener simulador pero conectado a expediente y datos historicos.

Criterios de aceptacion:
- Inputs guardados por escenario.
- Usa importe oficial.
- Sugerencias basadas en historico si existe.
- Sensibilidad de margen/precio/probabilidad.
- Export CSV/PDF.

## EPIC K - Documentos, exportaciones y preparacion de candidatura

### PB-K01 - Biblioteca documental

Prioridad: P1  
Tipo: producto/storage  
Descripcion: centralizar documentos de empresa y expediente.

Criterios de aceptacion:
- Subida segura.
- Tipos: certificado, solvencia, memoria, poderes, CV, seguro, otros.
- Permisos por rol.
- Versionado.
- Hash y metadatos.

### PB-K02 - Dossier de candidatura

Prioridad: P1  
Tipo: producto  
Descripcion: agrupar documentos para preparar presentacion.

Criterios de aceptacion:
- Dossier por expediente/lote.
- Checklist de completitud.
- Export ZIP limpio.
- Registro de exportacion.

### PB-K03 - Exportacion DOCX/PDF de propuesta

Prioridad: P1  
Tipo: producto  
Descripcion: entregar artefacto editable/profesional.

Criterios de aceptacion:
- DOCX editable.
- PDF opcional.
- Plantilla con marca LicitIA/cliente.
- Incluye version y fecha.

### PB-K04 - Limite de alcance: no presentacion electronica automatica

Prioridad: P0  
Tipo: producto/legal  
Descripcion: dejar claro que v1 prepara candidatura, no presenta oficialmente.

Criterios de aceptacion:
- UI y terminos no prometen envio oficial automatico.
- CTA usa "Preparar candidatura" y "Abrir portal oficial".
- Enlaces oficiales a PLACSP/BOE.

## EPIC L - Panel admin, auditoria y operaciones

### PB-L01 - Panel de salud del sistema

Prioridad: P0  
Tipo: operaciones  
Descripcion: sustituir auditoria demo por health real.

Criterios de aceptacion:
- Estado API.
- Estado DB.
- Ultima ingestion BOE/PLACSP.
- Errores ultimas 24h.
- Jobs pendientes/fallidos.
- Uso IA.
- Alertas enviadas/fallidas.

### PB-L02 - Backups y restauracion

Prioridad: P0  
Tipo: operaciones/db  
Descripcion: garantizar recuperacion.

Criterios de aceptacion:
- Backup automatico.
- Politica de retencion.
- Prueba de restauracion documentada.
- Export de organizacion bajo permiso owner/admin.

### PB-L03 - Observabilidad y errores

Prioridad: P0  
Tipo: operaciones  
Descripcion: detectar problemas antes que el usuario.

Criterios de aceptacion:
- Error tracking frontend/backend.
- Logs estructurados.
- Alertas internas por ingestion fallida/API caida.
- Dashboard basico de metricas.

### PB-L04 - Gestion de usuarios y organizaciones

Prioridad: P1  
Tipo: admin  
Descripcion: operar beta gratuita.

Criterios de aceptacion:
- Listar organizaciones.
- Ver estado de suscripcion gratuita.
- Bloquear/desbloquear organizacion.
- Reset invitaciones.
- Ver auditoria.

## EPIC M - Frontend UX de produccion

### PB-M01 - Rehacer login/registro/onboarding con look LicitIA

Prioridad: P0  
Tipo: frontend/producto  
Descripcion: sustituir modal demo por experiencia real.

Criterios de aceptacion:
- Registro, login, recuperar contrasena, verificar email.
- Diseno corporativo actual.
- Estados de carga/error.
- Responsive.
- Accesibilidad basica.

### PB-M02 - Cockpit operativo

Prioridad: P0  
Tipo: frontend/producto  
Descripcion: dashboard real para el dia a dia.

Criterios de aceptacion:
- Bandeja de oportunidades.
- Busqueda.
- Seguimiento.
- Alertas.
- Tareas.
- Calendario.
- Propuestas.
- Configuracion.

### PB-M03 - Estados vacios y ayudas contextuales

Prioridad: P1  
Tipo: frontend  
Descripcion: orientar a usuarios nuevos.

Criterios de aceptacion:
- Empty states por modulo.
- CTAs concretos.
- Sin textos largos de marketing dentro del producto.
- Ayudas discretas.

### PB-M04 - Accesibilidad y responsive

Prioridad: P1  
Tipo: frontend/calidad  
Descripcion: producto usable en desktop y tablet.

Criterios de aceptacion:
- Navegacion teclado basica.
- Contrastes correctos.
- Formularios con labels y errores.
- Sin solapes en 1366, 1440, mobile/tablet basico.

## EPIC N - Testing, QA y seguridad final

### PB-N01 - Suite de tests frontend

Prioridad: P0  
Tipo: calidad  
Descripcion: proteger flujos principales.

Criterios de aceptacion:
- Tests de registro/login mockeado.
- Onboarding.
- Busqueda.
- Guardar oportunidad.
- Crear alerta.
- Crear tarea.
- Generar propuesta mockeada.

### PB-N02 - Tests backend y RLS

Prioridad: P0  
Tipo: calidad/backend  
Descripcion: evitar fugas multi-tenant.

Criterios de aceptacion:
- Tests de permisos por rol.
- Tests de tenant isolation.
- Tests API auth.
- Tests de ingestion con fixtures.
- Tests de jobs de alertas.

### PB-N03 - Security checklist pre-release

Prioridad: P0  
Tipo: seguridad  
Descripcion: puerta final antes de produccion.

Criterios de aceptacion:
- Secret scan limpio.
- Dependencias auditadas.
- CSP configurada si es posible.
- CORS restringido.
- Rate limit activo.
- Logs sin secretos.
- Sesiones y roles probados.
- Backups activos.

### PB-N04 - Pruebas E2E de beta gratuita

Prioridad: P0  
Tipo: calidad/producto  
Descripcion: validar alta completa sin pago.

Flujo:
1. Usuario entra en landing.
2. Crea cuenta.
3. Verifica email.
4. Crea organizacion.
5. Completa perfil.
6. Configura busqueda/alerta inicial.
7. Llega a plan/facturacion.
8. Ve mensaje de gratuidad.
9. Entra al cockpit.
10. Busca licitaciones y guarda una oportunidad.

Criterios de aceptacion:
- Flujo pasa en staging y produccion.
- No aparece formulario de tarjeta.
- Se crea suscripcion gratuita.
- Auditoria registra alta y onboarding.

## EPIC O - Documentacion y handoff

### PB-O01 - README productivo

Prioridad: P0  
Tipo: documentacion  
Descripcion: sustituir README de demo por guia de producto.

Criterios de aceptacion:
- Setup local.
- Entornos.
- Deploy GitHub Pages.
- Backend/API.
- Variables.
- Testing.
- Operacion beta.

### PB-O02 - Runbook operativo

Prioridad: P1  
Tipo: documentacion/operaciones  
Descripcion: saber que hacer si algo falla.

Criterios de aceptacion:
- Ingestion falla.
- Alertas fallan.
- IA falla.
- Login falla.
- Restaurar backup.
- Revocar usuario.

### PB-O03 - Matriz de cumplimiento

Prioridad: P1  
Tipo: compliance  
Descripcion: dejar trazabilidad RGPD/ENS/AI Act basica.

Criterios de aceptacion:
- Inventario de datos personales.
- Subencargados.
- Retencion.
- Medidas tecnicas.
- Medidas organizativas.
- Transparencia IA.
- Riesgos pendientes.

## Prioridad absoluta para empezar desarrollo

Sprint 1:
- PB-A01
- PB-A02
- PB-A03
- PB-A04
- PB-B01
- PB-B02
- PB-C01
- PB-C02

Sprint 2:
- PB-B03
- PB-C04
- PB-C05
- PB-D01
- PB-D02
- PB-D03
- PB-D05
- PB-M01

Sprint 3:
- PB-E01
- PB-E02
- PB-E03
- PB-F01
- PB-F02
- PB-F03
- PB-G01
- PB-G02

Sprint 4:
- PB-F04
- PB-H01
- PB-H02
- PB-H03
- PB-I01
- PB-I02
- PB-I03
- PB-L01

Sprint 5:
- PB-H04
- PB-H05
- PB-J01
- PB-J02
- PB-J03
- PB-J04
- PB-K01
- PB-K02
- PB-K03

Sprint 6:
- PB-L02
- PB-L03
- PB-L04
- PB-M02
- PB-M03
- PB-M04
- PB-N01
- PB-N02
- PB-N03
- PB-N04
- PB-O01
- PB-O02
- PB-O03

## Criterios de salida a produccion

Para declarar LicitIA lista:

- Alta real y onboarding completo funcionando.
- Plan beta gratuita activo sin pago ni tarjeta.
- Auth server-side con email verificado.
- Usuarios, organizaciones, roles y permisos funcionando.
- Base de datos productiva con RLS y migraciones.
- PLACSP y BOE ingeridos server-side.
- Busqueda avanzada funcionando con datos oficiales.
- Oportunidades guardadas y seguimiento por expediente.
- Alertas server-side por email.
- IA server-side con schemas y citas.
- Checklist, tareas y calendario funcionando.
- Propuestas versionadas y exportables.
- Panel de salud operativo.
- Auditoria de acciones criticas.
- Backups y restauracion probada.
- Tests P0 pasando.
- Secret scan limpio.
- Deploy frontend en GitHub Pages y backend en entorno productivo.
- README y runbook actualizados.

## Fuera de alcance de esta version

- Pasarela de pagos real.
- Cobro automatico.
- Presentacion electronica automatica en PLACSP.
- Firma electronica integrada.
- Sustitucion de revision legal/humana.
- Integracion completa con ROLECE.

## Nota de producto sobre pagos

Aunque no se implemente cobro, el producto debe quedar preparado para activarlo despues:

- Planes y suscripciones existen en base de datos.
- La UI muestra plan actual.
- La organizacion queda en beta gratuita.
- El paso de pago se reemplaza por mensaje de gratuidad.
- No se pide tarjeta ni se guarda informacion financiera.
- Se deja un feature flag `payments_enabled=false`.

