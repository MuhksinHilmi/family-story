"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";
import { toast } from "sonner";
import Link from "next/link";

interface HalaqahInvitation {
  id: number;
  halaqah_id: number | null;
  halaqah_name: string;
  inviter_name: string;
  inviter_family: string;
  message: string | null;
  created_at: string;
  status: "pending" | "accepted" | "rejected";
}

export default function HalaqahInvitationsPage() {
  const [invitations, setInvitations] = useState<HalaqahInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvitations();

    const handler = () => fetchInvitations();
    window.addEventListener("halaqah-invitations-updated", handler);
    return () =>
      window.removeEventListener("halaqah-invitations-updated", handler);
  }, []);

  const fetchInvitations = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(
        "/api/circle-family/invitations?status=pending",
      );
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (
    invitationId: number,
    action: "accept" | "reject",
  ) => {
    try {
      const res = await apiFetch("/api/circle-family/invitations", {
        method: "POST",
        body: JSON.stringify({ invitationId, action }),
      });
      if (res.ok) {
        toast.success(
          `Undangan berhasil ${action === "accept" ? "diterima" : "ditolak"}`,
        );
        fetchInvitations();
        window.dispatchEvent(new Event("halaqah-invitations-updated"));
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || `Gagal ${action} undangan`);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  if (isLoading) {
    return <FamilyTreeLoader message="Memuat undangan masuk..." />;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2F1E]">
            Undangan Circle Family
          </h1>
          <p className="text-[#6B5B45]">
            Tinjau undangan dari keluarga lain untuk bergabung bersama.
          </p>
        </div>

        {invitations.length > 0 ? (
          <div className="space-y-4">
            {invitations.map((inv) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-[#FDFAF5] border-[#D4C4A8]">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-[#3B2F1E] text-lg">
                          {inv.halaqah_name}
                        </h3>
                        <p className="text-sm text-[#9C8B75]">
                          Dari: {inv.inviter_name} ({inv.inviter_family})
                        </p>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        Menunggu
                      </span>
                    </div>

                    {inv.message && (
                      <p className="text-sm text-[#6B5B45] bg-[#EDE4D3] p-3 rounded-lg">
                        {inv.message}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleAction(inv.id, "accept")}
                        className="flex-1 bg-[#4A7C59] hover:bg-[#2E5239] text-white"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Terima
                      </Button>
                      <Button
                        onClick={() => handleAction(inv.id, "reject")}
                        variant="outline"
                        className="flex-1 border-[#D4C4A8] text-[#6B5B45] hover:bg-[#EDE4D3]"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Tolak
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-[#EDE4D3] rounded-full flex items-center justify-center mx-auto">
              &#128236;
            </div>
            <h3 className="text-lg font-bold text-[#3B2F1E]">
              Tidak Ada Undangan
            </h3>
            <p className="text-[#6B5B45]">
              Anda tidak memiliki undangan Circle Family yang pending.
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
