# Product Backlog de Diseno UX 2026 - LicitIA

## Objetivo

Convertir LicitIA de beta funcional a SaaS corporativo premium: una herramienta de trabajo para equipos de licitaciones que compita por claridad, velocidad, confianza, trazabilidad y acabado visual.

La ambicion no es "ponerlo mas bonito". Es redisenar la experiencia para que el usuario entienda en segundos:

- que oportunidades importan hoy;
- por que una licitacion merece GO, NO-GO o revision;
- que falta para presentar una oferta;
- que evidencia oficial respalda cada recomendacion;
- que acciones debe ejecutar cada rol.

## Diagnostico UX actual

LicitIA ya tiene una base funcional fuerte: alta, onboarding, busqueda, seguimiento, scoring, IA, propuesta, dossier, operaciones y beta gratuita. El problema es que la interfaz aun parece un MVP ampliado:

- la navegacion mezcla areas de cuenta con trabajo diario;
- el cockpit muestra datos de configuracion, no una agenda de decision;
- la busqueda usa formulario + lista simple, insuficiente para volumen real;
- la ficha de licitacion no funciona todavia como centro de mando;
- las acciones clave quedan repartidas en bloques verticales;
- hay demasiados paneles parecidos, con poca jerarquia visual;
- no hay saved views, filtros persistentes, vistas de pipeline ni acciones masivas;
- los estados vacios son correctos, pero poco orientados a siguiente accion;
- la accesibilidad y responsive existen, pero no llegan a nivel enterprise.

## Vision UX

LicitIA debe sentirse como un "sistema operativo de licitaciones": sobrio, preciso, rapido y ejecutivo.

Principios:

1. Decision primero: cada pantalla debe responder "que hago ahora?".
2. Evidencia siempre visible: recomendaciones con fuentes, fechas, documentos y trazabilidad.
3. Flujo unico: descubrir -> evaluar -> preparar -> presentar -> aprender.
4. Densidad elegante: mas informacion util, menos paneles decorativos.
5. Confianza corporativa: visual limpio, azul/cyan LicitIA, estados sobrios, nada de ruido.
6. Producto operable: atajos, filtros guardados, tabs profundas, estados de carga, errores accionables.

## Arquitectura propuesta

### Sitio publico

- `/`: web corporativa de marca, mercado, propuesta de valor y CTA.
- `/acceso.html`: login, registro, recuperacion y onboarding.
- `/app.html`: herramienta productiva autenticada.

### App productiva

Navegacion principal propuesta:

- Hoy
- Oportunidades
- Expedientes
- Propuestas
- Inteligencia
- Operaciones
- Ajustes

Modelo de experiencia:

- "Hoy": cola priorizada de decisiones, alertas, vencimientos y trabajo pendiente.
- "Oportunidades": busqueda avanzada, saved views, tabla enterprise y acciones masivas.
- "Expedientes": licitaciones en seguimiento con estado, responsable, deadline y progreso.
- "Propuestas": estudio de propuesta con editor, fuentes, versionado y revision IA.
- "Inteligencia": competidores, bajas, escenarios economicos y patrones.
- "Operaciones": salud, backups, errores, release checks y usuarios admin.
- "Ajustes": perfil, equipo, legal, plan beta y preferencias.

## Backlog priorizado

### DUX-001 - Sistema visual LicitIA 2026

Prioridad: P0
Tipo: Foundation
Dependencias: ninguna

Historia:
Como equipo de producto, quiero un sistema visual consistente para que todas las pantallas parezcan parte de un SaaS corporativo premium.

Alcance:

- Tokens de color, tipografia, espaciado, radios, sombras, bordes y estados.
- Variantes de boton: primary, secondary, ghost, danger, icon.
- Componentes base: badge, status, KPI, table row, empty state, toast, modal, drawer.
- Status language: GO, NO-GO, Revisar, Urgente, Vence pronto, Bloqueado.
- Uso sobrio del azul/cyan corporativo sin saturar toda la interfaz.

Criterios de aceptacion:

- Existe una seccion documentada de tokens CSS.
- No hay estilos duplicados para paneles similares.
- Todos los botones tienen hover, active, disabled y focus-visible.
- El color comunica estado; no solo decoracion.
- El producto no lee como "todo azul".

### DUX-002 - App shell premium y navegacion por flujo

Prioridad: P0
Tipo: UX/Core UI
Dependencias: DUX-001

Historia:
Como usuario, quiero una navegacion organizada por mi trabajo real para no perderme entre modulos.

Alcance:

