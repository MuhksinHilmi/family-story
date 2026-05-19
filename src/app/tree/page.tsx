"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  OnConnect,
  Background,
  Controls,
  EdgeChange,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FamilyNodeData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Link as LinkIcon,
  UserPlus,
  Trash2,
  Scissors,
} from "lucide-react";
import { FamilyNode } from "./components/FamilyNode";
import { AddNodeModal } from "./components/AddNodeModal";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { useFamilyTree } from "./hooks/useFamilyTree";
import { useAuth } from "@/context/auth-context";

type Mode = "default" | "spouse" | "child" | "deleteNode" | "deleteEdge";

export default function TreePage() {
   const { user, isLoading: authLoading } = useAuth();
   const [mode, setMode] = useState<Mode>("default");
   const [firstSelectedNodeId, setFirstSelectedNodeId] = useState<string | null>(
     null,
   );
   const [detailNode, setDetailNode] = useState<FamilyNodeData | null>(null);
   const [isDetailOpen, setIsDetailOpen] = useState(false);

const {
     nodes,
     setNodes,
     edges,
     setEdges,
     isModalOpen,
     openModal,
     closeModal,
     onNodesChange,
     onEdgesChange,
     connectSpouse,
     addChild,
     deleteNode,
     deleteEdge,
     connectChild,
     reinviteNode,
     savePosition,
     loadTree,
     loadUserNode,
     familyId,
   } = useFamilyTree();

   useEffect(() => {
    console.log('TreePage: nodes state after effect:', nodes.length, nodes);
  }, [nodes]);

  useEffect(() => {
    if (user && !authLoading) {
      loadUserNode(
        user.id, 
        user.full_name, 
        user.gender || 'male', 
        user.birth_date
      );
    }
  }, [user, authLoading, loadUserNode]);

  const handleInfoClick = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDetailNode(node.data);
      setIsDetailOpen(true);
    }
  }, [nodes]);

  const nodeTypes = useMemo(() => ({
    custom: (props: any) => (
      <FamilyNode
        {...props}
        onInfoClick={handleInfoClick}
      />
    ),
  }), [handleInfoClick]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FamilyNodeData>) => {
      if (mode === "spouse") {
        if (!firstSelectedNodeId) {
          setFirstSelectedNodeId(node.id);
        } else if (firstSelectedNodeId !== node.id) {
          connectSpouse(firstSelectedNodeId, node.id);
          setFirstSelectedNodeId(null);
          setMode("default");
        }
      } else if (mode === "child") {
        if (!firstSelectedNodeId) {
          setFirstSelectedNodeId(node.id);
        } else if (firstSelectedNodeId !== node.id) {
          connectChild(firstSelectedNodeId, node.id);
          setFirstSelectedNodeId(null);
          setMode("default");
        }
      } else if (mode === "deleteNode") {
        deleteNode(node.id);
      } else {
        setFirstSelectedNodeId(null);
      }
    },
    [mode, firstSelectedNodeId, connectSpouse, connectChild, deleteNode],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (mode === "deleteEdge") {
        deleteEdge(edge.id);
      }
    },
    [mode, deleteEdge],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        if (mode === "spouse") {
          connectSpouse(connection.source, connection.target);
        } else if (mode === "child") {
          connectChild(connection.source, connection.target);
        }
      }
    },
    [mode, connectSpouse, connectChild],
  );

  const onEdgesChangeHandler = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const loadTreeData = useCallback(async () => {
    if (!familyId) return;
    try {
      const response = await fetch(`/api/tree?family_id=${familyId}`);
      const data = await response.json();
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    } catch (error) {
      console.error('Load tree error:', error);
    }
  }, [familyId, setNodes, setEdges]);

  const handlePaneClick = useCallback(() => {
    setFirstSelectedNodeId(null);
  }, []);

  const handleInviteMember = useCallback(
    (email: string, fullName: string, gender: 'male' | 'female', phone?: string) => {
      if (!familyId) return;
      fetch('/api/tree/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, gender, phone, family_id: familyId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.nodeId) {
            const newNode: FamilyNodeData = {
              id: data.nodeId.toString(),
              family_id: familyId,
              user_id: undefined,
              full_name: fullName,
              gender: gender,
              invitation_email: email,
              invitation_status: 'pending',
              position_x: 0,
              position_y: 0,
              is_alive: true,
              nasab_line: undefined,
              birth_order: undefined,
              father_id: undefined,
              mother_id: undefined,
              spouse_ids: [],
              children_ids: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setNodes(prev => [...prev, { id: data.nodeId.toString(), type: 'custom', position: { x: 400, y: 100 }, data: newNode }]);
          }
          closeModal();
          loadTreeData();
          alert('Undangan terkirim!');
        })
        .catch(() => alert('Gagal mengirim undangan'));
    },
    [familyId, closeModal, setNodes, loadTreeData]
  );

  const onNodesChangeWithSave = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      changes.forEach(change => {
        if (change.type === 'position' && change.id && change.position && !change.dragging) {
          savePosition(change.id, change.position);
        }
      });
    },
    [onNodesChange, savePosition]
  );

  return (
    <div className="h-[calc(100vh-120px)]">
      <Card className="h-full">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">Pohon Keluarga</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => openModal()}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Tambah Anggota</span>
            </Button>
            <Button
              size="sm"
              variant={mode === "spouse" ? "default" : "outline"}
              onClick={() => setMode(mode === "spouse" ? "default" : "spouse")}
            >
              <LinkIcon className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Pasangan</span>
            </Button>
            <Button
              size="sm"
              variant={mode === "child" ? "default" : "outline"}
              onClick={() => setMode(mode === "child" ? "default" : "child")}
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Anak</span>
            </Button>
            <Button
              size="sm"
              variant={mode === "deleteNode" ? "destructive" : "outline"}
              onClick={() =>
                setMode(mode === "deleteNode" ? "default" : "deleteNode")
              }
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Hapus Node</span>
            </Button>
            <Button
              size="sm"
              variant={mode === "deleteEdge" ? "destructive" : "outline"}
              onClick={() =>
                setMode(mode === "deleteEdge" ? "default" : "deleteEdge")
              }
            >
              <Scissors className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Hapus Garis</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="h-full w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChangeWithSave}
              onEdgesChange={onEdgesChangeHandler}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onConnect={onConnect}
              onPaneClick={handlePaneClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <AddNodeModal
        open={isModalOpen}
        onClose={closeModal}
        onInvite={handleInviteMember}
        title="Tambah Anggota"
      />

      <NodeDetailModal
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        node={detailNode}
        onReinvite={reinviteNode}
      />
    </div>
  );
}