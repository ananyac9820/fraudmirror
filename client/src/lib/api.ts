export const TOKEN_KEY = 'fm_token';
export const USER_KEY = 'fm_user';

/** The GitHub Pages build has no server: requests are answered by an in-browser simulator. */
export const DEMO_MODE = import.meta.env.MODE === 'pages';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function signOutAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = `${import.meta.env.BASE_URL}login`;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const method = opts.method || 'GET';

  if (DEMO_MODE) {
    const { demoRequest, DemoError } = await import('../demo/backend');
    try {
      return (await demoRequest(method, path, opts.body as Record<string, unknown> | undefined, token)) as T;
    } catch (e) {
      if (e instanceof DemoError) {
        if (e.status === 401 && token) signOutAndRedirect();
        throw new ApiError(e.status, e.message);
      }
      throw e;
    }
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) signOutAndRedirect();
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}
