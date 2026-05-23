// src/lib/api-client.ts
// Helper untuk semua panggilan API yang membutuhkan autentikasi (JWT + anti-spam timestamp)

import { triggerGlobalLogout } from "./global-logout";

export function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return {
    Authorization: token ? `Bearer ${token}` : "",
    "X-Timestamp": Date.now().toString(),
    "Content-Type": "application/json",
  };
}

/**
 * Authenticated fetch that automatically logs out on 401.
 * Use this instead of plain `fetch(url, { headers: getAuthHeaders() })`
 * to get global "expired token → logout from any page" behavior.
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  // Gunakan Headers object agar lebih aman saat merge
  const headers = new Headers();

  // Salin semua header yang dikirim dari options (jika ada)
  if (options.headers) {
    const incoming = options.headers;
    if (incoming instanceof Headers) {
      incoming.forEach((value, key) => headers.set(key, value));
    } else if (typeof incoming === "object") {
      Object.entries(incoming).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          headers.set(key, String(value));
        }
      });
    }
  }

  // Authorization (hanya jika token ada)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Wajib: X-Timestamp (anti-spam) — ini yang backend minta
  headers.set("X-Timestamp", Date.now().toString());

  // Content-Type hanya untuk request biasa (bukan FormData)
  if (!(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}