import { getOrCreateGeneralRoomForExtendedGroup, getOrCreateSmallRoom } from '@/lib/db_helper/chat';

/**
 * Helper: Get nuclear family UUID and husband's user UUID for small room creation
 */
async function getSmallRoomInfo(client: any, husbandNodeId: number): Promise<{ familyUuid: string | null; husbandUserUuid: string | null; husbandName: string | null }> {
  const res = await client.query(
    `SELECT nf.uuid as family_uuid, n.uuid as node_uuid, n.full_name as husband_name
     FROM nodes n
     LEFT JOIN nuclear_families nf ON nf.id = n.current_nuclear_family_id
     WHERE n.id = $1`,
    [husbandNodeId]
  );
  if (res.rows[0]) {
    return {
      familyUuid: res.rows[0].family_uuid,
      husbandUserUuid: res.rows[0].node_uuid,
      husbandName: res.rows[0].husband_name,
    };
  }
  return { familyUuid: null, husbandUserUuid: null, husbandName: null };
}

/**
 * Extended Family Groups Helper
 *
 * Tujuan: Mendukung model multi-group untuk Extended Family.
 * Satu node bisa memiliki beberapa extended_group_id.
 *
 * Ini memudahkan:
 * - Merging otomatis saat pernikahan
 * - Loading jaringan keluarga besar di tree
 * - Visibility feed keluarga besar
 */

export interface ExtendedGroup {
  id: number;
}

/**
 * Sinkronisasi kolom cache extended_group_ids di tabel nodes
 * berdasarkan data terkini di junction table node_extended_groups.
 * 
 * Dipanggil otomatis setelah setiap perubahan grup untuk menjaga konsistensi.
 */
export async function syncNodeExtendedGroupCache(
  client: any, 
  nodeId: number
): Promise<void> {
  await client.query(
    `UPDATE nodes 
     SET extended_group_ids = COALESCE((
       SELECT ARRAY_AGG(extended_group_id ORDER BY extended_group_id)
       FROM node_extended_groups 
       WHERE node_id = $1
     ), '{}'),
     updated_at = NOW()
     WHERE id = $1`,
    [nodeId]
  );
}

/**
 * Mengambil semua extended group yang dimiliki oleh sebuah node.
 */
export async function getNodeExtendedGroups(
  client: any,
  nodeId: number
): Promise<number[]> {
  const res = await client.query(
    `SELECT extended_group_id 
     FROM node_extended_groups 
     WHERE node_id = $1`,
    [nodeId]
  );

  return res.rows.map((row: any) => row.extended_group_id);
}

/**
 * Menambahkan node ke beberapa extended group sekaligus.
 * Hanya menambahkan jika belum ada (idempotent).
 */
export async function addNodeToExtendedGroups(
  client: any,
  nodeId: number,
  groupIds: number[]
): Promise<void> {
  if (groupIds.length === 0) return;

  const values = groupIds.map((gid, index) => `($1, $${index + 2})`).join(', ');
  const params = [nodeId, ...groupIds];

  await client.query(
    `INSERT INTO node_extended_groups (node_id, extended_group_id)
     VALUES ${values}
     ON CONFLICT (node_id, extended_group_id) DO NOTHING`,
    params
  );

  // Pastikan cache column di nodes selalu up-to-date
  await syncNodeExtendedGroupCache(client, nodeId);
}

/**
 * Membuat satu extended family group baru.
 */
export async function createNewExtendedGroup(client: any): Promise<number> {
  const res = await client.query(
    `INSERT INTO extended_family_groups (created_at) 
     VALUES (NOW()) 
     RETURNING id`
  );
  return res.rows[0].id;
}

/**
 * Fungsi utama: Menggabungkan extended group saat pernikahan.
 *
 * Filosofi:
 * - Extended group hanya dibuat ketika ada relasi (bukan saat registrasi).
 * - Saat dua orang menikah, mereka saling mewarisi group yang sudah dimiliki.
 * - Mendukung model multi-group (satu orang bisa punya beberapa extended group seiring waktu).
 *
 * Aturan:
 * - Jika keduanya belum punya group → buat 1 group baru.
 * - Jika salah satu sudah punya group → yang lain ikut group tersebut.
 * - Jika keduanya sudah punya group berbeda → keduanya menjadi anggota dari union (multi-group).
 */
