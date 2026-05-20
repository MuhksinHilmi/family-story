'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

export default function InvitationPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', gender: 'male', birth_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInv = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/invitations/${params.token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Undangan tidak ditemukan');
          setInv(null);
        } else {
          setInv(data);
          setForm(f => ({ ...f, email: data.email, full_name: data.node?.full_name || f.full_name }));
        }
      } catch (e) {
        setError('Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    };
    fetchInv();
  }, [params.token]);

  const acceptAsLoggedIn = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, full_name: user.full_name, gender: user.gender, birth_date: user.birth_date }),
      });
      if (res.ok) {
        router.push('/tree');
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal menerima undangan');
      }
    } catch (e) {
      setError('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        setError(regData.error || 'Gagal mendaftar');
        setIsSubmitting(false);
        return;
      }

      const newUser = regData.user;

      const acceptRes = await fetch(`/api/invitations/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: newUser.id, full_name: newUser.full_name, gender: newUser.gender, birth_date: newUser.birth_date }),
      });

      if (!acceptRes.ok) {
        const accData = await acceptRes.json();
        setError(accData.error || 'Gagal mengaitkan undangan');
        setIsSubmitting(false);
        return;
      }

      // Redirect to login so user can verify/OTP
      router.push('/auth/login');
    } catch (e) {
      setError('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Undangan Bergabung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-red-600">{error}</p>}
          {inv ? (
            <div>
              <p>Anda diundang untuk bergabung ke keluarga ID: <strong>{inv.family_id}</strong></p>
              {inv.node && <p>Posisi: <strong>{inv.node.full_name}</strong></p>}

              {user ? (
                <div className="mt-4">
                  <p>Masuk sebagai: <strong>{user.full_name} ({user.email})</strong></p>
                  <Button className="w-full mt-2" onClick={acceptAsLoggedIn} disabled={isSubmitting}>
                    {isSubmitting ? 'Memproses...' : 'Terima Undangan'}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRegisterAndAccept} className="space-y-3">
                  <input type="text" placeholder="Nama Lengkap" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full h-10 rounded-md border px-3" />
                  <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full h-10 rounded-md border px-3" />
                  <input type="tel" placeholder="Telepon" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full h-10 rounded-md border px-3" />
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full h-10 rounded-md border px-3">
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                  <input type="date" placeholder="Tanggal Lahir" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className="w-full h-10 rounded-md border px-3" />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Memproses...' : 'Daftar dan Terima Undangan'}</Button>
                  <div className="text-center">
                    <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">Sudah punya akun? Masuk</Link>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <p>Undangan tidak ditemukan atau sudah tidak berlaku.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
