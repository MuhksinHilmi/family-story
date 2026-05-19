# Product Requirements Document (PRD)
## Cerita Keluarga — Muslim Family Tree Platform
**Version:** 1.0  
**Date:** May 18, 2026  
**Status:** Draft
---
## 1. Executive Summary
**Cerita Keluarga** adalah platform website interaktif untuk mendaftarkan dan memvisualisasikan silsilah keluarga Muslim. Platform ini memungkinkan pengguna membuat pohon keluarga (family tree) berbasis node, mengundang anggota keluarga melalui email atau nomor telepon, menyimpan dokumen penting keluarga (Kartu Keluarga, KTP), dan berkomunikasi melalui fitur chat real-time antar anggota keluarga yang terdaftar.
---
## 2. Problem Statement
- Silsilah keluarga Muslim sulit didokumentasikan secara terstruktur dan visual
- Dokumen keluarga (KK, KTP, akta nikah) tersebar dan rentan hilang
- Komunikasi antar anggota keluarga besar tidak terpusat
- Tidak ada platform khusus yang mengakomodasi kebutuhan keluarga Muslim (nasab, garis keturunan ayah/ibu, gelar haji, dll)
---
## 3. Goals & Objectives
| # | Goal | Metric |
|---|------|--------|
| G1 | Membuat pohon keluarga interaktif yang mudah digunakan | User dapat membuat tree dalam < 5 menit |
| G2 | Mengundang anggota keluarga dengan mudah | Invite via email & SMS/WhatsApp |
| G3 | Menyimpan dokumen keluarga secara aman | Upload KK, KTP, akta dengan enkripsi |
| G4 | Chat real-time antar keluarga | Latensi pesan < 500ms |
| G5 | Mendukung struktur keluarga Muslim | Garis nasab, pasangan, anak, wali |
---
## 4. Target Users
| Persona | Deskripsi |
|---------|-----------|
| **Admin Keluarga** | Kepala keluarga / yang membuat tree, mengelola anggota & dokumen |
| **Anggota Keluarga** | Anggota yang di-invite, melihat tree, chat, upload dokumen |
| **Undangan (Pending)** | Orang yang belum register, menerima invite via email/SMS |
---
## 5. Tech Stack
| Layer | Technology | Keterangan |
|-------|------------|------------|
| **Frontend** | Next.js 15 (App Router) | SSR, API Routes, React Server Components |
| **Styling** | Tailwind CSS + shadcn/ui | UI components |
| **Visualization** | React Flow / D3.js | Interactive family tree nodes |
| **Backend API** | Next.js API Routes (Route Handlers) | RESTful API |
| **Primary Database** | PostgreSQL | Data user, keluarga, dokumen, relasi |
| **ORM** | Prisma / Drizzle | Type-safe database queries |
| **Realtime Chat** | Supabase (PostgreSQL + Realtime) | Pub/sub untuk chat |
| **Authentication** | Custom JWT Auth | Email + Phone OTP |
| **Document Storage** | VPS Local Storage (self-hosted) | FS storage saat deploy |
| **SMS Gateway** | (TBD) | Untuk invite via no telp |
| **Email Service** | Resend / Nodemailer | Untuk invite via email |
---
## 6. System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (SPA/SSR)            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ │  │
│  │  │ Family   │ │  Auth    │ │ Document│ │  Chat   │ │  │
│  │  │ Tree UI  │ │  Pages   │ │ Manager │ │  UI     │ │  │
│  │  └────┬────┘ └────┬─────┘ └───┬────┘ └────┬────┘ │  │
│  └───────┼───────────┼───────────┼────────────┼──────┘  │
└──────────┼───────────┼───────────┼────────────┼─────────┘
           │           │           │            │
           ▼           ▼           ▼            ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Backend)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ /api/    │ │ /api/    │ │ /api/    │ │ /api/      │ │
│  │ auth     │ │ family   │ │ document │ │ chat       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│       │             │            │              │        │
└───────┼─────────────┼────────────┼──────────────┼────────┘
        │             │            │              │
        ▼             ▼            ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  PostgreSQL  │ │PostgreSQL│ │   VPS    │ │   Supabase   │
