// src/lib/api-client.ts
// Helper untuk semua panggilan API yang membutuhkan autentikasi (JWT + anti-spam timestamp)

import { triggerGlobalLogout } from './global-logout';

export function getAuthHeaders() {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('token') 
    : null;

  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Timestamp': Date.now().toString(),
    'Content-Type': 'application/json',
  };
}

/**
 * Authenticated fetch that automatically logs out on 401.
 * Use this instead of plain `fetch(url, { headers: getAuthHeaders() })`
 * to get global "expired token → logout from any page" behavior.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(init?.headers || {}),
  };

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    triggerGlobalLogout();
  }

  return response;
}
