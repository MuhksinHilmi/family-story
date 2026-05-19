'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    gender: 'male',
    birth_date: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      const response = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          full_name: data.user.full_name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          gender: data.user.gender || 'male',
          birth_date: data.user.birth_date || '',
        });
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      if (response.ok) {
        console.log('Profile saved');
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pengaturan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
          <Button className="mt-4" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keluarga</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nama Keluarga</Label>
            <Input defaultValue="Keluarga Ahmad" className="mt-1" />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Input defaultValue="Keluarga besar di Jawa" className="mt-1" />
          </div>
          <Button className="mt-4">Simpan</Button>
        </CardContent>
      </Card>
    </div>
  );
}