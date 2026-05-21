// src/lib/fetch-with-auth.ts
// Reusable fetch helper that automatically handles 401 (Unauthorized)
// by calling the provided onUnauthorized callback (usually logout)

import { getAuthHeaders } from './api-client';

type FetchWithAuthOptions = RequestInit & {
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

  // Jika server bilang token tidak valid / expired
  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    }
    // Kamu bisa uncomment ini kalau mau throw otomatis
    // throw new Error('Unauthorized');
  }

  return response;
}
