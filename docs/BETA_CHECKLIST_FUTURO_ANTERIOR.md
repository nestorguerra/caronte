# Checklist beta privada - Futuro Anterior

## Producto

- [ ] URL fija `/futuro.html` accesible.
- [ ] Precio visible: 49 EUR.
- [ ] Pago simulado desbloquea entrevista.
- [ ] Aviso emocional visible antes de iniciar.
- [ ] Terminos enlazados.
- [ ] Privacidad y retencion enlazadas.
- [ ] Microfono funciona en navegador objetivo.
- [ ] Fallback de voz navegador funciona si ElevenLabs no esta configurado.

## Flujo completo

- [ ] Se crea sesion.
- [ ] Se acepta consentimiento.
- [ ] Pago simulado queda aprobado.
- [ ] Se completan 21 respuestas.
- [ ] Se genera manuscrito.
- [ ] Se genera PDF.
- [ ] PDF bloqueado en `pending_review`.
- [ ] Back office previsualiza PDF.
- [ ] Admin aprueba PDF.
- [ ] Admin libera PDF.
- [ ] Cliente descarga solo tras `released_to_customer`.

## Back office

- [ ] `/futuro-admin.html` protegido con `FUTURE_BOOK_ADMIN_TOKEN`.
- [ ] Dashboard muestra sesiones.
- [ ] Monitor muestra P0.
- [ ] Providers muestran configurado/no configurado sin exponer claves.
- [ ] Regenerar PDF crea nueva version.
- [ ] Borrado de sesion funciona.
- [ ] Toggle de acceso cierra nuevas sesiones.

## Produccion

- [ ] `SUPABASE_URL` configurado.
- [ ] `SUPABASE_ANON_KEY` configurado.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en Supabase Functions.
- [ ] `FUNCTIONS_BASE_URL` configurado.
- [ ] `FUTURE_BOOK_ADMIN_TOKEN` configurado.
- [ ] `FUTURE_BOOK_SECRET_KEY` configurado.
- [ ] `OPENAI_API_KEY` configurado si hay generacion IA real.
- [ ] `FUTURE_BOOK_OPENAI_MODEL` revisado.
- [ ] `ANTHROPIC_API_KEY` configurado si hay revision IA real.
- [ ] `ELEVENLABS_API_KEY` configurado si hay voz real.
- [ ] `FUTURE_BOOK_ACCESS_DISABLED=false`.

## Legal y privacidad

- [ ] Terminos indican que es obra IA.
- [ ] Terminos indican que no predice el futuro.
- [ ] Terminos indican que no es terapia ni consejo medico/legal/financiero.
- [ ] Privacidad indica voz, transcripcion y respuestas personales.
- [ ] Privacidad indica proveedores.
- [ ] Privacidad indica 30 dias de retencion beta.
- [ ] Privacidad indica derecho de borrado.

## Lulu

- [ ] Metadata `ready_for_print` presente.
- [ ] No se llama a Lulu.
- [ ] `send_to_lulu=false`.

## Go / No-Go

- [ ] `npm run validate` pasa.
- [ ] `npm test` pasa.
- [ ] `npm run build` pasa.
- [ ] No hay secretos en frontend.
- [ ] Runbook revisado por operador.
