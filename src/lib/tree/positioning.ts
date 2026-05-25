import { Node } from '@xyflow/react';

/**
 * Centralized positioning logic for the family tree.
 *
 * Rules (finalized May 2026):
 * - Pria hanya mendapat posisi random SEKALI (saat pernikahan pertama).
 * - Istri selalu ditempatkan di SEBELAH KANAN suami.
 * - Anak ditempatkan DI BAWAH ayah (relatif ke ayah).
 * - Wanita yang sudah menikah posisinya terkunci ke suami. Ayah tidak boleh override.
 * - Ibu mengundang anak → tidak mengubah posisi anak.
 * - Reload / incremental load TIDAK PERNAH mengubah posisi (hanya render dari DB).
 * - Posisi suami baru harus dalam batas wajar supaya tidak terlalu jauh.
 */

export interface Position {
  x: number;
  y: number;
}

// ==================== CONSTANTS ====================

const MARRIAGE_HORIZONTAL_OFFSET = 280; // Jarak istri di kanan suami
const MARRIAGE_VERTICAL_JITTER = 20;    // Sedikit variasi vertikal untuk istri

const CHILD_VERTICAL_OFFSET = 220;      // Jarak anak di bawah ayah
const CHILD_HORIZONTAL_SPREAD = 160;    // Jarak antar saudara kandung

// Batas wajar untuk posisi random suami saat menikah pertama kali
const MIN_REASONABLE_X = 180;
const MAX_REASONABLE_X = 920;
const MIN_REASONABLE_Y = 140;
const MAX_REASONABLE_Y = 620;

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate posisi "random tapi wajar" untuk pria saat menikah pertama kali.
 * Menggunakan deterministic-ish offset berdasarkan node id agar relatif stabil.
 */
export function calculateFirstMarriagePosition(husbandNode: { id: string | number }): Position {
  const id = String(husbandNode.id);
  // Hash sederhana dari id untuk menghasilkan offset yang repeatable
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }

  const rangeX = MAX_REASONABLE_X - MIN_REASONABLE_X;
  const rangeY = MAX_REASONABLE_Y - MIN_REASONABLE_Y;

  const x = MIN_REASONABLE_X + (hash % rangeX);
  const y = MIN_REASONABLE_Y + ((hash * 17) % rangeY);

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Hitung posisi istri berdasarkan posisi suami.
 * Selalu di sebelah kanan suami.
 */
export function calculateWifePosition(husbandPosition: Position): Position {
  return {
    x: husbandPosition.x + MARRIAGE_HORIZONTAL_OFFSET,
    y: husbandPosition.y + (Math.random() * MARRIAGE_VERTICAL_JITTER * 2 - MARRIAGE_VERTICAL_JITTER),
  };
}

/**
 * Hitung posisi anak berdasarkan posisi ayah.
 * Ditempatkan di bawah ayah. Bisa di-spread horizontal jika banyak anak.
 */
export function calculateChildPosition(
  fatherPosition: Position,
  siblingIndex: number = 0
): Position {
  const horizontalOffset = (siblingIndex % 3) * CHILD_HORIZONTAL_SPREAD - CHILD_HORIZONTAL_SPREAD;

  return {
    x: fatherPosition.x + horizontalOffset,
    y: fatherPosition.y + CHILD_VERTICAL_OFFSET + Math.floor(siblingIndex / 3) * 40,
  };
}

/**
 * Cek apakah sebuah node boleh di-update posisinya oleh relasi tertentu.
 *
 * Aturan:
 * - Jika wanita sudah menikah (punya current_marriage_id) → tidak boleh diubah oleh ayah.
 * - Pria hanya boleh diubah posisinya saat pernikahan pertama (dicek di luar fungsi ini).
 */
export function canUpdatePositionForRelation(
  node: {
    gender: 'male' | 'female';
    current_marriage_id?: string | number | null;
  },
  relationType: 'spouse' | 'child',
  inviterGender: 'male' | 'female'
): boolean {
  // Wanita yang sudah menikah tidak boleh diubah posisinya oleh siapa pun (terutama ayah)
  if (node.gender === 'female' && node.current_marriage_id && relationType === 'child') {
    return false;
  }

  // Ibu mengundang anak → tidak boleh ubah posisi (aturan yang sudah disepakati)
  if (relationType === 'child' && inviterGender === 'female') {
    return false;
  }

  return true;
}

// ==================== FUTURE / OPTIONAL ====================

/**
 * (Opsional nanti) Hitung posisi yang lebih pintar dengan menghindari overlap.
 * Untuk sekarang kita pakai offset sederhana + drag manual.
 */
export function suggestNonOverlappingPosition(
  basePosition: Position,
  existingPositions: Position[],
  minDistance = 180
): Position {
  // Placeholder untuk versi lanjutan jika diperlukan
  return basePosition;
}
