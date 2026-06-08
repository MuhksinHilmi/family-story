"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTaaruf } from './hooks/useTaaruf';
import TaarufProfileForm from './components/TaarufProfileForm';
import SwipeDeck from './components/SwipeDeck';
import WaitingScreen from './components/WaitingScreen';
import EmptyInbox from './components/EmptyInbox';
import MatchedChatRoom from './components/MatchedChatRoom';
import { Heart } from 'lucide-react';
import { ToastContainer } from '@/components/ui/toast';

export default function TaarufPage() {
  const router = useRouter();
  const { status, isLoading } = useTaaruf();

  useEffect(() => {
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8]">
        <div className="text-[#6B5B45]">Memuat...</div>
      </div>
    );
  }

  // Show spouse info for users who already have spouse
  if (status?.has_spouse && status.spouse) {
    const { partner_name, partner_photo, marriage_date } = status.spouse;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F0E8] p-4">
        <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#D6EAD9]">
            {partner_photo ? (
              <img src={partner_photo} alt={partner_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#D6EAD9] flex items-center justify-center">
                <Heart className="w-10 h-10 text-[#4A7C59]" />
              </div>
            )}
          </div>
          
          <h2 className="text-xl font-bold text-[#3B2F1E] mb-2">Status Ta'aruf</h2>
          
          <p className="text-[#6B5B45] mb-4">
            Anda sudah terhubung dengan {partner_name}
          </p>
          
          {marriage_date && (
            <div className="bg-[#EDE4D3] rounded-lg p-3 mb-4">
              <p className="text-sm text-[#9C8B75]">Tanggal Menikah</p>
              <p className="text-[#3B2F1E] font-medium">
                {new Date(marriage_date).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          
          <p className="text-sm text-[#9C8B75]">
            Fitur ta'aruf hanya tersedia bagi yang belum memiliki spouse.
          </p>
        </div>
      </div>
    );
  }

  function isProfileComplete(profile: any): boolean {
    return profile &&
      profile.location && profile.location.trim() !== '' &&
      profile.education_level && profile.education_level.trim() !== '' &&
      profile.occupation && profile.occupation.trim() !== '' &&
      profile.interests && profile.interests.length > 0;
  }

  if (!status?.my_profile || !isProfileComplete(status.my_profile)) {
    return (
      <>
        <TaarufProfileForm />
        <ToastContainer />
      </>
    );
  }

  if (!status?.gender) {
    return (
      <>
        <TaarufProfileForm />
        <ToastContainer />
      </>
    );
  }

  if (status.gender === 'male') {
    if (status.matched_room) {
      return (
        <>
          <MatchedChatRoom room={status.matched_room} />
          <ToastContainer />
        </>
      );
    }

    if (status.outgoing_application?.status === 'pending') {
      return (
        <>
          <WaitingScreen application={status.outgoing_application} />
          <ToastContainer />
        </>
      );
    }

    return (
      <>
        <SwipeDeck
          mode="browse"
          profiles={status.available_profiles || []}
        />
        <ToastContainer />
      </>
    );
  }

  if (!status.gender || status.gender === 'female') {
    if (status.matched_room) {
      return (
        <>
          <MatchedChatRoom room={status.matched_room} />
          <ToastContainer />
        </>
      );
    }

    if (status.incoming_applications && status.incoming_applications.length > 0) {
      return (
        <>
          <SwipeDeck
            mode="review"
            applications={status.incoming_applications}
          />
          <ToastContainer />
        </>
      );
    }

    return (
      <>
        <EmptyInbox />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <ToastContainer />
    </>
  );
}