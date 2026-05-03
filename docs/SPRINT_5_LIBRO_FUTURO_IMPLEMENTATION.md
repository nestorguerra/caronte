# Sprint 5 - Futuro Anterior

## Objetivo

Transformar el manuscrito en un PDF imprimible y dar una consola interna para operar la beta: sesiones, proveedores, cola editorial, aprobacion y liberacion manual.

## PB incluidos

- PB-E01: plantilla visual del libro.
- PB-E02: generacion server-side de PDF.
- PB-E03: preparacion Lulu-ready sin envio.
- PB-F01: vista interna de sesiones.
- PB-F02: regeneracion controlada.
- PB-F03: configuracion segura de API keys.
- PB-F04: dashboard operativo.
- PB-F05: cola de verificacion editorial de PDFs.
- PB-F06: liberacion manual del libro al cliente.

## Backend

### PDF

Archivo: `supabase/functions/future-book-session/index.ts`

Nuevas acciones publicas de sesion:

- `generatePdf`: convierte el manuscrito listo en PDF A5.
- `getPdfStatus`: devuelve metadata de PDF sin exponer el fichero.
- `downloadReleasedPdf`: solo devuelve `pdfBase64` si el PDF esta `released_to_customer`.

El PDF se genera server-side con un escritor PDF interno, sin navegador del cliente. El resultado entra siempre en:

```text
review_status = pending_review
```

La metadata Lulu queda preparada como:

```text
ready_for_print
send_to_lulu=false
trim_size=A5
language=es
```

No se llama a Lulu.

### Back office

Nuevas acciones admin:

- `adminDashboard`
- `adminPdf`
- `adminApprovePdf`
- `adminRejectPdf`
- `adminRequestRegeneration`
- `adminRegeneratePdf`
- `adminReleasePdf`
- `adminSaveProviderKey`
- `adminTestProvider`

El acceso admin usa `FUTURE_BOOK_ADMIN_TOKEN` en produccion. En local, si no hay backend, la consola funciona con fallback de `sessionStorage`.

### Proveedores

Tabla: `future_book_provider_settings`

Las claves no se devuelven nunca al navegador. Si se guardan desde back office, se almacenan cifradas con AES-GCM usando `FUTURE_BOOK_SECRET_KEY` o, como fallback server-side, `SUPABASE_SERVICE_ROLE_KEY`. El panel solo muestra:

- configurada/no configurada;
- origen (`env_secret`, `encrypted_setting`, `missing`);
- ultimos 4 caracteres;
- fecha de actualizacion/test.

## Base de datos

Migracion:

```text
supabase/migrations/202604220001_future_book_sprint5_pdf_admin.sql
```

Tablas:

- `future_book_pdfs`
- `future_book_provider_settings`

`future_book_pdfs` guarda versiones. Regenerar no borra PDFs anteriores.

## Frontend cliente

Archivos:

- `src/tiresias.html`
- `src/scripts/future-book.js`
- `src/styles/future-book.css`

Despues de `manuscript_ready` aparece:

- `generar_pdf`
- estado `pdf_status`
- enlace a `back_office`
- descarga solo si el PDF fue liberado.

En modo local se crea un PDF real en base64 para poder probar el flujo sin Supabase.

## Back office

Archivos:

- `src/futuro-admin.html`
- `src/scripts/future-admin.js`
- `src/styles/future-admin.css`

Incluye:

- gate de `admin_token`;
- metricas operativas;
- proveedores y rotacion de claves;
- sesiones recientes;
- cola `pdf_review_queue`;
- previsualizacion PDF;
- aprobar, rechazar, pedir regeneracion y liberar.
- regenerar crea una nueva version de PDF y conserva la anterior.

## Estados clave

- PDF nuevo: `pending_review`.
- Aprobado por admin: `approved`.
- Rechazado: `rejected`.
- Regeneracion solicitada: `regeneration_requested`.
- Liberado al cliente: `released_to_customer`.

## Limitaciones Sprint 5

- El PDF queda en base64 privado en base de datos para MVP. En produccion final conviene moverlo a Supabase Storage privado con URL firmada real.
- Lulu queda preparado como metadata, sin envio por API.
- El test de conexion de proveedores valida configuracion segura; no consume APIs externas.
