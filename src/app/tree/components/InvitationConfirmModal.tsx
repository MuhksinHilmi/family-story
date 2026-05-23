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

interface Invitation {
  id: number;
  token: string;
  relationship_type: "spouse" | "child";
  inviter: {
    full_name: string;
    gender: "male" | "female";
  };
}

interface InvitationConfirmModalProps {
  open: boolean;
  onClose: () => void;
  invitation: Invitation | null;
  onSuccess: () => void;
}

export function InvitationConfirmModal({
  open,
  onClose,
  invitation,
  onSuccess,
}: InvitationConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!invitation) return null;

  const isSpouse = invitation.relationship_type === "spouse";
  const relationshipLabel = isSpouse ? "Pasangan" : "Anak";

  const handleAccept = async () => {
    if (!invitation.token) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitation.token }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal menerima undangan");
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Accept invitation error:", error);
      alert("Terjadi kesalahan saat menerima undangan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!invitation?.token) {
      onClose();
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/invitations/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitation.token }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal menolak undangan");
        return;
      }

      // Setelah tolak berhasil, refresh daftar undangan di parent
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Reject invitation error:", error);
      alert("Terjadi kesalahan saat menolak undangan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Konfirmasi Undangan</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {invitation.inviter.full_name}
            </span>{" "}
            mengundang kamu sebagai{" "}
            <span className="font-semibold">{relationshipLabel}</span>.
          </p>

          {isSpouse && (
            <p className="text-xs text-[#6B5B4F]">
              Jika diterima, kalian akan resmi berpasangan dan bergabung dalam satu keluarga.
            </p>
          )}

          {!isSpouse && (
            <p className="text-xs text-[#6B5B4F]">
              Jika diterima, kamu akan menjadi anak dari {invitation.inviter.full_name}.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isLoading}
          >
            Tolak Undangan
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isLoading}
            className="bg-[#4A7C59] hover:bg-[#2E5239] text-cyan-50"
          >
            {isLoading ? "Memproses..." : "Terima Undangan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
