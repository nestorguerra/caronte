# Runbook operativo - Futuro Anterior

## Acceso

- Producto: `/tiresias.html`.
- Back office: `/futuro-admin.html`.
- En produccion configura `FUTURE_BOOK_ADMIN_TOKEN`.
- Si no hay backend configurado, el back office usa modo local con datos de `sessionStorage`.

## Como revisar sesiones

1. Abre `/futuro-admin.html`.
2. Introduce el `admin_token`.
3. Revisa `metrics`, `monitor` y la tabla `sessions`.
4. Busca estados anormales:
   - `failed`
   - `book_generating` demasiado tiempo
   - `pdf_generating` demasiado tiempo
   - `pending_review` mas de 24 horas

## Como revisar y descargar PDFs

1. En `pdf_review_queue`, pulsa `preview`.
2. Comprueba:
   - que abre como PDF;
   - paginas legibles;
   - aviso IA incluido;
   - metadata `ready_for_print`;
   - que `send_to_lulu=false`.
3. Si esta correcto, pulsa `approve`.
4. Si quieres que el cliente pueda descargarlo, pulsa `release`.
5. La descarga cliente solo se habilita tras `released_to_customer`.

## Como regenerar un PDF

1. En `pdf_review_queue`, pulsa `regen`.
2. El sistema marca la version anterior como `regeneration_requested`.
3. Se crea una nueva version de PDF en `pending_review`.
4. Revisa la nueva version antes de aprobar.

## Como borrar datos

1. En `monitor`, usa `session_id_to_delete`.
2. Introduce el ID de sesion completo.
3. Pulsa `delete_session_data`.
4. El borrado elimina la sesion y, por cascada, respuestas, manuscritos, PDFs y eventos asociados.
5. Registra manualmente el motivo de borrado fuera del producto si hay solicitud formal del usuario.

## Como rotar API keys

1. En `providers`, introduce la nueva clave en `new_key_write_only`.
2. Pulsa `guardar_key`.
3. Pulsa `test`.
4. El panel solo debe mostrar configurada/no configurada y ultimos 4 caracteres.
5. En produccion es preferible usar variables de entorno y redeploy controlado para claves criticas.

## Como desactivar el acceso si hay incidente

1. En `monitor`, pulsa `disable_access`.
2. El alta de nuevas sesiones queda bloqueada.
3. Investiga alertas P0:
   - proveedores obligatorios ausentes;
   - sesiones failed;
   - PDFs atascados.
4. Cuando este resuelto, pulsa `enable_access`.
5. Alternativa dura: configurar `FUTURE_BOOK_ACCESS_DISABLED=true`.

## Monitorizacion basica

El back office muestra:

- acceso abierto/cerrado;
- total P0;
- media de entrevista;
- media de generacion de libro;
- media de generacion PDF;
- alertas abiertas.

Un P0 debe tratarse manualmente si:

- hay sesiones `failed`;
- faltan proveedores obligatorios;
- hay PDFs `pending_review` mas de 24 horas;
- el acceso se ha desactivado por incidente.

## Observabilidad autonoma

En el panel `Observabilidad` puedes ejecutar dos comprobaciones:

- `Synthetic monitor`: crea una sesion sintetica, acepta consentimiento, salta el pago simulado, pide la primera pregunta y borra la sesion. Registra el resultado en `future_book_synthetic_runs`.
- `Monitor autonomo`: revisa sesiones/PDF atascados, costes, proveedores, conversion y alertas. Registra snapshots en `future_book_sla_snapshots` y abre dead letters en `future_book_dead_letters`.

En produccion lo ejecuta `.github/workflows/future-book-monitor.yml` cada 30 minutos con `INGESTION_SECRET`.

Para programarlo desde fuera:

