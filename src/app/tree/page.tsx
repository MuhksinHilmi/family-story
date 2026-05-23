"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
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
import { FamilyNode } from "./components/FamilyNode";
import { AddNodeModal } from "./components/AddNodeModal";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { InvitationConfirmModal } from "./components/InvitationConfirmModal";
import { TreeHeader } from "./components/TreeHeader";
import { useFamilyTree } from "./hooks/useFamilyTree";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

export default function TreePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [firstSelectedNodeId, setFirstSelectedNodeId] = useState<string | null>(
    null,
  );
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Invitation states
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);

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
  } = useFamilyTree();

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



  const handleInviteMember = useCallback(
    (
      email: string,
      fullName: string,
      gender: "male" | "female",
      phone: string | undefined,
      relationshipType: "spouse" | "child",
    ) => {
      if (!currentUserNodeUuid) {
        alert("Node Anda belum tersedia. Silakan refresh halaman.");
        return;
      }

      const payload: any = {
        relationship_type: relationshipType,
        invitee_email: email,
        is_share_link: true,
      };

      if (relationshipType === "child") {
        payload.parent_node_uuid = currentUserNodeUuid;
      }

      apiFetch("/api/invitations", {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          closeModal();

          if (data.error) {
            alert("Gagal mengirim undangan: " + data.error);
            return;
          }

          // Refresh bell list of pending invitations
          // (we can emit a custom event or call the fetch function if exposed)
          window.dispatchEvent(new CustomEvent('invitations-updated'));

          if (data.share_link?.token) {
            const link = `${window.location.origin}/auth/register?invite=${data.share_link.token}`;
            const confirmed = confirm(
              `Undangan berhasil dibuat!\n\n` +
              `Bagikan link ini ke ${fullName} (${email}):\n\n${link}\n\n` +
              `Link akan kadaluarsa dalam 7 hari dan hanya bisa dipakai sekali.`
            );
            if (confirmed) {
              navigator.clipboard?.writeText(link).catch(() => {});
            }
          } else {
            alert(`Undangan berhasil dikirim ke ${email}. Mereka akan menerima email.`);
          }

          // Do NOT add ghost node to the graph anymore.
          // The person will appear automatically after they register + claim.
        })
        .catch((err) => {
          console.error("Invite error:", err);
          alert("Gagal mengirim undangan");
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
          />
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
              // onEdgeClick={onEdgeClick}
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
        onDelete={deleteNode}
        currentUserId={user?.id}
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

          // Optionally reload tree data if we have a family loaded
          if (familyId) {
            // re-fetch current family (new schema loader)
            fetch(`/api/tree?family_id=${familyId}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.nodes) setNodes(d.nodes);
                if (d.edges) setEdges(d.edges);
              })
              .catch(() => {});
          }
        }}
      />
    </div>
  );
}