- Sustituir la navegacion actual por secciones: Hoy, Oportunidades, Expedientes, Propuestas, Inteligencia, Operaciones, Ajustes.
- Header superior con busqueda global, organizacion activa, salud API y usuario.
- Breadcrumb contextual en ficha de oportunidad.
- Sidebar responsive con version compacta en tablet/movil.
- URL profunda para vista activa, filtros y seleccion.

Criterios de aceptacion:

- Cmd/Ctrl click funciona en enlaces de navegacion.
- El usuario puede volver a la ultima vista con URL.
- La sidebar no desplaza contenido en movil.
- Hay estado activo claro y accesible.
- Logout y ajustes no compiten con trabajo diario.

### DUX-003 - Cockpit "Hoy" como centro de decision

Prioridad: P0
Tipo: Product UX
Dependencias: DUX-001, DUX-002

Historia:
Como bid manager, quiero abrir LicitIA y saber que decisiones o acciones requieren atencion hoy.

Alcance:

- Sustituir metricas de configuracion por KPIs operativos:
  - oportunidades nuevas relevantes;
  - deadlines proximos;
  - GO pendientes de preparar;
  - tareas bloqueadas;
  - alertas criticas.
- Cola priorizada "Hoy requiere tu atencion".
- Timeline de vencimientos.
- Seccion "Ultimas decisiones" con trazabilidad.
- Estado de ingesta y fuentes oficiales en formato no tecnico.

Criterios de aceptacion:

- En menos de 10 segundos el usuario sabe cual es la siguiente accion.
- Cada tarjeta tiene una accion primaria concreta.
- Los estados vacios explican como crear valor.
- Los datos de cuenta pasan a Ajustes, no al cockpit.

### DUX-004 - Busqueda enterprise de oportunidades

Prioridad: P0
Tipo: Core workflow
Dependencias: DUX-001, DUX-002

Historia:
Como usuario comercial, quiero buscar, comparar y guardar licitaciones sin perder contexto.

Alcance:

- Reemplazar formulario largo por:
  - barra de busqueda principal;
  - filtros rapidos;
  - drawer de filtros avanzados;
  - chips activos;
  - saved views.
- Tabla/listado enterprise con columnas:
  - score;
  - titulo;
  - organismo;
  - importe;
  - deadline;
  - CPV;
  - estado;
  - seguimiento;
  - accion.
- Ordenacion, paginacion, seleccion multiple y acciones masivas.
- Estado "sin resultados" con recomendaciones de filtro.

Criterios de aceptacion:

- Filtros y orden quedan en URL.
- El usuario puede guardar una vista.
- Las filas soportan titulos largos sin romper layout.
- Cada resultado permite ver ficha, seguir, marcar GO/NO-GO.
- La tabla mantiene lectura densa en desktop y cards resumidas en movil.

### DUX-005 - Ficha 360 de licitacion

Prioridad: P0
Tipo: Core workflow
Dependencias: DUX-004

Historia:
Como bid manager, quiero una ficha completa de licitacion para decidir y preparar sin cambiar de pantalla.

Alcance:

- Split view persistente:
  - izquierda: lista/tabla de oportunidades;
  - derecha: ficha/inspector sticky.
- Header de ficha con titulo, organismo, importe, deadline, estado, score y accion primaria.
- Tabs:
  - Resumen;
  - Requisitos;
  - Documentos;
  - Decision;
  - Tareas;
  - Propuesta;
  - Competencia;
  - Auditoria.
- Bloque "hechos oficiales" separado de "inferencias IA".
- Acciones contextuales segun estado.

Criterios de aceptacion:

- Seleccionar una oportunidad no desplaza al usuario fuera de la busqueda.
- La ficha mantiene contexto al cambiar de tab.
- Cada recomendacion muestra fuente o marca "inferencia".
- La accion primaria cambia segun estado: seguir, evaluar, preparar, revisar, exportar.

### DUX-006 - Modelo visual de decision GO/NO-GO

Prioridad: P0
Tipo: Decision UX
Dependencias: DUX-005

Historia:
Como director comercial, quiero entender el motivo del score sin leer un informe largo.

Alcance:

- Score radial o horizontal sobrio, no decorativo.
- Breakdown por factores: encaje, importe, plazo, solvencia, riesgo documental, competencia.
- Semaforo de decision con confianza.
- "Por que sube" y "Por que baja".
- CTA: Marcar GO, Marcar NO-GO, Pedir revision, Preparar expediente.

Criterios de aceptacion:

