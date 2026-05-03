# Sprint 1 - Acceso, precio y pago simulado

Fecha: 21/04/2026  
Producto operativo: `Futuro Anterior`  
Alcance: PB-A02, PB-A03, PB-A04, PB-B02 y PB-G03 del backlog `PRODUCT_BACKLOG_LIBRO_FUTURO_MVP.md`.

## Resultado

Sprint 1 deja una URL fija funcional:

```text
/tiresias.html
```

El usuario puede:

1. Entrar en una pantalla oscura y privada.
2. Ver el precio `49 EUR`.
3. Aceptar terminos, privacidad, aviso de IA y aviso emocional.
4. Continuar al pago.
5. Atravesar una pasarela simulada.
6. Quedar en estado de entrevista preparada para Sprint 2.

## Archivos principales

- `src/tiresias.html`
- `src/styles/future-book.css`
- `src/scripts/future-book.js`
- `supabase/functions/future-book-session/index.ts`
- `scripts/test-future-book-sprint1.mjs`

## Decisiones de experiencia

- La pagina no se integra en la navegacion publica de LicitIA para no mezclar productos.
- La URL fija del MVP es directa: `/tiresias.html`.
- El precio visible es `49 EUR`.
- El copy evita prometer prediccion literal.
- El pago es simulado y queda preparado para sustituirse por pasarela real.
- Si faltan variables publicas de backend, la pagina entra en modo local para poder probar el flujo visual sin romper.

## Backend Sprint 1

La Edge Function `future-book-session` suma estas acciones:

- `recordConsent`
- `startSimulatedPayment`
- `approveSimulatedPayment`

Eventos generados:

- `privacy_consent_accepted`
- `payment_started`
- `payment_simulated_approved`

Estados principales:

- Tras consentimiento: `payment_pending`
- Tras iniciar pago: `payment_pending` + `payment_status=simulated_pending`
- Tras aprobar pago simulado: `interview_ready` + `payment_status=simulated_approved`

## Comportamiento frontend

La pagina intenta crear o recuperar una sesion real con Supabase Functions. Si no hay backend configurado, crea una sesion local en `sessionStorage` para que Nestor pueda probar el flujo sin depender del entorno.

La experiencia tiene tres pasos:

1. Antes de entrar.
2. Pasarela de pago.
3. Entrevista lista.

Sprint 2 conectara voz, microfono y preguntas. Sprint 1 termina justo antes de la entrevista.

## Definition of Done Sprint 1

- URL fija `tiresias.html` creada.
- Pantalla oscura y opaca implementada.
- Precio `49 EUR` visible.
- Consentimiento y aviso emocional obligatorios.
- Pago simulado implementado en frontend y backend.
- Sesion queda en `interview_ready`.
- Tests estaticos Sprint 1 incluidos en `npm test`.
- Build genera `dist/tiresias.html`.

## Prueba manual recomendada

```bash
npm run build
python3 -m http.server 8765 --directory dist --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:8765/tiresias.html
```

Flujo esperado:

- Marcar los dos checkboxes.
- Pulsar `Continuar al pago`.
- Esperar la simulacion.
- Ver `Acceso concedido` y `La entrevista esta preparada`.
