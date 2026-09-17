'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinFamilyUuid = searchParams.get('join');
  const inviteToken = searchParams.get('invite');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    gender: '',
    birth_date: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [genderLocked, setGenderLocked] = useState(false);
  const hasCheckedEmail = useRef(false);

  // Fetch invitation details if coming from invite link
  useEffect(() => {
    if (inviteToken && !hasCheckedEmail.current) {
      hasCheckedEmail.current = true;
      fetch(`/api/invitations?token=${inviteToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.invitation) {
            setInvitationData(data.invitation);

            // Lock email from the invitation
            if (data.invitation.invitee_email) {
              setFormData(prev => ({ ...prev, email: data.invitation.invitee_email }));
            }

            // Lock gender for spouse invitation
            if (data.invitation.relationship_type === 'spouse' && data.invitation.inviter?.gender) {
              const forcedGender = data.invitation.inviter.gender === 'male' ? 'female' : 'male';
              setFormData(prev => ({ ...prev, gender: forcedGender }));
              setGenderLocked(true);
            }

            // Jika user sudah terdaftar via email ini, langsung ke halaman login
            if (data.invitation.invitee_email) {
              fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: data.invitation.invitee_email })
              })
                .then(r => r.json())
                .then(result => {
                  if (result.registered) {
                    router.push('/auth/login');
                  }
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {
          // ignore fetch error, user can still register normally
        });
    }
  }, [inviteToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload: any = { ...formData };
      if (joinFamilyUuid) {
        payload.family_uuid = joinFamilyUuid;
      }
      if (inviteToken) {
        payload.invite_token = inviteToken;
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.via_invitation) {
          alert('Berhasil! Akun terdaftar dan undangan diklaim. Silakan login.');
        } else {
          alert('Berhasil! Akun terdaftar. Cek email untuk link aktivasi.');
        }
        router.push('/auth/login');
      } else {
        alert('Gagal: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (error) {
      alert('Error: Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#D6EAD9] flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-[#4A7C59]" />
          </div>
          <div>
            <CardTitle className="text-[#3B2F1E]">Daftar</CardTitle>
            <CardDescription>
              {inviteToken
                ? "Anda diundang untuk bergabung melalui undangan."
                : joinFamilyUuid
                  ? "Bergabung ke keluarga melalui link undangan."
                  : "Buat akun Cerita Keluarga Anda"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
         {invitationData && (
           <div className="bg-[#E8F0E8] border border-[#A8C5A8] rounded-md p-3 text-sm text-[#2E5239]">
             Anda diundang sebagai <strong>{invitationData.relationship_type === 'spouse' ? 'pasangan' : 'anak'}</strong> oleh{' '}
             <strong>{invitationData.inviter?.full_name}</strong>.
             {invitationData.relationship_type === 'spouse' && (
               <span className="block mt-1 text-xs">Jenis kelamin Anda telah dikunci sesuai undangan.</span>
             )}
           </div>
         )}

         <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-sm font-medium text-[#3B2F1E]">Nama Lengkap</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Masukkan nama lengkap"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-[#3B2F1E]">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nama@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={!!inviteToken}   // Lock email ketika datang dari undangan
            />
            {inviteToken && (
              <p className="text-xs text-[#6B5F4D]">Email telah dikunci sesuai undangan yang Anda terima.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium text-[#3B2F1E]">Nomor Telepon <span className="text-[#9C8B75] font-normal">(opsional)</span></Label>
            <Input
              id="phone"
              type="tel"
              placeholder="08xxx-xxxx-xxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-sm font-medium text-[#3B2F1E]">Jenis Kelamin</Label>
             <select
               id="gender"
               value={formData.gender}
               onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
               required
               disabled={genderLocked}
               className="flex h-10 w-full rounded-md border border-[#D4C4A8] bg-[#EDE4D3] px-3 py-2 text-base text-[#3B2F1E] ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A7C59] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
             >
              <option value="">Pilih jenis kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date" className="text-sm font-medium text-[#3B2F1E]">Tanggal Lahir</Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#4A7C59] hover:bg-[#2E5239] text-white font-medium"
            disabled={isLoading}
          >
            {isLoading
              ? 'Memproses...'
              : inviteToken
                ? 'Daftar & Klaim Undangan'
                : joinFamilyUuid
                  ? 'Daftar & Bergabung ke Keluarga'
                  : 'Daftar'}
          </Button>
        </form>
        <div className="mt-5 pt-4 border-t border-[#D4C4A8] text-center">
          <Link href="/auth/login" className="text-sm text-[#4A7C59] hover:text-[#2E5239] hover:underline transition-colors">
            Sudah punya akun? Masuk di sini
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardContent className="flex justify-center py-8">
            <FamilyTreeLoader
              fullscreen={false}
              size="sm"
              message="Memuat..."
            />
          </CardContent>
        </Card>
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
