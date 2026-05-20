import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { Edge } from '@xyflow/react';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('family_id');

    if (!familyId) {
      return NextResponse.json(
        { error: 'family_id diperlukan' },
        { status: 400 }
      );
    }

    const nodesResult = await pool.query(
      `SELECT id, family_id, user_id, full_name, gender, birth_date, death_date, 
              photo_url, is_alive, nasab_line, birth_order, father_id, mother_id,
              position_x, position_y, invitation_email, invitation_status, created_at, updated_at
       FROM family_nodes 
       WHERE family_id = $1
       ORDER BY created_at`,
      [familyId]
    );

    const spouseRelationsResult = await pool.query(
      `SELECT node_a, node_b 
       FROM spouse_relations 
       WHERE family_id = $1`,
      [familyId]
    );

    const childrenMap = new Map<string, string[]>();
    nodesResult.rows.forEach(node => {
      if (node.father_id) {
        const key = node.father_id.toString();
        if (!childrenMap.has(key)) childrenMap.set(key, []);
        childrenMap.get(key)!.push(node.id.toString());
      }
      if (node.mother_id) {
        const key = node.mother_id.toString();
        if (!childrenMap.has(key)) childrenMap.set(key, []);
        childrenMap.get(key)!.push(node.id.toString());
      }
    });

    // Normalize and dedupe spouse relations so we don't return duplicates like [3,3]
    const relationSet = new Set();
    spouseRelationsResult.rows.forEach(relation => {
      const a = Math.min(relation.node_a, relation.node_b);
      const b = Math.max(relation.node_a, relation.node_b);
      relationSet.add(`${a}-${b}`);
    });

    const spouseMap = new Map();
    relationSet.forEach(key => {
      const [aStr, bStr] = key.split('-');
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      if (!spouseMap.has(a)) spouseMap.set(a, new Set());
      if (!spouseMap.has(b)) spouseMap.set(b, new Set());
      spouseMap.get(a).add(b.toString());
      spouseMap.get(b).add(a.toString());
    });

// build id -> name map for nasab computation
    const idToName = new Map<string, string>();
    nodesResult.rows.forEach(n => idToName.set(n.id.toString(), n.full_name));

    const nodes = nodesResult.rows.map(node => ({
       id: node.id.toString(),
       type: 'custom',
       position: { x: node.position_x || 0, y: node.position_y || 0 },
       data: {
         id: node.id.toString(),
         family_id: node.family_id,
         user_id: node.user_id,
         full_name: node.full_name,
         gender: node.gender,
         birth_date: node.birth_date,
         death_date: node.death_date,
         photo_url: node.photo_url,
         is_alive: node.is_alive,
         nasab_line: node.nasab_line,
         birth_order: node.birth_order,
         father_id: node.father_id,
         mother_id: node.mother_id,
// compute nasab_line from father_id only (nasab is father lineage)
          nasab_line: node.father_id ? `bin ${idToName.get(node.father_id.toString())}` : null,
         spouse_ids: Array.from(spouseMap.get(node.id) || []),
         children_ids: childrenMap.get(node.id.toString()) || [],
         invitation_email: node.invitation_email,
         invitation_status: node.invitation_status,
         created_at: node.created_at,
         updated_at: node.updated_at,
       }
     }));

    console.log('[GET /api/tree] familyId:', familyId, 'nodes count:', nodes.length, 'sample spouse_ids:', nodes.slice(0, 3).map(n => ({ id: n.id, spouse_ids: n.data.spouse_ids })), 'childrenMap sample:', Array.from(childrenMap.entries()).slice(0,5));

    const edges: Edge[] = [];
    spouseRelationsResult.rows.forEach(relation => {
      edges.push({
        id: `spouse-${relation.node_a}-${relation.node_b}`,
        source: relation.node_a.toString(),
        target: relation.node_b.toString(),
        animated: true,
        sourceHandle: 'right',
        targetHandle: 'left',
        style: { stroke: '#10b981', strokeWidth: 2 }
      });
    });

    // Create edges for both father and mother if they exist
    nodesResult.rows.forEach(node => {
      if (node.father_id) {
        edges.push({
          id: `parent-father-${node.father_id}-${node.id}`,
          source: node.father_id.toString(),
          target: node.id.toString(),
          animated: true,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        });
      }
      if (node.mother_id) {
        edges.push({
          id: `parent-mother-${node.mother_id}-${node.id}`,
          source: node.mother_id.toString(),
          target: node.id.toString(),
          animated: true,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          style: { stroke: '#ec4094', strokeWidth: 2, strokeDasharray: '5 5' }
        });
      }
    });

    return NextResponse.json({ nodes, edges }, { status: 200 });
  } catch (error) {
    console.error('Get tree error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      family_id, 
      full_name, 
      gender, 
      birth_date, 
      death_date,
      position_x,
      position_y,
      user_id 
    } = body;

    if (!full_name || !gender) {
      return NextResponse.json(
        { error: 'full_name dan gender wajib diisi' },
        { status: 400 }
      );
    }

    let targetFamilyId = family_id;
    
    // If family_id not provided but user_id is, get or create user's family
    if (!targetFamilyId && user_id) {
      const memberCheck = await pool.query(
        'SELECT family_id FROM family_members WHERE user_id = $1 LIMIT 1',
        [user_id]
      );
      
      if (memberCheck.rows.length > 0) {
        targetFamilyId = memberCheck.rows[0].family_id;
      } else {
        // Create a new family for the user
        const familyResult = await pool.query(
          `INSERT INTO families (name, created_by, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING id`,
          [`Family ${full_name}`, user_id]
        );
        targetFamilyId = familyResult.rows[0].id;
        
        // Add user as family member
        await pool.query(
          `INSERT INTO family_members (family_id, user_id, role, joined_at)
           VALUES ($1, $2, 'admin', NOW())`,
          [targetFamilyId, user_id]
        );
      }
    }

    if (!targetFamilyId) {
      return NextResponse.json(
        { error: 'family_id diperlukan' },
        { status: 400 }
      );
    }

    // Convert to integers where needed
    const targetFamilyIdInt = parseInt(targetFamilyId, 10);
    const userIdInt = user_id ? parseInt(user_id, 10) : null;

    const isAlive = !death_date;

    const result = await pool.query(
      `INSERT INTO family_nodes (family_id, user_id, full_name, gender, birth_date, death_date, 
                                  is_alive, position_x, position_y, 
                                  created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, family_id, user_id, full_name, gender, birth_date, death_date,
                   is_alive, position_x, position_y, created_at, updated_at`,
      [targetFamilyIdInt, userIdInt, full_name, gender, birth_date, death_date, isAlive, 
       position_x || 0, position_y || 0]
    );

    const newNode = result.rows[0];

    return NextResponse.json({
      id: newNode.id,
      family_id: newNode.family_id,
      user_id: newNode.user_id,
      full_name: newNode.full_name,
      gender: newNode.gender,
      birth_date: newNode.birth_date,
      death_date: newNode.death_date,
      photo_url: null,
      is_alive: newNode.is_alive,
      nasab_line: null,
      birth_order: null,
      father_id: null,
      mother_id: null,
      spouse_ids: [],
      children_ids: [],
      invitation_email: null,
      invitation_status: 'accepted',
      position_x: newNode.position_x,
      position_y: newNode.position_y,
      created_at: newNode.created_at,
      updated_at: newNode.updated_at
    }, { status: 201 });
  } catch (error) {
    console.error('Create node error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}