import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BizzmineClient.get', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.BIZZMINE_API_BASE = 'https://example.test';
    process.env.BIZZMINE_TENANT = 'test-tenant';
    process.env.BIZZMINE_TOKEN = 'test-token';
    // Reset module cache so config picks up new env
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ConfigError when token is missing', async () => {
    process.env.BIZZMINE_TOKEN = '';
    vi.resetModules();
    const { BizzmineClient } = await import('../client');
    // Use .code rather than instanceof — vi.resetModules() creates new class identities per import
    await expect(BizzmineClient.get('/AD/info')).rejects.toMatchObject({
      code: 'CONFIG_ERROR',
    });
  });

  it('sends X-Token and X-Tenant headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ Version: '6.0.44.5' }), { status: 200 }),
    );
    const { BizzmineClient } = await import('../client');
    await BizzmineClient.get('/AD/info');
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-Token']).toBe('test-token');
    expect(options.headers['X-Tenant']).toBe('test-tenant');
  });

  it('returns parsed JSON on 200', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const { BizzmineClient } = await import('../client');
    const result = await BizzmineClient.get<{ ok: boolean }>('/AD/info');
    expect(result).toEqual({ ok: true });
  });

  it('throws ApiError with status on 4xx/5xx', async () => {
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const { BizzmineClient } = await import('../client');
    await expect(BizzmineClient.get('/AD/info')).rejects.toMatchObject({
      code: 'API_ERROR',
      status: 401,
    });
  });

  it('throws TransportError on network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network down'));
    const { BizzmineClient } = await import('../client');
    await expect(BizzmineClient.get('/AD/info')).rejects.toMatchObject({
      code: 'TRANSPORT_ERROR',
    });
  });

  it('does not include the token in any thrown error message', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const { BizzmineClient } = await import('../client');
    try {
      await BizzmineClient.get('/AD/info');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('test-token');
    }
  });
});