- El score se entiende sin abrir texto tecnico.
- Cada factor tiene evidencia o razon.
- La decision manual queda claramente diferenciada del score automatico.
- Hay confirmacion para NO-GO y acciones destructivas.

### DUX-007 - Estudio de propuesta

Prioridad: P1
Tipo: Advanced workflow
Dependencias: DUX-005, DUX-006

Historia:
Como responsable tecnico, quiero preparar propuesta con fuentes, versionado y revision en una experiencia de editor profesional.

Alcance:

- Layout de 3 zonas:
  - fuentes/requisitos oficiales;
  - editor de propuesta;
  - panel de revision/sugerencias.
- Indice de propuesta.
- Versionado visible.
- Export DOCX/PDF como accion persistente.
- Marcadores de calidad por seccion.

Criterios de aceptacion:

- El usuario puede ver fuente y texto generado en paralelo.
- Revision IA no sobrescribe la propuesta.
- Exportacion muestra estado y resultado.
- Las sugerencias se pueden aceptar/ignorar.

### DUX-008 - Dossier y tareas como checklist operativo

Prioridad: P1
Tipo: Workflow
Dependencias: DUX-005

Historia:
Como equipo de oferta, quiero saber que documentos faltan, quien los lleva y cuando vencen.

Alcance:

- Checklist por categorias: administrativa, tecnica, economica, anexos.
- Estado por item: pendiente, en curso, listo, bloqueado, no aplica.
- Asignacion a usuario.
- Fechas limite y avisos.
- Vista de progreso del dossier.
- Export ZIP con manifiesto claro.

Criterios de aceptacion:

- Se ve completitud del dossier en un porcentaje util.
- Cada item tiene responsable y siguiente accion.
- Los documentos bloqueados aparecen arriba.
- El export muestra que contiene y que queda fuera.

### DUX-009 - Inteligencia competitiva y simulador economico

Prioridad: P1
Tipo: Analytics UX
Dependencias: DUX-005

Historia:
Como direccion, quiero entender el contexto competitivo y economico antes de decidir oferta.

Alcance:

- Dashboard por organismo, CPV, territorio y competidor.
- Distribucion de bajas historicas.
- Comparador de escenarios economicos.
- Riesgo de precio: conservador, competitivo, agresivo.
- Explicacion ejecutiva para comite.

Criterios de aceptacion:

- Los graficos tienen lectura textual equivalente.
- Se puede guardar escenario y vincularlo a expediente.
- La recomendacion economica nunca se presenta como certeza.
- Export CSV sigue disponible.

### DUX-010 - Onboarding premium con valor inmediato

Prioridad: P1
Tipo: Activation UX
Dependencias: DUX-001

Historia:
Como nuevo usuario, quiero completar 7 preguntas y ver inmediatamente oportunidades o una busqueda preparada.

Alcance:

- Mantener 7 preguntas maximo.
- Mejorar jerarquia visual: pregunta actual, progreso, preview de busqueda generada.
- Validacion inline.
- "Que pasara despues" antes del submit.
- Landing de exito: "Tu primera busqueda esta lista".

Criterios de aceptacion:

- No hay mas de 7 preguntas.
- El usuario entiende que no hay pago.
- Cada error aparece junto al campo.
- El submit no parece final legal, sino inicio de trabajo.

### DUX-011 - Operaciones y administracion sin mezclar con usuario final

Prioridad: P1
Tipo: Admin UX
Dependencias: DUX-002

Historia:
Como admin, quiero gestionar salud, backups, usuarios y release checks sin contaminar la experiencia del bid manager.

Alcance:

- Vista "Operaciones" separada de "Ajustes".
- Tabs: Salud, Errores, Backups, Usuarios, Release.
- Estados criticos con severidad visual.
- Acciones admin con confirmacion.
- Export de backup con feedback.

Criterios de aceptacion:

- Usuarios sin rol admin no ven operaciones.
- Acciones de bloqueo requieren confirmacion.
- Errores muestran fecha, fuente, severidad y estado.
- Backups muestran retencion y descarga.

### DUX-012 - Estados vacios, carga y errores de nivel enterprise

Prioridad: P1
Tipo: UX quality
Dependencias: DUX-001

Historia:
Como usuario, quiero entender que ocurre aunque no haya datos, haya carga o falle el backend.

Alcance:

- Empty states especificos por vista.
- Skeleton loaders en tablas, cards y ficha.
- Toasts con `aria-live`.
- Errores accionables: que paso, que puedo hacer, si se ha registrado.
- Retry visible en errores recuperables.

Criterios de aceptacion:

