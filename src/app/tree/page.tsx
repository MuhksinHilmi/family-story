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
  Scissors,
} from "lucide-react";
import { FamilyNode } from "./components/FamilyNode";
import { AddNodeModal } from "./components/AddNodeModal";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { useFamilyTree } from "./hooks/useFamilyTree";
import { useAuth } from "@/context/auth-context";

type Mode = "default" | "spouse" | "child" | "deleteEdge";

export default function TreePage() {
   const { user, isLoading: authLoading } = useAuth();
   const [mode, setMode] = useState<Mode>("default");
const [firstSelectedNodeId, setFirstSelectedNodeId] = useState<string | null>(
      null,
    );
    const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
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
    setDetailNodeId(nodeId);
    setIsDetailOpen(true);
  }, []);

  const nodeTypes = useMemo(() => ({
    custom: function FamilyNodeWrapper(props: any) {
      // augment node data with nasab_line and siblings for display in the node detail modal
      const node = props.data as FamilyNodeData;
      const allNodes: Node<FamilyNodeData>[] = props.__rf?.__nodes || [];
      // compute nasab_line: only from father_id (bin/binti is for father lineage)
      const fatherId = node.father_id || null;
      const fatherName = fatherId ? (allNodes.find((n:any) => n.id === fatherId)?.data?.full_name) : null;
      if (fatherName) node.nasab_line = node.gender === 'male' ? `bin ${fatherName}` : `binti ${fatherName}`;

      // compute siblings (from father_id only, as they share the same nasab)
      if (fatherId) {
        const siblings = allNodes
          .filter((n:any) => n.id !== node.id && n.data.father_id === fatherId)
          .map((n:any) => n.data.full_name);
        (node as any).siblings_names = siblings;
      }

      return <FamilyNode {...props} onInfoClick={handleInfoClick} />;
    }
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
          // parent is firstSelectedNodeId, child is node.id
          connectChild(firstSelectedNodeId, node.id);

          // update local nodes state immediately so parent info shows without needing a reload
          setNodes(prev => {
            const parent = prev.find(n => n.id === firstSelectedNodeId);
            const parentName = parent?.data?.full_name;
            const parentGender = parent?.data?.gender;
            const isFather = parentGender === 'male';
            
            return prev.map(n => {
              if (n.id === node.id) {
                const updated: any = {
                  ...n.data,
                };
                
                // Only father_id sets nasab_line (bin/binti)
                if (isFather) {
                  updated.father_id = firstSelectedNodeId;
                  const childGender = (n.data as any).gender || 'male';
                  updated.nasab_line = parentName ? (childGender === 'male' ? `bin ${parentName}` : `binti ${parentName}`) : undefined;
                } else {
                  // For mother, just update mother_id, no nasab_line
                  updated.mother_id = firstSelectedNodeId;
                  updated.nasab_line = n.data.nasab_line; // keep existing or undefined
                }
                
                return {
                  ...n,
                  data: updated,
                };
              }
              return n;
            });
          });

          setFirstSelectedNodeId(null);
          setMode("default");
        }
      } else {
        setFirstSelectedNodeId(null);
      }
    },
    [mode, firstSelectedNodeId, connectSpouse, connectChild, setNodes],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (mode === "deleteEdge") {
        const parts = edge.id.split('-');
        const type = parts[0] === 'spouse' ? 'spouse' : 'child';

        // prefer using explicit source/target from edge object to avoid parsing errors
        const src = (edge as any).source as string | undefined;
        const tgt = (edge as any).target as string | undefined;
        let nodeA: string | undefined = src;
        let nodeB: string | undefined = tgt;

        if (!nodeA || !nodeB) {
          // fallback to parsing id when source/target missing
          if (type === 'spouse') {
            nodeA = parts[1];
            nodeB = parts[2];
          } else {
            if (parts.length === 4) {
              nodeA = parts[2];
              nodeB = parts[3];
            } else if (parts.length === 3) {
              nodeA = parts[1];
              nodeB = parts[2];
            } else {
              console.error('Unknown edge id format', edge.id);
              return;
            }
          }
        }

        if (!nodeA || !nodeB) {
          console.error('Cannot determine nodes for edge deletion', edge);
          return;
        }

        deleteEdge(nodeA, nodeB, type);
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
          // Only treat as parent->child when the source handle is a parent handle (bottom or right).
          const parentHandles = ['bottom', 'right'];
          const sourceHandle = (connection as any).sourceHandle as string | undefined;
          const targetHandle = (connection as any).targetHandle as string | undefined;

          const sourceIsParent = !!sourceHandle && parentHandles.includes(sourceHandle);
          const targetIsParent = !!targetHandle && parentHandles.includes(targetHandle);

          // If ambiguous (both parent handles) or reversed (target is parent), ignore to avoid duplicate/reverse calls
          if (sourceIsParent && !targetIsParent) {
            console.log('[onConnect] creating child relation parent->child', connection);
            connectChild(connection.source, connection.target);
          } else {
            console.log('[onConnect] ignored ambiguous/reversed child connection', connection);
          }
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
        onClose={() => {
          setIsDetailOpen(false);
          setDetailNodeId(null);
        }}
        nodeId={detailNodeId}
        nodes={nodes}
        onReinvite={reinviteNode}
        onDelete={deleteNode}
        currentUserId={user?.id}
      />
    </div>
  );
}