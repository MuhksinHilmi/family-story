"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, User, Calendar } from "lucide-react";
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";

interface JoinRequest {
  id: number;
  halaqah_id: number;
  halaqah_name: string;
  node_id: number;
  full_name: string;
  photo_url?: string;
  family_name?: string;
  status: string;
  joined_at: string;
}

export default function JoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(
          "/api/circle-family/requests?status=pending",
        );
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests || []);
        }
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, []);

  if (isLoading) {
    return <FamilyTreeLoader message="Memuat permintaan bergabung..." />;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2F1E] flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[#4A7C59]" />
            Permintaan Bergabung
          </h1>
          <p className="text-[#6B5B45]">
            Keluarga yang ingin bergabung ke Circle Family Anda.
          </p>
        </div>

        {requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id} className="bg-[#FDFAF5] border-[#D4C4A8]">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#D6EAD9] text-[#2E5239] rounded-full flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#3B2F1E]">
                        {req.full_name}
                      </p>
                      <p className="text-xs text-[#6B5B45]">
                        {req.family_name || "Keluarga tanpa nama"}
                      </p>
                      <p className="text-[10px] text-[#9C8B75] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(req.joined_at).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-[#4A7C59] hover:bg-[#2E5239] text-white"
                    >
                      Terima
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#D4C4A8] text-[#6B5B45]"
                    >
                      Tolak
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-[#EDE4D3] rounded-full flex items-center justify-center mx-auto">
              <CheckSquare className="w-10 h-10 text-[#9C8B75]" />
            </div>
            <h3 className="text-lg font-bold text-[#3B2F1E]">
              Tidak Ada Permintaan
            </h3>
            <p className="text-[#6B5B45] max-w-sm mx-auto">
              Tidak ada permintaan bergabung yang tertunda untuk saat ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
