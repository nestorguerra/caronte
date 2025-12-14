# Caronte - Landing & Dashboard

Proyecto de landing page y dashboard para la experiencia literaria personalizada "Caronte".

## 🚀 Cómo funciona

Este proyecto está diseñado para funcionar en dos modos:

1.  **Modo Completo (Local con Servidor):** Permite guardar los emails de la lista de espera en un archivo CSV real y tener un contador global sincronizado.
2.  **Modo Estático (GitHub Pages / Demo):** Funciona perfectamente sin backend. La lista de espera se guarda en el navegador del usuario (`LocalStorage`) y el contador es una simulación basada en una cifra inicial (1.250) + registros locales.

---

## 🛠️ Instalación y Uso (Modo Completo)

Si quieres ejecutar el servidor para guardar los emails en un CSV real:

1.  Asegúrate de tener [Node.js](https://nodejs.org/) instalado.
2.  Abre la terminal en la carpeta del proyecto.
3.  Ejecuta el servidor:
    ```bash
    node caronte-landing/server.js
    ```
    *(Si estás en la raíz, ajusta la ruta según corresponda).*

4.  Abre `http://localhost:3000` en tu navegador.

---

## 🌐 Despliegue en GitHub Pages (Modo Estático)

Simplemente sube la carpeta `caronte-landing` (o el contenido de la misma) a tu repositorio y activa GitHub Pages.
El proyecto detectará automáticamente que no está en `localhost` y activará el **Modo Estático**:

*   **Lista de Espera:** Los emails se guardan en el navegador del visitante.
*   **Contador:** Muestra una cifra estática (+35.000) para transmitir autoridad sin depender de APIs externas.
*   **Sin Errores:** No verás alertas de conexión al servidor.

---

## 🔑 Credenciales de Acceso

Para probar el dashboard (`login.html`), utiliza estos usuarios preconfigurados:

| Usuario | Email | Contraseña | Rol |
| :--- | :--- | :--- | :--- |
| **Demo User** | `demo@caronte.com` | `futuro2026` | Usuario estándar (Genera portada automática) |
| **Néstor Guerra** | `nestor.guerra@gmail.com` | `caronte2026` | **VIP** (Descarga archivos PDF/ePub reales) |

---

## 📧 Configuración de Email (Confirmación)

Para que los correos de confirmación se envíen realmente:

1.  Crea una cuenta gratuita en [EmailJS.com](https://www.emailjs.com/).
2.  **Add Service > Gmail** (o tu proveedor). Llámalo `service_caronte`.
3.  **Add Template > Create New Template**.
    *   Llámalo `template_caronte`.
    *   Copia el código de `email-template.html` y pégalo en la pestaña "Fuente" (Source) del editor.
4.  **Integration**:
    *   Ve a *Account > API Keys*.
    *   Copia tu "Public Key".
5.  **En `index.html`**:
    *   Busca `emailjs.init("YOUR_PUBLIC_KEY")` y pega tu clave.
    *   Verifica que `SERVICE_ID` y `TEMPLATE_ID` coincidan con lo que creaste.

---

## 📂 Archivos Importantes

*   `index.html`: Landing page principal.
*   `dashboard.html`: Área privada (perfil, entrevista, descarga).
*   `server.js`: Servidor Node.js (opcional para persistencia).
*   `waiting_list.csv`: Archivo donde se guardan los emails (solo modo servidor).
*   `caronte.pdf` / `caronte.epub`: Archivos del libro real (descargables solo por el usuario VIP).

---

## ✨ Características

*   **Diseño Radical:** Estética oscura, premium y provocadora.
*   **Entrevista:** 40 preguntas profundas divididas en 4 bloques temáticos.
*   **Generación PDF/ePub:** Creación de archivos al vuelo en el navegador (JSZip/jsPDF).
*   **Persistencia Local:** Todo el progreso del usuario se guarda en su navegador.
