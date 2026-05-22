// src/lib/fetch-with-auth.ts
// Reusable fetch helper that automatically handles 401 (Unauthorized)
// by triggering global logout (works from any page, even outside React components)

import { getAuthHeaders } from './api-client';
import { triggerGlobalLogout } from './global-logout';

type FetchWithAuthOptions = RequestInit & {
  /** Optional extra callback (still supported for backward compatibility) */
  onUnauthorized?: () => void;
};

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: FetchWithAuthOptions
): Promise<Response> {
  const { onUnauthorized, ...fetchInit } = init || {};

  const headers = {
    ...getAuthHeaders(),
    ...(fetchInit.headers || {}),
  };

  const response = await fetch(input, {
    ...fetchInit,
    headers,
  });

  // Token invalid/expired → logout immediately from anywhere
  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    }
    // Always trigger the global one (safe, idempotent)
    triggerGlobalLogout();
  }

  return response;
}
