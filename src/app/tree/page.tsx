"use client";

import {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Share2 } from "lucide-react";
import { FamilyTreeLoader } from "@/components/ui/family-tree-loader";
import { FamilyNode } from "./components/FamilyNode";
import { AddNodeModal } from "./components/AddNodeModal";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { InvitationConfirmModal } from "./components/InvitationConfirmModal";
import { BreakRelationshipModal } from "./components/BreakRelationshipModal";
import { TreeHeader } from "./components/TreeHeader";
import { useFamilyTree } from "./hooks/useFamilyTree";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

function TreePageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusName = searchParams.get("focus_name") || null;
  const [firstSelectedNodeId, setFirstSelectedNodeId] = useState<string | null>(
    null,
  );
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Invitation states
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);

  // Break relationship modal state
  const [breakModalNodeId, setBreakModalNodeId] = useState<string | null>(null);
  const [breakModalRelatedNodeId, setBreakModalRelatedNodeId] = useState<
    string | null
  >(null);
  const [breakModalRelatedNodeName, setBreakModalRelatedNodeName] = useState<
    string | null
  >(null);
  const [breakModalRelationshipType, setBreakModalRelationshipType] = useState<
    "spouse" | "father" | "mother" | "child" | null
  >(null);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);

  // Loading state for "Undang User Baru" (email invite)
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);

  // Loading state for per-node reload (Fase 4)
  const [reloadingNodeId, setReloadingNodeId] = useState<string | null>(null);

  // A4: Track if we have already attempted to load from extended groups on first load
  const hasTriedExtendedLoad = useRef(false);

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
    deleteNode,
    savePosition,
    loadTree,
    loadUserNode,
    familyId,
    familyUuid,
    currentUserNodeUuid,
    addRelatedNodes,
    getNodesWithMoreRelations,
    loadMoreGlobally,
    currentUserExtendedGroups,
    loadFromUserExtendedGroups,
  } = useFamilyTree();

  // React Flow instance (safe way via onInit, not useReactFlow() at top level)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Fase 5: Global lazy loading state + derived list (declared after hook to avoid TDZ)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const nodesWithMoreRelations = useMemo(
    () => getNodesWithMoreRelations(),
    [getNodesWithMoreRelations, nodes.length],
  );

  // Client-side nasab fallback (hanya untuk node yang belum dapat nasab_line dari server)
  const nodesWithNasab = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data as FamilyNodeData;

      // Jika server sudah mengirim nasab_line, pakai itu
      if (data.nasab_line) {
        return node;
      }

      const fatherId = data.father_id;
      if (!fatherId) {
        return node;
      }

      const fatherNode = nodes.find((n) => n.id === fatherId);
      const fatherName = fatherNode?.data?.full_name;

      if (!fatherName) {
        return node;
      }

      const fatherFirstName = fatherName.trim().split(/\s+/)[0];
      const nasab_line =
        data.gender === "male"
          ? `bin ${fatherFirstName}`
          : `binti ${fatherFirstName}`;

      return {
        ...node,
        data: {
          ...data,
          nasab_line,
        },
      };
    });
  }, [nodes]);

  useEffect(() => {
    if (user && !authLoading) {
      loadUserNode(
        user.id,
        user.full_name,
        user.gender || "male",
        user.birth_date,
      );
      fetchPendingInvitations();
    }
  }, [user, authLoading, loadUserNode]);

  // Focus by name from query param (e.g., /tree?focus_name=John)
  useEffect(() => {
    if (!focusName || nodes.length === 0) return;

    const name = decodeURIComponent(focusName).toLowerCase();
    // try find exact match first
    let target = nodes.find(
      (n) => (n.data.full_name || "").toLowerCase() === name,
    );
    if (!target) {
      // partial match
      target = nodes.find((n) =>
        (n.data.full_name || "").toLowerCase().includes(name),
      );
    }

    if (target && reactFlowInstance) {
      // center and open detail
      const { x, y } = target.position;
      reactFlowInstance.setCenter(x, y, { zoom: 1.2, duration: 600 });
      setDetailNodeId(String(target.id));
      setIsDetailOpen(true);

      // remove query param to avoid repeated focus on reload
      const url = new URL(window.location.href);
      url.searchParams.delete("focus_name");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [focusName, nodes, reactFlowInstance]);

  // A4: One-time trigger on first load of the tree page (or after full refresh)
  // Automatically load nodes from the user's extended groups on initial view.
  // Capped at 30 nodes for the very first auto extended load (user can use
  // "Muat lebih banyak relasi" for the rest or for direct relations).
  useEffect(() => {
    if (
      !hasTriedExtendedLoad.current &&
      currentUserNodeUuid &&
      currentUserExtendedGroups.length > 0
    ) {
      hasTriedExtendedLoad.current = true;
      // First auto extended load: up to 3 groups, max 30 nodes total
      loadFromUserExtendedGroups(3, undefined, 30);
    }
  }, [
    currentUserNodeUuid,
    currentUserExtendedGroups,
    loadFromUserExtendedGroups,
  ]);

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

  // Phase 5: Center view on the logged-in user's own node after load
  useEffect(() => {
    if (!currentUserNodeUuid || nodes.length === 0 || !reactFlowInstance)
      return;

    const userNode = nodes.find((n) => n.id === currentUserNodeUuid);
    if (!userNode) return;

    // Gunakan setCenter agar lebih halus dan fokus ke node user
    // Bukan fitView seluruh tree
    const { x, y } = userNode.position;
    reactFlowInstance.setCenter(x, y, {
      zoom: 1.1,
      duration: 700,
    });
  }, [currentUserNodeUuid, nodes.length, reactFlowInstance]);

  const handleInfoClick = useCallback((nodeId: string) => {
    setDetailNodeId(nodeId);
    setIsDetailOpen(true);
  }, []);

  // Fetch pending invitations
  const fetchPendingInvitations = useCallback(async () => {
    try {
      const res = await apiFetch("/api/invitations?status=pending");
      if (res.ok) {
        const data = await res.json();
        if (data.invitations) {
          setPendingInvitations(data.invitations);
        }
      }
    } catch (error) {
      console.error("Failed to fetch invitations", error);
    }
  }, []);

  // === Fase 4: Reload relasi tambahan dari node tertentu ===
  const handleReload = useCallback(
    async (nodeId: string) => {
      setReloadingNodeId(nodeId);

      try {
        const currentNodeIds = nodes.map((n) => n.id);

        const res = await apiFetch("/api/tree/related", {
          method: "POST",
          body: JSON.stringify({
            node_ids: [nodeId],
            exclude_node_ids: currentNodeIds,
            limit: 30,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert("Gagal memuat relasi tambahan: " + (err.error || res.status));
          setReloadingNodeId(null);
          return;
        }

        const { nodes: newNodes, relations } = await res.json();

        if (newNodes && newNodes.length > 0) {
          addRelatedNodes(newNodes, relations || [], nodeId);
        } else {
          alert("Tidak ada relasi tambahan yang ditemukan untuk node ini.");
        }
      } catch (error) {
        console.error("Reload node error:", error);
        alert("Terjadi kesalahan saat memuat relasi tambahan.");
      } finally {
        setReloadingNodeId(null);
      }
    },
    [nodes, addRelatedNodes],
  );

  // === Handle break button click - open modal to select reason ===
  const handleBreakClick = useCallback(
    (
      nodeId: string,
      relatedNodeId: string | null,
      relationshipType: "spouse" | "father" | "mother" | "child" | null,
    ) => {
      if (!relatedNodeId || !relationshipType) {
        alert("Node ini tidak memiliki hubungan yang bisa diputuskan.");
        return;
      }

      // Find related node name from nodes
      const relatedNode = nodes.find((n) => n.id === relatedNodeId);
      const relatedName = relatedNode?.data?.full_name || "Orang tua";

      setBreakModalNodeId(nodeId);
      setBreakModalRelatedNodeId(relatedNodeId);
      setBreakModalRelatedNodeName(relatedName);
      setBreakModalRelationshipType(relationshipType);
      setIsBreakModalOpen(true);
    },
    [nodes],
  );

  // Fase 5: Global lazy load (capped)
  const handleGlobalLoadMore = useCallback(async () => {
    setIsGlobalLoading(true);
    try {
      const result = await loadMoreGlobally(50);
      if (result.added === 0) {
        // Optional: could show a toast, but keep silent for now to avoid noise
      }
    } finally {
      setIsGlobalLoading(false);
    }
  }, [loadMoreGlobally]);

  const nodeTypes = useMemo(
    () => ({
      custom: function FamilyNodeWrapper(props: any) {
        // Note: nasab_line is now pre-computed reliably in nodesWithNasab (see above)
        // We only keep sibling computation here for the detail modal (can be improved later)
        const node = props.data as FamilyNodeData;
        const allNodes: Node<FamilyNodeData>[] = props.__rf?.__nodes || [];

        // compute siblings (from father_id only)
        const fatherId = node.father_id || null;
        if (fatherId) {
          const siblings = allNodes
            .filter(
              (n: any) => n.id !== node.id && n.data.father_id === fatherId,
            )
            .map((n: any) => n.data.full_name);
          (node as any).siblings_names = siblings;
        }

        // Safety: ensure critical arrays exist on incrementally loaded nodes
        node.spouse_ids = node.spouse_ids || [];
        node.children_ids = node.children_ids || [];
        node.father_id = node.father_id ?? null;
        node.mother_id = node.mother_id ?? null;

        // Fase 4: Tentukan apakah node ini masih punya relasi yang belum diload
        const nodesWithMore = getNodesWithMoreRelations();
        const showReload = nodesWithMore.includes(props.id);
        const isReloading = reloadingNodeId === props.id;

        return (
          <FamilyNode
            {...props}
            onInfoClick={handleInfoClick}
            onReload={handleReload}
            showReloadButton={showReload}
            isReloading={isReloading}
          />
        );
      },
    }),
    [handleInfoClick, getNodesWithMoreRelations, handleReload, reloadingNodeId],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<FamilyNodeData>) => {
      handleInfoClick(node.id);
    },
    [handleInfoClick],
  );

  // Edge click handler (edit mode removed)
  const onEdgeClick = useCallback((_edge: Edge) => {
    // No action for now (deletion disabled)
  }, []);

  // Drag-to-connect disabled (use "Undang via UUID" or "Undang User Baru" instead)

  const onEdgesChangeHandler = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

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

  const handleInviteNewUser = useCallback(
    (email: string, relationshipType: "spouse" | "child") => {
      if (!currentUserNodeUuid) {
        alert("Node Anda belum tersedia. Silakan refresh halaman.");
        return;
      }

      setIsSendingInvitation(true); // show loading overlay
      closeModal(); // close the invite modal immediately

      apiFetch("/api/invitations", {
        method: "POST",
        body: JSON.stringify({
          relationship_type: relationshipType,
          invitee_email: email,
          is_share_link: true,
          ...(relationshipType === "child" && {
            parent_node_uuid: currentUserNodeUuid,
          }),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            alert("Gagal mengirim undangan: " + data.error);
            setIsSendingInvitation(false);
            return;
          }

          window.dispatchEvent(new CustomEvent("invitations-updated"));

          alert(
            `Undangan berhasil dikirim ke ${email}.\n\nPenerima akan menerima email berisi link untuk mendaftar dan bergabung.`,
          );

          setIsSendingInvitation(false); // hide loading after user clicks OK on alert
        })
        .catch((err) => {
          console.error("Invite error:", err);
          alert("Gagal mengirim undangan");
          setIsSendingInvitation(false);
        });
    },
    [currentUserNodeUuid, closeModal],
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
          <TreeHeader
            familyUuid={familyUuid}
            currentUserNodeUuid={currentUserNodeUuid}
            pendingInvitations={pendingInvitations}
            onInviteNewUser={openModal}
            onShareLink={handleShareJoinLink}
            onInvitationSelect={(inv) => {
              setSelectedInvitation(inv);
              setIsInvitationModalOpen(true);
            }}
            onBreakRequestProcessed={fetchPendingInvitations}
          />

          {/* Fase 5: Global lazy load button (only when there are unexplored nodes) */}
          {nodesWithMoreRelations.length > 0 && (
            <div className="flex justify-end px-3 -mt-1 mb-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGlobalLoadMore}
                disabled={isGlobalLoading}
                className="text-xs border-[#D4C4A8] text-[#3B2F1E] hover:bg-[#F5F0E8]"
              >
                {isGlobalLoading ? "Memuat..." : "Muat lebih banyak relasi"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="h-full w-full">
            <ReactFlow
              nodes={nodesWithNasab}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChangeWithSave}
              onEdgesChange={onEdgesChangeHandler}
              onNodeClick={onNodeClick}
              // onEdgeClick={onEdgeClick}
              onPaneClick={handlePaneClick}
              onInit={setReactFlowInstance}
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
        onInvite={handleInviteNewUser}
        title="Undang User Baru"
      />

      <NodeDetailModal
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailNodeId(null);
        }}
        nodeId={detailNodeId}
        nodes={nodesWithNasab}
        onDelete={deleteNode}
        currentUserId={user?.id}
        onBreakClick={handleBreakClick}
      />

      {/* Invitation Confirmation Modal */}
      <InvitationConfirmModal
        open={isInvitationModalOpen}
        onClose={() => {
          setIsInvitationModalOpen(false);
          setSelectedInvitation(null);
        }}
        invitation={selectedInvitation}
        onSuccess={() => {
          // Refresh invitations list + notify sidebar
          fetchPendingInvitations();
          window.dispatchEvent(new CustomEvent("invitations-updated"));

          // Reload the full tree using the current user's node (new schema path)
          if (user) {
            loadUserNode(
              user.id,
              user.full_name,
              user.gender || "male",
              user.birth_date,
            );
          }
        }}
      />

      {/* Break Relationship Modal */}
      <BreakRelationshipModal
        open={isBreakModalOpen}
        onClose={() => {
          setIsBreakModalOpen(false);
          setBreakModalNodeId(null);
          setBreakModalRelatedNodeId(null);
          setBreakModalRelatedNodeName(null);
          setBreakModalRelationshipType(null);
        }}
        nodeId={breakModalNodeId}
        relatedNodeId={breakModalRelatedNodeId}
        relatedNodeName={breakModalRelatedNodeName}
        relationshipType={breakModalRelationshipType}
        onSuccess={() => {
          // Reload the tree
          if (user) {
            loadUserNode(
              user.id,
              user.full_name,
              user.gender || "male",
              user.birth_date,
            );
          }
        }}
      />

      {/* Loading Overlay for "Undang User Baru" (Email Invite) */}
      {isSendingInvitation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-3xl px-8 py-7 shadow-xl flex flex-col items-center gap-3 min-w-[260px]">
            <FamilyTreeLoader
              fullscreen={false}
              size="sm"
              message="Mengirim undangan..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TreePage() {
  return (
    <Suspense
      fallback={<FamilyTreeLoader message="Memuat pohon keluarga..." />}
    >
      <TreePageContent />
    </Suspense>
  );
}
