"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

interface UuidInviteModalProps {
  open: boolean;
  onClose: () => void;
  currentUserNodeUuid: string | null;
}

export function UuidInviteModal({
  open,
  onClose,
  currentUserNodeUuid,
}: UuidInviteModalProps) {
  const [inviteUuid, setInviteUuid] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState<"spouse" | "child">("child");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!inviteUuid.trim() || !currentUserNodeUuid) {
      alert("UUID tidak boleh kosong");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        relationship_type: inviteRelationship,
        invitee_node_uuid: inviteUuid.trim(),
      };

      if (inviteRelationship === "child") {
        payload.parent_node_uuid = currentUserNodeUuid;
      }

      const res = await apiFetch("/api/invitations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Undangan berhasil dikirim!");
        window.dispatchEvent(new CustomEvent("invitations-updated"));
        setInviteUuid("");
        onClose();
      } else {
        alert(data.error || "Gagal mengirim undangan");
      }
    } catch (err) {
      alert("Terjadi kesalahan saat mengirim undangan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setInviteUuid("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-[480px] min-w-[360px] animate-[slideIn_200ms_ease-out] rounded-2xl border border-[#D4C4A8] bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#3B2F1E]">Undang via UUID</h3>
          <button
            onClick={handleClose}
            className="text-2xl leading-none text-[#6B5B45] hover:text-[#3B2F1E]"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#3B2F1E]">
              UUID Node User
            </label>
            <Input
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              value={inviteUuid}
              onChange={(e) => setInviteUuid(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#3B2F1E]">
              Hubungan
            </label>
            <select
              value={inviteRelationship}
              onChange={(e) =>
                setInviteRelationship(e.target.value as "spouse" | "child")
              }
              className="w-full rounded-md border border-[#D4C4A8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A7C59]"
            >
              <option value="child">Saya sebagai Orang Tua</option>
              <option value="spouse">Sebagai Pasangan</option>
            </select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!inviteUuid.trim() || isSubmitting}
            className="w-full bg-[#4A7C59] hover:bg-[#2E5239] text-white"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Undangan"}
          </Button>

          <p className="text-center text-xs text-[#9C8B75]">
            UUID bisa didapat dari halaman Pengaturan user tersebut.
          </p>
        </div>
      </div>
    </div>
  );
}
