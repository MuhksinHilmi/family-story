'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';

export default function MembersPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Anggota Keluarga</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Daftar Anggota</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {user && (
              <div key={user.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <Avatar>
                  <AvatarImage src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.id}`} alt={user.full_name} />
                  <AvatarFallback>{user.full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                  Anda
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}