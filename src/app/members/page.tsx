'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';

interface Member {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  role: string;
}

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      if (!user?.id) return;

      try {
        const memberRes = await fetch(`/api/tree/me?user_id=${user.id}`);
        const memberData = await memberRes.json();

        const fid = memberData.family_id || memberData.node?.family_id;
        if (!fid) return;

        setFamilyId(String(fid));

        const membersRes = await fetch(`/api/family/members?family_id=${fid}`);
        const membersData = await membersRes.json();

        if (membersData.members) {
          setMembers(membersData.members);
        }
      } catch (error) {
        console.error('Load members error:', error);
      }
    };

    loadMembers();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Anggota Keluarga</h1>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Anggota</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Belum ada anggota</p>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <Avatar>
                    <AvatarImage src={`https://i.pravatar.cc/150?u=${m.id}`} alt={m.full_name} />
                    <AvatarFallback>{m.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-sm text-gray-600">{m.email}</p>
                    {m.role === 'admin' && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Admin
                      </span>
                    )}
                  </div>
                  {String(m.id) === user?.id && (
                    <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                      Anda
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}