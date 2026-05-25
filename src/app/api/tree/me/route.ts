import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "user_id diperlukan" },
        { status: 400 },
      );
    }

    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "user_id tidak valid" },
        { status: 400 },
      );
    }

    // Find the user's primary node in the new schema
    const nodeRes = await client.query(
      `SELECT 
         n.id, 
         n.uuid,
         n.user_id, 
         n.full_name, 
         n.gender, 
         n.birth_date, 
         n.death_date, 
         n.photo_url,
         n.is_alive, 
         n.current_nuclear_family_id,
         n.current_marriage_id,
         n.position_x,
         n.position_y,
         n.extended_group_ids,
         n.created_at, 
         n.updated_at,
         u.photo_url as user_photo_url
        FROM nodes n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.user_id = $1
        LIMIT 1`,
      [userIdInt],
    );

    if (nodeRes.rows.length === 0) {
      // No node yet (should not happen after registration, but handle gracefully)
      return NextResponse.json(
        {
          node: null,
          family_id: null,
          message:
            "User belum memiliki node di sistem baru. Silakan hubungi admin atau coba register ulang.",
        },
        { status: 200 },
      );
    }

    const node = nodeRes.rows[0];
    const familyId = node.current_nuclear_family_id
      ? String(node.current_nuclear_family_id)
      : null;
    console.log(`User ${userId} has node ${node.id} in family ${familyId}`);
    // Map to the shape expected by the legacy frontend (many fields will be enriched by the main /api/tree load)
    return NextResponse.json(
      {
        node: {
          id: node.id,
          // Use nuclear_family id as the "family_id" for compatibility with existing hook calls
          family_id: familyId,
          user_id: node.user_id,
          full_name: node.full_name,
          gender: node.gender,
          birth_date: node.birth_date,
          death_date: node.death_date,
          photo_url: node.user_photo_url || node.photo_url,
          is_alive: node.is_alive,
          nasab_line: null, // not used in new schema
          father_id: null, // will be computed from parent_child_relations in tree load
          mother_id: null,
          spouse_ids: [],
          children_ids: [],
          invitation_email: null,
          invitation_status: "accepted", // if they have a node, they are claimed
          position_x: node.position_x ?? 0,
          position_y: node.position_y ?? 0,
          extended_group_ids: node.extended_group_ids || [],
          created_at: node.created_at,
          updated_at: node.updated_at,
        },
        family_id: familyId,
        node_uuid: node.uuid,
        nuclear_family_id: node.current_nuclear_family_id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get node by user (new schema) error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan", details: String(error) },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
