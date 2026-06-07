"use client";

import { Heart } from 'lucide-react';

interface WaitingScreenProps {
  application: {
    recipient_name?: string;
    message: string;
    created_at: string;
  };
}

export default function WaitingScreen({ application }: WaitingScreenProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8] p-4">
      <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-[#D6EAD9] rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-10 h-10 text-[#4A7C59] animate-pulse" />
        </div>

        <h2 className="text-xl font-bold text-[#3B2F1E] mb-2">
          Lamaran Terkirim
        </h2>

        <p className="text-[#6B5B45] mb-6">
          Lamaran Anda sudah dikirim. Silakan menunggu respon dari calon pasangan.
        </p>

        <div className="bg-[#F5E8C8] border border-[#D4C4A8] rounded-lg p-4 mb-4">
          <p className="text-sm text-[#C4922A] font-semibold mb-2">Tgl Kirim</p>
          <p className="text-[#3B2F1E]">{formatDate(application.created_at)}</p>
        </div>

        <p className="text-sm text-[#9C8B75] bg-[#EDE4D3] p-3 rounded-lg">
          💡 Anda bisa tetap aktif melihat profil lainnya. 
          Jika ada yang mengirim lamaran ke Anda, 
          lamaran sebelumnya akan otomatis dibatalkan.
        </p>
      </div>
    </div>
  );
}