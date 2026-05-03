# Auditoria de paso a produccion - LicitIA v2

Fecha: 19/04/2026  
Alcance revisado: `index.html`, `dashboard.html`, `README.md`, `404.html`, `.github/workflows/deploy-pages.yml`, `.gitignore`, `LicitIA.zip` y estructura local.

## Veredicto ejecutivo

LicitIA v2 es una demo/MVP estatica muy completa a nivel narrativo y funcional aparente, pero no esta lista para produccion. La base actual sirve para vender vision, validar flujos y enseñar una experiencia tipo cockpit, pero no debe usarse todavia con clientes reales ni con datos sensibles.

Madurez estimada: 2,5/10 para produccion SaaS.  
Riesgo de salida a produccion sin refactor: alto.  
Decision recomendada: no publicar como producto productivo; abrir fase de industrializacion con backend, modelo de datos, ingestion oficial, seguridad, cumplimiento y observabilidad.

## Evidencias tecnicas ejecutadas

- Validacion sintactica de scripts inline con Node: OK en `index.html` y `dashboard.html`.
- Servicio estatico local por HTTP: OK en `/` y `/dashboard.html`.
- Revision de codigo manual sobre autenticacion, almacenamiento, integraciones externas, busqueda BOE, alertas, IA, despliegue y artefactos.
- Contraste con fuentes oficiales: BOE OpenData, PLACSP Datos Abiertos, LCSP, ENS, AEPD y AI Act.

## Bloqueantes P0

### 1. Autenticacion inexistente a nivel servidor

El login es solo cliente. La landing muestra credenciales demo (`index.html:1970-1971`), calcula un hash propio en navegador (`index.html:2034-2041`) y marca el acceso escribiendo `sessionStorage` (`index.html:2072-2078`). El dashboard solo comprueba esa marca local (`dashboard.html:4294-4296`).

Impacto: cualquiera puede saltarse el login desde DevTools. No hay usuarios reales, sesiones revocables, expiracion, MFA, roles, control por tenant ni trazabilidad fiable.

Requisito de produccion:
- Auth server-side con sesiones firmadas/JWT de corta duracion.
- MFA opcional para cuentas corporativas.
- RBAC por rol: admin, bid manager, legal, financiero, lector.
- Separacion multi-tenant por organizacion.
- Auditoria de login, cambios de perfil, descargas y acciones criticas.

### 2. Secretos y datos sensibles en el navegador

La API key de OpenAI se guarda en `localStorage` (`dashboard.html:2060-2067`, `dashboard.html:4397-4400`). El bot token de Telegram se introduce y usa tambien desde cliente (`dashboard.html:1620-1627`, `dashboard.html:6051-6066`). Los perfiles, historiales, propuestas, simulaciones y snapshots tambien se persisten localmente (`dashboard.html:2793-2846`).

Impacto: una extension del navegador, XSS, equipo compartido o soporte remoto puede exponer claves, datos de empresa, borradores de ofertas y estrategia competitiva. Para una herramienta de concursos publicos esto es critico: maneja informacion comercial, importes, capacidades, responsables y decisiones Go/No-Go.

Requisito de produccion:
- Ninguna clave de IA o Telegram en frontend.
- Backend proxy para IA con cuotas, logging y redaccion de datos sensibles.
- Cifrado en reposo en base de datos.
- Politica de retencion y borrado.
- Secret manager gestionado.
- Exportacion y backup controlados por permisos.

### 3. Fuente de datos insuficiente: BOE no basta

La busqueda se basa en el sumario del BOE (`dashboard.html:3357`, `dashboard.html:4569-4585`) y filtra la seccion V.A por textos como "anuncio de licitacion" y "formalizacion" (`dashboard.html:4518-4558`). Esto deja fuera mucha informacion operacional: estado del expediente, lotes, CPV, pliegos, fechas limite estructuradas, organo de contratacion, modificaciones, preguntas/respuestas, adjudicaciones detalladas y expedientes alojados/agregados en PLACSP.

Ademas usa proxies CORS publicos (`dashboard.html:3358-3360`, `dashboard.html:4488-4504`), que no son aceptables para produccion.

