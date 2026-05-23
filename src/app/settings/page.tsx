'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiFetch } from '@/lib/api-client';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    gender: 'male',
    birth_date: '',
    photo_url: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState({
    name: '',
    description: '',
  });
  const [publicNodeUuid, setPublicNodeUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      const res = await apiFetch(`/api/user/profile`);
      if (res.ok) {
        const data = await res.json();
        const formatDate = (d: any) => {
          if (!d) return '';
          try {
            return new Date(d).toISOString().split('T')[0]; // yyyy-MM-dd for <input type="date">
          } catch {
            return '';
          }
        };

        setProfile({
          full_name: data.user.full_name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          gender: data.user.gender || 'male',
          birth_date: formatDate(data.user.birth_date),
          photo_url: data.user.photo_url || '',
        });
        setPhotoPreview(data.user.photo_url || null);
      }

      const memberRes = await apiFetch(`/api/tree/me?user_id=${user.id}`);
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        
        // Ambil UUID publik node (untuk di-share agar orang bisa invite via relasi)
        if (memberData.node_uuid) {
          setPublicNodeUuid(memberData.node_uuid);
        }

        if (memberData.family_id) {
          const familyRes = await apiFetch(`/api/family/${memberData.family_id}`);
          if (familyRes.ok) {
            const familyData = await familyRes.json();
            setFamily({
              name: familyData.name || '',
              description: familyData.description || '',
            });
          }
        }
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      let payload: any = { ...profile };

      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        // Send other profile data as JSON string
        formData.append('profile', JSON.stringify(profile));

        // Build auth headers without Content-Type (browser sets multipart boundary)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const uploadHeaders: HeadersInit = {};
        if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
        uploadHeaders['X-Timestamp'] = Date.now().toString();

        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: uploadHeaders,
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user?.photo_url) {
            setProfile(prev => ({ ...prev, photo_url: data.user.photo_url }));
            setPhotoPreview(data.user.photo_url);
          } else {
            setPhotoPreview(null);
          }
          alert('Profil tersimpan');
          setPhotoFile(null);
        } else {
          alert('Gagal menyimpan foto');
        }
      } else {
        // No new photo, just update text fields
        const res = await apiFetch('/api/user/profile', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert('Profil tersimpan');
        }
      }
    } catch (error) {
      alert('Gagal menyimpan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFamily = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/family', {
        method: 'PUT',
        body: JSON.stringify(family),
      });
      if (res.ok) {
        alert('Keluarga tersimpan');
      }
    } catch (error) {
      alert('Gagal menyimpan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-6 bg-[#F5F0E8] min-h-full pb-10 max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#3B2F1E]">Pengaturan</h1>

        <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo Upload */}
            <div>
              <Label>Foto Profil</Label>
              <div className="flex items-center gap-4 mt-2">
                <Avatar className="h-20 w-20">
                  {photoPreview && <AvatarImage src={photoPreview} alt="Foto profil" />}
                  <AvatarFallback className="bg-[#D6EAD9] text-[#2E5239] text-3xl font-semibold border-2 border-[#4A7C59]/30">
                    {profile.full_name ? profile.full_name[0].toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Pilih Foto
                  </Button>
                  {photoFile && (
                    <p className="text-xs text-[#9C8B75] mt-1">{photoFile.name}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Nama Lengkap</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="mt-1"
                disabled
              />
            </div>
            <div>
              <Label>Nomor Telepon</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="flex h-10 w-full rounded-md border border-[#D4C4A8] bg-[#EDE4D3] px-3 py-2 text-base text-[#3B2F1E] ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input
                type="date"
                value={profile.birth_date}
                onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <Button className="mt-4 bg-[#4A7C59] hover:bg-[#2E5239] text-white" onClick={handleSaveProfile} disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </CardContent>
        </Card>

        {/* UUID Publik untuk Undangan Relasi */}
        <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
          <CardHeader>
            <CardTitle>UUID Publik Node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[#6B5F4D]">
              Bagikan UUID ini ke orang lain agar mereka bisa mengundang Anda sebagai pasangan atau anak secara langsung (tanpa email).
            </p>
            
            {publicNodeUuid ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={publicNodeUuid} 
                  readOnly 
                  className="font-mono text-sm bg-[#EDE4D3]" 
                />
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(publicNodeUuid);
                    alert('UUID berhasil disalin!');
                  }}
                >
                  Salin
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[#9C8B75]">Memuat UUID node...</p>
            )}
            
            <p className="text-xs text-[#9C8B75]">
              Ini adalah identifier unik node Anda di sistem baru. Gunakan ini saat orang lain ingin mengundang Anda via UUID.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
          <CardHeader>
            <CardTitle>Keluarga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nama Keluarga</Label>
              <Input
                value={family.name}
                onChange={(e) => setFamily({ ...family, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input
                value={family.description}
                onChange={(e) => setFamily({ ...family, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <Button className="mt-4 bg-[#4A7C59] hover:bg-[#2E5239] text-white" onClick={handleSaveFamily} disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}