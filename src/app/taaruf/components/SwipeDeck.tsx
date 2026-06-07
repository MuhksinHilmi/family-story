"use client";

import { useState, useCallback } from 'react';
import SwipeCard from './SwipeCard';
import ConfirmSheet from './ConfirmSheet';
import { useTaaruf } from '../hooks/useTaaruf';

interface SwipeDeckProps {
  mode: 'browse' | 'review';
  profiles?: any[];
  applications?: any[];
  onSendApplication?: (profileId: number, message: string) => void;
  onRespondApplication?: (applicationId: number, action: 'accept' | 'reject', message: string) => void;
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
    setCurrentIndex(0); // Reset to start of new list after action
  };

  const handleSkip = () => {
    if (currentIndex < (mode === 'browse' ? profiles.length : applications.length) - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const targetList = mode === 'browse' ? profiles : applications;
  const currentItem = targetList[currentIndex];

  if (!currentItem) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8]">
        <p className="text-[#6B5B45]">Tidak ada profil lainnya</p>
      </div>
    );
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