│  (Primary)   │ │(Primary) │ │ Storage  │ │  Realtime    │
│              │ │          │ │(Docs KK, │ │  (Chat)      │
│  - Users     │ │- Family  │ │  KTP)    │ │              │
│  - Invites   │ │- Nodes   │ │          │ │  - Messages  │
│  - Documents │ │- Docs    │ │          │ │  - Presence  │
└──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```
---
## 7. Core Features
### 7.1 Authentication & Authorization
#### 7.1.1 Register
- Register dengan email + password
- Register dengan nomor telepon + OTP
- Validasi email (email verification link)
- Validasi phone (SMS OTP)
#### 7.1.2 Login
- Login dengan email + password
- Login dengan phone + OTP
- JWT token-based session
- Refresh token mechanism
#### 7.1.3 JWT Structure
```json
{
  "sub": "user_uuid",
  "email": "user@email.com",
  "phone": "+6281234567890",
  "family_id": "family_uuid",
  "role": "admin|member",
  "iat": 1716000000,
  "exp": 1716086400
}
```
#### 7.1.4 Roles
| Role | Permissions |
|------|-------------|
| **admin** | Kelola tree, invite/remove member, upload/hapus dokumen, kelola chat group |
| **member** | Lihat tree, upload dokumen pribadi, chat, edit profil sendiri |
---
### 7.2 Family Tree (Node-based)
#### 7.2.1 Node Structure
Setiap node merepresentasikan satu anggota keluarga:
```typescript
interface FamilyNode {
  id: string;
  family_id: string;
  user_id?: string;        // linked user account (nullable jika belum register)
  full_name: string;
  gender: 'male' | 'female';
  birth_date?: Date;
  death_date?: Date;
  photo_url?: string;
  
  // Muslim-specific fields
  is_haji: boolean;
  nasab_line: 'father' | 'mother';  // garis keturunan
  birth_order?: number;
  
  // Relations
  father_id?: string;      // parent node
  mother_id?: string;      // parent node
  spouse_ids: string[];    // bisa lebih dari 1 (poligami)
  children_ids: string[];
  
  // Positioning (untuk visualisasi)
  position_x: number;
  position_y: number;
  
  created_at: Date;
  updated_at: Date;
}
```
#### 7.2.2 Tree Visualization
- Interactive drag & drop nodes
- Zoom in/out
- Pan canvas
- Click node → detail modal
- Expand/collapse branches
- Color coding: laki-laki (biru), perempuan (pink), sudah meninggal (abu-abu)
- Badge haji (ka'bah icon) untuk yang sudah haji/umroh
#### 7.2.3 Tree Operations
- Add parent/child/spouse node
- Edit node details
- Delete node (dengan konfirmasi & cascade handling)
- Re-parent node (drag ke parent baru)
- Search & filter anggota
---
### 7.3 Invite System
#### 7.3.1 Invite via Email
- Admin input email target
- Sistem generate unique invite token
- Email dikirim dengan link registrasi + token
- Token expired dalam 7 hari
- Status invite: `pending` → `accepted` / `expired` / `revoked`
#### 7.3.2 Invite via Phone Number
- Admin input nomor telepon
- Sistem generate unique invite token
- SMS/WhatsApp dikirim dengan link + token
- Token expired dalam 7 hari
- Tracking status invite
#### 7.3.3 Invite Flow
```
Admin → Input email/phone → Generate token → Send invite
                                              ↓
Recipient → Click link → Register/Login → Auto-join family
                                              ↓
                                    Node linked to user account
```
---
### 7.4 Document Management
#### 7.4.1 Supported Documents
| Document Type | Description | Max Size |
|---------------|-------------|----------|
| Kartu Keluarga (KK) | Dokumen keluarga resmi | 10 MB |
| KTP | Kartu Tanda Penduduk | 5 MB |
| Akta Nikah | Dokumen pernikahan | 10 MB |
| Akta Kelahiran | Dokumen kelahiran | 10 MB |
| Lainnya | Dokumen keluarga lainnya | 10 MB |
#### 7.4.2 Document Structure
```typescript
interface Document {
  id: string;
  family_id: string;
  uploaded_by: string;      // user_id
  document_type: 'kk' | 'ktp' | 'akta_nikah' | 'akta_lahir' | 'lainnya';
  file_name: string;
  file_path: string;        // path di VPS storage
  file_size: number;
  mime_type: string;
  
  // Access control
  visibility: 'family' | 'admin_only';
  
  // Metadata
  description?: string;
  created_at: Date;
}
```
#### 7.4.3 Storage Architecture (VPS)
```
/storage
  /{family_id}
    /{document_type}
    /{uuid}_{original_filename}.ext
