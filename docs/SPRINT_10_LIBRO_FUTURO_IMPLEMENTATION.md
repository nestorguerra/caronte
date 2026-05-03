# Sprint 10 - PDF editorial real

Fecha: 22/04/2026  
Producto: Futuro Anterior / Caronte  
Estado: implementado

## Objetivo

Sustituir el PDF tecnico del MVP por un interior A5 con estructura de libro: portada, hoja suelta, indice, aperturas de capitulo, margenes espejo, numeracion, validacion automatica y storage privado.

## PB cubierto

- PB-D01 - Motor PDF editorial server-side.
- PB-D02 - Plantilla A5 premium.
- PB-D03 - Tipografia, margenes y paginacion.
- PB-D04 - Portada sobria y unica.
- PB-D05 - Validacion automatica de PDF.
- PB-D06 - Storage privado con URL firmada.
- PB-D07 - Versionado de PDFs.
- PB-D08 - Preparacion Lulu-ready real.
- PB-D09 - Gate `ready_for_print`.
- PB-D10 - Descarga cliente segura.

## Motor editorial

Archivo: `supabase/functions/future-book-session/index.ts`

Plantilla:

```text
future-book-a5-editorial-v1
```

El nuevo `buildPdfDocument` genera:

- portada interior sobria;
- hoja suelta de instrucciones;
- indice;
- apertura propia por seccion/capitulo;
- margenes espejo para encuadernacion;
- cabecera discreta;
- numero de pagina centrado;
- paginas de registro de lectura hasta llegar a un minimo editorial beta.

La salida mantiene trim A5:

```text
420 x 595 pt
```

## Storage privado

Migracion:

```text
supabase/migrations/202604220005_future_book_sprint10_pdf_storage.sql
```

Cambios:

- `pdf_base64` deja de ser obligatorio.
- Nueva columna `print_validation`.
- Bucket privado `future-book-pdfs`.
- MIME permitido: `application/pdf`.
- Limite: 20 MB.

El PDF se sube a:

```text
future-book-pdfs/{session_id}/vXX/{file_name}
```

`pdf_base64` queda solo como fallback legacy si storage falla.

## Preview y descarga

El back office y la descarga cliente piden el binario mediante Edge Function. La funcion puede devolver:

- `pdfBase64` temporal, construido desde storage privado.
- `signedUrl` temporal para preview/descarga.

El navegador nunca accede al bucket sin autorizacion server-side.

## Validacion automatica

`validateEditorialPdf` evalua:

- cabecera `%PDF-1.4`;
- storage privado;
- trim A5;
- plantilla editorial;
- rango de paginas;
- peso del archivo;
- si el manuscrito fuente esta degradado.

El resultado se guarda en:

```text
future_book_pdfs.print_validation
future_book_pdfs.quality_report
future_book_pdfs.lulu_metadata
```

## Gate Lulu

`ready_for_print=true` solo si:

- no hay errores de validacion;
- no hay warnings de paginas;
- el PDF esta en storage privado;
- el manuscrito fuente no esta degradado, generico ni bloqueado por seguridad.

No se llama a Lulu en Sprint 10. `send_to_lulu=false`.

## Definition of Done

- PDF abre como PDF valido.
- PDF tiene portada, front matter, indice, paginas interiores y aviso IA.
- PDF no se almacena como base64 principal en DB.
- Metadata Lulu queda preparada y condicionada por QA.
- Back office puede previsualizar la version exacta.
- Cliente solo descarga si el PDF esta liberado.
