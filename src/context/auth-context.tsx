'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { registerLogout, triggerGlobalLogout } from '@/lib/global-logout';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    // Case 1: Real JWT (header.payload.signature)
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          return Date.now() >= payload.exp * 1000; // exp is in seconds
        }
      }
    }

    // Case 2: Old fake token format (token-123-123456789) - fallback during transition
    const parts = token.split('-');
    if (parts.length >= 3) {
      const timestamp = parseInt(parts[2], 10);
      const TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
      return Date.now() - timestamp > TOKEN_AGE_MS;
    }
  } catch {
    // Any parsing error → treat as expired (safer)
    return true;
  }
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Register this logout instance so non-React code (fetch helpers, global error handlers) can trigger it
  useEffect(() => {
    registerLogout(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      const expired = isTokenExpired(storedToken);

      if (expired) {
        // Token expired or invalid → force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    
    const checkExpiration = () => {
      if (isTokenExpired(token)) {
        logout();
      }
    };
    
    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);
    return () => clearInterval(interval);
  }, [token]);

  // Global error handlers — catch SyntaxError from failed chunk loads (often caused by expired/invalid token)
  // and any unhandled auth-related promise rejections, then force logout from ANY page.
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || '';
      const error = event.error;

      // "Invalid or unexpected token" usually means the browser tried to parse HTML (error page / redirect)
      // as JavaScript — classic symptom of an authenticated chunk failing because the token was rejected.
      const isSyntaxError = error instanceof SyntaxError || message.includes('SyntaxError');
      const isUnexpectedToken = message.includes('Invalid or unexpected token') ||
                                message.includes('Unexpected token');

      if (isSyntaxError || isUnexpectedToken) {
        // Do not spam console in production; just force logout + clean navigation
        triggerGlobalLogout();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const status = reason?.status || reason?.response?.status;
      const message = String(reason?.message || reason || '');

      if (status === 401 || message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        triggerGlobalLogout();
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Use the global trigger for consistent hard navigation (handles broken React state)
    triggerGlobalLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}