```
- File disimpan di VPS local filesystem
- Served via Next.js API route dengan auth check
- File access harus authenticated & authorized
- Support image preview untuk JPG/PNG
---
### 7.5 Chat System (Realtime via Supabase)
#### 7.5.1 Chat Structure
```typescript
interface ChatRoom {
  id: string;
  family_id: string;
  type: 'family_group' | 'private' | 'sub_group';
  name?: string;            // untuk group/sub_group
  created_by: string;
  created_at: Date;
}
interface ChatMessage {
  id: string;               // UUID
  room_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'document';
  file_url?: string;
  reply_to?: string;        // message_id
  created_at: Date;
}
interface ChatMember {
  room_id: string;
  user_id: string;
  joined_at: Date;
  last_read_at: Date;
}
```
#### 7.5.2 Realtime Features
- Realtime message delivery (Supabase Realtime)
- Online presence indicator
- Typing indicator
- Read receipts
- Unread message count
- Image/document sharing dalam chat
#### 7.5.3 Supabase Schema (Chat)
```sql
-- Enable realtime
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_presence REPLICA IDENTITY FULL;
-- Publications
CREATE PUBLICATION chat_realtime FOR TABLE chat_messages, chat_presence;
```
#### 7.5.4 Chat Flow
```
User A → Send message → API → Insert to Supabase
                                      ↓
                          Supabase Realtime broadcast
                                      ↓