Impacto: cobertura incompleta, resultados falsamente negativos, plazos mal detectados y dependencia de terceros no controlados.

Requisito de produccion:
- Ingestion primaria desde PLACSP Datos Abiertos y mecanismos oficiales.
- BOE como fuente complementaria para anuncios oficiales y verificacion.
- Normalizacion por expediente, lote, CPV, organo, estado, importe, fecha limite, enlaces a pliegos y documentos.
- Reconciliacion diaria de conteos/fuentes y alertas de ingestion.
- Sin CORS proxies publicos.

### 4. Alertas no productivas

La propia UI avisa que la monitorizacion funciona solo mientras el panel esta abierto (`dashboard.html:1601-1603`). El temporizador es `setInterval` en navegador (`dashboard.html:6218-6229`) y el envio a Telegram sale desde el cliente (`dashboard.html:6051-6077`).

Impacto: no hay garantia de aviso, no hay SLA, no hay reintentos fiables, no hay cola, no hay deduplicacion global, no hay notificaciones email corporativas ni auditoria centralizada.

Requisito de produccion:
- Jobs server-side programados.
- Cola de eventos y reintentos.
- Deduplicacion por expediente/lote/version.
- Canales: email, Teams/Slack/Telegram, webhook y digest.
- Registro de entrega, error, lectura y accion del usuario.

### 5. IA sin gobierno ni trazabilidad suficiente

La IA se llama desde el cliente usando Chat Completions (`dashboard.html:4591-4618`). Los resultados se parsean buscando JSON con regex (`dashboard.html:4660-4668`, `dashboard.html:7460-7468`) y se usan para scoring, resumen, requisitos, propuestas y competencia. No hay schema estricto, citas obligatorias, control de alucinacion, evaluaciones, versionado de prompts ni registro auditable.

Impacto: la herramienta puede recomendar presentar/no presentar o generar una oferta sin evidencia suficiente. En licitaciones reales esto puede causar perdida de oportunidades, incumplimientos o propuestas incorrectas.

Requisito de produccion:
- Llamadas IA server-side.
- Structured outputs/schema validado.
- RAG sobre documentos oficiales descargados y versionados.
- Citas por campo: plazo, importe, solvencia, criterios, documentos.
- Human-in-the-loop antes de decisiones Go/No-Go o propuestas.
- Evaluaciones con expedientes reales y gold set.

## Hallazgos P1

### 6. No existe backend ni base de datos real

La app usa `localStorage` e IndexedDB/localStorage fallback (`dashboard.html:2091-2100`, `dashboard.html:2793-2846`). Esto vale para demo, no para un SaaS multiusuario.

Hace falta:
- API backend.
- PostgreSQL/Supabase u otro datastore transaccional.
- Migraciones.
- Modelos: tenant, usuario, expediente, lote, documento, fuente, alerta, tarea, propuesta, decision, comentario, evento.
- Control de concurrencia y permisos por recurso.

### 7. El producto dice "aplicacion" pero no aplica a concursos

Hay generador de borradores (`dashboard.html:7046-7093`), checklist y exportaciones, pero no hay integracion con PLACSP para presentacion electronica, firma, roles de apoderado, ROLECE, DEUC, certificados, carpetas documentales ni validacion de formatos.

En produccion conviene separar:
- "Preparar candidatura" como alcance inicial realista.
- "Presentar oferta electronica" como fase posterior, con integracion y requisitos legales especificos.

### 8. Busqueda y scoring demasiado simples

El filtro por palabras clave no usa CPV, sinonimos, organos favoritos, territorios, lotes, importes, procedimiento, estado, solvencia, fecha limite ni historico de adjudicacion (`dashboard.html:4716-4736`). El score por defecto deriva de relevancia textual (`dashboard.html:4886-4891`) y puede dar una precision engañosa.

Hace falta:
- Motor de busqueda con indices: texto, CPV, entidad, geografia, importe, plazo, estado, modalidad.
- Perfil empresarial estructurado: CPV objetivo, CNAE, clasificaciones, solvencias, certificaciones, regiones, capacidad, restricciones.
- Scoring explicable por factores y no solo un porcentaje.

### 9. Inteligencia competitiva poco fiable

