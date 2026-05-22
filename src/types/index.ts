export interface User {
  id: string;
  email?: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  photo_url?: string;
  gender?: 'male' | 'female';
  birth_date?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  activation_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id?: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: User;
}

export interface FamilyNodeData extends Record<string, unknown> {
  id: string;
  family_id: string;
  user_id?: string | null;
  full_name: string;
  gender: 'male' | 'female';
  birth_date?: string;
  death_date?: string;
  photo_url?: string;
  is_alive: boolean;
  nasab_line?: string;
  birth_order?: number;
  father_id?: string;
  mother_id?: string;
  spouse_ids: string[];
  children_ids: string[];
  position_x: number;
  position_y: number;
  invitation_email?: string;
  invitation_status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface SpouseRelation {
  id: string;
  family_id: string;
  node_a: string;
  node_b: string;
  marriage_date?: string;
  marriage_location?: string;
  created_at: string;
}

export interface Invite {
  id: string;
  family_id: string;
  email?: string;
  phone?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by?: string;
  expires_at: string;
  created_at: string;
}

export interface Document {
  id: string;
  family_id: string;
  uploaded_by: string;
  document_type: 'kk' | 'ktp' | 'akta_nikah' | 'akta_lahir' | 'lainnya';
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  visibility: 'family' | 'admin_only';
  description?: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  family_id: string;
  type: 'family_group' | 'private' | 'sub_group';
  name?: string;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_photo?: string;   // profile photo URL of sender (from snapshot)
  content: string | Record<string, unknown>;
  type: 'text' | 'image' | 'document';
  file_url?: string;
  reply_to?: string;
  created_at: string;
}

export interface UserFamily {
  user_id: string;
  family_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  family?: Family;
}

export interface AuthState {
  user: User | null;
  family: Family | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}