User B (subscribed) ← Receive message ← WebSocket
```
---
## 8. API Specification
### 8.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register akun baru |
| POST | `/api/auth/login` | Login (email/password) |
| POST | `/api/auth/login/otp` | Login via phone OTP |
| POST | `/api/auth/otp/request` | Request OTP ke phone |
| POST | `/api/auth/otp/verify` | Verify OTP |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout (invalidate token) |
### 8.2 Family
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/family` | Buat keluarga baru |
| GET | `/api/family` | Get detail keluarga user |
| PUT | `/api/family` | Update info keluarga |
| GET | `/api/family/members` | Get semua anggota keluarga |
### 8.3 Family Tree Nodes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/family/tree` | Get seluruh tree structure |
| POST | `/api/family/tree/nodes` | Tambah node baru |
| PUT | `/api/family/tree/nodes/:id` | Update node |
| DELETE | `/api/family/tree/nodes/:id` | Hapus node |
| POST | `/api/family/tree/nodes/:id/link` | Link node ke user |
| PUT | `/api/family/tree/nodes/:id/position` | Update posisi node |
### 8.4 Invites
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invites` | Buat invite baru |
| GET | `/api/invites` | List semua invite |
| POST | `/api/invites/:token/accept` | Accept invite |
| DELETE | `/api/invites/:id` | Revoke invite |
### 8.5 Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents` | Upload dokumen |
| GET | `/api/documents` | List dokumen keluarga |
| GET | `/api/documents/:id` | Get detail dokumen |
| GET | `/api/documents/:id/download` | Download dokumen |
| DELETE | `/api/documents/:id` | Hapus dokumen |
### 8.6 Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/rooms` | Buat room chat baru |
| GET | `/api/chat/rooms` | List room user |
| GET | `/api/chat/rooms/:id/messages` | Get messages (paginated) |
| POST | `/api/chat/rooms/:id/messages` | Send message |
| PUT | `/api/chat/rooms/:id/read` | Mark as read |
---
## 9. Database Schema (PostgreSQL - Primary)
### 9.1 Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
### 9.2 Families
```sql
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
### 9.3 Family Members
```sql
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);
```
### 9.4 Family Tree Nodes
```sql
CREATE TABLE tree_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  death_date DATE,
  photo_url VARCHAR(500),
  is_haji BOOLEAN DEFAULT FALSE,
  nasab_line VARCHAR(10) CHECK (nasab_line IN ('father', 'mother')),
  birth_order INTEGER,
  father_id UUID REFERENCES tree_nodes(id),
  mother_id UUID REFERENCES tree_nodes(id),
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
### 9.5 Spouse Relations
```sql
CREATE TABLE spouse_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  node_a UUID REFERENCES tree_nodes(id),
  node_b UUID REFERENCES tree_nodes(id),
  marriage_date DATE,
  marriage_location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (node_a != node_b)
);
```
### 9.6 Invites
```sql
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```
### 9.7 Documents
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100),
  visibility VARCHAR(20) DEFAULT 'family',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```
---
## 10. Database Schema (Supabase - Chat)
```sql
-- Chat Rooms
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('family_group', 'private', 'sub_group')),
  name VARCHAR(255),
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Chat Members
CREATE TABLE chat_members (
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  last_read_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
-- Chat Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'document')),
  file_url VARCHAR(500),
  reply_to UUID REFERENCES chat_messages(id),
  created_at TIMESTAMP DEFAULT NOW()
);
-- Indexes
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
-- Enable Realtime
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_members REPLICA IDENTITY FULL;
CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages, chat_members;
```
---
## 11. Project Structure
```
cerita-keluarga/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   └── verify-phone/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tree/page.tsx         # Family tree visualization
│   │   │   ├── members/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── chat/page.tsx
│   │   │   ├── chat/[roomId]/page.tsx
│   │   │   ├── invites/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── invite/[token]/page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── login/route.ts
│   │   │   │   └── otp/
│   │   │   │       ├── request/route.ts
│   │   │   │       └── verify/route.ts
│   │   │   ├── family/
│   │   │   │   ├── route.ts
│   │   │   │   ├── members/route.ts
│   │   │   │   └── tree/
│   │   │   │       ├── route.ts
│   │   │   │       └── nodes/[id]/route.ts
│   │   │   ├── invites/
│   │   │   │   ├── route.ts
│   │   │   │   └── [token]/accept/route.ts
│   │   │   ├── documents/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   └── chat/
│   │   │       ├── rooms/route.ts
│   │   │       └── rooms/[id]/
│   │   │           ├── messages/route.ts
│   │   │           └── read/route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   ├── components/
│   │   ├── auth/
│   │   ├── tree/
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── invites/
│   │   └── shared/
│   ├── lib/
│   │   ├── db.ts                     # PostgreSQL connection
│   │   ├── supabase.ts               # Supabase client
│   │   ├── jwt.ts                    # JWT utilities
│   │   ├── storage.ts                # VPS storage utilities
│   │   └── email.ts                  # Email service
│   ├── middleware.ts                 # Auth middleware
│   └── types/
├── prisma/
│   └── schema.prisma
├── public/
├── storage/                          # VPS storage (gitignored)
├── .env.local
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```
---
## 12. User Flows
### 12.1 Create Family & Tree
```
1. User register/login
2. Create new family → auto jadi admin
3. Add first node (diri sendiri) → auto linked ke user
4. Add parents, spouse, children nodes
5. Drag & drop untuk arrange posisi
6. Invite anggota keluarga lainnya
```
### 12.2 Accept Invite
```
1. User receive email/SMS dengan link invite
2. Click link → redirect ke /invite/[token]
3. Jika belum punya akun → flow register
4. Jika sudah punya akun → login
5. Auto join family & linked ke node yang sesuai
6. Redirect ke dashboard/tree
```
### 12.3 Upload Document
```
1. Navigate ke Documents page
2. Click "Upload Document"
3. Pilih tipe dokumen (KK, KTP, dll)
4. Select file dari device
5. Upload → file disimpan di VPS storage
6. Metadata saved ke PostgreSQL
7. Document muncul di list, bisa di-preview/download
```
### 12.4 Chat
```
1. Navigate ke Chat page
2. Auto join family_group room
3. Bisa buat private chat / sub group
4. Ketik pesan → send
5. Message stored di Supabase
6. Realtime broadcast ke member lain yang online
7. Typing indicator & presence update
```
---
## 13. Security Considerations
| Area | Implementation |
|------|----------------|
| **Authentication** | JWT dengan expiry, refresh token rotation, bcrypt password hashing |
| **Authorization** | Role-based access control (RBAC), family-scoped data isolation |
| **Document Access** | File served via API route, auth check sebelum serve |
| **Data Isolation** | Semua query scoped by `family_id` |
| **Input Validation** | Zod schema validation di semua API endpoints |
| **Rate Limiting** | API rate limiting untuk login, OTP, upload |
| **File Upload** | File type validation, size limit, rename file |
---
## 14. Non-Functional Requirements
| Requirement | Target |
|-------------|--------|
| **Page Load Time** | < 2s (LCP) |
| **API Response Time** | < 300ms (p95) |
| **Chat Latency** | < 500ms (realtime) |
| **Max Family Size** | 500+ members |
| **Max Tree Nodes** | 1000+ nodes |
| **File Upload Size** | Max 10 MB per file |
| **Concurrent Chat Users** | 100+ per family |
| **Mobile Responsive** | Yes (all pages) |
---
## 15. Development Phases
### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Database schema setup (PostgreSQL + Prisma/Drizzle)
- [ ] Authentication system (JWT, register, login, OTP)
- [ ] Basic layout & navigation
- [ ] Middleware for auth protection
### Phase 2: Family Tree (Week 3-4)
- [ ] Family CRUD
- [ ] Tree node CRUD
- [ ] Interactive tree visualization (React Flow)
- [ ] Node detail modal
- [ ] Spouse & parent-child relations
### Phase 3: Invite System (Week 5)
- [ ] Invite generation (email & phone)
- [ ] Email service integration
- [ ] SMS gateway integration
- [ ] Accept invite flow
- [ ] Auto-link node to user
### Phase 4: Document Management (Week 6)
- [ ] Upload endpoint
- [ ] VPS storage integration
- [ ] Document list & preview
- [ ] Download with auth check
- [ ] Access control (visibility)
### Phase 5: Chat System (Week 7-8)
- [ ] Supabase setup
- [ ] Chat room CRUD
- [ ] Message send/receive (REST)
- [ ] Realtime subscription
- [ ] Presence & typing indicator
- [ ] Chat UI
### Phase 6: Polish & Launch (Week 9-10)
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Error handling & edge cases
- [ ] Testing (unit + integration)
- [ ] Deployment setup (VPS)
- [ ] Documentation
---
## 16. Future Enhancements (Post-MVP)
- [ ] **Nasab Tracing** — Visualisasi garis nasab ke atas (ayah, kakek, dst)
- [ ] **Family Timeline** — Timeline events keluarga
- [ ] **Photo Gallery** — Album foto keluarga shared
- [ ] **Calendar** — Kalender events keluarga (ulang tahun, haul, dll)
- [ ] **Doa & Dzikir** — Fitur shared doa untuk anggota yang meninggal
- [ ] **Export Tree** — Export tree sebagai PDF/image
- [ ] **Multi-Family** — User bisa belong to multiple families
- [ ] **Mobile App** — React Native / Flutter app
- [ ] **Push Notification** — Untuk invite, chat, events
---
## 17. Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cerita_keluarga
# Supabase (Chat)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# JWT
JWT_SECRET=
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@ceritakeluarga.com
# SMS (TBD)
SMS_API_KEY=
# Storage
STORAGE_PATH=/var/www/cerita-keluarga/storage
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
---
## 18. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| VPS storage penuh | High | Implement quota, cleanup, monitoring |
| Supabase downtime | Medium | Fallback ke polling |
| Scale tree besar (>500 nodes) | Medium | Virtual rendering, lazy load |
| Data privacy breach | Critical | Encryption, audit logs, strict RBAC |
| Invite token leak | Medium | Short expiry, single-use, revoke |
---
## 19. Success Metrics
| Metric | Target |
|--------|--------|
| User dapat membuat family tree pertama | < 5 menit |
| Invite acceptance rate | > 60% |
| Chat message delivery | < 500ms latency |
| Document upload success rate | > 99% |
| User retention (7-day) | > 40% |
---
*End of PRD*
Thinking: PRD sudah dibuat. Sekarang saya perlu memberikan ringkasan kepada user tentang apa yang sudah dibuat.
PRD sudah dibuat di ~/.local/share/opencode/plans/PRD-cerita-keluarga.md.
Ringkasan isi PRD:
Cerita Keluarga — Muslim Family Tree Platform dengan fitur:
1. Auth — Custom JWT (email/password + phone OTP)
2. Family Tree — Node interaktif (drag & drop, zoom, expand/collapse) dengan field Muslim (is_haji, nasab_line, support poligami)
3. Invite System — Via email atau no telp dengan token unik (expired 7 hari)
4. Document Management — Upload KK, KTP, akta ke VPS storage, served via API dengan auth
5. Chat Realtime — Supabase Realtime untuk pesan, presence, typing indicator
Tech Stack:
- Next.js 15 (App Router) + Tailwind + shadcn/ui
- PostgreSQL (Prisma/Drizzle) untuk data utama
- Supabase untuk chat realtime
- VPS local storage untuk dokumen
19 sections mencakup: architecture, API spec, DB schema (PostgreSQL + Supabase), project structure, user flows, security, timeline 10 minggu (6 phases), dan future enhancements.
