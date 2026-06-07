"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';

interface ConfirmSheetProps {
  isOpen: boolean;
  variant: 'send' | 'accept-reject';
  targetProfile: {
    full_name?: string;
    sender_name?: string;
  } | null;
  onConfirm: (message: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmSheet({ 
  isOpen, 
  variant, 
  targetProfile, 
  onConfirm, 
  onCancel,
  isLoading 
}: ConfirmSheetProps) {
  const [message, setMessage] = useState('');

  const handleConfirm = () => {
    if (message.trim().length >= 20) {
      onConfirm(message);
      setMessage('');
    }
  };

  if (!isOpen) return null;

  const targetName = targetProfile?.full_name || targetProfile?.sender_name || 'Calon';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30"
        onClick={onCancel}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative w-full max-w-md bg-[#FDFAF5] rounded-t-2xl p-6 border-t border-[#D4C4A8]"
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1 bg-[#D4C4A8] rounded-full" />
        </div>

        <h3 className="text-lg font-semibold text-[#3B2F1E] mb-2">
          {variant === 'send' ? 'Kirim Lamaran?' : 'Respons Lamaran'}
        </h3>
        
        <p className="text-sm text-[#6B5B45] mb-4">
          {variant === 'send' 
            ? `Anda akan mengirim lamaran ke ${targetName}. Lamaran hanya bisa dikirim satu kali.`
            : `Anda akan ${message ? 'menolak' : 'menerima'} lamaran dari ${targetName}.`
          }
        </p>

        <div className="mb-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-24 bg-[#EDE4D3] border border-[#D4C4A8] rounded-lg p-3 text-[#3B2F1E] placeholder:text-[#9C8B75] resize-none"
            placeholder={variant === 'send' ? 'Tulis pesan lamaran...' : 'Tulis pesan balasan (min 20 karakter)...'}
          />
          <p className={`text-xs mt-1 ${
            message.trim().length < 20 ? 'text-red-500' : 'text-[#4A7C59]'
          }`}>
            {message.trim().length}/20 karakter minimal
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2 px-4 rounded-lg border border-[#D4C4A8] text-[#6B5B45] hover:bg-[#EDE4D3] transition-all"
          >
            Batal
          </button>

          {variant === 'send' ? (
            <button
              onClick={handleConfirm}
              disabled={isLoading || message.trim().length < 20}
              className="flex-1 py-2 px-4 rounded-lg bg-[#4A7C59] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2E5239] transition-all"
            >
              {isLoading ? 'Mengirim...' : 'Kirim Lamaran'}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  if (message.trim().length >= 20) {
                    onConfirm(message);
                  }
                }}
                disabled={isLoading || message.trim().length < 20}
                className="flex-1 py-2 px-4 rounded-lg bg-red-100 text-red-600 border border-red-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-200 transition-all"
              >
                {isLoading ? 'Memproses...' : 'Tolak'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading || message.trim().length < 20}
                className="flex-1 py-2 px-4 rounded-lg bg-[#4A7C59] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2E5239] transition-all"
              >
                {isLoading ? 'Memproses...' : 'Terima'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}