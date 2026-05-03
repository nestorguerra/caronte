const rawEnv = window.LicitiaEnv || {};

const missingPlaceholder = (value) => !value || String(value).startsWith('__');

export const config = {
  appEnv: rawEnv.appEnv || 'local',
  appVersion: rawEnv.appVersion || '0.1.0',
  supabaseUrl: missingPlaceholder(rawEnv.supabaseUrl) ? '' : rawEnv.supabaseUrl.replace(/\/$/, ''),
  supabaseAnonKey: missingPlaceholder(rawEnv.supabaseAnonKey) ? '' : rawEnv.supabaseAnonKey,
  functionsBaseUrl: missingPlaceholder(rawEnv.functionsBaseUrl) ? '' : rawEnv.functionsBaseUrl.replace(/\/$/, ''),
  paymentsEnabled: rawEnv.paymentsEnabled === true,
  freeBetaMessage: rawEnv.freeBetaMessage || 'Durante el primer mes LicitIA es gratuita. No tienes que introducir tarjeta ni metodo de pago. Te avisaremos antes de activar cualquier plan de pago.'
};

export function hasBackendConfig() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.functionsBaseUrl);
}

export function getConfigIssues() {
  const issues = [];
  if (!config.supabaseUrl) issues.push('Falta SUPABASE_URL');
  if (!config.supabaseAnonKey) issues.push('Falta SUPABASE_ANON_KEY');
  if (!config.functionsBaseUrl) issues.push('Falta FUNCTIONS_BASE_URL');
  return issues;
}
