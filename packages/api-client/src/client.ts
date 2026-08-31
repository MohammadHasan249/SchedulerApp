let _baseUrl = "";
let _getToken: (() => Promise<string | null>) | null = null;
let _refreshToken: (() => Promise<string | null>) | null = null;

export function configureApiClient(opts: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  /** Called once on a 401 to attempt a token refresh before retrying. */
  refreshToken?: () => Promise<string | null>;
}) {
  _baseUrl = opts.baseUrl.replace(/\/$/, "");
  _getToken = opts.getToken;
  _refreshToken = opts.refreshToken ?? null;
}

async function doFetch(path: string, init: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${_baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/** Base URL configured via `configureApiClient`, for callers that need to build a full URL themselves (e.g. a streaming transport that can't go through `apiFetch`). */
export function getApiBaseUrl(): string {
  return _baseUrl;
}

/**
 * Wraps a fetch implementation to inject the same bearer token `apiFetch` uses,
 * via the `getToken` callback passed to `configureApiClient`. For callers that
 * need raw streaming response bodies (e.g. an AI SDK chat transport) and so
 * can't go through `apiFetch`, which buffers and JSON-parses the response.
 * Does not attempt the 401-refresh-and-retry `apiFetch` does — a token that
 * expires mid-stream just fails that request; the next message picks up a
 * fresh token from `getToken`.
 */
export function createAuthenticatedFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = _getToken ? await _getToken() : null;
    // `new Headers(init.headers)` normalizes any of the three RequestInit
    // header shapes (plain object, array of tuples, or a Headers instance) —
    // spreading `init.headers` directly would silently drop a Headers instance.
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetchImpl(input, { ...init, headers });
  }) as typeof fetch;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let token = _getToken ? await _getToken() : null;
  let res = await doFetch(path, init, token);

  // On 401, attempt a single session refresh then retry. This handles the case
  // where the Supabase JWT expires mid-session on mobile without forcing a logout.
  if (res.status === 401 && _refreshToken) {
    token = await _refreshToken();
    if (token) {
      res = await doFetch(path, init, token);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let parsed: { error?: unknown } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON — fall through to the generic message below
    }
    const message = typeof parsed?.error === "string" ? parsed.error : null;
    throw new Error(message ?? `Request failed: ${res.status} ${res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text);
}
