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
  Link as LinkIcon,
  UserPlus,
  Scissors,
  Share2,
  GitBranch,
  Pencil,
  GitFork,
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
    familyUuid,
  } = useFamilyTree();

  useEffect(() => {
    if (user && !authLoading) {
      loadUserNode(
        user.id,
        user.full_name,
        user.gender || "male",
        user.birth_date,
      );
    }
  }, [user, authLoading, loadUserNode]);

  // Client-side sync: always use the latest photo from the logged-in user's profile
  // for their own node in the tree (so avatar updates immediately after profile change)
  useEffect(() => {
    if (!user || nodes.length === 0) return;

    const latestPhoto = (user as any)?.photo_url || (user as any)?.avatar_url;
    if (!latestPhoto) return;

    const currentUserKey = (user as any)?.uuid || (user as any)?.id;

    setNodes((prev) =>
      prev.map((n) => {
        const nodeUserId = (n.data as any)?.user_id;
        if (
          nodeUserId &&
          (nodeUserId === currentUserKey || nodeUserId === user.id)
        ) {
          if (n.data.photo_url !== latestPhoto) {
            return {
              ...n,
              data: {
                ...n.data,
                photo_url: latestPhoto,
              },
            };
          }
        }
        return n;
      }),
    );
  }, [user, nodes.length]); // nodes.length to re-run when tree is (re)loaded

  const handleInfoClick = useCallback((nodeId: string) => {
    setDetailNodeId(nodeId);
    setIsDetailOpen(true);
  }, []);

  const nodeTypes = useMemo(
    () => ({
      custom: function FamilyNodeWrapper(props: any) {
        // augment node data with nasab_line and siblings for display in the node detail modal
        const node = props.data as FamilyNodeData;
        const allNodes: Node<FamilyNodeData>[] = props.__rf?.__nodes || [];
        // compute nasab_line: only from father_id (bin/binti is for father lineage)
        const fatherId = node.father_id || null;
        const fatherName = fatherId
          ? allNodes.find((n: any) => n.id === fatherId)?.data?.full_name
          : null;
        if (fatherName)
          node.nasab_line =
            node.gender === "male"
              ? `bin ${fatherName}`
              : `binti ${fatherName}`;

        // compute siblings (from father_id only, as they share the same nasab)
        if (fatherId) {
          const siblings = allNodes
            .filter(
              (n: any) => n.id !== node.id && n.data.father_id === fatherId,
            )
            .map((n: any) => n.data.full_name);
          (node as any).siblings_names = siblings;
        }

        return <FamilyNode {...props} onInfoClick={handleInfoClick} />;
      },
    }),
    [handleInfoClick],
  );

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
          setNodes((prev) => {
            const parent = prev.find((n) => n.id === firstSelectedNodeId);
            const parentName = parent?.data?.full_name;
            const parentGender = parent?.data?.gender;
            const isFather = parentGender === "male";

            return prev.map((n) => {
              if (n.id === node.id) {
                const updated: any = {
                  ...n.data,
                };

                // Only father_id sets nasab_line (bin/binti)
                if (isFather) {
                  updated.father_id = firstSelectedNodeId;
                  const childGender = (n.data as any).gender || "male";
                  updated.nasab_line = parentName
                    ? childGender === "male"
                      ? `bin ${parentName}`
                      : `binti ${parentName}`
                    : undefined;
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
        const parts = edge.id.split("-");
        const type = parts[0] === "spouse" ? "spouse" : "child";

        // prefer using explicit source/target from edge object to avoid parsing errors
        const src = (edge as any).source as string | undefined;
        const tgt = (edge as any).target as string | undefined;
        let nodeA: string | undefined = src;
        let nodeB: string | undefined = tgt;

        if (!nodeA || !nodeB) {
          // fallback to parsing id when source/target missing
          if (type === "spouse") {
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
              console.error("Unknown edge id format", edge.id);
              return;
            }
          }
        }

        if (!nodeA || !nodeB) {
          console.error("Cannot determine nodes for edge deletion", edge);
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
          const parentHandles = ["bottom", "right"];
          const sourceHandle = (connection as any).sourceHandle as
            | string
            | undefined;
          const targetHandle = (connection as any).targetHandle as
            | string
            | undefined;

          const sourceIsParent =
            !!sourceHandle && parentHandles.includes(sourceHandle);
          const targetIsParent =
            !!targetHandle && parentHandles.includes(targetHandle);

          // If ambiguous (both parent handles) or reversed (target is parent), ignore to avoid duplicate/reverse calls
          if (sourceIsParent && !targetIsParent) {
            console.log(
              "[onConnect] creating child relation parent->child",
              connection,
            );
            connectChild(connection.source, connection.target);
          } else {
            console.log(
              "[onConnect] ignored ambiguous/reversed child connection",
              connection,
            );
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
      console.error("Load tree error:", error);
    }
  }, [familyId, setNodes, setEdges]);

  const handlePaneClick = useCallback(() => {
    setFirstSelectedNodeId(null);
  }, []);

  const handleShareJoinLink = useCallback(() => {
    if (!familyUuid) {
      alert("Link keluarga belum tersedia. Coba muat ulang halaman.");
      return;
    }
    const link = `${window.location.origin}/auth/register?join=${familyUuid}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        alert(
          "Link berhasil disalin!\n\n" +
            "Kirim link ini ke anggota keluarga baru.\n" +
            "Mereka akan bergabung ke keluarga ini saat mendaftar.",
        );
      })
      .catch(() => {
        // fallback
        prompt("Salin link ini:", link);
      });
  }, [familyUuid]);

  const handleInviteMember = useCallback(
    (
      email: string,
      fullName: string,
      gender: "male" | "female",
      phone?: string,
    ) => {
      if (!familyId) return;
      fetch("/api/tree/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName,
          gender,
          phone,
          family_id: familyId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.nodeId) {
            const newNode: FamilyNodeData = {
              id: data.nodeId.toString(),
              family_id: familyId,
              user_id: undefined,
              full_name: fullName,
              gender: gender,
              invitation_email: email,
              invitation_status: "pending",
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
            setNodes((prev) => [
              ...prev,
              {
                id: data.nodeId.toString(),
                type: "custom",
                position: { x: 400, y: 100 },
                data: newNode,
              },
            ]);
          }
          closeModal();
          loadTreeData();
          alert("Undangan terkirim!");
        })
        .catch(() => alert("Gagal mengirim undangan"));
    },
    [familyId, closeModal, setNodes, loadTreeData],
  );

  const onNodesChangeWithSave = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      changes.forEach((change) => {
        if (
          change.type === "position" &&
          change.id &&
          change.position &&
          !change.dragging
        ) {
          savePosition(change.id, change.position);
        }
      });
    },
    [onNodesChange, savePosition],
  );

  return (
    <div className="h-[calc(100vh-120px)] bg-[#EDE4D3]">
      <Card className="h-full bg-[#FDFAF5] border border-[#D4C4A8]">
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <GitFork className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg text-[#3B2F1E]">
                  Pohon Keluarga
                </CardTitle>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* === Group 1: Member Actions (primary CTAs) === */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => openModal()}
                  className="bg-[#4A7C59] hover:bg-[#2E5239] text-white shadow-sm"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Tambah Anggota
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareJoinLink}
                  disabled={!familyUuid}
                  className="border-[#C4B49A] hover:bg-[#F5F0E8] text-[#3B2F1E]"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Bagikan Link
                </Button>
              </div>

              {/* Prominent vertical separator */}
              <div className="hidden sm:block h-8 w-px bg-[#C4B49A] mx-1" />

              {/* === Group 2: Edit Mode Toolbar (pill style) === */}
              <div className="flex items-center gap-2">
                {/* Label */}
                <div className="flex items-center gap-1 text-[#9C8B75]">
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold tracking-[1.5px] uppercase">
                    Mode Edit
                  </span>
                </div>

                {/* Pill container with icon-only buttons */}
                <div className="flex items-center bg-[#EDE4D3] rounded-full p-1 gap-1">
                  <Button
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all ${mode === "spouse" ? "bg-[#3B82F6] text-white shadow" : "text-[#3B2F1E] hover:bg-[#D4C4A8]"}`}
                    title="Hubungkan Pasangan"
                    onClick={() =>
                      setMode(mode === "spouse" ? "default" : "spouse")
                    }
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all ${mode === "child" ? "bg-[#3B82F6] text-white shadow" : "text-[#3B2F1E] hover:bg-[#D4C4A8]"}`}
                    title="Tambah Anak"
                    onClick={() =>
                      setMode(mode === "child" ? "default" : "child")
                    }
                  >
                    <GitBranch className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className={`h-8 w-8 rounded-full transition-all ${mode === "deleteEdge" ? "bg-red-600 text-white shadow" : "text-[#3B2F1E] hover:bg-[#D4C4A8]"}`}
                    title="Hapus Garis"
                    onClick={() =>
                      setMode(mode === "deleteEdge" ? "default" : "deleteEdge")
                    }
                  >
                    <Scissors className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Active mode instruction banner (visible only when editing) */}
          {mode !== "default" && (
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-[#FDFAF5] border border-[#D4C4A8] rounded-full px-4 py-1.5 text-xs text-[#3B2F1E] shadow-sm">
                <span className="font-medium">
                  Mode aktif:{" "}
                  {mode === "spouse"
                    ? "Hubungkan Pasangan"
                    : mode === "child"
                      ? "Tambah Anak"
                      : "Hapus Garis"}
                </span>
                <span className="text-[#9C8B75]">
                  — Klik node pertama, lalu node kedua
                </span>
              </div>
            </div>
          )}
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
