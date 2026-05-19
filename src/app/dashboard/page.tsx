'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, TreePine, FileText, MessageCircle, UserPlus, Calendar, User, Shield } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();
  const memberCount = 0;
  const documentCount = 0;
  const nodeCount = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Selamat datang kembali, <span className="font-medium text-primary">{user?.full_name || 'User'}</span>!</p>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Anggota</p>
                <p className="text-2xl font-bold text-gray-900">{memberCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TreePine className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Node Pohon</p>
                <p className="text-2xl font-bold text-gray-900">{nodeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Dokumen</p>
                <p className="text-2xl font-bold text-gray-900">{documentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-0 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <MessageCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Chat Aktif</p>
                <p className="text-2xl font-bold text-gray-900">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Family Overview */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Family Tree</CardTitle>
              <CardDescription className="mt-2">Manage your family data</CardDescription>
            </div>
            <Shield className="h-8 w-8 text-primary/30" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{memberCount}</div>
              <div className="text-sm text-gray-600">Anggota Keluarga</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{nodeCount}</div>
              <div className="text-sm text-gray-600">Node Pohon</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{documentCount}</div>
              <div className="text-sm text-gray-600">Dokumen</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary">1</div>
              <div className="text-sm text-gray-600">Chat Room</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button asChild className="h-auto py-4 justify-start">
            <Link href="/tree">
              <TreePine className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Lihat Pohon Keluarga</div>
                <div className="text-xs opacity-80">Visualisasi silsilah</div>
              </div>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/chat">
              <MessageCircle className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Chat Keluarga</div>
                <div className="text-xs opacity-80">Kirim pesan ke anggota</div>
              </div>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/invites">
              <UserPlus className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Undang Anggota</div>
                <div className="text-xs opacity-80">Tambahkan keluarga baru</div>
              </div>
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="h-auto py-4 justify-start">
            <Link href="/documents">
              <FileText className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Kelola Dokumen</div>
                <div className="text-xs opacity-80">Upload & lihat arsip</div>
              </div>
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
          <CardDescription>Kabar terbaru dari keluarga Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Ibu Siti bergabung</p>
                <p className="text-sm text-gray-600">Anggota keluarga baru telah ditambahkan</p>
              </div>
              <span className="text-xs text-gray-500">2 hari lalu</span>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-full">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Kartu Keluarga diupload</p>
                <p className="text-sm text-gray-600">Dokumen telah berhasil disimpan</p>
              </div>
              <span className="text-xs text-gray-500">3 hari lalu</span>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-purple-100 rounded-full">
                <MessageCircle className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Pesan baru di grup keluarga</p>
                <p className="text-sm text-gray-600">Anak Pertama mengirim pesan</p>
              </div>
              <span className="text-xs text-gray-500">5 hari lalu</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}