# Sprint 15 - URL efimera y acceso viral controlado

## Objetivo

Pasar de una URL fija de beta a un acceso cerrado, medible y apagable: campanas privadas, enlaces efimeros con TTL, uso unico, cupos limitados, lista de espera opaca y proteccion anti-indexacion.

## PB cubiertos

- **PB-I01 Generador de enlaces efimeros**: `adminCreateAccessInvites` crea links `futuro.html?k=...` y solo devuelve el token una vez.
- **PB-I02 TTL de enlace**: cada invite tiene `expires_at`; el backend marca como `expired` si llega tarde.
- **PB-I03 Un solo uso**: `consumeAccessInvite()` actualiza `use_count` y cierra el link cuando llega a `max_uses`.
- **PB-I04 Invitaciones limitadas**: campanas con `max_invites`, `max_sessions` y `child_invite_limit`.
- **PB-I05 Kill-switch por campana**: `adminUpdateAccessCampaign` puede pausar o cerrar campanas sin redeploy.
- **PB-I06 Lista de espera opaca**: `joinWaitlist` guarda hashes y devuelve solo un codigo opaco.
- **PB-I07 Modo URL fija solo beta**: `FUTURE_BOOK_ACCESS_MODE=fixed_beta` mantiene pruebas internas; `invite_required` exige link.
- **PB-I08 Proteccion contra indexacion**: meta robots y `X-Robots-Tag` preparados.

## Backend

- Nueva migracion `202604220009_future_book_sprint15_ephemeral_access.sql`.
- Nuevas tablas:
  - `future_book_access_campaigns`
  - `future_book_access_invites`
  - `future_book_waitlist_entries`
- Nuevas columnas en `future_book_sessions`:
  - `access_campaign_id`
  - `access_invite_id`
- Nuevas acciones publicas:
  - `accessStatus`
  - `joinWaitlist`
  - `requestViralInvite`
- Nuevas acciones admin:
  - `adminCreateAccessCampaign`
  - `adminUpdateAccessCampaign`
  - `adminUpdateAccessPolicy`
  - `adminCreateAccessInvites`
  - `adminRevokeAccessInvite`

## Back office

Nuevo panel `Acceso viral`:

- KPIs de modo, campanas, links abiertos/usados/caducados y waitlist.
- Formulario para cambiar modo global.
- Formulario para crear campanas.
- Formulario para emitir enlaces efimeros.
- Tablas de campanas e invites con pausar/cerrar/revocar.

## Operacion

Para campana real:

1. Crear campana en back office.
2. Generar links con TTL corto.
3. Cambiar modo global a `invite_required`.
4. Desactivar `fixed beta`.
5. Usar el kill-switch cerrando la campana si hay abuso o coste anomalo.

Para pruebas internas:

```text
FUTURE_BOOK_ACCESS_MODE=fixed_beta
FUTURE_BOOK_REQUIRE_INVITE=false
```

Para cierre total de viralidad:

```text
FUTURE_BOOK_ACCESS_MODE=invite_required
FUTURE_BOOK_REQUIRE_INVITE=true
```

## DoD

- Un enlace caduca solo.
- Un enlace usado no se puede reutilizar.
- Se puede cerrar una campana sin redeploy.
- La URL fija queda disponible solo en modo beta interno.
- La experiencia publica no se indexa.
