'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trophy, Upload, Image as ImageIcon, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

interface Challenge {
  id: number;
  title: string;
  description: string;
  due_date: string;
}

interface Submission {
  id: number;
  family_name: string;
  content_url: string;
  description: string;
  created_at: string;
}

export default function ChallengeTab({ halaqahId }: { halaqahId: string }) {
  const [data, setData] = useState<{ challenge: Challenge | null, submissions: Submission[] }>({
    challenge: null,
    submissions: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    content_url: '',
  });

  useEffect(() => {
    fetchChallenges();
  }, [halaqahId]);

  const fetchChallenges = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/circle-family/${halaqahId}/challenges`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!data.challenge) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/halaqah/${halaqahId}/challenges`, {
        method: 'POST',
        body: JSON.stringify({
          challenge_id: data.challenge.id,
          ...formData,
        }),
      });
      if (res.ok) {
        toast.success('Hasil praktik berhasil dikirim!');
        setFormData({ description: '', content_url: '' });
        fetchChallenges();
      } else {
        toast.error('Gagal mengirim hasil praktik');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <FamilyTreeLoader fullscreen={false} size="sm" message="Memuat tantangan..." />;

  if (!data.challenge) {
    return (
      <div className="text-center py-20 bg-[#FDFAF5] rounded-3xl border-[#D4C4A8] border-2 space-y-4">
        <Trophy className="w-12 h-12 text-[#9C8B75] mx-auto opacity-50" />
        <p className="text-[#6B5B45]">Belum ada tantangan aktif untuk circle family ini.</p>
      </div >
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Challenge Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="bg-[#F5E8C8] border-[#D4C4A8] overflow-hidden shadow-sm">
          <CardHeader className="border-b border-[#D4C4A8]/50 pb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#C4922A]" />
              <CardTitle className="text-[#3B2F1E]">Tantangan Mingguan</CardTitle>
            </div >
            <p className="text-xs text-[#6B5B45] mt-1">Batas waktu: {new Date(data.challenge.due_date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-[#3B2F1E] text-lg">{data.challenge.title}</h3>
              <p className="text-[#6B5B45] leading-relaxed">{data.challenge.description}</p>
            </div >

            {/* Submit Form */}
            <div className="bg-white/50 p-4 rounded-2xl border border-[#D4C4A8] space-y-4">
              <p className="text-sm font-semibold text-[#3B2F1E] flex items-center gap-2">
                <Upload className="w-4 h-4" /> Kirim Hasil Praktik Keluarga
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Link foto/video bukti praktik (Google Drive/Dropbox...)"
                  value={formData.content_url}
                  onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
                  className="bg-white border-[#D4C4A8]"
                />
                <Textarea
                  placeholder="Ceritakan pengalaman keluarga saat mempraktikkan tantangan ini..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white border-[#D4C4A8] min-h-[80px]"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-[#4A7C59] hover:bg-[#2E5239] text-white flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Kirim Sekarang</>}
                </Button>
              </div >
            </div >
          </CardContent>
        </Card>
      </motion.div>

      {/* Family Gallery */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#3B2F1E] flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#4A7C59]" /> Galeri Praktik Keluarga
          </h3>
          <Badge className="bg-[#D6EAD9] text-[#2E5239] border-none">{data.submissions.length} Keluarga</Badge>
        </div >

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {data.submissions.length > 0 ? (
              data.submissions.map((sub) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="bg-[#FDFAF5] border-[#D4C4A8] overflow-hidden h-full flex flex-col">
                    <CardContent className="p-4 space-y-3 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-[#EDE4D3] rounded-full flex items-center justify-center text-[10px] font-bold text-[#8B6F47]">
                          {sub.family_name[0]}
                        </div >
                        <span className="text-xs font-bold text-[#3B2F1E]">{sub.family_name}</span>
                      </div >

                      {sub.content_url ? (
                        <div className="aspect-video bg-[#EDE4D3] rounded-lg overflow-hidden flex items-center justify-center text-[#9C8B75] relative group">
                          <a href={sub.content_url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all">
                            <ImageIcon className="w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </a >
                          <span className="text-[10px] absolute bottom-2 right-2 bg-white/80 px-1 rounded">Lihat Bukti</span>
                        </div >
                      ) : (
                        <div className="aspect-video bg-[#EDE4D3] rounded-lg flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-[#9C8B75] opacity-50" />
                        </div >
                      )}

                      <p className="text-xs text-[#6B5B45] line-clamp-3 italic">
                        "{sub.description || 'Hanya mengirim bukti tanpa cerita.'}"
                      </p>
                    </CardContent>
                    <div className="p-3 bg-[#F5F0E8] border-t border-[#D4C4A8] flex justify-between items-center">
                       <span className="text-[10px] text-[#9C8B75]">{new Date(sub.created_at).toLocaleDateString('id-ID')}</span>
                       <Badge className="bg-[#D6EAD9] text-[#2E5239] border-none text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Berhasil</Badge>
                    </div >
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 space-y-2">
                <p className="text-sm text-[#9C8B own-text-3] opacity-60">Belum ada keluarga yang mengirimkan praktik.</p>
                <p className="text-xs text-[#9C8B75]">Jadilah keluarga pertama yang berbagi inspirasi!</p>
              </div >
            )}
          </AnimatePresence>
        </div >
      </div >
    </div>
  );
}
