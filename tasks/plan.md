# Plan del piloto Caronte

## Actualización aprobada: novela +30 y 216–224 páginas (12 de octubre)

Continúa el mismo piloto; no sustituye ni cierra los pendientes históricos.
Orden de implementación y verificación:

1. Contrato versionado +30, 55–65k palabras orientativas y ocho dimensiones editoriales.
   Registrar primero rechazos de +40, mala extensión y revisiones incompletas.
2. Congelar contrato/modelos por trabajo. Versiones viejas no se reinterpretan:
   conservar compatibilidad explícita o bloqueo antes de pagar al proveedor.
   Validar reanudación, hashes y objetivos persistidos en PostgreSQL.
3. Maquetación y cola de impresión por versión. Nuevo objetivo 216–224, centro220;
   conservar el PDF técnico v2 de194. Verificar texto íntegro, tipografía y cubierta
   calculada por Lulu con las páginas finales, no con las previstas.
4. Reparar recibos Lulu con test independiente. Identidad/source hash válidos se
   conservan; estados/errores desconocidos no habilitan impresión ni reenvío.
   Los dos intentos técnicos inciertos previos siguen bloqueados y no se repiten.
5. Publicar el servidor y los cambios autorizados de GitHub. Releer función,
   configuración, despliegue Pages y HTML/CSS originales. No alterar controles públicos.
6. Probar escritura/revisión auténticas y libro completo, recuperación independiente
   y PDFs reales. Lectura humana y ambos recibos NORMALIZED antes de liberar el piloto.

Checkpoint tras cada corte: pruebas enfocadas RED→GREEN, suite cuando cambien
contratos transversales y verificación remota proporcional. Un recibo idle no prueba
autonomía, una muestra no es una novela, y un PDF sintético no acredita literatura.

Riesgos concretos: coste/tiempo de un libro completo, límites Edge, consistencia de
edad/calendario, voz intercambiable y pérdida de recibos. No activar gastos de Lulu.
Modelos y credenciales ya responden en producción; la página se verificó byte-exacta.
Lulu sigue pendiente: el segundo intento técnico falló al capturar el recibo en la
comprobación del operador; no se conoce su ID. No inventar ni volver a enviar.

## Plan anterior y evidencia histórica

Mapa: ../CAPABILITY-MAP.md. Contratos iniciales: ../SPEC-book-engine.md y
../SPEC-fulfillment.md. Tareas en todo.md; no se usa un tracker externo.

1. Consolidar acceso/voz: publicado 48157ae; servidor ACTIVE_HEALTHY y audio real
   ElevenLabs v3 comprobados. No equivale a producto completo.
2. Implementar contrato literario + cola persistente; conectar generación/consulta
   con un worker reanudable y progreso en la UI existente.
3. Probar una entrevista completa real/sintética de QA y generación auténtica,
   revisar literatura completa, corregir continuidad y extensión.
   Captura STT endurecida localmente: deadline cubre cuerpo, reader/socket se
   cancelan, fallo conserva audio/ID y no avanza. 61 tests enfocados y HTTP local
   nativo pasan; no es STT/archivo/DB en Edge ni resuelve duplicados concurrentes.
4. PDF interior/cubierta con fuentes embebidas; verificar 180–200 páginas reales.
   Antes de activar `generatePdf`, resolver CPU y recuperación persistente: la
   fixture variada consume 6,4 s de CPU local incluso tras optimizar. No asumir
   que `waitUntil` elimina el límite de 2 s por petición alojada. Probar bloques
   pequeños y unión final, o preparar una decisión concreta de trabajador/coste.
   Primitivas medidas en 144 etapas locales: pico 901 ms; plan íntegro e identidad
   de bytes conservados. Coordinador, archivo privado y migración de imprenta
   preparados localmente: reserva estable, intención antes del objeto y recuperación
   sin otra versión. Integración real de PDF recupera un fragmento tras fallo DB.
   Arranque/consulta/worker/cliente y disparador independiente conectados en local,
   default-off. Cola/controles privados preparados con CAS y lectura posterior.
   Trabajador HTTP completo medido después: tres pares/147 procesos nuevos,
   pico CPU local de petición 1.762 ms y RSS de prueba hasta 291 MiB. Incluye
   instrumentación/servidores sintéticos; no certifica Edge. Informe:
   `../docs/CARONTE_PRINT_WORKER_PROFILE.md`. La herramienta oficial y el entorno
   nativo experimental se autorizaron y probaron en privado: SQL/ACL/concurrencia
   reales pasan; función carga y primitivas Deno generan un par sintético.
   En macOS el timer CPU está desactivado, por lo que no certifica Edge. Procesos
   cerrados. Evidencia: `../docs/CARONTE_NATIVE_LOCAL_VERIFICATION.md`.
   Falta aplicar SQL remoto con autorización, activar y verificar el trabajador
   completo alojado. No encadenar
   49 peticiones recursivas (48 etapas y cierre para 194 páginas).
   Decisiones Propuestas: `../docs/ADR-001_PRINT_STAGES.md` y
   `../docs/ADR-002_DURABLE_PRINT_COORDINATOR.md`.
5. Lulu sandbox, luego presupuesto y pedido real aprobado; pago por portal y readback.
6. Back office sin datos showcase, trazabilidad, alertas y recuperación de incidencias.
7. Piloto humano completo y entrega a domicilio confirmada.

Riesgos: interrupciones de función (pasos pequeños+lease), modelos/proveedores ausentes
(bloqueo explícito), libro genérico (evidencias+revisión íntegra), PDF inválido
(preflight remoto), duplicación de pedidos (lock+reconciliación), pagos no autorizados
(aprobación de importe/destino). No sustituir estos requisitos por stubs.

Abiertos: disponibilidad efectiva de OpenAI/Anthropic; cuenta/credenciales Lulu;
datos de entrega y aprobación del presupuesto. No bloquean módulos independientes.
