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

      const initialNodes = nodesRes.rows;
      const nodeIds = initialNodes.map((r: any) => r.id);

      // Fetch marriages involving ANY loaded node (not all nodes)
      const marriagesRes = await client.query(
        `SELECT husband_node_id, wife_node_id
         FROM marriages
         WHERE status = 'married'
           AND (husband_node_id = ANY($1::int[]) OR wife_node_id = ANY($1::int[]))`,
        [nodeIds]
      );

      // Fetch parent-child relations where EITHER parent or child is loaded (not both)
      let pcrRes = await client.query(
        `SELECT parent_node_id, child_node_id, parent_type
         FROM parent_child_relations
         WHERE parent_node_id = ANY($1::int[]) OR child_node_id = ANY($1::int[])`,
        [nodeIds]
      );

      // Collect additional node IDs from relations (spouse/children/parents not yet loaded)
      const allRelationNodeIds = new Set<number>();
      marriagesRes.rows.forEach((m: any) => {
        allRelationNodeIds.add(m.husband_node_id);
        allRelationNodeIds.add(m.wife_node_id);
      });
      pcrRes.rows.forEach((r: any) => {
        allRelationNodeIds.add(r.parent_node_id);
        allRelationNodeIds.add(r.child_node_id);
      });

      // Fetch nodes that are related but not in extended groups
      const missingNodeIds = Array.from(allRelationNodeIds).filter(id => !nodeIds.includes(id));
      let missingNodesRes = { rows: [] };
      if (missingNodeIds.length > 0) {
        missingNodesRes = await client.query(
          `SELECT 
             n.id, n.uuid, n.full_name, n.gender, n.birth_date, n.death_date, 
             n.photo_url, n.is_alive, n.current_nuclear_family_id,
             n.position_x, n.position_y, n.extended_group_ids,
             n.created_at, n.updated_at
           FROM nodes n
           WHERE n.id = ANY($1::int[])`,
          [missingNodeIds]
        );
        missingNodesRes.rows.forEach((node: any) => {
          if (!nodeIds.includes(node.id)) {
            nodeIds.push(node.id);
          }
        });

        // Re-fetch parent-child relations now that we have all related nodes
        pcrRes = await client.query(
          `SELECT parent_node_id, child_node_id, parent_type
           FROM parent_child_relations
           WHERE parent_node_id = ANY($1::int[]) OR child_node_id = ANY($1::int[])`,
          [nodeIds]
        );
      }

      // Build spouse and children maps for ALL nodes (initial + missing)
      const spouseMap = new Map<string, string[]>();
      marriagesRes.rows.forEach((m: any) => {
        const h = m.husband_node_id.toString();
        const w = m.wife_node_id.toString();
        if (!spouseMap.has(h)) spouseMap.set(h, []);
        if (!spouseMap.has(w)) spouseMap.set(w, []);
        if (!spouseMap.get(h)!.includes(w)) spouseMap.get(h)!.push(w);
        if (!spouseMap.get(w)!.includes(h)) spouseMap.get(w)!.push(h);
      });

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

      // Combine all nodes and add spouse/children/parent info
      const allNodes = [...initialNodes, ...missingNodesRes.rows];

      const nodes = allNodes.map((node: any) => {
        const nodeId = node.id.toString();
        return {
          ...node,
          extended_group_ids: node.extended_group_ids || [],
          spouse_ids: spouseMap.get(nodeId) || [],
          children_ids: childrenMap.get(nodeId) || [],
          father_id: parentMap.get(nodeId)?.father || null,
          mother_id: parentMap.get(nodeId)?.mother || null,
        };
      });

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