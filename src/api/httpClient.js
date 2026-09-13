// Cliente HTTP do NERVA que fala com o backend próprio (Express + Prisma).
// Substitui o SDK proprietário anterior. Cuida de:
//  - base URL configurável (VITE_API_URL)
//  - bearer token em localStorage
//  - renovação automática via refresh token (uma tentativa)
//  - erros com { status, message, data } compatíveis com o código existente.

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'nerva_access_token';
// Chaves legadas mantidas por compatibilidade com utilitários existentes.
const LEGACY_KEYS = ['base44_access_token', 'token'];

export function getAccessToken() {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    localStorage.getItem('base44_access_token') ||
    localStorage.getItem('token') ||
    null
  );
}

export function setAccessToken(token) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    // mantém as chaves legadas em sincronia
    localStorage.setItem('base44_access_token', token);
  }
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let refreshingPromise = null;

async function tryRefresh() {
  // Evita múltiplas renovações simultâneas.
  if (!refreshingPromise) {
    refreshingPromise = (async () => {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new ApiError(res.status, 'refresh_failed');
      const data = await res.json();
      if (data.access_token) setAccessToken(data.access_token);
      return data.access_token;
    })().finally(() => {
      refreshingPromise = null;
    });
  }
  return refreshingPromise;
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request(method, path, { body, query, auth = true, _retried = false } = {}) {
  let url = `${API_URL}${path}`;
  if (query && typeof query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expirado -> tenta renovar uma vez.
  if (res.status === 401 && auth && !_retried && getAccessToken()) {
    try {
      const newToken = await tryRefresh();
      if (newToken) {
        return request(method, path, { body, query, auth, _retried: true });
      }
    } catch {
      clearAccessToken();
    }
  }

  const data = await parseBody(res);
  if (!res.ok) {
    const message = (data && data.error && data.error.message) || res.statusText || 'Request failed';
    throw new ApiError(res.status, message, data);
  }
  return data;
}

export const http = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
  apiUrl: API_URL,
};
