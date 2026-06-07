"use client";

import { Inbox } from 'lucide-react';

export default function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F0E8] p-4">
      <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-[#EDE4D3] rounded-full flex items-center justify-center mx-auto mb-4">
          <Inbox className="w-10 h-10 text-[#9C8B75]" />
        </div>

        <h2 className="text-xl font-bold text-[#3B2F1E] mb-2">
          Belum Ada Lamaran
        </h2>

        <p className="text-[#6B5B45]">
          Saat ini belum ada lamaran yang masuk. 
          Profil Anda sudah aktif dan bisa dilihat oleh calon yang tepat.
        </p>
      </div>
    </div>
  );
}