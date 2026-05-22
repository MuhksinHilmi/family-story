// src/lib/global-logout.ts
// Centralized logout trigger that can be called from anywhere
// (error handlers, fetch interceptors, 401 responses, etc.)
// without needing React context.

type LogoutFn = () => void;

let logoutFn: LogoutFn | null = null;

export function registerLogout(fn: LogoutFn) {
  logoutFn = fn;
}

export function triggerGlobalLogout() {
  if (typeof window === 'undefined') return;

  // Clear storage immediately
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {}

  // If a React-aware logout was registered (from AuthProvider), use it first
  // (it will also clear React state)
  if (logoutFn) {
    try {
      logoutFn();
    } catch {
      // ignore
    }
  }

  // Hard navigation to login — guarantees clean slate even if React is in broken state
  // (e.g. after SyntaxError from failed chunk load)
  if (window.location.pathname !== '/auth/login') {
    window.location.href = '/auth/login';
  }
}