export async function mergeExtendedGroupsOnMarriage(
  client: any,
  husbandNodeId: number,
  wifeNodeId: number
): Promise<void> {
  const husbandGroups = await getNodeExtendedGroups(client, husbandNodeId);
  const wifeGroups = await getNodeExtendedGroups(client, wifeNodeId);

  // Kasus 1: Keduanya belum punya group sama sekali
  if (husbandGroups.length === 0 && wifeGroups.length === 0) {
    const newGroupId = await createNewExtendedGroup(client);
    await addNodeToExtendedGroups(client, husbandNodeId, [newGroupId]);
    await addNodeToExtendedGroups(client, wifeNodeId, [newGroupId]);
    // Buat chat room general untuk extended group ini
    const { familyUuid, husbandUserUuid, husbandName } = await getSmallRoomInfo(client, husbandNodeId);
    await getOrCreateGeneralRoomForExtendedGroup(client, newGroupId, familyUuid, husbandName || null);
    // Buat small room untuk keluarga inti
    if (husbandUserUuid) {
      await getOrCreateSmallRoom(client, familyUuid, husbandUserUuid, husbandName || null);
    }
    return;
  }

  // Kasus 2: Suami sudah punya group, istri belum
  if (husbandGroups.length > 0 && wifeGroups.length === 0) {
    await addNodeToExtendedGroups(client, wifeNodeId, husbandGroups);
    return;
  }

  // Kasus 3: Istri sudah punya group, suami belum
  if (wifeGroups.length > 0 && husbandGroups.length === 0) {
    await addNodeToExtendedGroups(client, husbandNodeId, wifeGroups);
    return;
  }

  // Kasus 4: Keduanya sudah punya group (bisa berbeda) → Full component merge + propagasi
  // Semua node yang tadinya berelasi dengan suami atau istri (extended family masing-masing)
  // ikut mendapat union group.
  await mergeAndPropagateGroups(client, husbandGroups, wifeGroups);

  // Pastikan suami dan istri sendiri juga sudah mendapat union (sudah dilakukan di atas,
  // tapi kita tetap sync cache mereka secara eksplisit untuk keamanan)
  const union = Array.from(new Set([...husbandGroups, ...wifeGroups]));
  await addNodeToExtendedGroups(client, husbandNodeId, union);
  await addNodeToExtendedGroups(client, wifeNodeId, union);
}

/**
 * Menghubungkan sebuah node baru ke extended groups yang sudah dimiliki node terkait.
 *
 * Digunakan ketika seseorang yang belum punya group terhubung dengan keluarga yang sudah punya group.
 * Contoh:
 * - Ayah C baru daftar, lalu diundang oleh anaknya (B) yang sudah menikah → Ayah C ikut group anaknya.
 * - Anak dari pernikahan sebelumnya yang baru diundang ke keluarga.
 *
 * Ini mendukung konsep "warisan group" ke orang tua/anak yang baru bergabung.
 */
