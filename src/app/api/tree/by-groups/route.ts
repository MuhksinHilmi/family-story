import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupIdsParam = searchParams.get('group_ids');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!groupIdsParam) {
      return NextResponse.json({ error: 'group_ids is required' }, { status: 400 });
    }

    const groupIds = groupIdsParam
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));

    if (groupIds.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const client = await pool.connect();

    try {
      // Fetch nodes that belong to any of the requested extended groups
      // Source of truth: node_extended_groups (junction table), bukan cache column.
      // Ini memastikan node yang baru di-link via marriage/child invitation langsung terlihat,
      // meskipun cache extended_group_ids di tabel nodes belum sempat di-sync.
        const nodesRes = await client.query(
          `SELECT 
            n.id, n.uuid, n.full_name, n.gender, n.birth_date, n.death_date, 
            n.photo_url, n.is_alive, n.current_nuclear_family_id,
            n.position_x, n.position_y, n.extended_group_ids,
            n.created_at, n.updated_at
          FROM nodes n
          WHERE EXISTS (
            SELECT 1 FROM node_extended_groups neg
            WHERE neg.node_id = n.id
              AND neg.extended_group_id = ANY($1::bigint[])
          )
          LIMIT $2`,
          [groupIds, limit]
        );

      const nodes = nodesRes.rows.map((node: any) => ({
        ...node,
        extended_group_ids: node.extended_group_ids || [],
      }));

      const nodeIds = nodesRes.rows.map((r: any) => r.id);

      // Fetch marriages between the loaded nodes (both ends must be present)
      const marriagesRes = await client.query(
        `SELECT husband_node_id, wife_node_id
         FROM marriages
         WHERE status = 'married'
           AND husband_node_id = ANY($1::int[])
           AND wife_node_id = ANY($1::int[])`,
        [nodeIds]
      );

      // Fetch parent-child relations between the loaded nodes
      const pcrRes = await client.query(
        `SELECT parent_node_id, child_node_id, parent_type
         FROM parent_child_relations
         WHERE parent_node_id = ANY($1::int[])
           AND child_node_id = ANY($1::int[])`,
        [nodeIds]
      );

      const edges: any[] = [];

      marriagesRes.rows.forEach((m: any) => {
        const a = String(m.husband_node_id);
        const b = String(m.wife_node_id);
        edges.push({
          id: `spouse-${a}-${b}`,
          source: a,
          target: b,
          animated: true,
          sourceHandle: 'right',
          targetHandle: 'left',
          style: { stroke: '#10b981', strokeWidth: 2 },
        });
      });

      pcrRes.rows.forEach((rel: any) => {
        const p = String(rel.parent_node_id);
        const c = String(rel.child_node_id);
        const isFather = rel.parent_type === 'father';
        edges.push({
          id: `parent-${rel.parent_type}-${p}-${c}`,
          source: p,
          target: c,
          animated: true,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          style: {
            stroke: isFather ? '#3b82f6' : '#ec4899',
            strokeWidth: 2,
            strokeDasharray: '4 3',
          },
        });
      });

      console.log(
        `Fetched ${nodes.length} nodes and ${edges.length} edges for extended groups [${groupIds.join(', ')}]`,
      );
      return NextResponse.json({
        nodes,
        edges,
        group_ids: groupIds,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('GET /api/tree/by-groups error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes by extended groups' },
      { status: 500 }
    );
  }
}
