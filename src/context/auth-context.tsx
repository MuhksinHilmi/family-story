'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth/login');
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