export async function linkNodeToRelativeExtendedGroups(
  client: any,
  newNodeId: number,
  existingRelatedNodeId: number
): Promise<void> {
  const existingGroups = await getNodeExtendedGroups(client, existingRelatedNodeId);
  const newPersonGroups = await getNodeExtendedGroups(client, newNodeId);

  // Cari pasangan dari existing (untuk cakupan nuclear family)
  const spouseRes = await client.query(
    `SELECT 
       CASE WHEN husband_node_id = $1 THEN wife_node_id ELSE husband_node_id END as spouse_id
     FROM marriages 
     WHERE (husband_node_id = $1 OR wife_node_id = $1) 
       AND status = 'married'
     LIMIT 1`,
    [existingRelatedNodeId]
  );
  const spouseId = spouseRes.rows[0]?.spouse_id ? Number(spouseRes.rows[0].spouse_id) : null;

  let spouseGroups: number[] = [];
  if (spouseId) {
    spouseGroups = await getNodeExtendedGroups(client, spouseId);
  }

  // Komponen "existing family" = groups dari existing + spouse
  const existingFamilyGroups = Array.from(new Set([...existingGroups, ...spouseGroups]));

// === Kasus 1: Kedua pihak belum punya group → buat baru dan berikan ke new + existing family
  if (existingFamilyGroups.length === 0 && newPersonGroups.length === 0) {
    const newGroupId = await createNewExtendedGroup(client);
    await addNodeToExtendedGroups(client, newNodeId, [newGroupId]);
    await addNodeToExtendedGroups(client, existingRelatedNodeId, [newGroupId]);
    if (spouseId) await addNodeToExtendedGroups(client, spouseId, [newGroupId]);
    // Buat chat room general untuk extended group ini
    // Tentukan husband node: jika existingRelatedNode adalah laki-laki, gunakan dia; jika wanita, gunakan suaminya
    const existingGender = await client.query('SELECT gender FROM nodes WHERE id = $1', [existingRelatedNodeId]);
    const isExistingHusband = existingGender.rows[0]?.gender === 'male';
    const husbandNodeId = isExistingHusband ? existingRelatedNodeId : spouseId;
    if (husbandNodeId) {
      const { familyUuid, husbandUserUuid, husbandName } = await getSmallRoomInfo(client, husbandNodeId);
      await getOrCreateGeneralRoomForExtendedGroup(client, newGroupId, familyUuid, husbandName || null);
      if (husbandUserUuid) {
        await getOrCreateSmallRoom(client, familyUuid, husbandUserUuid, husbandName || null);
      }
    }
    return;
  }

  // === Kasus 2: Existing family punya group, new person belum → new person ikut existing (full component)
  if (existingFamilyGroups.length > 0 && newPersonGroups.length === 0) {
    await addNodeToExtendedGroups(client, newNodeId, existingFamilyGroups);
    // Tidak perlu ubah existing family (mereka sudah punya group-nya)
    await syncNodeExtendedGroupCache(client, newNodeId);
    return;
  }

  // === Kasus 3: New person bawa group sendiri, existing family belum → existing family ikut new person
  if (existingFamilyGroups.length === 0 && newPersonGroups.length > 0) {
    await addNodeToExtendedGroups(client, existingRelatedNodeId, newPersonGroups);
    if (spouseId) await addNodeToExtendedGroups(client, spouseId, newPersonGroups);
    await syncNodeExtendedGroupCache(client, existingRelatedNodeId);
    if (spouseId) await syncNodeExtendedGroupCache(client, spouseId);
    return;
  }

  // === Kasus 4: Keduanya sudah punya group (bisa berbeda) → FULL COMPONENT MERGE + PROPAGASI
  // Semua node yang tadinya di grup manapun dari existing family ATAU dari new person
  // sekarang mendapat union lengkap.
  await mergeAndPropagateGroups(client, existingFamilyGroups, newPersonGroups);

  // Pastikan new person, existing, dan spouse mendapat union (sudah tercover di atas, tapi explicit untuk cache)
  const union = Array.from(new Set([...existingFamilyGroups, ...newPersonGroups]));
  await addNodeToExtendedGroups(client, newNodeId, union);
  await addNodeToExtendedGroups(client, existingRelatedNodeId, union);
  if (spouseId) await addNodeToExtendedGroups(client, spouseId, union);
}

/**
 * Ambil semua node yang ikut dalam salah satu dari groupIds yang diberikan.
 * Ini digunakan untuk propagasi merge ke seluruh komponen extended family.
 */
export async function getAllNodesInGroups(
  client: any, 
  groupIds: number[]
): Promise<number[]> {
  if (groupIds.length === 0) return [];
  const res = await client.query(
    `SELECT DISTINCT node_id 
     FROM node_extended_groups 
     WHERE extended_group_id = ANY($1::bigint[])`,
    [groupIds]
  );
  return res.rows.map((r: any) => Number(r.node_id));
}

/**
 * Ambil semua group yang dimiliki oleh kumpulan node (union dari semua node tersebut).
 * Berguna untuk menemukan "komponen" lengkap sebelum merge.
 */
export async function getAllGroupsForNodes(
  client: any, 
  nodeIds: number[]
): Promise<number[]> {
  if (nodeIds.length === 0) return [];
  const res = await client.query(
    `SELECT DISTINCT extended_group_id 
     FROM node_extended_groups 
     WHERE node_id = ANY($1::int[])`,
    [nodeIds]
  );
  return res.rows.map((r: any) => Number(r.extended_group_id));
}

/**
 * Lakukan full merge antar dua komponen extended family.
 * Semua node yang sebelumnya berada di group manapun dari komponen A atau B
 * akan mendapatkan union dari semua group tersebut.
 * 
 * Ini adalah implementasi dari aturan:
 * - A punya 1, B punya 2 → semua node yang tadinya di 1 atau 2 sekarang punya {1,2}
 */
export async function mergeAndPropagateGroups(
  client: any,
  groupsA: number[],
  groupsB: number[]
): Promise<void> {
  const union = Array.from(new Set([...groupsA, ...groupsB]));
  if (union.length === 0) return;

  // Kumpulkan semua node yang terlibat di komponen A atau B
  const nodesA = await getAllNodesInGroups(client, groupsA);
  const nodesB = await getAllNodesInGroups(client, groupsB);
  const allAffectedNodes = Array.from(new Set([...nodesA, ...nodesB]));

  if (allAffectedNodes.length === 0) return;

  // Berikan union group ke setiap node yang terkena dampak
  for (const nodeId of allAffectedNodes) {
    await addNodeToExtendedGroups(client, nodeId, union);
  }
}