- Ninguna vista queda con texto generico tipo "Sin datos" sin siguiente paso.
- Los errores no exponen mensajes tecnicos innecesarios.
- Las cargas no mueven el layout.
- Los toasts son accesibles.

### DUX-013 - Responsive y accesibilidad AA

Prioridad: P0
Tipo: Quality gate
Dependencias: DUX-001, DUX-002

Historia:
Como usuario en portatil, tablet o movil, quiero operar la herramienta sin roturas ni perdida de informacion.

Alcance:

- Skip link.
- Focus-visible global.
- `prefers-reduced-motion`.
- Tab order revisado.
- Labels, aria-current, aria-selected, aria-controls.
- Tables convertidas a cards en movil.
- Safe areas y overflow horizontal controlado.

Criterios de aceptacion:

- Navegacion completa por teclado.
- Lighthouse accessibility >= 95.
- No hay `outline: none` sin reemplazo.
- No hay imagenes sin dimensiones donde aplique.
- No hay solapamientos en 375px, 768px, 1440px.

### DUX-014 - Microinteracciones y motion sobrio

Prioridad: P2
Tipo: Delight/Polish
Dependencias: DUX-001, DUX-013

Historia:
Como usuario, quiero que la app se sienta moderna, rapida y fiable sin animaciones molestas.

Alcance:

- Transiciones de vista con opacity/transform.
- Hover y press states coherentes.
- Skeleton shimmer reducido.
- Cambios de score animados con respeto a reduced motion.
- Confirmaciones de accion con undo cuando aplique.

Criterios de aceptacion:

- No se usa `transition: all`.
- Todas las animaciones respetan `prefers-reduced-motion`.
- La motion refuerza jerarquia, no decora.

### DUX-015 - Design QA y metricas de UX

Prioridad: P0
Tipo: Delivery quality
Dependencias: todas

Historia:
Como equipo, quiero medir y validar que el rediseño mejora conversion y uso real.

Alcance:

- Checklist visual por viewport.
- Eventos de producto:
  - signup_started;
  - onboarding_completed;
  - search_executed;
  - tender_tracked;
  - decision_recorded;
  - proposal_exported;
  - dossier_exported.
- Pruebas E2E de flujo beta.
- Revision visual manual antes de deploy.

Criterios de aceptacion:

- Hay capturas desktop/tablet/mobile antes de release.
- Los flujos criticos tienen test.
- Los eventos no capturan datos sensibles.
- El equipo puede comparar conversion pre/post rediseño.

## Plan de ejecucion recomendado

### Sprint UX 1 - Fundacion y shell

- DUX-001 Sistema visual
- DUX-002 App shell
- DUX-013 base accesibilidad
- Ajuste de acceso/onboarding solo en estilo, sin cambiar las 7 preguntas

Resultado: la app ya parece producto corporativo, aunque mantenga flujos actuales.

### Sprint UX 2 - Oportunidades y ficha 360

- DUX-004 Busqueda enterprise
- DUX-005 Ficha 360
- DUX-006 Decision GO/NO-GO

Resultado: el flujo principal de valor queda a nivel SaaS serio.

### Sprint UX 3 - Propuesta, dossier e inteligencia

- DUX-007 Estudio de propuesta
- DUX-008 Dossier/checklist
- DUX-009 Inteligencia competitiva

Resultado: LicitIA deja de parecer buscador y se convierte en plataforma de ejecucion.

### Sprint UX 4 - Operaciones, polish y medicion

- DUX-011 Operaciones/admin
- DUX-012 Estados y errores
- DUX-014 Motion
- DUX-015 QA y metricas

Resultado: beta lista para usuarios exigentes con acabado de produccion.

## Definicion de done de diseno

Una historia de este PB no esta terminada hasta que:

- tiene version desktop, tablet y movil;
- tiene estado vacio, carga, error y datos largos;
- es navegable por teclado;
- tiene copy final en espanol;
- usa tokens del sistema visual;
- no rompe la beta gratuita ni introduce pagos;
- mantiene la identidad azul/cyan de LicitIA;
- queda validada con captura visual antes/despues.

## Riesgos si no se aborda

- El producto puede funcionar, pero parecer herramienta interna.
- Los usuarios nuevos no entenderan el valor en la primera sesion.
- El volumen de licitaciones hara insuficiente el listado actual.
- El cockpit no guiara decisiones, solo mostrara modulos.
- La IA perdera confianza si sus recomendaciones no se conectan a evidencia visible.
- El equipo de desarrollo seguira acumulando paneles sin sistema de diseño.