La extraccion de adjudicatario/importes usa regex sobre titulos (`dashboard.html:7401-7418`) y opcionalmente IA (`dashboard.html:7442-7468`). Para decisiones comerciales, esto no basta.

Hace falta:
- Datos de formalizacion estructurados desde fuente oficial.
- Serie historica por CPV/organo/adjudicatario.
- Normalizacion de empresas: CIF/NIF cuando exista, UTEs, grupos empresariales, variantes de nombre.
- Metricas de baja, recurrencia, concentracion, lotes, adjudicacion por procedimiento.

### 10. Auditoria interna demasiado superficial

La pantalla de "Auditoria integral del producto" valida contenedores, handlers y persistencia local (`dashboard.html:2102-2112`, `dashboard.html:3187-3315`). Esta bien como smoke test de demo, pero no audita seguridad, cumplimiento, fuentes, cobertura, IA, rendimiento, disponibilidad ni privacidad.

Debe convertirse en:
- Health checks backend.
- Estado de ingestion por fuente.
- Estado de colas/jobs.
- Ultima alerta entregada.
- Errores de IA/API.
- Cobertura de tests.
- Estado de backups.

### 11. Despliegue GitHub Pages correcto para demo, insuficiente para produccion

El workflow publica todo el directorio (`.github/workflows/deploy-pages.yml:29-32`). La carpeta contiene `LicitIA.zip`, y el ZIP incluye artefactos `__MACOSX`. La `.gitignore` solo ignora `.DS_Store` y `Thumbs.db`.

Riesgos:
- Se suben artefactos innecesarios.
- No hay build reproducible, minificacion, CSP, SRI, headers de seguridad ni control de cache.
- No hay entornos dev/staging/prod.

### 12. Dependencias externas sin control

La landing carga fuentes de Google y varias imagenes remotas de Unsplash (`index.html:7-9`, `index.html:1628`, `index.html:1828`, `index.html:1844`). Para demo vale; para produccion corporativa conviene controlar assets, privacidad y disponibilidad.

## Cumplimiento y normativa

### Contratacion publica

La LCSP regula PLACSP como plataforma electronica para perfiles de contratante y difusion por Internet; la informacion debe publicarse en estandares abiertos y reutilizables. PLACSP Datos Abiertos publica conjuntos de licitaciones, agregadas, contratos menores, perfiles, encargos y consultas preliminares. Por tanto, una herramienta productiva de busqueda y seguimiento debe tratar PLACSP como fuente central, no solo BOE.

### BOE

BOE OpenData ofrece API REST para sumarios diarios y enlaces a HTML/PDF/XML. Sirve como fuente oficial complementaria, pero el propio dataset del diario BOE no sustituye la ficha completa de licitacion ni sus documentos de PLACSP.

### Proteccion de datos

La AEPD exige privacidad desde el diseno y por defecto: minimizar datos, limitar accesibilidad, definir retencion y aplicar medidas tecnicas y organizativas durante todo el ciclo de vida. El estado actual, guardando claves y datos empresariales en navegador, no cumple el nivel esperable para clientes reales.

### ENS

Si el producto aspira a vender a administraciones o integrarse en procesos publicos, debe prepararse para ENS: gestion de riesgos, minimo privilegio, proteccion de informacion en transito/reposo, registro de actividad, incidentes, continuidad y auditorias periodicas segun categoria.

### AI Act

La app usa IA generativa para analisis, scoring y redaccion. Aunque probablemente no sea "alto riesgo" por defecto si se limita a apoyo empresarial, necesita transparencia, trazabilidad, supervision humana, evaluacion de robustez y registro de outputs. Si llegara a automatizar decisiones con impacto juridico/administrativo, el riesgo regulatorio sube bastante.

## Recomendacion de arquitectura objetivo

### Backend

- API Node/Fastify, NestJS o FastAPI.
- Auth OIDC/passwordless/MFA.
- PostgreSQL con RLS por tenant si se usa Supabase.
- Object storage para documentos oficiales y propuestas.
- Worker de ingestion y worker de alertas.
- Secret manager.
- Observabilidad: logs estructurados, metricas, errores y trazas.

