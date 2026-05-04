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
  const res = await fetch(`${_baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
