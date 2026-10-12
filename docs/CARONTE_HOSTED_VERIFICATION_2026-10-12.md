# Caronte: verificación del servidor, 12 de octubre de 2026

Este corte amplía, sin sustituir, las pruebas locales anteriores.

## Ejecutado y releído

- Función `future-book-session`, proyecto `jbisqvqdouvufhzzotde`: versión 10,
  ACTIVE. Los veinte archivos conservados por el
  empaquetador remoto coinciden con el artefacto enviado. Las dos dependencias
  ajenas al grafo activo se eliminan durante el empaquetado.
- El paquete de texto incorpora los tres binarios originales de Crimson Text
  y su licencia OFL. El empaquetador y el lector verifican sus SHA-256. No se
  cargan fuentes desde un servicio externo. El despliegue convencional conserva
  sus archivos estáticos; `package-caronte-edge.mjs` reproduce el artefacto para
  la API oficial de despliegue que solo admite archivos de texto.
- Se preservó la versión 8 para recuperación antes del despliegue. No se han
  cambiado Auth, permisos globales ni otras funciones del proyecto compartido.
- OpenAI: clave privada guardada fuera del control de versiones y cifrada en
  Caronte; lectura autenticada de modelos y generación mínima real completadas.
  Esta generación breve no verifica un libro de 45–55 mil palabras.
- ElevenLabs: consulta real de la voz Javier — Mature and Commanding correcta.
  Una consulta de configuración no acredita todavía la reproducción completa
  de una entrevista desde GitHub.
- Lulu: par nuevo, autorizado por el propietario, guardado cifrado y confirmado
  en la base de datos; `adminTestProvider` devuelve HTTP 200, `liveProbeOk:true`,
  `persistenceVerified:true`, entorno production, comprobación real OAuth.
  No se ha creado, pagado ni enviado ningún pedido.
- La comparación de `tested_at` acepta el mismo instante expresado con `Z` o
  `+00:00`. Una diferencia de un milisegundo o una confirmación ausente siguen
  rechazándose. El fallo remoto se reprodujo antes de corregirlo.
- Cola de imprenta: migración remota `20261012090838`,
  `caronte_durable_print_jobs`, correspondiente al SQL preparado
  `202610120001_caronte_durable_print_jobs.sql`.
- Aserciones SQL del libro y de impresión ejecutadas en el servidor real dentro
  de transacciones revertidas: exclusión de leases, reservas estables,
  checkpoints inmutables, recuperación, prevención de envíos inciertos, CAS,
  aislamiento de versiones y borrado en cascada. Ninguna sesión sintética
  de esas pruebas permanece. Las tablas nuevas tienen RLS y no permiten
  acceso directo de anon/authenticated; sus RPC son de servicio.
- La función acepta el origen HTTPS de GitHub y rechaza un token administrativo
  incorrecto. Los avisos previos del asesor del proyecto compartido permanecen;
  no se presenta el proyecto entero como libre de avisos.
- 422 pruebas de comportamiento, 17 comprobaciones heredadas, validación y
  compilación correctas; cero pruebas omitidas. Auditoría de las dependencias
  PDF de producción: cero vulnerabilidades notificadas.
- `src/tiresias.html` y `src/styles/future-book.css` siguen idénticos al commit
  original `48157ae`. No se han añadido controles ni modo de demostración.

## Pendiente en este corte

- Publicación y relectura de los nuevos archivos funcionales en GitHub Pages.
- Clave y comprobación real del revisor Anthropic.
- Validación del trabajo PDF completo bajo los límites reales del servidor,
  persistencia de sus binarios privados y normalización de ambos archivos por
  Lulu. Fuentes incluidas y OAuth correcto no acreditan esas etapas.
- La cola de PDF y los disparadores independientes siguen desactivados mientras
  se comprueba el runtime. El envío de pedidos Lulu sigue desactivado.
- El piloto completo y la entrega física no se han verificado.

Las credenciales no se incluyen en este documento ni en GitHub.
