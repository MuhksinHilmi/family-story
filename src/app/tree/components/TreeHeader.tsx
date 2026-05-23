"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { UserPlus, Share2, GitFork, Link, Mail } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

interface TreeHeaderProps {
  familyUuid: string | null;
  currentUserNodeUuid: string | null;
  pendingInvitations: any[];
  onInviteNewUser: () => void;
  onShareLink: () => void;
  onInvitationSelect: (inv: any) => void;
}

export function TreeHeader({
  familyUuid,
  currentUserNodeUuid,
  pendingInvitations,
  onInviteNewUser,
  onShareLink,
  onInvitationSelect,
}: TreeHeaderProps) {
  const [showUuidInvite, setShowUuidInvite] = useState(false);
  const [inviteUuid, setInviteUuid] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState<"spouse" | "child">("child");
  const [isBellOpen, setIsBellOpen] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);

  // Close bell dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInviteByUuid = async () => {
    if (!inviteUuid.trim() || !currentUserNodeUuid) {
      alert("UUID tidak boleh kosong");
      return;
    }

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
        setShowUuidInvite(false);
      } else {
        alert(data.error || "Gagal mengirim undangan");
      }
    } catch (err) {
      alert("Terjadi kesalahan");
    }
  };

  const count = pendingInvitations.length;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <GitFork className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-[#3B2F1E]">
              Pohon Keluarga
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {/* Undang via UUID */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUuidInvite(true)}
            className="border-[#4A7C59] text-[#4A7C59] hover:bg-[#E8F0E8] h-9 px-3"
            aria-label="Undang via UUID"
          >
            <Link className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Undang via UUID</span>
          </Button>

          {/* Undang User Baru */}
          <Button
            size="sm"
            onClick={onInviteNewUser}
            className="bg-[#4A7C59] hover:bg-[#2E5239] text-white h-9 px-3"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Undang User Baru</span>
          </Button>

          {/* Bagikan Link */}
          <Button
            size="sm"
            variant="outline"
            onClick={onShareLink}
            disabled={!familyUuid}
            className="border-[#C4B49A] text-[#3B2F1E] hover:bg-[#F5F0E8] h-9 px-3"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Bagikan Link</span>
          </Button>

          {/* Notification Bell */}
          <NotificationBell
            count={count}
            invitations={pendingInvitations}
            open={isBellOpen}
            onToggle={() => setIsBellOpen(!isBellOpen)}
            onSelect={(inv) => {
              onInvitationSelect(inv);
              setIsBellOpen(false);
            }}
          />
        </div>
      </div>

      {/* UUID Invite Modal */}
      {showUuidInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-[480px] min-w-[360px] animate-[slideIn_200ms_ease-out] rounded-2xl border border-[#D4C4A8] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#3B2F1E]">Undang via UUID</h3>
              <button
                onClick={() => {
                  setShowUuidInvite(false);
                  setInviteUuid("");
                }}
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
                <input
                  type="text"
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  value={inviteUuid}
                  onChange={(e) => setInviteUuid(e.target.value)}
                  className="w-full rounded-md border border-[#D4C4A8] bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#4A7C59]"
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
                onClick={async () => {
                  if (!inviteUuid.trim() || !currentUserNodeUuid) {
                    alert("UUID tidak boleh kosong");
                    return;
                  }

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
                      setShowUuidInvite(false);
                    } else {
                      alert(data.error || "Gagal mengirim undangan");
                    }
                  } catch {
                    alert("Terjadi kesalahan");
                  }
                }}
                disabled={!inviteUuid.trim()}
                className="w-full bg-[#4A7C59] hover:bg-[#2E5239] text-white"
              >
                Kirim Undangan
              </Button>

              <p className="text-center text-xs text-[#9C8B75]">
                UUID bisa didapat dari halaman Pengaturan user tersebut.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
