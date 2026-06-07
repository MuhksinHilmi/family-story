import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

type RelationType = 'parents' | 'children' | 'spouses';

interface RelatedRequest {
  node_ids: string[];
  relation_types?: RelationType[];
  exclude_node_ids?: string[];
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RelatedRequest = await request.json();

    const {
      node_ids = [],
      relation_types = ['parents', 'children', 'spouses'],
      exclude_node_ids = [],
      limit = 100,
    } = body;

    if (!Array.isArray(node_ids) || node_ids.length === 0) {
      return NextResponse.json({ error: 'node_ids is required' }, { status: 400 });
    }

    const nodeIdInts = node_ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    const excludeInts = exclude_node_ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

    if (nodeIdInts.length === 0) {
      return NextResponse.json({ nodes: [], relations: [] });
    }

    const client = await pool.connect();

    try {
      const relatedNodeIds = new Set<number>();
      const relations: any[] = [];

      // === PARENTS ===
      if (relation_types.includes('parents')) {
        const parentsRes = await client.query(
          `SELECT parent_node_id, child_node_id, parent_type
           FROM parent_child_relations
           WHERE child_node_id = ANY($1::int[])`,
          [nodeIdInts]
        );

        parentsRes.rows.forEach((row: any) => {
          if (!excludeInts.includes(row.parent_node_id)) {
            relatedNodeIds.add(row.parent_node_id);
            relations.push({
              from: row.child_node_id,
              to: row.parent_node_id,
              type: row.parent_type === 'father' ? 'father' : 'mother',
            });
          }
        });
      }

      // === CHILDREN ===
      if (relation_types.includes('children')) {
        const childrenRes = await client.query(
          `SELECT parent_node_id, child_node_id, parent_type
           FROM parent_child_relations
           WHERE parent_node_id = ANY($1::int[])`,
          [nodeIdInts]
        );

        childrenRes.rows.forEach((row: any) => {
          if (!excludeInts.includes(row.child_node_id)) {
            relatedNodeIds.add(row.child_node_id);
            relations.push({
              from: row.parent_node_id,
              to: row.child_node_id,
              type: row.parent_type === 'father' ? 'father' : 'mother',
            });
          }
        });
      }

      // === SPOUSES ===
      if (relation_types.includes('spouses')) {
        const marriagesRes = await client.query(
          `SELECT husband_node_id, wife_node_id
           FROM marriages
           WHERE (husband_node_id = ANY($1::int[]) OR wife_node_id = ANY($1::int[]))
             AND status = 'married'`,
          [nodeIdInts]
        );

        marriagesRes.rows.forEach((row: any) => {
          const spouseA = row.husband_node_id;
          const spouseB = row.wife_node_id;

          if (nodeIdInts.includes(spouseA) && !excludeInts.includes(spouseB)) {
            relatedNodeIds.add(spouseB);
            relations.push({ from: spouseA, to: spouseB, type: 'spouse' });
          }
          if (nodeIdInts.includes(spouseB) && !excludeInts.includes(spouseA)) {
            relatedNodeIds.add(spouseA);
            relations.push({ from: spouseB, to: spouseA, type: 'spouse' });
          }
        });
      }

      // Limit the number of related nodes
      let finalRelatedIds = Array.from(relatedNodeIds).slice(0, limit);

      if (finalRelatedIds.length === 0) {
        return NextResponse.json({ nodes: [], relations: [] });
      }

      // Fetch full node data
      const nodesRes = await client.query(
        `SELECT 
           id, uuid, full_name, gender, birth_date, death_date, 
           photo_url, is_alive, current_nuclear_family_id,
           position_x, position_y, extended_group_ids,
           created_at, updated_at
         FROM nodes 
         WHERE id = ANY($1::int[])`,
        [finalRelatedIds]
      );

      // Attach father_id, mother_id, spouse_ids and children_ids for NodeDetailModal
      const pcrRes = await client.query(
        `SELECT parent_node_id, child_node_id, parent_type
         FROM parent_child_relations
         WHERE child_node_id = ANY($1::int[])`,
        [finalRelatedIds]
      );

      // Also fetch children (parents as parents) and spouses for these nodes
      const childrenAndSpousesRes = await client.query(
        `SELECT parent_node_id, child_node_id, parent_type
         FROM parent_child_relations
         WHERE parent_node_id = ANY($1::int[])`,
        [finalRelatedIds]
      );

      const marriagesForNodesRes = await client.query(
        `SELECT husband_node_id, wife_node_id
         FROM marriages
         WHERE (husband_node_id = ANY($1::int[]) OR wife_node_id = ANY($1::int[]))
           AND status = 'married'`,
        [finalRelatedIds]
      );

      const parentMap = new Map<number, { father?: number; mother?: number }>();
      const childrenMap = new Map<string, string[]>();
      const spouseMap = new Map<string, string[]>();

      pcrRes.rows.forEach((row: any) => {
        const childId = row.child_node_id;
        if (!parentMap.has(childId)) parentMap.set(childId, {});
        if (row.parent_type === 'father') {
          parentMap.get(childId)!.father = row.parent_node_id;
        } else {
          parentMap.get(childId)!.mother = row.parent_node_id;
        }
      });

      childrenAndSpousesRes.rows.forEach((row: any) => {
        const p = row.parent_node_id.toString();
        if (!childrenMap.has(p)) childrenMap.set(p, []);
        childrenMap.get(p)!.push(row.child_node_id.toString());
      });

      marriagesForNodesRes.rows.forEach((m: any) => {
        const h = m.husband_node_id.toString();
        const w = m.wife_node_id.toString();
        if (!spouseMap.has(h)) spouseMap.set(h, []);
        if (!spouseMap.has(w)) spouseMap.set(w, []);
        if (!spouseMap.get(h)!.includes(w)) spouseMap.get(h)!.push(w);
        if (!spouseMap.get(w)!.includes(h)) spouseMap.get(w)!.push(h);
      });

      const nodesWithRelations = nodesRes.rows.map((node: any) => {
        const nodeId = node.id.toString();
        return {
          ...node,
          father_id: parentMap.get(node.id)?.father || null,
          mother_id: parentMap.get(node.id)?.mother || null,
          spouse_ids: spouseMap.get(nodeId) || [],
          children_ids: childrenMap.get(nodeId) || [],
        };
      });

      // Ambil nama depan ayah untuk semua node yang punya father
      const fatherIds = nodesWithRelations
        .map(n => n.father_id)
        .filter((id): id is number => id !== null);

      let fatherNameMap = new Map<number, string>();

      if (fatherIds.length > 0) {
        const fathersRes = await client.query(
          `SELECT id, full_name FROM nodes WHERE id = ANY($1::int[])`,
          [fatherIds]
        );

        fathersRes.rows.forEach((f: any) => {
          const firstName = f.full_name ? f.full_name.trim().split(/\s+/)[0] : '';
          fatherNameMap.set(f.id, firstName);
        });
      }

      // Hitung nasab_line langsung di server (hanya nama depan ayah)
      const finalNodes = nodesWithRelations.map((node: any) => {
        let nasab_line = null;
        if (node.father_id) {
          const fatherFirstName = fatherNameMap.get(node.father_id);
          if (fatherFirstName) {
            nasab_line = node.gender === 'male'
              ? `bin ${fatherFirstName}`
              : `binti ${fatherFirstName}`;
          }
        }
        return {
          ...node,
          nasab_line,
          extended_group_ids: node.extended_group_ids || [],
        };
      });

      return NextResponse.json({
        nodes: finalNodes,
        relations,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('GET related nodes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch related nodes' },
      { status: 500 }
    );
  }
}

// Support simple GET for single node (convenience)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('node_id');
  const nodeIdsParam = searchParams.get('node_ids');
  const limit = parseInt(searchParams.get('limit') || '50');

  let nodeIds: string[] = [];

  if (nodeId) nodeIds.push(nodeId);
  if (nodeIdsParam) nodeIds = nodeIdsParam.split(',');

  if (nodeIds.length === 0) {
    return NextResponse.json({ error: 'node_id or node_ids is required' }, { status: 400 });
  }

  // Reuse POST logic
  const body = {
    node_ids: nodeIds,
    limit,
  };

  const fakeRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(fakeRequest);
}