### Ingestion

- PLACSP Datos Abiertos como fuente base.
- BOE sumario como verificacion/anuncios.
- DOUE/eForms cuando aplique.
- Normalizador de expediente/lote/documento.
- Versionado de documentos y diffs de cambios.
- Reconciliacion diaria con alertas internas.

### IA

- RAG con documentos oficiales versionados.
- Structured outputs con schemas.
- Citas por cada extraccion sensible.
- Prompt registry/versionado.
- Evaluaciones automaticas con expedientes reales.
- Politica: IA recomienda, usuario decide.

### Producto

- Pipeline: descubrir -> cualificar -> checklist -> tareas -> propuesta -> revision -> decision -> preparacion documental -> seguimiento post-presentacion.
- Bandeja de oportunidades por estado.
- Kanban o lista operativa por expediente.
- Calendario real con plazos y responsables.
- Comentarios, menciones, adjuntos, aprobaciones.
- Exportacion DOCX/PDF para propuesta y dossier.

## Roadmap recomendado

### Fase 0 - Contencion

Duracion estimada: 1 semana.

- Mantener LicitIA v2 como demo, no como producto.
- Eliminar claims de "acceso seguro" si se publica publicamente.
- No pedir claves OpenAI reales en frontend salvo entorno privado de demo.
- Generar ZIP limpio sin `__MACOSX` y sin artefactos innecesarios.

### Fase 1 - Base productiva

Duracion estimada: 3-5 semanas.

- Backend, auth, base de datos, tenants y roles.
- Proxy IA server-side.
- Modelo de datos inicial.
- Jobs de ingestion BOE/PLACSP.
- Alertas server-side basicas.
- Tests unitarios/integracion sobre ingestion y auth.

### Fase 2 - Calidad de datos y workflow

Duracion estimada: 4-6 semanas.

- Normalizacion CPV/lotes/organos/importes/plazos.
- Busqueda avanzada.
- Scoring explicable.
- Tareas, responsables, checklist real por expediente.
- Export DOCX/PDF.
- Panel de auditoria operativo.

### Fase 3 - Gobierno IA y compliance

Duracion estimada: 3-5 semanas.

- RAG documental con citas.
- Evaluaciones IA.
- Registro de decisiones y versionado.
- Politica de privacidad, DPIA si aplica, DPA/subencargados.
- Preparacion ENS basica/media segun mercado objetivo.

## Criterios minimos para declarar "produccion"

- No hay secretos en frontend.
- Login no se puede saltar con `sessionStorage`.
- Cada usuario pertenece a un tenant y tiene permisos.
- Los expedientes vienen de fuentes oficiales versionadas.
- Las alertas se ejecutan aunque el navegador este cerrado.
- Cada recomendacion IA tiene fuente/cita o queda marcada como inferencia.
- Hay backups y restauracion probada.
- Hay logs y auditoria de acciones criticas.
- Hay tests de ingestion, auth, permisos, alertas y exportaciones.
- Hay politica de privacidad, terminos, DPA/subencargados y retencion.
- Hay staging separado de produccion.

## Prioridad de backlog

1. Backend + auth + tenants.
2. Sacar OpenAI/Telegram del cliente.
3. Ingestion PLACSP/BOE server-side.
4. Base de datos y modelo de expedientes.
5. Alertas server-side.
6. RAG con citas y schemas.
7. Workflow documental y exportaciones.
8. Observabilidad, backups y auditoria real.
9. Compliance RGPD/ENS/AI Act.
10. Limpieza de despliegue y assets.

## Fuentes oficiales consultadas

- BOE OpenData API: https://www.boe.es/datosabiertos/api/api.php
- BOE FAQ API: https://www.boe.es/datosabiertos/faq/boe.php
- PLACSP Datos Abiertos: https://contrataciondelestado.es/wps/portal/plataforma/datos_abiertos/
- LCSP, Ley 9/2017, art. 347: https://boe.es/buscar/act.php?id=BOE-A-2017-12902
- ENS, Real Decreto 311/2022: https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191
- AEPD, proteccion de datos desde el diseno: https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/proteccion-de-datos-desde-el-diseno
- European Commission, AI Act: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
