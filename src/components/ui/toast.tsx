"use client";

import { useState, useEffect } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

let toastCallbacks: Array<(toast: { message: string; type: string } | null) => void> = [];

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  toastCallbacks.forEach(cb => cb({ message, type }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);

  useEffect(() => {
    const callback = (toast: { message: string; type: string } | null) => {
      if (toast) {
        const id = Date.now();
        setToasts(prev => [...prev, { ...toast, id }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
      }
    };
    toastCallbacks.push(callback);
    return () => {
      toastCallbacks = toastCallbacks.filter(cb => cb !== callback);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm"
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            toast.type === 'success' ? 'bg-[#4A7C59]' : 
            toast.type === 'error' ? 'bg-red-500' : 'bg-[#6B5B45]'
          }`}>
            {toast.type === 'success' && <IconCheck className="w-4 h-4 text-white" />}
            {toast.type === 'error' && <IconX className="w-4 h-4 text-white" />}
          </div>
          <span className="text-[#3B2F1E] text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}