import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

interface TaarufProfile {
  id: number;
  full_name: string;
  age: number;
  location: string;
  education_level: string;
  occupation: string;
  about_me: string;
  interests: string[];
  photo_url?: string;
  cover_photo?: string;
  status: 'draft' | 'active' | 'matched' | 'closed' | 'hidden';
  criteria?: {
    age_min?: number;
    age_max?: number;
    preferred_education?: string[];
    preferred_location?: string;
    preferred_marital_status?: string;
  };
}

interface Application {
  id: number;
  sender_profile_id: number;
  recipient_profile_id: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  responded_at?: string;
  chat_room_id?: string;
  sender_name?: string;
  sender_occupation?: string;
  sender_location?: string;
  sender_interests?: string[];
  sender_about?: string;
  recipient_name?: string;
}

interface TaarufStatus {
  has_spouse: boolean;
  spouse: {
    full_name: string;
    partner_name: string;
    partner_photo?: string;
    marriage_date?: string;
  } | null;
  my_profile: TaarufProfile | null;
  gender: 'male' | 'female';
  outgoing_application: Application | null;
  incoming_applications: Application[];
  matched_room: { id: string; name: string } | null;
  available_profiles: TaarufProfile[];
}

export function useTaaruf() {
  const [status, setStatus] = useState<TaarufStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch('/api/taaruf');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Gagal mengambil status ta\'aruf');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const updateProfile = useCallback(async (data: Partial<TaarufProfile & { criteria?: any; letter?: any }>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch('/api/taaruf', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        await fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Gagal menyimpan profil');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const sendApplication = useCallback(async (recipientProfileId: number, message: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch('/api/taaruf/applications', {
        method: 'POST',
        body: JSON.stringify({ recipient_profile_id: recipientProfileId, message }),
      });
      
      if (res.ok) {
        await fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Gagal mengirim lamaran');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const respondApplication = useCallback(async (applicationId: number, action: 'accept' | 'reject', response_message: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch(`/api/taaruf/applications/${applicationId}`, {
        method: 'PUT',
        body: JSON.stringify({ action, response_message }),
      });
      
      if (res.ok) {
        await fetchStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Gagal memproses respons lamaran');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const refreshStatus = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    updateProfile,
    sendApplication,
    respondApplication,
    refreshStatus,
  };
}