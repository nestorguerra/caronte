# Sprint 12 - Back office de operacion real

## Objetivo

Convertir el back office de Futuro Anterior en una consola operativa real: acceso con identidad, roles, auditoria, vista de sesion completa, cola editorial y acciones de reparacion sin entrar en SQL.

## PB cubiertos

- **PB-F01 Login admin real**: el panel acepta Supabase Auth para operadores reales y mantiene el token legacy como fallback transitorio.
- **PB-F02 Roles admin**: permisos por rol `owner`, `ops`, `editor`, `support` y `viewer`.
- **PB-F03 Dashboard realtime**: el panel mantiene refresco automatico y muestra salud, sesiones, proveedores y costes.
- **PB-F04 Timeline por sesion**: nueva accion `adminSessionDetail` con eventos, respuestas, artefactos, mapas, manuscritos y PDFs.
- **PB-F05 Respuestas/transcripciones**: el detalle muestra respuestas, fuente de transcripcion, calidad y preview del texto.
- **PB-F06 Cola editorial manuscritos**: tabla de manuscritos con estado, version de prompt, calidad y fecha.
- **PB-F07 PDFs**: se conserva preview privado de PDF con storage firmado o base64 autorizado.
- **PB-F08 Acciones revision**: aprobar, rechazar, regenerar, liberar y reparar estados desde back office.
- **PB-F09 Auditoria admin**: nueva tabla `future_book_admin_audit_events` para lecturas privilegiadas y acciones mutantes.
- **PB-F10 Proveedores**: las API keys siguen siendo write-only y ahora quedan vinculadas a operador.
- **PB-F11 Costes**: snapshot operativo de ingresos, llamadas IA aproximadas, manuscritos, PDFs y carga editorial.
- **PB-F12 Apagado global**: cierre/reapertura de acceso auditado.

## Backend

- Nueva migracion `202604220006_future_book_sprint12_backoffice_ops.sql`.
- Nueva tabla `future_book_admin_users` para operadores y roles.
- Nueva tabla `future_book_admin_audit_events` para auditoria operativa.
- `future-book-session` resuelve administradores por Supabase Auth, `FUTURE_BOOK_ADMIN_EMAILS` / `APP_ADMIN_EMAILS` o token legacy.
- `adminSessionDetail` devuelve el expediente operativo completo de una sesion.
- `adminPatchSessionStatus` permite corregir estados, limpiar errores y dejar evento/auditoria.

## Frontend

- Login por email/password de Supabase y token legacy.
- Identidad y rol visibles en la barra superior.
- Panel de costes.
- Cola editorial de manuscritos.
- Detalle de sesion con timeline y respuestas.
- Reparacion manual guiada.
- Auditoria visible desde el panel.

## DoD

- El token unico deja de ser el mecanismo principal.
- Las acciones privilegiadas quedan auditadas.
- Los roles limitan acciones sensibles.
- Un operador puede abrir una sesion rota y corregir estados sin SQL.
- Las claves de proveedor siguen sin mostrarse completas en el navegador.
