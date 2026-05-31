let _baseUrl = "";
let _getToken: (() => Promise<string | null>) | null = null;

export function configureApiClient(opts: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
}) {
  _baseUrl = opts.baseUrl.replace(/\/$/, "");
  _getToken = opts.getToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = _getToken ? await _getToken() : null;
  const url = `${_baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text);
      throw new Error(err.error ?? `Request failed: ${res.status}`);
    } catch {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }
  }

  // 204 No Content / empty body — return undefined cast to T so callers typed as
  // Promise<void> work without crashing JSON.parse("").
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text);
}
