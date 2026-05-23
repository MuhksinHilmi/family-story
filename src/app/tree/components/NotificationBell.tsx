"use client";

import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";

interface NotificationBellProps {
  count: number;
  invitations: any[];
  open: boolean;
  onToggle: () => void;
  onSelect: (inv: any) => void;
}

export function NotificationBell({
  count,
  invitations,
  open,
  onToggle,
  onSelect,
}: NotificationBellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onToggle();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#C4B49A] bg-white text-[#3B2F1E] hover:bg-[#F5F0E8]"
        aria-label="Notifikasi undangan"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E24B4A] px-1.5 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-[#D4C4A8] rounded-lg shadow-lg z-50 py-2">
          {invitations.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#6B5B45]">
              Tidak ada undangan baru.
            </div>
          ) : (
            invitations.map((inv, index) => (
              <button
                key={index}
                onClick={() => onSelect(inv)}
                className="w-full text-left px-4 py-2.5 hover:bg-[#F5F0E8] text-sm flex flex-col gap-0.5"
              >
                <span className="font-medium text-[#3B2F1E]">
                  {inv.inviter?.full_name || "Seseorang"}
                </span>
                <span className="text-[#6B5B45] text-xs">
                  Mengundang kamu sebagai{" "}
                  {inv.relationship_type === "spouse" ? "Pasangan" : "Anak"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
