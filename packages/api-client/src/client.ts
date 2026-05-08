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

  const text = await res.text();
  return JSON.parse(text);
}
