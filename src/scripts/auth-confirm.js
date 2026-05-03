import { verifyTokenHash } from './api-client.js';
import { qs } from './dom.js';

function setStatus(message, isError = false) {
  const status = qs('#confirmStatus');
  const notice = qs('#confirmNotice');
  if (status) status.textContent = message;
  if (notice) {
    notice.textContent = message;
    notice.classList.toggle('is-error', Boolean(isError));
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const confirmationUrl = params.get('confirmation_url');
  if (confirmationUrl) {
    setStatus('Te llevamos a la confirmacion segura de Supabase.');
    window.location.href = confirmationUrl;
    return;
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type') || 'email';
  if (!tokenHash) {
    setStatus('Este enlace no contiene un token de confirmacion valido.', true);
    return;
  }

  try {
    await verifyTokenHash({ tokenHash, type });
    setStatus('Email confirmado. Entrando en LicitIA...');
    window.location.href = '../acceso.html?confirmed=1';
  } catch (error) {
    setStatus(`No se pudo confirmar el email: ${error.message}`, true);
  }
}

init();
