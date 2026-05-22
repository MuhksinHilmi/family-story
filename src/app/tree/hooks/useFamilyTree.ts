import { useState, useCallback } from 'react';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { FamilyNodeData } from '@/types';
import { useAuth } from '@/context/auth-context';

type ConnectionMode = 'add' | 'spouse' | 'child';

interface NewNodeData {
  full_name: string;
  gender: 'male' | 'female';
  birth_date?: string;
  death_date?: string;
  invitation_email?: string;
  user_id?: string;
}

interface UseFamilyTreeReturn {
  nodes: Node<FamilyNodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FamilyNodeData>[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  selectedNodeId: string | null;
  connectionMode: ConnectionMode;
  isModalOpen: boolean;
  isLoading: boolean;
  familyId: string | null;
  familyUuid: string | null;
  setConnectionMode: (mode: ConnectionMode) => void;
  openModal: () => void;
  closeModal: () => void;
  setSelectedNode: (id: string | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addNode: (data: NewNodeData, position: { x: number; y: number }, familyId?: string) => Promise<void>;
  connectSpouse: (nodeAId: string, nodeBId: string) => void;
  addChild: (parentId: string, data: NewNodeData) => void;
  connectChild: (parentId: string, childId: string) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (nodeA: string, nodeB: string, type: 'spouse' | 'child') => void;
  reinviteNode: (id: string) => void;
  savePosition: (nodeId: string, position: { x: number; y: number }) => void;
  loadTree: (familyId: string) => Promise<void>;
  loadUserNode: (userId: string, fullName: string, gender: 'male' | 'female', birthDate?: string) => Promise<void>;
}

export function useFamilyTree(): UseFamilyTreeReturn {
   const [nodes, setNodes] = useState<Node<FamilyNodeData>[]>([]);
   const [edges, setEdges] = useState<Edge[]>([]);
   const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
   const [connectionMode, setConnectionMode] = useState<ConnectionMode>('add');
   const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [familyUuid, setFamilyUuid] = useState<string | null>(null);
    const { user } = useAuth();

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const normalizeEdges = (edges: Edge[]) => {
    const seen = new Set<string>();
    return edges.filter((e) => {
      const key = `${e.source}-${e.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadTree = useCallback(async (fid: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tree?family_id=${fid}`);
      const data = await response.json();
      
      if (data.nodes && data.edges) {
        setFamilyId(fid);
        setNodes(data.nodes);
        setEdges(normalizeEdges(data.edges));

        // Also fetch the stable family_uuid for share links
        try {
          const famRes = await fetch(`/api/family?id=${fid}`);
          if (famRes.ok) {
            const famData = await famRes.json();
            if (famData.uuid) setFamilyUuid(famData.uuid);
          }
        } catch (e) {
          console.warn('Could not load family uuid for share link');
        }
      }
    } catch (error) {
      console.error('Load tree error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNode = useCallback(async (data: NewNodeData, position: { x: number; y: number }, targetFamilyId?: string) => {
    try {
      const targetFamId = targetFamilyId || familyId;
      const response = await fetch('/api/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_id: targetFamId,
          full_name: data.full_name,
          gender: data.gender,
          birth_date: data.birth_date,
          death_date: data.death_date,
          position_x: position.x,
          position_y: position.y,
          user_id: data.user_id
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add node');
      }
      
      const newNode = await response.json();
      
      if (!newNode?.id) {
        throw new Error('Invalid response from server');
      }
      
      const node: Node<FamilyNodeData> = {
        id: newNode.id.toString(),
        type: 'custom',
        position,
        data: {
          id: newNode.id.toString(),
          family_id: newNode.family_id,
          user_id: newNode.user_id,
          full_name: newNode.full_name,
          gender: newNode.gender,
          birth_date: newNode.birth_date,
          death_date: newNode.death_date,
          photo_url: newNode.photo_url,
          is_alive: newNode.is_alive !== false,
          nasab_line: newNode.nasab_line,
          birth_order: newNode.birth_order,
          father_id: newNode.father_id?.toString(),
          mother_id: newNode.mother_id?.toString(),
          spouse_ids: [],
          children_ids: [],
          invitation_email: newNode.invitation_email,
          invitation_status: newNode.invitation_status,
          position_x: newNode.position_x,
          position_y: newNode.position_y,
          created_at: newNode.created_at,
          updated_at: newNode.updated_at,
        }
      };

      setNodes(prev => [...prev, node]);
      closeModal();
    } catch (error) {
      console.error('Add node error:', error);
    }
  }, [familyId, closeModal]);

  const loadUserNode = useCallback(async (userId: string, fullName: string, gender: 'male' | 'female', birthDate?: string) => {
    try {
      const response = await fetch(`/api/tree/me?user_id=${userId}`);
      const data = await response.json();
      
      if (data.node) {
        const fid = String(data.node.family_id);
        const treeResponse = await fetch(`/api/tree?family_id=${fid}`);
        const treeData = await treeResponse.json();
        
        if (treeData.nodes && treeData.edges) {
          setFamilyId(fid);
          setNodes(treeData.nodes);
          setEdges(treeData.edges);

          try {
            const famRes = await fetch(`/api/family?id=${fid}`);
            if (famRes.ok) {
              const famData = await famRes.json();
              if (famData.uuid) setFamilyUuid(famData.uuid);
            }
          } catch {}
        }
      } else if (data.family_id) {
        const fid = String(data.family_id);
        const treeResponse = await fetch(`/api/tree?family_id=${fid}`);
        const treeData = await treeResponse.json();
        
        if (treeData.nodes && treeData.edges) {
          setFamilyId(fid);
          setNodes(treeData.nodes);
          setEdges(treeData.edges);

          try {
            const famRes = await fetch(`/api/family?id=${fid}`);
            if (famRes.ok) {
              const famData = await famRes.json();
              if (famData.uuid) setFamilyUuid(famData.uuid);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Load user node error:', error);
    }
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<FamilyNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const deleteEdge = useCallback(async (nodeA: string, nodeB: string, type: 'spouse' | 'child') => {
    try {
      await fetch(`/api/tree/edge`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_a: nodeA, node_b: nodeB, type })
      });
      if (familyId) {
        const response = await fetch(`/api/tree?family_id=${familyId}`);
        const data = await response.json();
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      }
    } catch (error) {
      console.error('Delete edge error:', error);
    }
  }, [familyId, setNodes, setEdges]);

  const savePosition = useCallback(async (nodeId: string, position: { x: number; y: number }) => {
    try {
      await fetch(`/api/tree/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_x: position.x, position_y: position.y })
      });
    } catch (error) {
      console.error('Save position error:', error);
    }
  }, []);

  const connectSpouse = useCallback(async (nodeAId: string, nodeBId: string) => {
    if (!familyId) return;
    try {
      const response = await fetch(`/api/tree/${nodeAId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: nodeBId, type: 'spouse', family_id: familyId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect spouse');
      }
      console.log('[connectSpouse] success, refetching tree...');
      const treeResponse = await fetch(`/api/tree?family_id=${familyId}`);
      const data = await treeResponse.json();
      console.log('[connectSpouse] fetched nodes:', data.nodes?.length, 'first node spouse_ids:', data.nodes?.[0]?.spouse_ids);
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch (error) {
      console.error('Connect spouse error:', error);
    }
  }, [familyId, setNodes, setEdges]);

  const addChild = useCallback(async (parentId: string, data: NewNodeData) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    const position = {
      x: parent.position.x + (parent.data.gender === 'male' ? -200 : 200),
      y: parent.position.y + 200
    };

    await addNode(data, position);
  }, [nodes, addNode]);

  const connectChild = useCallback(async (parentId: string, childId: string) => {
    if (!familyId) return;
    try {
      const body = { target_id: childId, type: 'child', family_id: familyId };
      console.log('[connectChild] POST body:', { parentId, childId, body });

      const response = await fetch(`/api/tree/${parentId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const respJson = await response.json().catch(() => null);
      console.log('[connectChild] POST response status, json:', response.status, respJson);

      if (!response.ok) {
        throw new Error(respJson?.error || 'Failed to connect child');
      }

      console.log('[connectChild] server ok, parentId, childId:', parentId, childId);

      // Optimistically update local state so parent shows child immediately
      setNodes((prev) => {
        const parent = prev.find((n) => n.id === parentId);
        const child = prev.find((n) => n.id === childId);
        const parentGender = parent?.data.gender;

        console.log('[connectChild] parent found, gender:', parentGender);

        return prev.map((n) => {
          if (n.id === parentId) {
            const existing = Array.isArray(n.data.children_ids) ? n.data.children_ids : [];
            const dedup = existing.includes(childId) ? existing : [...existing, childId];
            return {
              ...n,
              data: { ...n.data, children_ids: dedup }
            };
          }

          if (n.id === childId) {
            const updatedChildData = { ...n.data } as any;
            if (parentGender === 'male') updatedChildData.father_id = parentId;
            if (parentGender === 'female') updatedChildData.mother_id = parentId;
            return { ...n, data: updatedChildData } as Node<FamilyNodeData>;
          }

          return n;
        });
      });

      // refetch authoritative tree to ensure consistency
      const treeResponse = await fetch(`/api/tree?family_id=${familyId}`);
      const data = await treeResponse.json();
      console.log('[connectChild] fetched tree full response:', data);
      console.log('[connectChild] fetched tree nodes sample:', data.nodes?.slice(0,5).map((n:any)=>({ id: n.id, children_ids: n.data?.children_ids })));
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch (error) {
      console.error('Connect child error:', error);
    }
  }, [familyId, setNodes, setEdges]);

  const deleteNode = useCallback(async (id: string) => {
    try {
      const node = nodes.find(n => n.id === id);
      if (!node) return;

      if (node.data.invitation_status === 'accepted' && node.data.user_id !== user?.id) {
        alert('Tidak dapat menghapus node milik anggota lain');
        return;
      }

      const response = await fetch(`/api/tree/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Gagal menghapus node');
        return;
      }
      if (familyId) {
        const treeResponse = await fetch(`/api/tree?family_id=${familyId}`);
        const treeData = await treeResponse.json();
        if (treeData.nodes && treeData.edges) {
          setNodes(treeData.nodes);
          setEdges(treeData.edges);
        }
      }
    } catch (error) {
      console.error('Delete node error:', error);
    }
  }, [nodes, user?.id, familyId, setNodes, setEdges]);

  const reinviteNode = useCallback(async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node?.data.invitation_email) return;

    try {
      await fetch(`/api/tree/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: node.data.invitation_email, family_id: familyId })
      });
      if (familyId) {
        const response = await fetch(`/api/tree?family_id=${familyId}`);
        const data = await response.json();
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      }
    } catch (error) {
      console.error('Reinvite error:', error);
    }
  }, [nodes, familyId, setNodes, setEdges]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedNodeId,
    connectionMode,
    isModalOpen,
    isLoading,
    familyId,
    familyUuid,
    setConnectionMode,
    openModal,
    closeModal,
    setSelectedNode: setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    addNode,
    connectSpouse,
    addChild,
    connectChild,
    deleteNode,
    deleteEdge,
    reinviteNode,
    savePosition,
    loadTree,
    loadUserNode,
  };
}