"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface BreakRelationshipModalProps {
  open: boolean;
  onClose: () => void;
  nodeId: string | null;
  relatedNodeId: string | null;
  relatedNodeName: string | null;
  relationshipType: 'spouse' | 'father' | 'mother' | 'child' | null;
  onSuccess: () => void;
}

type BreakReason = "divorce" | "wrong_data";

export function BreakRelationshipModal({
  open,
  onClose,
  nodeId,
  relatedNodeId,
  relatedNodeName,
  relationshipType,
  onSuccess,
}: BreakRelationshipModalProps) {
  const [selectedReason, setSelectedReason] = useState<BreakReason>("divorce");
  const [isLoading, setIsLoading] = useState(false);

  if (!nodeId || !relatedNodeId) return null;

  const getRelationshipLabel = () => {
    switch (relationshipType) {
      case 'spouse': return 'pasangan';
      case 'father': return 'ayah';
      case 'mother': return 'ibu';
      case 'child': return 'anak';
      default: return 'hubungan';
    }
  };

  const handleSendRequest = async () => {
    setIsLoading(true);

    try {
      if (relationshipType === 'spouse') {
        // Use marriage break endpoint
        const res = await apiFetch("/api/tree/break-request", {
          method: "POST",
          body: JSON.stringify({
            node_id: nodeId,
            spouse_id: relatedNodeId,
            reason: selectedReason,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || "Gagal mengirim permintaan putus hubungan");
          return;
        }

        // Notify listeners to refresh break requests
        window.dispatchEvent(new CustomEvent("break-requests-updated"));

        alert(`Permintaan putus hubungan telah dikirim ke ${relatedNodeName}. Menunggu konfirmasi.`);
      } else {
        // For parent-child, we need to implement a different endpoint
        // For now, use direct delete (this should require approval too)
        alert("Fitur putus hubungan orang tua/anak belum tersedia. Hubungi admin.");
        return;
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Break request error:", error);
      alert("Terjadi kesalahan saat mengirim permintaan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Putuskan Hubungan Keluarga</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-[#9C8B75]">
            Ini akan mengirim permintaan putus hubungan ke{" "}
            <span className="font-medium text-[#3B2F1E]">{relatedNodeName}</span>
            {" "}sebagai {getRelationshipLabel()}.
            Mereka harus menerima permintaan ini agar hubungan dihapus.
          </p>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-[#8B6F47]">Alasan:</p>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="breakReason"
                value="divorce"
                checked={selectedReason === "divorce"}
                onChange={(e) => setSelectedReason(e.target.value as BreakReason)}
                className="w-4 h-4 text-[#4A7C59] border-[#D4C4A8]"
              />
              <span className="text-sm text-[#3B2F1E]">Cerai</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="breakReason"
                value="wrong_data"
                checked={selectedReason === "wrong_data"}
                onChange={(e) => setSelectedReason(e.target.value as BreakReason)}
                className="w-4 h-4 text-[#4A7C59] border-[#D4C4A8]"
              />
              <span className="text-sm text-[#3B2F1E]">Data salah / tidak tepat</span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button
            onClick={handleSendRequest}
            disabled={isLoading}
            className="bg-[#C4922A] hover:bg-[#A37520] text-white"
          >
            {isLoading ? "Mengirim..." : "Kirim Permintaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}