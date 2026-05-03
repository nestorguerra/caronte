# Sprint UX 4 - Operaciones, polish y medicion

## Objetivo

Cerrar el rediseño UX con una consola admin separada, estados de producto mas claros y medicion de los flujos criticos de beta.

## Historias cubiertas

- DUX-011 Operaciones y administracion sin mezclar con usuario final.
- DUX-012 Estados vacios, carga y errores de nivel enterprise.
- DUX-014 Microinteracciones y motion sobrio.
- DUX-015 Design QA y metricas de UX.

## Cambios de producto

La vista `Operaciones` queda restringida visualmente a roles `owner` y `admin` y se organiza por pestañas:

- Salud;
- Errores;
- Backups;
- Usuarios;
- Release;
- Medicion.

El usuario de negocio mantiene su experiencia limpia: `Ajustes` queda para perfil y equipo, mientras `Operaciones` concentra administracion, seguridad, backups y QA.

## Cambios UI

- Consola admin con `ops-tabbar`, resumen superior y paneles dedicados.
- Panel de salud con estado de organizacion, errores abiertos y organizaciones visibles.
- Panel de errores con severidad, fuente, fecha y estado.
- Panel de backups con retencion, historico y acciones auditadas.
- Panel de usuarios con miembros e invitaciones.
- Panel de release con checks P0.
- Panel de medicion con cobertura de eventos criticos.

## Estados, errores y carga

- Se añade region global de toasts accesible con `aria-live`.
- Se añaden skeleton loaders para operaciones, ficha y busqueda.
- Los errores recuperables muestran mensaje accionable y boton de reintento.
- Los estados vacios explican siguiente accion, no solo "sin datos".
- Las acciones sensibles muestran confirmacion antes de ejecutarse.

## Medicion

Eventos instrumentados sin datos sensibles:

- `signup_started`;
- `onboarding_completed`;
- `search_executed`;
- `tender_tracked`;
- `decision_recorded`;
- `proposal_exported`;
- `dossier_exported`.

Los eventos autenticados se registran mediante `audit-event`. El evento anonimo `signup_started` se registra como evento informativo de observabilidad sin email ni payload sensible.

## Motion y polish

- Pestañas admin con transiciones acotadas.
- Paneles con entrada suave.
- Skeleton shimmer reducido.
- Toasts con entrada/salida breve.
- Se valida que no aparezca `transition: all`.
- Todo respeta `prefers-reduced-motion` mediante la regla global existente.

## Limitaciones conocidas

- La medicion se apoya en auditoria/observabilidad existentes; queda pendiente un panel analitico historico con series temporales.
- La resolucion de errores todavia no tiene accion backend de marcar como resuelto desde UI.
- Los usuarios no admin quedan ocultos en UI, pero el backend sigue siendo la barrera real de permisos.