```bash
curl -X POST "$FUNCTIONS_BASE_URL/future-book-session" \
  -H "Content-Type: application/json" \
  -H "x-future-book-monitor-secret: $FUTURE_BOOK_MONITOR_SECRET" \
  --data '{"action":"runAutonomousMonitor"}'
```

Si no quieres otro secreto, puedes reutilizar `INGESTION_SECRET` con la cabecera `x-licitia-job-secret`.

## Dead-letter queue

Una dead letter abierta significa que el sistema ha visto algo que no debe quedarse invisible:

- `recover_stuck_session`: sesion atascada en entrevista, libro o PDF.
- `inspect_failed_session`: sesion fallida o con `error_code`.
- `review_pdf`: PDF pendiente de revision demasiado tiempo.

Acciones:

1. Abre la sesion desde el back office.
2. Mira timeline, respuestas, manuscrito y PDF.
3. Si es recuperable, corrige estado con `Detalle de sesion`.
4. Pulsa `Retry` para registrar el reintento.
5. Si ya esta resuelto fuera del sistema, pulsa `Resolver`.

## Acceso viral controlado

El panel `Acceso viral` gobierna la entrada real al sistema.

- `fixed_beta`: la URL fija sigue creando sesiones. Usar solo para pruebas internas.
- `invite_required`: solo entran enlaces `tiresias.html?k=...` activos.
- `fixed beta`: excepcion temporal para mantener pruebas internas aunque el modo sea cerrado.
- `waitlist`: si un link falla, se guarda una entrada opaca sin datos crudos.

Operacion de campana:

1. Crear campana con cupo y TTL.
2. Generar enlaces desde `Generar links`.
3. Copiar solo los enlaces necesarios. El token no se puede recuperar despues.
4. Cambiar modo a `invite_required`.
5. Si hay abuso, cerrar la campana. No hace falta redeploy.

Estados:

- `active`: link valido.
- `used`: link consumido.
- `expired`: TTL vencido.
- `revoked`: revocado manualmente.

Variables:

- `FUTURE_BOOK_ACCESS_MODE=fixed_beta|invite_required`
- `FUTURE_BOOK_REQUIRE_INVITE=true|false`

## Alertas P0 externas

Configura `FUTURE_BOOK_ALERT_WEBHOOK_URL` si quieres que los P0 salgan fuera del back office. Cada intento queda en `future_book_alert_deliveries` como `sent`, `failed` o `skipped`.

P0 esperados:

- OpenAI o Anthropic sin configurar cuando son obligatorios.
- ElevenLabs sin configurar en experiencia de voz productiva.
- Sesiones `failed` o con `error_code`.
- PDF atascado o no revisado.
- Anomalia de coste por exceso de llamadas IA.
- Fallo del synthetic monitor.

## Runbook por proveedor

- OpenAI: comprobar `OPENAI_API_KEY`, `FUTURE_BOOK_OPENAI_MODEL`, cuotas y que `adminTestProvider` pase. Si falla generacion, bloquear liberacion del PDF y regenerar manuscrito.
- Anthropic: comprobar `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` y estado de revision editorial. Si falla, el libro no debe marcarse `ready_for_print`.
- ElevenLabs: comprobar `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` y fallback de audio. Si falla la voz, la entrevista puede continuar con texto/audio alternativo, pero debe quedar alerta.
- PDF: revisar `future-book-pdfs`, `print_validation`, peso, paginas A5 y `ready_for_print`. Si falla, regenerar PDF y mantener `pending_review`.
- Pago: ahora mismo es simulado. Cuando se conecte pasarela real, cualquier pago no confirmado debe dejar la sesion antes de entrevista y abrir dead letter si queda atascado.

## Retencion

- Respuestas, manuscritos y PDFs: 30 dias recomendado en beta.
- Logs tecnicos agregados: hasta 90 dias.
- Solicitud de borrado: ejecutar `delete_session_data` desde back office.

## Lulu

Sprint 6 no envia nada a Lulu. Solo se guarda metadata `ready_for_print`.
