// src/lib/api-client.ts
// Helper untuk semua panggilan API yang membutuhkan autentikasi (JWT + anti-spam timestamp)

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
