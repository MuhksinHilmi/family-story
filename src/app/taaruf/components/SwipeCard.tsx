"use client";

import { motion } from 'framer-motion';
import { X, Heart, Send } from 'lucide-react';

interface SwipeCardProps {
  profile: {
    full_name: string;
    age?: number;
    occupation?: string;
    location?: string;
    about_me?: string;
    interests?: string[];
    photo_url?: string;
    cover_photo?: string;
  };
  application?: {
    message: string;
  };
  mode: 'browse' | 'review';
  onAccept: () => void;
  onReject: () => void;
}

export default function SwipeCard({ profile, application, mode, onAccept, onReject }: SwipeCardProps) {
  const getInitials = (name: string) => {
    return name?.charAt(0) || '?';
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-[500px] bg-[#FDFAF5] rounded-xl overflow-hidden border border-[#D4C4A8]">
      {/* Background */}
      {profile.cover_photo ? (
        <img
          src={profile.cover_photo}
          alt="cover"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#4A7C59] to-[#2E5239]" />
      )}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h2 className="text-2xl font-bold">{profile.full_name}</h2>
        <p className="text-white/80">
          {profile.age ? `${profile.age} tahun` : ''} 
          {profile.age && profile.location && ' • '}
          {profile.location}
        </p>
        {profile.occupation && (
          <p className="text-white/70 text-sm mt-1">{profile.occupation}</p>
        )}
        
        {/* Interest chips */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.interests.slice(0, 4).map(interest => (
              <span key={interest} className="px-2 py-1 bg-white/20 rounded-full text-xs">
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Application message in review mode */}
        {mode === 'review' && application?.message && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg backdrop-blur">
            <p className="text-xs font-semibold mb-1">Pesan Lamaran:</p>
            <p className="text-sm">{application.message}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-8">
        <button
          onClick={onReject}
          className="w-14 h-14 rounded-full border-2 border-red-400 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          aria-label={mode === 'browse' ? 'Lewati' : 'Tolak'}
        >
          <X className="w-6 h-6 text-red-400" />
        </button>

        <button
          onClick={onAccept}
          className="w-14 h-14 rounded-full border-2 border-green-400 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          aria-label={mode === 'browse' ? 'Lamar' : 'Terima'}
        >
          <Heart className="w-6 h-6 text-green-400" />
        </button>
      </div>

      {/* Action labels */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-12 text-xs text-[#9C8B75]">
        <span>{mode === 'browse' ? 'Lewati' : 'Tolak'}</span>
        <span>{mode === 'browse' ? 'Lamar' : 'Terima'}</span>
      </div>
    </div>
  );
}