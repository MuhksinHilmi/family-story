"use client";

import { useState, useCallback } from 'react';
import { IconHeart, IconUsers, IconHeartHandshake } from '@tabler/icons-react';
import SwipeCard from './SwipeCard';
import ConfirmSheet from './ConfirmSheet';
import { useTaaruf } from '../hooks/useTaaruf';

interface SwipeDeckProps {
  mode: 'browse' | 'review';
  profiles?: any[];
  applications?: any[];
}

function EmptyState({ mode }: { mode: 'browse' | 'review' }) {
  const messages = {
    browse: {
      icon: IconUsers,
      title: 'Belum Ada Profil Wanita',
      description: 'Saat ini belum ada profil wanita yang tersedia untuk ditampilkan. Profil yang ditampilkan sudah melalui proses verifikasi agar sesuai dengan standar Ta\'aruf.',
      hint: 'Coba kembali nanti atau hubungi admin jika ada pertanyaan.'
    },
    review: {
      icon: IconHeartHandshake,
      title: 'Belum Ada Lamaran Masuk',
      description: 'Anda belum menerima lamaran Ta\'aruf dari pria mana pun. Ketika ada yang melamar, profil mereka akan muncul di sini.',
      hint: 'Yuk, teruskan berwawasan dan berpegian untuk menunggu yang tepat.'
    }
  };

  const { icon: Icon, title, description, hint } = messages[mode];

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8] px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D6EAD9] flex items-center justify-center">
          <Icon className="w-10 h-10 text-[#4A7C59]" />
        </div>
        <h2 className="text-xl font-bold text-[#3B2F1E] mb-3">{title}</h2>
        <p className="text-[#6B5B45] mb-4 leading-relaxed">{description}</p>
        <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-xl p-4">
          <p className="text-[11px] text-[#9C8B75] italic">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function SwipeDeck({ mode, profiles = [], applications = [] }: SwipeDeckProps) {
  const { sendApplication, respondApplication, refreshStatus } = useTaaruf();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentAction, setCurrentAction] = useState<'send' | 'accept' | 'reject'>('send');
  const [currentTarget, setCurrentTarget] = useState<any>(null);

  const handleAction = (action: 'send' | 'accept' | 'reject') => {
    const target = mode === 'browse' ? profiles[currentIndex] : applications[currentIndex];
    setCurrentTarget(target);
    setCurrentAction(action);
    setShowConfirm(true);
  };

  const handleConfirm = async (message: string) => {
    if (mode === 'browse' && currentTarget) {
      await sendApplication(currentTarget.id, message);
    } else if (mode === 'review' && currentTarget) {
      await respondApplication(
        currentTarget.id, 
        currentAction as 'accept' | 'reject', 
        message
      );
    }
    
    setShowConfirm(false);
    refreshStatus();
    setCurrentIndex(0);
  };

  const handleSkip = () => {
    if (currentIndex < (mode === 'browse' ? profiles.length : applications.length) - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const targetList = mode === 'browse' ? profiles : applications;
  const currentItem = targetList[currentIndex];

  if (!currentItem) {
    return <EmptyState mode={mode} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <SwipeCard
        profile={currentItem}
        application={mode === 'review' ? currentItem : undefined}
        mode={mode}
        onAccept={() => handleAction(mode === 'browse' ? 'send' : 'accept')}
        onReject={() => handleAction(mode === 'browse' ? 'send' : 'reject')}
      />

      <ConfirmSheet
        isOpen={showConfirm}
        variant={mode === 'browse' ? 'send' : 'accept-reject'}
        targetProfile={currentTarget}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}