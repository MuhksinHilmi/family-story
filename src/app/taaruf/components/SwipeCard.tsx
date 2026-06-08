"use client";

import { X, Heart } from "lucide-react";

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
  mode: "browse" | "review";
  onAccept: () => void;
  onReject: () => void;
}

export default function SwipeCard({
  profile,
  application,
  mode,
  onAccept,
  onReject,
}: SwipeCardProps) {
  return (
    // Wrapper: card + buttons stacked vertically
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {/* === CARD === */}
      <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-[#D4C4A8] shadow-lg">
        {/* Background - use cover_photo first, then photo_url as fallback */}
        {profile.cover_photo ? (
          <img
            src={profile.cover_photo}
            alt="cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : profile.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.full_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#4A7C59] to-[#2E5239]" />
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Content: pinned to bottom of card */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h2 className="text-2xl font-bold leading-tight">
            {profile.full_name}
          </h2>

          <p className="text-white/80 text-sm mt-1">
            {profile.age ? `${profile.age} tahun` : ""}
            {profile.age && profile.location ? " · " : ""}
            {profile.location}
          </p>

          {profile.occupation && (
            <p className="text-white/65 text-sm mt-0.5">{profile.occupation}</p>
          )}

          {/* About me */}
          {profile.about_me && (
            <p className="text-white/90 text-sm mt-2 line-clamp-3">{profile.about_me}</p>
          )}

          {/* Interest chips */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.interests.slice(0, 4).map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {/* Application message — review mode only */}
          {mode === "review" && application?.message && (
            <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60 mb-1">
                Pesan Lamaran
              </p>
              <p className="text-sm leading-relaxed">{application.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* === ACTION BUTTONS — outside the card === */}
      <div className="flex items-center justify-center gap-10">
        {/* Reject / Skip */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onReject}
            className="w-14 h-14 rounded-full border-2 border-red-400 bg-white flex items-center justify-center shadow-md hover:bg-red-50 hover:scale-105 active:scale-95 transition-all duration-150"
            aria-label={mode === "browse" ? "Lewati" : "Tolak"}
          >
            <X className="w-6 h-6 text-red-400" />
          </button>
          <span className="text-xs text-[#9C8B75] font-medium">
            {mode === "browse" ? "Lewati" : "Tolak"}
          </span>
        </div>

        {/* Accept / Apply */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAccept}
            className="w-14 h-14 rounded-full border-2 border-[#4A7C59] bg-white flex items-center justify-center shadow-md hover:bg-[#D6EAD9] hover:scale-105 active:scale-95 transition-all duration-150"
            aria-label={mode === "browse" ? "Lamar" : "Terima"}
          >
            <Heart className="w-6 h-6 text-[#4A7C59]" />
          </button>
          <span className="text-xs text-[#9C8B75] font-medium">
            {mode === "browse" ? "Lamar" : "Terima"}
          </span>
        </div>
      </div>
    </div>
  );
}