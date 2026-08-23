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
