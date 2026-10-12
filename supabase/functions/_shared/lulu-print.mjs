/** Lulu Print API boundary. Credentials stay inside this server-side client. */
export const LULU_ENVIRONMENTS = Object.freeze({
  sandbox: Object.freeze({ api: 'https://api.sandbox.lulu.com', portal: 'https://developers.sandbox.lulu.com/' }),
  production: Object.freeze({ api: 'https://api.lulu.com', portal: 'https://developers.lulu.com/' })
});
export const LULU_A5_PAPERBACK_SKU = '0583X0827.BW.STD.PB.060UC444.MXX';
export const LULU_VALIDATION_STATUSES = Object.freeze({
  interior: Object.freeze([null, 'VALIDATING', 'VALIDATED', 'NORMALIZING', 'NORMALIZED', 'ERROR']),
  cover: Object.freeze([null, 'NORMALIZING', 'NORMALIZED', 'ERROR'])
});
export const LULU_PRINT_JOB_STATUSES = Object.freeze([
  'CREATED', 'UNPAID', 'PAYMENT_IN_PROGRESS', 'PRODUCTION_DELAYED',
  'PRODUCTION_READY', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELED', 'ERROR'
]);

export class LuluPrintError extends Error {
  constructor(code, operation, { httpStatus = null, uncertain = false, retryable = false, field = null, reason = null } = {}) {
    super(`Lulu ${operation}: ${code}${httpStatus ? ` (HTTP ${httpStatus})` : ''}${field ? ` [${field}]` : ''}`);
    this.name = 'LuluPrintError';
    Object.assign(this, { code, operation, httpStatus, uncertain, reconciliationRequired: uncertain, retryable, field, reason });
  }
}

function requiredText(value, field, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new LuluPrintError('invalid_input', 'validate', { field });
  return value.trim();
}

function positiveInteger(value, field, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new LuluPrintError('invalid_input', 'validate', { field });
  return value;
}

function environmentConfig(environment) {
  if (!Object.hasOwn(LULU_ENVIRONMENTS, environment)) throw new LuluPrintError('invalid_input', 'configure', { field: 'environment' });
  return LULU_ENVIRONMENTS[environment];
}

