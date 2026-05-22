'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Mail, Copy } from 'lucide-react';

export default function InvitesPage() {
  return (
    <div className="space-y-6 bg-[#F5F0E8] min-h-screen">
      <h1 className="text-2xl font-bold text-[#3B2F1E]">Undang Anggota</h1>

      <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
        <CardHeader>
          <CardTitle className="text-[#3B2F1E]">Buat Undangan Baru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" placeholder="email@contoh.com" className="mt-1" />
          </div>
          <Button className="w-full sm:w-auto bg-[#4A7C59] hover:bg-[#2E5239] text-white">
            <Mail className="h-4 w-4 mr-2" />
            Kirim Undangan
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
        <CardHeader>
          <CardTitle className="text-[#3B2F1E]">Undangan Aktif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#EDE4D3] rounded-lg">
              <div>
                <p className="font-medium text-[#3B2F1E]">pending@example.com</p>
                <p className="text-sm text-[#6B5B45]">Status: Menunggu konfirmasi</p>
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