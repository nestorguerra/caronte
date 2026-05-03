# Matriz cumplimiento LicitIA

## Alcance

Matriz inicial para operar LicitIA v2 en beta gratuita de primer mes. No sustituye revision legal formal, pero deja controles de producto, datos y operacion listos para produccion.

| Ambito | Riesgo | Control implementado | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| RGPD | Tratamiento de datos de cuenta, empresa y actividad comercial | Supabase Auth, RLS multi-tenant, legal acceptance, auditoria y minimizacion en errores | migraciones Sprint 1-6, `legal_acceptances`, `audit_events`, `error_events` | Implementado |
| RGPD | Exposicion de datos entre organizaciones | Politicas RLS por `organization_id` y validacion server-side de membresia | `public.has_org_role`, `public.is_org_member`, Edge Functions | Implementado |
| RGPD | Derechos de acceso/exportacion | Backup/export organizativo desde `ops-admin` | `backup_runs`, ZIP con `manifest.json` | Implementado |
| RGPD | Retencion de backups y logs | `retention_until` en backups y runbook de restauracion | `backup_runs.retention_until`, `docs/RUNBOOK_OPERATIVO.md` | Preparado |
| RGPD | Subencargados | Supabase como backend, email opcional Resend, IA opcional OpenAI | README variables y contratos operativos | Pendiente revision contractual |
| ENS | Control de acceso | Owner/admin por organizacion, secretos fuera del frontend, service role solo server-side | `requireActiveMembership`, `requireOrgRole`, `.env.example` | Implementado |
| ENS | Trazabilidad | Auditoria de onboarding, decisiones, exportaciones, backups y release checks | `audit_events`, `release_checks` | Implementado |
| ENS | Continuidad | Runbook de ingestion, IA, backup, restauracion y revocacion de usuario | `docs/RUNBOOK_OPERATIVO.md` | Implementado |
| ENS | Monitorizacion | Captura de errores y panel operativo | `observability-event`, `error_events`, cockpit operaciones | Implementado |
| AI Act | Transparencia de uso de IA | Aviso de IA, separacion hecho oficial/inferencia y fallback determinista | `src/legal/ai-notice.html`, `analyze-tender` | Implementado |
| AI Act | Trazabilidad de salidas IA | Registro de `ai_runs`, modelo, entrada/salida y warnings | `ai_runs`, proposal review, proposal copilot | Implementado |
| Seguridad | Secretos expuestos en frontend | Validacion estatica y variables publicas limitadas | `scripts/validate.mjs`, `src/config/env.template.js` | Implementado |
| Seguridad | Pagos no activos en beta | `paymentsEnabled=false`, ausencia de UI/API de pagos, mensaje de beta gratuita | `scripts/test-production-flows.mjs`, onboarding | Implementado |
| Calidad | Regresion de flujo critico | Tests estaticos y build reproducible | `npm run validate`, `npm test`, `npm run build` | Implementado |
| Accesibilidad | Labels, foco y responsive | CSS responsive, nav por vistas, estados vacios | `src/app.html`, `src/styles/app.css` | Requiere revision manual final |

## Decisiones abiertas

- Firmar DPA/subencargados antes de pasar de beta gratuita a clientes de pago.
- Definir politica final de Retencion de logs, backups y documentos.
- Ejecutar auditoria ENS formal si el producto entra en clientes del sector publico.
- Completar pruebas manuales de lector de pantalla y navegacion por teclado.