function sourceFile(value) {
  const source = requiredText(value, 'source_url', 8192);
  if (!/^https:\/\//i.test(source) || /[\s\\]/.test(source)) throw new LuluPrintError('invalid_input', 'validate', { field: 'source_url' });
  let url;
  try { url = new URL(source); } catch { throw new LuluPrintError('invalid_input', 'validate', { field: 'source_url' }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new LuluPrintError('invalid_input', 'validate', { field: 'source_url' });
  return source;
}

function sku(value) {
  const result = requiredText(value, 'pod_package_id', 100);
  if (!/^[A-Z0-9]+(?:\.[A-Z0-9]+){5}$/.test(result)) throw new LuluPrintError('invalid_input', 'validate', { field: 'pod_package_id' });
  return result;
}

function lineItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new LuluPrintError('invalid_input', 'validate', { field: 'line_items' });
  return items.map((item) => ({ pod_package_id: sku(item?.pod_package_id), page_count: positiveInteger(item?.page_count, 'page_count', 10000), quantity: positiveInteger(item?.quantity, 'quantity', 100000) }));
}

function shippingAddress(address, countryField, full = false) {
  const country = requiredText(address?.[countryField], `shipping_address.${countryField}`, 2);
  if (!/^[A-Z]{2}$/.test(country) || address[countryField === 'country' ? 'country_code' : 'country'] !== undefined) throw new LuluPrintError('invalid_input', 'validate', { field: 'shipping_address.country' });
  const result = { [countryField]: country };
  for (const key of ['name', 'street1', 'street2', 'city', 'postcode', 'state_code', 'phone_number', 'email', 'organization', 'recipient_tax_id']) {
    if (address[key] != null && !(typeof address[key] === 'string' && !address[key].trim())) result[key] = requiredText(address[key], `shipping_address.${key}`, 255);
  }
  for (const key of ['is_business', 'is_postbox']) {
    if (address[key] !== undefined) {
      if (typeof address[key] !== 'boolean') throw new LuluPrintError('invalid_input', 'validate', { field: key });
      result[key] = address[key];
    }
  }
  if (full) for (const key of ['name', 'street1', 'city', 'postcode', 'phone_number', 'email']) requiredText(result[key], `shipping_address.${key}`);
  const stateRequired = ['AE', 'AS', 'AU', 'BR', 'CA', 'CN', 'CO', 'CR', 'KY', 'ES', 'FM', 'HK', 'HN', 'ID', 'IN', 'IQ', 'IT', 'JM', 'JP', 'KN', 'KR', 'MX', 'MH', 'MP', 'NR', 'PW', 'PG', 'PF', 'RU', 'SV', 'SO', 'TW', 'UM', 'US', 'VE', 'VI'];
  if (stateRequired.includes(country)) requiredText(result.state_code, 'shipping_address.state_code', 6);
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new LuluPrintError('invalid_input', 'validate', { field: 'shipping_address.email' });
  if (result.phone_number && !/^\+?[\d\s\-./()]{8,20}$/.test(result.phone_number)) throw new LuluPrintError('invalid_input', 'validate', { field: 'shipping_address.phone_number' });
  return result;
}

function shippingLevel(value) {
  if (!['MAIL', 'PRIORITY_MAIL', 'GROUND_HD', 'GROUND_BUS', 'GROUND', 'EXPEDITED', 'EXPRESS'].includes(value)) throw new LuluPrintError('invalid_input', 'validate', { field: 'shipping_level' });
  return value;
}

function orderPayload(input) {
  const contact = requiredText(input?.contact_email, 'contact_email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new LuluPrintError('invalid_input', 'validate', { field: 'contact_email' });
  if (!Array.isArray(input?.line_items) || !input.line_items.length || input.line_items.length > 100) throw new LuluPrintError('invalid_input', 'validate', { field: 'line_items' });
  const delay = input.production_delay ?? 120;
  positiveInteger(delay, 'production_delay', 2880);
  if (delay < 60) throw new LuluPrintError('invalid_input', 'validate', { field: 'production_delay' });
  const address = shippingAddress(input.shipping_address, 'country_code', true);
  if (['BR', 'CL', 'MX'].includes(address.country_code)) requiredText(address.recipient_tax_id, 'shipping_address.recipient_tax_id', 64);
  return {
    external_id: requiredText(input.external_id, 'external_id', 255), contact_email: contact,
    line_items: input.line_items.map((item) => {
      const normalization = item?.printable_normalization;
      return {
        ...(item?.external_id === undefined ? {} : { external_id: requiredText(item.external_id, 'line_items.external_id', 255) }),
        title: requiredText(item?.title, 'line_items.title', 255), quantity: positiveInteger(item?.quantity, 'quantity', 100000),
        printable_normalization: {
          interior: { source_url: sourceFile(normalization?.interior?.source_url) },
          cover: { source_url: sourceFile(normalization?.cover?.source_url) },
          pod_package_id: sku(normalization?.pod_package_id)
        }
      };
    }),
    shipping_address: address, shipping_level: shippingLevel(input.shipping_level), production_delay: delay
  };
}

/** The portal performs manual payment. This is not a payment endpoint or receipt. */
export function luluPaymentPortalUrl(environment = 'sandbox') {
  return environmentConfig(environment).portal;
}

export function createLuluPrintClient({ environment = 'sandbox', clientKey, clientSecret, fetch: fetchImpl = globalThis.fetch, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), timeoutMs = 15000 } = {}) {
  const { api } = environmentConfig(environment);
  requiredText(clientKey, 'clientKey', 4096);
  requiredText(clientSecret, 'clientSecret', 4096);
  positiveInteger(timeoutMs, 'timeoutMs', 120000);
  if (typeof fetchImpl !== 'function' || typeof now !== 'function' || typeof sleep !== 'function') throw new LuluPrintError('invalid_input', 'configure');
  let accessToken = null;
  let expiresAt = 0;
  let refreshAt = 0;
  let refreshing = null;

  async function transport(path, init, operation, submission = false, signal) {
    const controller = new AbortController();
    let timer;
    let onAbort;
    const deadline = new Promise((_, reject) => {
      onAbort = () => {
        reject(new LuluPrintError('canceled', operation));
        controller.abort();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
      timer = setTimeout(() => {
        reject(new LuluPrintError(submission ? 'submission_uncertain' : 'timeout', operation, { uncertain: submission, retryable: !submission }));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await fetchImpl(`${api}${path}`, { ...init, signal: controller.signal, redirect: 'error' });
        if (!response.ok) {
          if (response.status === 401) accessToken = null;
          const uncertain = submission && (response.status >= 500 || response.status === 408);
          throw new LuluPrintError(uncertain ? 'submission_uncertain' : 'http_error', operation, {
            httpStatus: response.status, uncertain,
            retryable: !submission && (response.status === 429 || response.status >= 500 || response.status === 408)
          });
        }
        try {
          return JSON.parse(await response.text(), (key, value, context) => {
            if (typeof value === 'number' && /(?:^|_)(?:cost|price|amount|tax|discount)(?:_|$)/.test(key)) {
              if (!context?.source) throw new Error('Exact decimal parsing requires a current runtime');
              return context.source;
            }
            return value;
          });
        } catch {
          throw new LuluPrintError(submission ? 'submission_uncertain' : 'invalid_response', operation, { uncertain: submission });
        }
      })()]);
    } catch (error) {
      if (error instanceof LuluPrintError) throw error;
      throw new LuluPrintError(submission ? 'submission_uncertain' : 'network_error', operation, { uncertain: submission, retryable: !submission });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function ensureToken() {
    if (accessToken && now() < refreshAt) return;
    if (!refreshing) refreshing = (async () => {
      const basic = btoa(Array.from(new TextEncoder().encode(`${clientKey}:${clientSecret}`), (byte) => String.fromCharCode(byte)).join(''));
      const data = await transport('/auth/realms/glasstree/protocol/openid-connect/token', {
        method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials'
      }, 'authenticate');
      if (typeof data?.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new LuluPrintError('invalid_response', 'authenticate');
      accessToken = data.access_token;
      expiresAt = now() + data.expires_in * 1000;
      refreshAt = expiresAt - Math.min(30000, data.expires_in * 100);
    })().finally(() => { refreshing = null; });
    await refreshing;
  }

  async function request(path, operation, body, submission = false, signal) {
    if (signal?.aborted) throw new LuluPrintError('canceled', operation);
    await ensureToken();
    if (signal?.aborted) throw new LuluPrintError('canceled', operation);
    return transport(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }, operation, submission, signal);
  }

  async function waitForValidation(kind, id, { timeoutMs: waitMs = 120000, pollIntervalMs = 1500, requireNormalized = true } = {}) {
    positiveInteger(id, 'validationId');
    positiveInteger(waitMs, 'timeoutMs', 600000);
    positiveInteger(pollIntervalMs, 'pollIntervalMs', 60000);
    const start = now();
    const maxPolls = Math.ceil(waitMs / pollIntervalMs);
    const label = `${kind[0].toUpperCase()}${kind.slice(1)}Validation`;
    const pending = () => new LuluPrintError('validation_pending', `waitFor${label}`, { retryable: true });
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(pending());
        controller.abort();
      }, waitMs);
    });
    const poll = async () => {
      for (let index = 0; index < maxPolls && now() - start < waitMs; index += 1) {
        const result = await request(`/validate-${kind}/${id}/`, `get${label}`, undefined, false, controller.signal);
        if (controller.signal.aborted || now() - start >= waitMs) throw pending();
        if (!result || result.id !== id || !LULU_VALIDATION_STATUSES[kind].includes(result.status)) throw new LuluPrintError('invalid_response', `waitFor${label}`);
        if (['NORMALIZED', 'ERROR'].includes(result.status) || (kind === 'interior' && !requireNormalized && result.status === 'VALIDATED')) return result;
        if (index + 1 < maxPolls) await sleep(Math.min(pollIntervalMs, Math.max(0, waitMs - (now() - start))));
      }
      throw pending();
    };
    try { return await Promise.race([deadline, poll()]); } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  async function reconcilePrintJob(externalId, { maxPages = 10, pageSize = 100, timeoutMs: searchMs = 60000 } = {}) {
    const reference = requiredText(externalId, 'external_id', 255);
    if (reference !== externalId) throw new LuluPrintError('invalid_input', 'validate', { field: 'external_id' });
    positiveInteger(maxPages, 'maxPages', 100);
    positiveInteger(pageSize, 'pageSize', 100);
    positiveInteger(searchMs, 'timeoutMs', 120000);
    const operation = 'reconcilePrintJob';
    const incomplete = (reason, httpStatus = null, retryable = false) => Object.assign(
      new LuluPrintError('reconciliation_incomplete', operation, { uncertain: true, reason, httpStatus, retryable }),
      { resubmitAllowed: false }
    );
    const controller = new AbortController();
    const startedAt = now();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { reject(incomplete('timeout', null, true)); controller.abort(); }, searchMs);
    });
    const scan = async () => {
      const seen = new Set();
      const matches = new Map();
      let total;
      for (let page = 1; page <= maxPages; page += 1) {
        const query = new URLSearchParams({ search: reference, ordering: 'id', page: String(page), page_size: String(pageSize) });
        const result = await request(`/print-jobs/?${query}`, operation, undefined, false, controller.signal);
        if (controller.signal.aborted || now() - startedAt >= searchMs) throw incomplete('timeout', null, true);
        if (!Number.isSafeInteger(result?.count) || result.count < 0 || !Array.isArray(result.results) || result.results.length > pageSize || !(result.next === null || (typeof result.next === 'string' && result.next))) throw incomplete('invalid_page');
        if (total !== undefined && result.count !== total) throw incomplete('count_changed', null, true);
        total = result.count;
        for (const job of result.results) {
          if (!Number.isSafeInteger(job?.id) || job.id < 1 || !(typeof job.external_id === 'string' || job.external_id === null)) throw incomplete('invalid_record');
          if (seen.has(job.id)) throw incomplete('pagination_overlap', null, true);
          seen.add(job.id);
          if (job.external_id === reference) matches.set(job.id, job);
        }
        if (seen.size > total) throw incomplete('count_mismatch');
        const complete = result.next === null && seen.size === total;
        if (matches.size > 1 || complete) {
          const outcome = matches.size > 1 ? 'ambiguous' : matches.size === 1 ? 'matched' : 'not_found';
          return {
            outcome, printJob: outcome === 'matched' ? [...matches.values()][0] : null,
            matchingJobIds: [...matches.keys()], matchCount: matches.size, searchComplete: complete,
            pagesScanned: page, recordsScanned: seen.size, checkedAt: new Date(now()).toISOString(),
            reconciliationRequired: outcome !== 'matched', resubmitAllowed: false
          };
        }
        if (result.next === null || !result.results.length || seen.size >= total) throw incomplete('count_mismatch');
        let next;
        try { next = new URL(result.next, `${api}/print-jobs/`); } catch { throw incomplete('invalid_pagination'); }
        if (next.origin !== api || next.pathname !== '/print-jobs/' || next.username || next.password || next.hash || next.searchParams.getAll('page').length !== 1 || next.searchParams.get('page') !== String(page + 1)) throw incomplete('invalid_pagination');
        for (const [key, expected] of [['search', reference], ['page_size', String(pageSize)], ['ordering', 'id']]) {
          if (next.searchParams.has(key) && (next.searchParams.getAll(key).length !== 1 || next.searchParams.get(key) !== expected)) throw incomplete('invalid_pagination');
        }
        // Rebuild the next request from trusted inputs; never follow a provider URL with our bearer token.
      }
      throw incomplete('page_limit');
    };
    try { return await Promise.race([deadline, scan()]); } catch (error) {
      if (error instanceof LuluPrintError && error.code === 'reconciliation_incomplete') throw error;
      throw incomplete(error instanceof LuluPrintError ? error.code : 'invalid_response', error?.httpStatus || null, error?.retryable === true);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  return Object.freeze({
    environment,
    paymentPortalUrl: luluPaymentPortalUrl(environment),
    async authenticate() { await ensureToken(); return { environment, expiresAt }; },
    reconcilePrintJob,
    getPrintJob(id) { return request(`/print-jobs/${positiveInteger(id, 'printJobId')}/`, 'getPrintJob'); },
    getPrintJobStatus(id) { return request(`/print-jobs/${positiveInteger(id, 'printJobId')}/status/`, 'getPrintJobStatus'); },
    getPrintJobCosts(id) { return request(`/print-jobs/${positiveInteger(id, 'printJobId')}/costs/`, 'getPrintJobCosts'); },
    createPrintJob(input) {
      const body = orderPayload(input);
      return request('/print-jobs/', 'createPrintJob', body, true).then((result) => {
        if (!Number.isSafeInteger(result?.id) || result.id < 1 || !LULU_PRINT_JOB_STATUSES.includes(result?.status?.name)) {
          throw new LuluPrintError('submission_uncertain', 'createPrintJob', { uncertain: true });
        }
        return result;
      });
    },
    validateInterior(input) { return request('/validate-interior/', 'validateInterior', { source_url: sourceFile(input?.source_url), pod_package_id: sku(input?.pod_package_id) }, true); },
    getInteriorValidation(id) { return request(`/validate-interior/${positiveInteger(id, 'validationId')}/`, 'getInteriorValidation'); },
    waitForInteriorValidation(id, options) { return waitForValidation('interior', id, options); },
    calculateCoverDimensions(input) {
      const body = { pod_package_id: sku(input?.pod_package_id), interior_page_count: positiveInteger(input?.interior_page_count, 'interior_page_count', 10000), unit: input?.unit || 'pt' };
      if (!['pt', 'mm', 'inch'].includes(body.unit)) throw new LuluPrintError('invalid_input', 'validate', { field: 'unit' });
      return request('/cover-dimensions/', 'calculateCoverDimensions', body);
    },
    validateCover(input) { return request('/validate-cover/', 'validateCover', { source_url: sourceFile(input?.source_url), pod_package_id: sku(input?.pod_package_id), interior_page_count: positiveInteger(input?.interior_page_count, 'interior_page_count', 10000) }, true); },
    getCoverValidation(id) { return request(`/validate-cover/${positiveInteger(id, 'validationId')}/`, 'getCoverValidation'); },
    waitForCoverValidation(id, options) { return waitForValidation('cover', id, options); },
    shippingOptions(input) {
      const currency = input?.currency || 'EUR';
      if (!['AUD', 'CAD', 'EUR', 'GBP', 'USD'].includes(currency)) throw new LuluPrintError('invalid_input', 'validate', { field: 'currency' });
      const { state_code, ...address } = shippingAddress(input?.shipping_address, 'country');
      return request('/shipping-options/', 'shippingOptions', { currency, line_items: lineItems(input?.line_items),
        shipping_address: { ...address, ...(state_code ? {state: state_code} : {}) } });
    },
    quote(input) { return request('/print-job-cost-calculations/', 'quote', { line_items: lineItems(input?.line_items), shipping_address: shippingAddress(input?.shipping_address, 'country_code', true), shipping_option: shippingLevel(input?.shipping_option) }); }
  });
}
