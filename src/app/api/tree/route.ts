import { NextRequest, NextResponse } from "next/server";
import pool from '@/lib/db_helper';
import { Edge } from "@xyflow/react";

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const familyIdParam = searchParams.get("family_id") || searchParams.get("nuclear_family_id");

    if (!familyIdParam) {
      return NextResponse.json(
        { error: "family_id (nuclear_family_id) diperlukan" },
        { status: 400 },
      );
    }

    const nuclearFamilyId = parseInt(familyIdParam, 10);
    if (isNaN(nuclearFamilyId)) {
      return NextResponse.json({ error: "family_id tidak valid" }, { status: 400 });
    }

    // NEW SCHEMA LOADER
    const membersRes = await client.query(
      `SELECT 
         n.id, n.uuid, n.user_id, n.full_name, n.gender, n.birth_date, n.death_date,
         n.photo_url, n.is_alive, n.current_nuclear_family_id,
         n.position_x, n.position_y,
         n.extended_group_ids,
         n.created_at, n.updated_at,
         m.role, m.join_reason
       FROM nuclear_family_memberships m
       JOIN nodes n ON n.id = m.node_id
       WHERE m.nuclear_family_id = $1 AND m.left_at IS NULL
       ORDER BY n.full_name`,
      [nuclearFamilyId]
    );

    const memberRows = membersRes.rows;

    if (memberRows.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const memberIds = memberRows.map((r: any) => r.id);
    const idToRow = new Map(memberRows.map((r: any) => [r.id.toString(), r]));

    const marriagesRes = await client.query(
      `SELECT id, husband_node_id, wife_node_id, status
       FROM marriages
       WHERE status = 'married'
         AND (husband_node_id = ANY($1::int[]) OR wife_node_id = ANY($1::int[]))`,
      [memberIds]
    );

    const spouseMap = new Map<string, string[]>();
    marriagesRes.rows.forEach((m: any) => {
      const h = m.husband_node_id.toString();
      const w = m.wife_node_id.toString();
      if (!spouseMap.has(h)) spouseMap.set(h, []);
      if (!spouseMap.has(w)) spouseMap.set(w, []);
      if (!spouseMap.get(h)!.includes(w)) spouseMap.get(h)!.push(w);
      if (!spouseMap.get(w)!.includes(h)) spouseMap.get(w)!.push(h);
    });

    const pcrRes = await client.query(
      `SELECT parent_node_id, child_node_id, parent_type
       FROM parent_child_relations
       WHERE parent_node_id = ANY($1::int[]) OR child_node_id = ANY($1::int[])`,
      [memberIds]
    );

    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, { father?: string; mother?: string }>();

    pcrRes.rows.forEach((r: any) => {
      const p = r.parent_node_id.toString();
      const c = r.child_node_id.toString();
      if (!childrenMap.has(p)) childrenMap.set(p, []);
      if (!childrenMap.get(p)!.includes(c)) childrenMap.get(p)!.push(c);

      if (!parentMap.has(c)) parentMap.set(c, {});
      if (r.parent_type === 'father') parentMap.get(c)!.father = p;
      else parentMap.get(c)!.mother = p;
    });

    // Simple layout
    let primaryHusband: string | null = null;
    let primaryWife: string | null = null;

    for (const row of memberRows) {
      if (row.role === 'head' && row.gender === 'male') {
        primaryHusband = row.id.toString();
        break;
      }
    }
    if (!primaryHusband) {
      for (const [id, spouses] of spouseMap.entries()) {
        const row = idToRow.get(id);
        if (row && row.gender === 'male' && spouses.length > 0) {
          primaryHusband = id;
          primaryWife = spouses[0];
          break;
        }
      }
    }
    if (!primaryHusband && memberRows.length > 0) {
      primaryHusband = memberRows[0].id.toString();
    }
    if (primaryHusband && !primaryWife && spouseMap.has(primaryHusband)) {
      primaryWife = spouseMap.get(primaryHusband)![0] || null;
    }

    const nodes = memberRows.map((node: any, idx: number) => {
      const nodeId = node.id.toString();

      // Prefer saved position from database if the user has moved the node
      // (we treat 0,0 as "not yet manually positioned" for new nodes)
      const hasSavedPosition = node.position_x !== 0 || node.position_y !== 0;

      let x = hasSavedPosition ? node.position_x : 120 + (idx % 4) * 160;
      let y = hasSavedPosition ? node.position_y : 80 + Math.floor(idx / 4) * 180;

      // Only apply smart initial layout if user hasn't manually positioned it yet
      if (!hasSavedPosition) {
        if (nodeId === primaryHusband) { x = 80; y = 60; }
        else if (nodeId === primaryWife) { x = 340; y = 60; }
        else {
          const kids = childrenMap.get(primaryHusband || '') || [];
          const kidIndex = kids.indexOf(nodeId);
          if (kidIndex >= 0) {
            x = 60 + kidIndex * 170;
            y = 240;
          }
        }

        if (memberRows.length === 1) { x = 220; y = 120; }
      }

      const fatherId = parentMap.get(nodeId)?.father || null;
      const motherId = parentMap.get(nodeId)?.mother || null;

      let nasab = null;
      if (fatherId) {
        const dad = idToRow.get(fatherId);
        const fatherFirstName = dad?.full_name ? dad.full_name.trim().split(/\s+/)[0] : '';
        nasab = fatherFirstName 
          ? `${node.gender === 'male' ? 'bin' : 'binti'} ${fatherFirstName}` 
          : null;
      }

      return {
        id: nodeId,
        type: 'custom',
        position: { x, y },
        data: {
          id: nodeId,
          family_id: String(nuclearFamilyId),
          user_id: node.user_id ? String(node.user_id) : null,
          full_name: node.full_name,
          gender: node.gender,
          birth_date: node.birth_date,
          death_date: node.death_date,
          photo_url: node.photo_url,
           is_alive: node.is_alive,
           nasab_line: nasab,
           father_id: fatherId,

          mother_id: motherId,
          spouse_ids: spouseMap.get(nodeId) || [],
          children_ids: childrenMap.get(nodeId) || [],
          invitation_email: null,
          invitation_status: 'accepted',
          position_x: x,
          position_y: y,
          extended_group_ids: node.extended_group_ids || [],
          created_at: node.created_at,
          updated_at: node.updated_at,
        },
      };
    });

    const edges: Edge[] = [];

    marriagesRes.rows.forEach((m: any) => {
      const a = m.husband_node_id.toString();
      const b = m.wife_node_id.toString();
      if (idToRow.has(a) && idToRow.has(b)) {
        edges.push({
          id: `spouse-${a}-${b}`,
          source: a,
          target: b,
          animated: true,
          sourceHandle: 'right',
          targetHandle: 'left',
          style: { stroke: '#10b981', strokeWidth: 2 },
        });
      }
    });

    pcrRes.rows.forEach((rel: any) => {
      const p = rel.parent_node_id.toString();
      const c = rel.child_node_id.toString();
      if (idToRow.has(p) && idToRow.has(c)) {
        edges.push({
          id: `parent-${rel.parent_type}-${p}-${c}`,
          source: p,
          target: c,
          animated: true,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          style: {
            stroke: rel.parent_type === 'father' ? '#3b82f6' : '#ec4899',
            strokeWidth: 2,
          },
        });
      }
    });

    return NextResponse.json({
      nodes,
      edges,
      family_id: String(nuclearFamilyId),
      nuclear_family_id: nuclearFamilyId,
    });
  } catch (error) {
    console.error('GET /api/tree (new schema) error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data pohon keluarga' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

// =====================================================
// LEGACY MUTATION ENDPOINTS REMOVED DURING 2026 MIGRATION
// =====================================================
// All member creation now uses POST /api/invitations.
// Old code using family_nodes, spouse_relations, family_members has been deleted.
