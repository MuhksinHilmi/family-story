"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, BookOpen, Trophy, MessageSquare } from "lucide-react";
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

interface HalaqahGroup {
  id: number;
  name: string;
  description: string;
  type: "belajar" | "pranikah" | "parenting";
  topics: string[];
  member_count: number;
  chat_room_uuid: string;
  is_admin: boolean;
}

export default function MyHalaqahPage() {
  const [groups, setGroups] = useState<HalaqahGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMyGroups = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch("/api/circle-family");
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups || []);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyGroups();
  }, []);

  if (isLoading) {
    return <FamilyTreeLoader message="Memuat circle family..." />;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#3B2F1E]">
              Grup Circle Family Saya
            </h1>
            <p className="text-[#6B5B45]">
              Kelola dan ikuti aktivitas belajar bersama keluarga.
            </p>
          </div>
          <Link href="/circle-family/discover/skill">
            <Button className="bg-[#4A7C59] hover:bg-[#2E5239] text-white flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Buat/Bergabung Grup
            </Button>
          </Link>
        </div>

        {groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
              >
                <Link href={`/circle-family/${group.id}`}>
                  <Card className="bg-[#FDFAF5] border-[#D4C4A8] hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#D6EAD9] text-[#2E5239] rounded-full flex items-center justify-center font-bold">
                          {group.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-[#3B2F1E] text-lg">
                            {group.name}
                          </CardTitle>
                          {group.is_admin && (
                            <span className="text-xs bg-[#C4922A] text-white px-2 py-0.5 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-[#6B5B45] line-clamp-2">
                        {group.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-[#9C8B75]">
                          <Users className="w-3 h-3" />
                          {group.member_count} keluarga
                        </div>
                        <div className="flex items-center gap-1 text-[#9C8B75]">
                          <MessageSquare className="w-3 h-3" />
                          Chat aktif
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.topics.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] bg-[#EDE4D3] text-[#6B5B45] px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-[#EDE4D3] rounded-full flex items-center justify-center mx-auto">
              <Users className="w-10 h-10 text-[#9C8B75]" />
            </div>
            <h3 className="text-lg font-bold text-[#3B2F1E]">Belum Ada Grup</h3>
            <p className="text-[#6B5B45] max-w-sm mx-auto">
              Anda belum bergabung ke dalam grup Circle Family apapun. Cari
              keluarga lain untuk memulai belajar bersama.
            </p>
            <Link href="/circle-family/discover/skill">
              <Button className="bg-[#4A7C59] hover:bg-[#2E5239] text-white mt-4">
                Cari Keluarga Belajar
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
