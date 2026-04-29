/** Configuration is missing (e.g., BIZZMINE_TOKEN unset). */
export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** BizzMine returned a non-2xx response. */
export class ApiError extends Error {
  readonly code = 'API_ERROR';
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Network or transport failure (timeout, DNS, abort). */
export class TransportError extends Error {
  readonly code = 'TRANSPORT_ERROR';
  constructor(
    message: string,
    readonly path: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
