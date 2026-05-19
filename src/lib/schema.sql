-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  gender VARCHAR(10),
  birth_date DATE,
  is_email_verified BOOLEAN DEFAULT false,
  is_phone_verified BOOLEAN DEFAULT false,
  otp VARCHAR(6),
  otp_expires_at TIMESTAMP,
  activation_token VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create families table
CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Create family_nodes table (tree nodes)
CREATE TABLE IF NOT EXISTS family_nodes (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  death_date DATE,
  photo_url TEXT,
  is_alive BOOLEAN DEFAULT true,
  nasab_line VARCHAR(10) CHECK (nasab_line IN ('father', 'mother')),
  birth_order INTEGER,
  father_id INTEGER REFERENCES family_nodes(id) ON DELETE SET NULL,
  mother_id INTEGER REFERENCES family_nodes(id) ON DELETE SET NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  invitation_email VARCHAR(255),
  invitation_status VARCHAR(20) DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create spouse_relations table
CREATE TABLE IF NOT EXISTS spouse_relations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  node_a INTEGER REFERENCES family_nodes(id) ON DELETE CASCADE,
  node_b INTEGER REFERENCES family_nodes(id) ON DELETE CASCADE,
  marriage_date DATE,
  marriage_location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(node_a, node_b)
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_family_nodes_family_id ON family_nodes(family_id);
CREATE INDEX IF NOT EXISTS idx_family_nodes_user_id ON family_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_family_nodes_invitation_email ON family_nodes(invitation_email);
CREATE INDEX IF NOT EXISTS idx_spouse_relations_family_id ON spouse_relations(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_family_id ON invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);