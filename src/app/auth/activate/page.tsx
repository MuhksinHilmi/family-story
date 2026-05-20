'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ActivatePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token tidak valid');
      return;
    }

    const activate = async () => {
      try {
        const response = await fetch('/api/auth/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (response.ok) {
          setStatus('success');
          setMessage(data.message);
          // Auto-login if token returned
          if (data.token && data.user) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setTimeout(() => router.push('/tree'), 1500);
          } else {
            setTimeout(() => router.push('/auth/login'), 1500);
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Gagal mengaktifkan akun');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Terjadi kesalahan');
      }
    };
    activate();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aktivasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && <p>Mengaktifkan akun...</p>}
          {status === 'success' && (
            <div>
              <p className="text-green-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Anda akan diarahkan ke halaman pohon keluarga...</p>
            </div>
          )}
          {status === 'error' && (
            <div>
              <p className="text-red-600">{message}</p>
              <Button className="w-full mt-4" onClick={() => router.push('/auth/login')}>
                Kembali ke Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}