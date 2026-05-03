# Runbook operativo LicitIA

## Objetivo

Guia de operacion para mantener LicitIA en produccion durante la beta gratuita. Prioriza continuidad de servicio, proteccion de datos y trazabilidad de incidencias.

## Roles

- Owner/admin de organizacion: gestiona equipo, backups, release checks y bloqueo operativo.
- Platform admin: usuario incluido en `APP_ADMIN_EMAILS`, con visibilidad multi-organizacion.
- Usuario operativo: busca oportunidades, sigue expedientes y prepara propuestas.

## Checklist diario

1. Entrar en `Ajustes y operacion`.
2. Revisar `Errores recientes`.
3. Revisar `Alertas internas`.
4. Revisar `Salud del sistema`.
5. Ejecutar ingesta si no hay oportunidades recientes.
6. Confirmar que las notificaciones no estan en estado `failed`.

## Ingestion falla

Sintomas:

- `system-health` muestra ingesta en error.
- No aparecen licitaciones nuevas.
- `ingestion_runs` o `audit_events` registran fallos recientes.

Acciones:

1. Verificar `INGESTION_SECRET`.
2. Probar `ingest-boe` con una fecha concreta.
3. Probar `ingest-placsp` con `source=profiles` y limite bajo.
4. Revisar si la fuente oficial ha cambiado XML/Atom.
5. Si el proveedor oficial no responde, dejar constancia en `audit_events` y reintentar mas tarde.

## IA falla

Sintomas:

- `analyze-tender` o `proposal-copilot` devuelven warning.
- `ai_runs` registra error de proveedor.
- El cockpit muestra analisis determinista.

Acciones:

1. Verificar si `OPENAI_API_KEY` esta configurada.
2. Verificar `OPENAI_MODEL`.
3. Revisar limite diario por organizacion/usuario.
4. Confirmar que el fallback determinista se muestra al usuario.
5. Si el fallo es externo, continuar con fallback y registrar incidencia.

## Restaurar backup

Sprint 6 genera backup organizativo como ZIP bajo demanda desde `ops-admin`.

Acciones:

1. Exportar backup desde `Ajustes y operacion`.
2. Guardar el ZIP en ubicacion controlada por el equipo operativo.
3. Abrir `manifest.json` y validar `organization_id`, fecha y tablas.
4. Para restauracion, importar tablas en entorno staging primero.
5. Validar RLS, usuarios, suscripcion beta y auditoria.
6. Solo restaurar produccion despues de validacion funcional.

Nota: durante la beta, la restauracion productiva debe hacerse manualmente y quedar documentada en `release_checks` como `restore_test`.

## Revocar usuario

Acciones:

1. Entrar en Supabase Auth y bloquear o eliminar la sesion del usuario si procede.
2. Actualizar `organization_members.status` a `revoked` o equivalente operativo.
3. Cancelar invitaciones pendientes del mismo email.
4. Registrar evento en `audit_events`.
5. Revisar si el usuario tenia tareas, propuestas o dossiers asignados.

## Bloquear organizacion

Usar `ops-admin` accion `blockOrganization` si hay riesgo contractual, abuso, fraude o peticion expresa del owner.

Efecto:

- `organizations.status=blocked`;
- `blocked_at` y `blocked_reason` quedan informados;
- se registra auditoria.

## Observabilidad

Fuentes:

- `error_events`;
- `internal_alerts`;
- `audit_events`;
- `system-health`;
- logs de Supabase Edge Functions.

Severidad:

- `info`: evento informativo;
- `warning`: degradacion controlada;
- `error`: fallo de flujo;
- `critical`: fallo que bloquea produccion o riesgo de datos.

## Release beta gratuita

Antes de publicar:

1. `npm run validate`
2. `npm test`
3. `npm run build`
4. Ejecutar migraciones Supabase.
5. Desplegar Edge Functions.
6. Registrar checks P0 desde `Ajustes y operacion`.
7. Probar alta beta gratuita sin tarjeta.
8. Probar login, recuperacion, onboarding, busqueda, seguimiento, propuesta, dossier y backup.
