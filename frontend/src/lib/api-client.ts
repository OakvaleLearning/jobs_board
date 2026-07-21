'use client';

import { isProtectedPath } from './auth-paths';

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

type Json = Record<string, unknown> | unknown[];

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null): void {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (typeof window !== 'undefined') {
    if (tokens) {
      localStorage.setItem('oak_tokens', JSON.stringify(tokens));
    } else {
      localStorage.removeItem('oak_tokens');
    }
  }
}

export function hydrateTokens(): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem('oak_tokens');
  if (!raw) return;
  try {
    const t = JSON.parse(raw) as { accessToken: string; refreshToken: string };
    accessToken = t.accessToken;
    refreshToken = t.refreshToken;
  } catch {
    localStorage.removeItem('oak_tokens');
  }
}

/**
 * A protected-page request returned a 401 that couldn't be refreshed → the
 * session is dead. Clear all client auth state and hard-redirect to the auth
 * page. Hard redirect (vs router) reloads the app so the persisted store
 * re-initialises empty. No-ops on public pages and on the auth page itself, so
 * pre-auth flows (login/register/forgot) and the marketing /auth/me probe never
 * bounce.
 */
function forceLogoutRedirect(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (!isProtectedPath(pathname)) return;
  setTokens(null);
  localStorage.removeItem('oak_user');
  document.cookie = 'oak_role=; path=/; max-age=0';
  const next = encodeURIComponent(pathname + search);
  window.location.href = `/login?next=${next}`;
}

async function request<T>(path: string, init: RequestInit & { json?: Json } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const method = (init.method ?? 'GET').toUpperCase();
  const bodyBearing = method === 'POST' || method === 'PATCH' || method === 'PUT';
  const body =
    init.json !== undefined
      ? JSON.stringify(init.json)
      : (init.body ?? (bodyBearing ? '{}' : undefined));

  let res = await fetch(`${PUBLIC_API}${path}`, { ...init, headers, body });

  if (res.status === 401 && refreshToken && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(`${PUBLIC_API}${path}`, { ...init, headers, body });
    }
  }

  if (res.status === 401 && path !== '/auth/refresh') {
    forceLogoutRedirect();
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: { code: string; message: string; statusCode: number } }
      | null;
    const err = payload?.error;
    throw new ApiError(err?.code ?? 'INTERNAL_ERROR', err?.message ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${PUBLIC_API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      setTokens(null);
      return false;
    }
    const { data } = (await res.json()) as {
      data: { accessToken: string; refreshToken: string };
    };
    setTokens(data);
    return true;
  } catch {
    setTokens(null);
    return false;
  }
}

/** Best-effort sign-out: revoke the refresh token server-side, then drop local tokens. */
export async function logout(): Promise<void> {
  const token = refreshToken;
  if (token) {
    try {
      await fetch(`${PUBLIC_API}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
    } catch {
      /* best-effort — clear locally regardless */
    }
  }
  setTokens(null);
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json?: Json) => request<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json?: Json) => request<T>(path, { method: 'PATCH', json }),
  put: <T>(path: string, json?: Json) => request<T>(path, { method: 'PUT', json }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function fetchBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let res = await fetch(`${PUBLIC_API}${path}`, { method: 'GET', headers });
  if (res.status === 401 && refreshToken && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(`${PUBLIC_API}${path}`, { method: 'GET', headers });
    }
  }
  if (res.status === 401 && path !== '/auth/refresh') {
    forceLogoutRedirect();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError('INTERNAL_ERROR', text || res.statusText, res.status);
  }
  return res.blob();
}

export async function downloadBlob(path: string, filename: string): Promise<void> {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
