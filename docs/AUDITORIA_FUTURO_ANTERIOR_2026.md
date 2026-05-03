# Auditoria Futuro Anterior - abril 2026

## Veredicto

El producto ya tiene una base funcional real hasta PDF revisable: entrevista, transcripcion, generacion literaria, PDF, back office, claves de proveedores, observabilidad, retencion y acceso viral.

No esta todavia en modo "sonda espacial" al 100%. Para llegar ahi faltan tres cierres de produccion: autenticacion admin sin token legacy, pago real con reconciliacion, y fulfillment Lulu sandbox/produccion con trazabilidad de envio.

## Fortalezas actuales

- Front de cliente muy diferenciado: experiencia terminal, opaca, rara y no convencional.
- Edge Function centraliza secretos: ElevenLabs, OpenAI/GPT, Anthropic/Claude y Lulu no se exponen al navegador.
- ElevenLabs queda forzado: si falla la voz configurada, Caronte no cambia silenciosamente a voz del navegador.
- Back office operativo: sesiones, PDF, proveedores, auditoria, retencion, acceso viral y observabilidad.
- PDF no se libera sin revision manual.
- RLS y Edge Functions evitan acceso directo cliente a datos sensibles.
- Retencion y borrado RGPD ya existen como primitives operativas.

## Riesgos P0 antes de escala

1. Token legacy de administracion.
   - Riesgo: si se filtra, permite acciones amplias.
   - Cierre: login real con Supabase Auth, MFA y roles por usuario. Mantener token solo como emergencia rotada.

2. Pago simulado.
   - Riesgo: no hay reconciliacion economica real ni antifraude de checkout.
   - Cierre: Stripe Checkout/PaymentIntents en EUR, webhooks firmados, idempotencia y estado `paid`.

3. Lulu no envia todavia.
   - Riesgo: el producto promete entrega fisica pero el ultimo tramo no esta automatizado.
   - Cierre: Lulu sandbox, validacion de interior/cover, coste, direccion, tracking y cancelacion.

4. Promesa psicologica delicada.
   - Riesgo: puede percibirse como terapia, prediccion o diagnostico.
   - Cierre: copy legal consistente: "futuros plausibles, no prediccion, no terapia". Escalado de crisis y exclusion de menores.

## Riesgos P1

- URL efimera: existe, pero falta consola de campanas mas simple para operar sin tocar IDs.
- Backups y disaster recovery: falta simulacro documentado.
- Rate limits: existen, pero conviene separar limites por IP, fingerprint, invite y sesion.
- Observabilidad: hay synthetic monitor, pero faltan alertas externas obligatorias por proveedor caido.
- Calidad editorial: hay scoring, pero falta checklist humana estructurada antes de liberar.

## Cambios aplicados en esta auditoria

- Back office enriquecido con vista operativa superior.
- Datos demo automaticos cuando no hay datos reales, sin escribir en backend.
- Metricas visibles: libros hechos, libros en transito, usuarios en web, entrevistas, revision, APIs.
- Proveedores renombrados de forma clara: GPT-5.4/OpenAI, Claude Opus/Anthropic, ElevenLabs voz Javier, Lulu.
- Panel de auditoria rapida: ElevenLabs, GPT, Claude, PDF manual, acceso viral y retencion.
- Documentacion actualizada para que la voz no tenga fallback a navegador.

## Proximo sprint recomendado

Sprint 16 debe ser "Operacion cerrada":

- Login admin real con MFA.
- Stripe pago real en modo test y webhooks.
- Lulu sandbox sin envio real.
- Checklist editorial antes de liberar.
- Alerta externa si ElevenLabs/OpenAI/Anthropic falla.
- Boton de modo demo on/off en back office.
