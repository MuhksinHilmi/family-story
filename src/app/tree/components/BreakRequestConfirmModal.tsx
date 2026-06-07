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

interface BreakRequestConfirmModalProps {
  open: boolean;
  onClose: () => void;
  breakRequest: any;
  onSuccess: () => void;
}

export function BreakRequestConfirmModal({
  open,
  onClose,
  breakRequest,
  onSuccess,
}: BreakRequestConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!breakRequest) return null;

  const handleAccept = async () => {
    setIsLoading(true);

    try {
      const res = await apiFetch(`/api/tree/break-request/${breakRequest.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "accept" }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Gagal menerima permintaan");
        return;
      }

      // Notify listeners to refresh break requests and tree
      window.dispatchEvent(new CustomEvent("break-requests-updated"));

      alert("Permintaan putus hubungan diterima. Hubungan telah diputuskan.");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Accept break request error:", error);
      alert("Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);

    try {
      const res = await apiFetch(`/api/tree/break-request/${breakRequest.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Gagal menolak permintaan");
        return;
      }

      // Notify listeners to refresh break requests
      window.dispatchEvent(new CustomEvent("break-requests-updated"));

      alert("Permintaan ditolak.");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Reject break request error:", error);
      alert("Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const reasonLabel = breakRequest.reason === "divorce" ? "Cerai" : "Data salah";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Permintaan Putus Hubungan Keluarga</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-[#9C8B75]">
            <span className="font-medium text-[#3B2F1E]">
              {breakRequest.requester?.full_name || "Seseorang"}
            </span>{" "}
            meminta untuk memutuskan hubungan keluarga.
          </p>

          <div className="bg-[#F5E8C8] border border-[#D4C4A8] rounded-lg p-3">
            <p className="text-sm font-medium text-[#C4922A]">
              Alasan: {reasonLabel}
            </p>
          </div>

          <p className="text-xs text-[#9C8B75]">
            Jika Anda menerima, hubungan pernikahan akan dihapus dan keduanya akan
            keluar dari keluarga inti masing-masing.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject} disabled={isLoading}>
            Tolak
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isLoading}
            className="bg-[#C4922A] hover:bg-[#A37520] text-white"
          >
            {isLoading ? "Memproses..." : "Terima & Putuskan Hubungan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}