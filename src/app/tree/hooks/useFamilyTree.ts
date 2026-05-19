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
  deleteEdge: (id: string) => void;
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
   const { user } = useAuth();

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const loadTree = useCallback(async (fid: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tree?family_id=${fid}`);
      const data = await response.json();
      
      if (data.nodes && data.edges) {
        setFamilyId(fid);
        setNodes(data.nodes);
        setEdges(data.edges);
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
        }
      } else {
        const userFamilyId = data.family_id || familyId;
        await addNode({
          full_name: fullName,
          gender,
          birth_date: birthDate,
          user_id: userId,
        }, { x: 400, y: 100 }, userFamilyId);
      }
    } catch (error) {
      console.error('Load user node error:', error);
    }
  }, [familyId, addNode]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<FamilyNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const deleteEdge = useCallback(async (id: string) => {
    try {
      await fetch(`/api/tree/${id}/edge`, {
        method: 'DELETE',
      });
      setEdges(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Delete edge error:', error);
    }
  }, []);

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
    try {
      await fetch(`/api/tree/${nodeAId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: nodeBId, type: 'spouse', family_id: familyId })
      });
    } catch (error) {
      console.error('Connect spouse error:', error);
    }
  }, [familyId]);

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
    try {
      await fetch(`/api/tree/${parentId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: childId, type: 'child', family_id: familyId })
      });
    } catch (error) {
      console.error('Connect child error:', error);
    }
  }, [familyId]);

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
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    } catch (error) {
      console.error('Delete node error:', error);
    }
  }, [nodes, user?.id]);

  const reinviteNode = useCallback(async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node?.data.invitation_email) return;

    try {
      await fetch(`/api/tree/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: node.data.invitation_email, family_id: familyId })
      });
    } catch (error) {
      console.error('Reinvite error:', error);
    }
  }, [nodes, familyId]);

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