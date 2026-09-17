'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Search, Send, UserPlus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

interface FamilyMatch {
  nuclear_family_id: number;
  family_name: string;
  head_name: string;
  head_occupation: string;
  spouse_name?: string;
  spouse_occupation?: string;
  combined_skills: string[];
  matched_skills: string[];
  location_label: string;
}

export default function SkillDiscoveryPage() {
  const [skills, setSkills] = useState<string[]>(['IT', 'Coding']);
  const [skillInput, setSkillInput] = useState('');
  const [matches, setMatches] = useState<FamilyMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState<number | null>(null);

  useEffect(() => {
    fetchMatches();
  }, [skills]);

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/circle-family/discover/skill?skills=${skills.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const sendInvite = async (familyId: number) => {
    setIsSending(familyId);
    try {
      const res = await apiFetch('/api/circle-family/invite', {
        method: 'POST',
        body: JSON.stringify({
          target_nuclear_family_id: familyId,
          theme: 'umum',
          skills: skills,
        }),
      });
      if (res.ok) {
        toast.success('Undangan belajar berhasil dikirim!');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Gagal mengirim undangan');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSending(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[#3B2F1E]">Temukan Keluarga Belajar</h1>
          <p className="text-[#6B5B45]">Cari keluarga dengan keahlian tertentu untuk memulai circle family bersama.</p>
        </div>

        {/* Skill Filter Bar */}
        <Card className="bg-[#FDFAF5] border-[#D4C4A8] p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C8B75]" />
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                placeholder="Cari skill (e.g. Coding, Memasak...)"
                className="pl-10 bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
              />
            </div>
            <Button onClick={addSkill} className="bg-[#4A7C59] hover:bg-[#2E5239] text-white w-full md:w-auto">
              Tambah Skill
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {skills.map(skill => (
              <Badge
                key={skill}
                className="bg-[#D6EAD9] text-[#2E5239] border-[#4A7C59]/30 px-3 py-1 rounded-full flex items-center gap-1"
              >
                {skill}
                <button onClick={() => removeSkill(skill)} className="hover:text-red-600">×</button>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Results List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-full flex justify-center py-8">
                <FamilyTreeLoader
                  fullscreen={false}
                  size="sm"
                  message="Mencari keluarga..."
                />
              </div>
            ) : matches.length > 0 ? (
              matches.map((match) => (
                <motion.div
                  key={match.nuclear_family_id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="bg-[#FDFAF5] border-[#D4C4A8] overflow-hidden group">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-bold text-[#3B2F1E] text-lg">{match.family_name}</h3>
                          <p className="text-xs text-[#9C8B75] flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {match.location_label}
                          </p>
                        </div>
                        <Badge className="bg-[#F5E8C8] text-[#C4922A] border-[#D4C4A8]">Match!</Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <div className="text-xs bg-[#EDE4D3] text-[#6B5B45] px-2 py-1 rounded">
                            Head: {match.head_occupation}
                          </div>
                          {match.spouse_occupation && (
                            <div className="text-xs bg-[#EDE4D3] text-[#6B5B45] px-2 py-1 rounded">
                              Spouse: {match.spouse_occupation}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {match.matched_skills.map(s => (
                            <span key={s} className="text-[10px] bg-[#D6EAD9] text-[#2E5239] px-1.5 py-0.5 rounded border border-[#4A7C59]/20">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={() => sendInvite(match.nuclear_family_id)}
                        disabled={isSending === match.nuclear_family_id}
                        className="w-full bg-[#4A7C59] hover:bg-[#2E5239] text-white flex items-center justify-center gap-2"
                      >
                        {isSending === match.nuclear_family_id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Kirim Undangan Belajar
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-20 space-y-4">
                <div className="bg-[#EDE4D3] w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-10 h-10 text-[#9C8B75]" />
                </div>
                <p className="text-[#6B5B45]">Tidak menemukan keluarga yang cocok. Coba skill lain!</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
