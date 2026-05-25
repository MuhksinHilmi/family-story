-- =============================================================================
-- SEED TEST FAMILY DATA
-- =============================================================================
-- Keluarga simulasi untuk testing snapshot keluarga inti (father-centric)
--
-- Struktur:
-- - Kharis + Liliya (pasangan + orang tua)
-- - Anak: Muhksin dan Fauzi
-- - Muhksin + Avida
-- - Fauzi + Dian
--
-- Catatan: Father (Kharis) adalah patokan utama untuk active nuclear family.
-- =============================================================================

-- Bersihkan data sebelumnya (hanya untuk seed ini, aman karena DB baru)
TRUNCATE TABLE 
    node_active_nuclear_viewers,
    parent_child_relations,
    marriages,
    nodes,
    users
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 1. USERS
-- ============================================================================
INSERT INTO users (full_name, email, gender, is_email_verified, activation_status, created_at, updated_at) VALUES
('Kharis', 'kharis@example.com', 'male', true, 'active', NOW(), NOW()),
('Liliya', 'liliya@example.com', 'female', true, 'active', NOW(), NOW()),
('Muhksin', 'muhksin@example.com', 'male', true, 'active', NOW(), NOW()),
('Avida', 'avida@example.com', 'female', true, 'active', NOW(), NOW()),
('Fauzi', 'fauzi@example.com', 'male', true, 'active', NOW(), NOW()),
('Dian', 'dian@example.com', 'female', true, 'active', NOW(), NOW());

-- ============================================================================
-- 2. NODES
-- ============================================================================
INSERT INTO nodes (user_id, full_name, gender, is_alive, created_at, updated_at) 
SELECT id, full_name, gender, true, NOW(), NOW() FROM users 
WHERE email IN ('kharis@example.com', 'liliya@example.com', 'muhksin@example.com', 
                'avida@example.com', 'fauzi@example.com', 'dian@example.com');

-- ============================================================================
-- 3. MARRIAGES
-- ============================================================================

-- Kharis + Liliya
INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Kharis'),
    (SELECT id FROM nodes WHERE full_name = 'Liliya'),
    'married', NOW(), NOW();

-- Muhksin + Avida
INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Muhksin'),
    (SELECT id FROM nodes WHERE full_name = 'Avida'),
    'married', NOW(), NOW();

-- Fauzi + Dian
INSERT INTO marriages (husband_node_id, wife_node_id, status, created_at, updated_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Fauzi'),
    (SELECT id FROM nodes WHERE full_name = 'Dian'),
    'married', NOW(), NOW();

-- ============================================================================
-- 4. PARENT-CHILD RELATIONS
-- ============================================================================

-- Kharis sebagai ayah
INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Kharis'),
    (SELECT id FROM nodes WHERE full_name = 'Muhksin'),
    'father', NOW();

INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Kharis'),
    (SELECT id FROM nodes WHERE full_name = 'Fauzi'),
    'father', NOW();

-- Liliya sebagai ibu
INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Liliya'),
    (SELECT id FROM nodes WHERE full_name = 'Muhksin'),
    'mother', NOW();

INSERT INTO parent_child_relations (parent_node_id, child_node_id, parent_type, created_at)
SELECT 
    (SELECT id FROM nodes WHERE full_name = 'Liliya'),
    (SELECT id FROM nodes WHERE full_name = 'Fauzi'),
    'mother', NOW();

-- ============================================================================
-- 5. REBUILD NUCLEAR FAMILY SNAPSHOTS (Father-centric)
-- ============================================================================
-- Panggil fungsi untuk membangun active nuclear viewers
SELECT rebuild_active_nuclear_viewers((SELECT id FROM nodes WHERE full_name = 'Kharis'));
SELECT rebuild_active_nuclear_viewers((SELECT id FROM nodes WHERE full_name = 'Muhksin'));
SELECT rebuild_active_nuclear_viewers((SELECT id FROM nodes WHERE full_name = 'Fauzi'));

-- ============================================================================
-- 6. VERIFIKASI
-- ============================================================================

\echo '=== USERS & NODES ==='
SELECT u.full_name, u.email, n.id as node_id, n.gender 
FROM users u 
JOIN nodes n ON n.user_id = u.id 
ORDER BY n.id;

\echo ''
\echo '=== MARRIAGES ==='
SELECT 
    h.full_name as husband, 
    w.full_name as wife, 
    m.status
FROM marriages m
JOIN nodes h ON h.id = m.husband_node_id
JOIN nodes w ON w.id = m.wife_node_id;

\echo ''
\echo '=== PARENT-CHILD RELATIONS ==='
SELECT 
    p.full_name as parent, 
    c.full_name as child, 
    pcr.parent_type
FROM parent_child_relations pcr
JOIN nodes p ON p.id = pcr.parent_node_id
JOIN nodes c ON c.id = pcr.child_node_id
ORDER BY p.id, pcr.parent_type;

\echo ''
\echo '=== NODE ACTIVE NUCLEAR VIEWERS (Snapshot Keluarga Inti) ==='
SELECT 
    n.full_name as node,
    v.full_name as viewer,
    'can see nuclear posts of ' || n.full_name as description
FROM node_active_nuclear_viewers nav
JOIN nodes n ON n.id = nav.node_id
JOIN nodes v ON v.id = nav.viewer_node_id
ORDER BY n.id, v.id;

\echo ''
\echo '=== SEED SELESAI ==='
\echo 'Keluarga simulasi berhasil dibuat.'
\echo 'Silakan test undangan relasi anak/orang tua untuk memverifikasi trigger snapshot.'