'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, MessageSquare, LayoutDashboard, Settings, Calendar, Trophy } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

import LearningPathMap from './components/LearningPathMap';
import ChallengeTab from './components/ChallengeTab';

export default function HalaqahDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('beranda');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      const res = await apiFetch(`/api/halaqah/${id}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    };
    fetchDetail();
  }, [id]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4C4A8] border-t-[#4A7C59] rounded-full animate-spin" />
      </div>
    );
  }

  const { halaqah, members, learningPath, steps, progress } = data;

  // Helper to find my current nuclear family id
  const getMyNfId = async () => {
    const res = await apiFetch(`/api/tree/me?user_id=${user?.id}`);
    if (res.ok) {
      const d = await res.json();
      return d.family_id;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] pb-20">
      {/* Header */}
      <div className="bg-[#FDFAF5] border-b border-[#D4C4A8] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D6EAD9] text-[#2E5239] rounded-full flex items-center justify-center font-bold">
              {halaqah.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#3B2F1E] leading-tight">{halaqah.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] border-[#D4C4A8] text-[#6B5B45]">
                  {halaqah.type}
                </Badge>
                <span className="text-xs text-[#9C8B75]">• {halaqah.location_label}</span>
              </div >
            </div>
          </div>

          <Button variant="outline" className="border-[#D4C4A8] text-[#6B5B45] hover:bg-[#EDE4D3]">
            <Settings className="w-4 h-4 mr-2" /> Pengaturan
          </Button>
        </Cdiv>

        {/* Tab Navigation */}
        <div className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto scrollbar-hide">
          {[
            { id: 'beranda', label: 'Beranda', icon: LayoutDashboard },
            { id: 'belajar', label: 'Learning Path', icon: BookOpen },
            { id: 'challenge', label: 'Tantangan', icon: Trophy },
            { id: 'anggota', label: 'Anggota', icon: Users },
            { id: 'chat', label: 'Diskusi', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${
                activeTab === tab.id
                ? 'text-[#3B2F1E] font-bold'
                : 'text-[#9C8B75] hover:text-[#6B5B45]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7C59]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'beranda' && (
            <motion.div
              key="beranda"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card className="bg-[#FDFAF5] border-[#D4C4A8]">
                <CardHeader>
                  <CardTitle className="text-[#3B2F1E]">Tentang Halaqah</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-[#6B5B45] leading-relaxed">{halaqah.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {halaqah.topics?.map((t: string) => (
                      <Badge key={t} className="bg-[#EDE4D3] text-[#6B5B45] border-none text-xs">{t}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#F5E8C8] border-[#D4C4A8] overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-[#3B2F1E] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#C4922A]" />
                      Sesi Berikutnya
                    </h3>
                    <p className="text-sm text-[#6B5B45]">Sabtu, 15 Juni · 09:00 WIB</p>
                  </div >
                  <Button className="bg-[#4A7C59] hover:bg-[#2E5239] text-white">
                    Gabung Sesi
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'belajar' && (
            <motion.div
              key="belajar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {learningPath ? (
                <div className="space-y-6">
                  <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
                    <h2 className="text-2xl font-bold text-[#3B2F1E]">{learningPath.name}</h2>
                    <p className="text-[#6B5B45]">{learningPath.description}</p>
                  </div >
                  <LearningPathMap
                    steps={steps}
                    progress={progress}
                    halaqahId={id as string}
                    myNuclearFamilyId={0} // This should be fetched from getMyNfId
                  />
                </div >
              ) : (
                <div className="text-center py-20 bg-[#FDFAF5] rounded-3xl border-[#D4C4A8] border-2 space-y-4">
                  <BookOpen className="w-12 h-12 text-[#9C8B75] mx-auto" />
                  <p className="text-[#6B5B45]">Belum ada kurikulum belajar untuk halaqah ini.</p>
                  <Button variant="outline" className="border-[#D4C4A8] text-[#6B5B45]">Saran Kurikulum</Button>
                </div >
              )}
            </motion.div>
          )}

          {activeTab === 'challenge' && (
            <motion.div
              key="challenge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ChallengeTab halaqahId={id as string} />
            </motion.div>
          )}

          {activeTab === 'anggota' && (
            <motion.div
              key="anggota"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {members.map((m: any) => (
                <Card key={m.id} className="bg-[#FDFAF5] border-[#D4C4A8]">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#EDE4D3] rounded-full flex items-center justify-center text-[#8B6F47] font-bold">
                      {m.full_name[0]}
                    </div >
                    <div className="flex-1">
                      <p className="font-bold text-[#3B2F1E] text-sm">{m.full_name}</p>
                      <p className="text-xs text-[#9C8B75]">{m.family_name} • {m.occupation}</p>
                    </div >
                    {m.is_admin && <Badge className="bg-[#C4922A] text-white">Admin</Badge>}
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-[calc(100vh-200px)]"
            >
              <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-2xl h-full flex items-center justify-center text-[#9C8B75]">
                {/* Integration with actual ChatRoom component would go here */}
                <div className="text-center space-y-2">
                  <MessageSquare className="w-12 h-12 mx-auto opacity-50" />
                  <p>Koneksi ke Ruang Diskusi... (Room UUID: {halaqah.chat_room_uuid})</p>
                </div >
              </div >
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
