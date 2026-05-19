'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Mail, Copy } from 'lucide-react';

export default function InvitesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Undang Anggota</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Buat Undangan Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" placeholder="email@contoh.com" className="mt-1" />
          </div>
          <Button className="w-full sm:w-auto">
            <Mail className="h-4 w-4 mr-2" />
            Kirim Undangan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Undangan Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">pending@example.com</p>
                <p className="text-sm text-gray-600">Status: Menunggu konfirmasi</p>
              </div>
              <Button variant="ghost" size="sm">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}