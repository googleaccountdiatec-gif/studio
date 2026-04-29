import 'server-only';
import { BIZZMINE_API_BASE, BIZZMINE_TENANT, BIZZMINE_TOKEN } from './config';
import { ApiError, ConfigError, TransportError } from './errors';

const DEFAULT_TIMEOUT_MS = 60_000;

function assertConfig(): void {
  if (!BIZZMINE_TOKEN) {
    throw new ConfigError(
      'BIZZMINE_TOKEN is not set. Add it to .env.local for local dev or to ' +
        'Firebase Secret Manager (`firebase apphosting:secrets:set bizzmine-token`) for deployment.',
    );
  }
  if (!BIZZMINE_TENANT) {
    throw new ConfigError('BIZZMINE_TENANT is not set.');
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  assertConfig();

  const url = `${BIZZMINE_API_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  // Forward an external signal if provided
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'X-Token': BIZZMINE_TOKEN,
        'X-Tenant': BIZZMINE_TENANT,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    throw new TransportError(
      `Network failure calling BizzMine ${method} ${path}`,
      path,
      cause,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Read body but DO NOT include token in error message
    const text = await response.text().catch(() => '');
    throw new ApiError(
      `BizzMine ${method} ${path} returned ${response.status}: ${text.slice(0, 200)}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as T;
}

export const BizzmineClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>('GET', path, { signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>('POST', path, { body, signal }),
};
