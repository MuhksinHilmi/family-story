import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id diperlukan" }, { status: 400 });
  }

  const fid = parseInt(id, 10);
  if (isNaN(fid)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }

  try {
    // Try new nuclear_families first (the active schema)
    let result = await pool.query(
      `SELECT id, uuid, name, status, created_by_node_id as created_by, created_at, updated_at 
       FROM nuclear_families 
       WHERE id = $1`,
      [fid],
    );

    if (result.rows.length === 0) {
      // Fallback to old families table if it still exists (for transition)
      try {
        result = await pool.query(
          "SELECT id, uuid, name, description, created_by, created_at, updated_at FROM families WHERE id = $1",
          [fid],
        );
      } catch {
        // table may not exist
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Family tidak ditemukan" },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    return NextResponse.json(
      {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        description: row.description || null,
        created_by: row.created_by,
        status: row.status || "active",
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("/api/family error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth_header = request.headers.get("authorization");
  if (!auth_header) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, description } = body;

  if (!name || !id) {
    return NextResponse.json(
      { error: "id dan name wajib diisi" },
      { status: 400 },
    );
  }

  const fid = parseInt(String(id), 10);
  if (isNaN(fid)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE nuclear_families 
       SET name = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, uuid, name, status, created_at, updated_at`,
      [name, fid],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Keluarga tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("PUT /api/family error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
