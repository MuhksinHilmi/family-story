import { useState, useCallback, useMemo, useRef } from "react";
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { FamilyNodeData } from "@/types";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

type ConnectionMode = "add" | "spouse" | "child";

interface NewNodeData {
  full_name: string;
  gender: "male" | "female";
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
  currentUserNodeUuid: string | null;
  setConnectionMode: (mode: ConnectionMode) => void;
  openModal: () => void;
  closeModal: () => void;
  setSelectedNode: (id: string | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addNode: (
    data: NewNodeData,
    position: { x: number; y: number },
    familyId?: string,
  ) => Promise<void>;
  connectSpouse: (nodeAId: string, nodeBId: string) => void;
  addChild: (parentId: string, data: NewNodeData) => void;
  connectChild: (parentId: string, childId: string) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (nodeA: string, nodeB: string, type: "spouse" | "child") => void;
  reinviteNode: (id: string) => void;
  savePosition: (nodeId: string, position: { x: number; y: number }) => void;
  loadTree: (familyId: string) => Promise<void>;
  loadUserNode: (
    userId: string,
    fullName: string,
    gender: "male" | "female",
    birthDate?: string,
  ) => Promise<void>;

  // Fase 1 & 2: Incremental loading + exploration tracking
  addRelatedNodes: (
    newNodes: any[],
    newEdges: any[],
    exploredFromNodeId?: string,
  ) => void;
  markNodeAsExplored: (nodeId: string) => void;
  markNodesAsExplored: (nodeIds: string[]) => void;
  getNodesWithMoreRelations: () => string[];

  // Fase 5
  loadMoreGlobally: (maxAdditional?: number) => Promise<{ added: number }>;

  // A4: Extended groups
  currentUserExtendedGroups: number[];

  // A4: Load nodes from the user's extended groups (with limit + override for reliable trigger)
  loadFromUserExtendedGroups: (
    maxGroups?: number,
    groupIdsOverride?: number[],
    maxNodes?: number,
  ) => Promise<{ added: number }>;
}

export function useFamilyTree(): UseFamilyTreeReturn {
  const [nodes, setNodes] = useState<Node<FamilyNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("add");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyUuid, setFamilyUuid] = useState<string | null>(null);
  const [currentUserNodeUuid, setCurrentUserNodeUuid] = useState<string | null>(
    null,
  );
  const [exploredNodeIds, setExploredNodeIds] = useState<Set<string>>(
    new Set(),
  );
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
        setExploredNodeIds(new Set()); // reset exploration state on full reload

        // Also fetch the stable family_uuid for share links
        try {
          const famRes = await fetch(`/api/family?id=${fid}`);
          if (famRes.ok) {
            const famData = await famRes.json();
            if (famData.uuid) setFamilyUuid(famData.uuid);
          }
        } catch (e) {
          console.warn("Could not load family uuid for share link");
        }
      }
    } catch (error) {
      console.error("Load tree error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNode = useCallback(
    async (
      data: NewNodeData,
      position: { x: number; y: number },
      targetFamilyId?: string,
    ) => {
      try {
        const targetFamId = targetFamilyId || familyId;
        const response = await fetch("/api/tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            family_id: targetFamId,
            full_name: data.full_name,
            gender: data.gender,
            birth_date: data.birth_date,
            death_date: data.death_date,
            position_x: position.x,
            position_y: position.y,
            user_id: data.user_id,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to add node");
        }

        const newNode = await response.json();

        if (!newNode?.id) {
          throw new Error("Invalid response from server");
        }

        const node: Node<FamilyNodeData> = {
          id: newNode.id.toString(),
          type: "custom",
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
          },
        };

        setNodes((prev) => [...prev, node]);
        closeModal();
      } catch (error) {
        console.error("Add node error:", error);
      }
    },
    [familyId, closeModal],
  );

  const loadUserNode = useCallback(
    async (
      userId: string,
      fullName: string,
      gender: "male" | "female",
      birthDate?: string,
    ) => {
      try {
        const response = await fetch(`/api/tree/me?user_id=${userId}`);
        const data = await response.json();

        const hasNode = !!data.node;
        let fid = data.family_id ? String(data.family_id) : null;

        if (data.node_uuid) {
          setCurrentUserNodeUuid(data.node_uuid);
        }
        console.log(
          `[User Node] User ${userId} has node:`,
          hasNode,
          "family_id:",
          fid,
        );
        if (hasNode && fid && fid !== "null" && fid !== "undefined") {
          // Normal path: user has a nuclear family
          const treeResponse = await fetch(`/api/tree?family_id=${fid}`);
          const treeData = await treeResponse.json();

          if (treeData.nodes && treeData.edges) {
            setFamilyId(fid);
            setNodes(treeData.nodes);
            setEdges(treeData.edges);
            setExploredNodeIds(new Set()); // reset exploration on full reload

            try {
              const famRes = await fetch(`/api/family?id=${fid}`);
              if (famRes.ok) {
                const famData = await famRes.json();
                if (famData.uuid) setFamilyUuid(famData.uuid);
              }
            } catch {}

            // Reliable auto-load of extended groups right after we have the user's data
            const userGroups =
              (data.node?.extended_group_ids as number[]) || [];
            if (userGroups.length > 0) {
              loadFromUserExtendedGroupsRef.current?.(3, userGroups, 30);
            }
          }
        } else if (hasNode) {
          // User has a node but no current nuclear family yet (e.g. child invited only by mother)
          // Show at least the user as a standalone node so the page is usable

          const n = data.node;
          console.log(
            "[DEBUG] Masuk branch no-family. node id:",
            n?.id,
            "extended_group_ids dari DB:",
            n?.extended_group_ids,
          );
          const single: any = {
            id: String(n.id),
            type: "custom",
            position: {
              x: n.position_x ?? 220,
              y: n.position_y ?? 140,
            },
            data: {
              ...n,
              family_id: null,
              spouse_ids: [],
              children_ids: [],
              father_id: null,
              mother_id: null,
              nasab_line: null,
            },
          };
          setNodes([single]);
          setEdges([]);
          setFamilyId(null);
          setFamilyUuid(null);
          setExploredNodeIds(new Set());

          // Reliable auto-load of extended groups (critical for users who only have extended group
          // membership but no nuclear family yet, e.g. newly added parent via child invitation)
          const userGroups = (n?.extended_group_ids as number[]) || [];
          if (userGroups.length > 0) {
            console.log(
              "[ExtendedLoad] Triggering from no-family branch for user",
              userId,
              "groups:",
              userGroups,
            );
            loadFromUserExtendedGroupsRef.current?.(3, userGroups, 30);
          }
        } else {
          // No node at all (edge case) - create a placeholder from the logged-in user info
          const placeholderId = "me-" + userId;
          const placeholder = {
            id: placeholderId,
            type: "custom",
            position: { x: 220, y: 140 },
            data: {
              id: placeholderId,
              family_id: null,
              user_id: userId,
              full_name: fullName,
              gender,
              birth_date: birthDate,
              is_alive: true,
              spouse_ids: [],
              children_ids: [],
              father_id: null,
              mother_id: null,
              nasab_line: null,
              invitation_status: "accepted",
              position_x: 220,
              position_y: 140,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          };
          setNodes([placeholder as any]);
          setEdges([]);
          setFamilyId(null);
          setExploredNodeIds(new Set());
        }
      } catch (error) {
        console.error("Load user node error:", error);
      }
    },
    [],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<FamilyNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const deleteEdge = useCallback(
    async (_nodeA: string, _nodeB: string, _type: "spouse" | "child") => {
      // Legacy endpoint removed during 2026 schema migration.
      // Canvas editing (connect/delete between existing nodes) is temporarily disabled.
      console.warn(
        "[Tree] deleteEdge is disabled during new schema migration.",
      );
      alert(
        "Fitur hapus relasi antar node sedang dalam pengembangan ulang untuk schema baru.",
      );
    },
    [],
  );

  const savePosition = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      try {
        const res = await apiFetch(`/api/tree/${nodeId}`, {
          method: "PUT",
          body: JSON.stringify({
            position_x: position.x,
            position_y: position.y,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error(
            "Gagal menyimpan posisi node:",
            data.error || res.status,
          );
        }
      } catch (error) {
        console.error("Save position error:", error);
      }
    },
    [],
  );

  // ========== FASE 1: Incremental Loading Helpers ==========

  const mergeNodes = useCallback(
    (existing: Node<FamilyNodeData>[], incoming: any[]) => {
      const nodeMap = new Map(existing.map((n) => [n.id, n]));

      incoming.forEach((newNode: any) => {
        const id = String(newNode.id);
        if (!nodeMap.has(id)) {
          // Gunakan posisi yang sudah dihitung di addRelatedNodes jika tersedia
          const posX = newNode.position_x ?? newNode.position?.x ?? 0;
          const posY = newNode.position_y ?? newNode.position?.y ?? 0;

          nodeMap.set(id, {
            id,
            type: "custom",
            position: { x: posX, y: posY },
            data: {
              ...newNode,
              id,
              spouse_ids: newNode.spouse_ids || [],
              children_ids: newNode.children_ids || [],
              father_id: newNode.father_id ?? null,
              mother_id: newNode.mother_id ?? null,
            },
          });
        }
      });

      return Array.from(nodeMap.values());
    },
    [],
  );

  // Reconstruct the same visual style that /api/tree uses for parent-child and spouse edges
  const createStyledEdge = useCallback(
    (src: string, tgt: string, relType: string) => {
      const id = `${relType}-${src}-${tgt}`;

      if (relType === "spouse") {
        return {
          id,
          source: src,
          target: tgt,
          animated: true,
          sourceHandle: "right",
          targetHandle: "left",
          style: { stroke: "#10b981", strokeWidth: 2 }, // solid green
        };
      }

      // father or mother → dashed colored line
      const isFather = relType === "father";
      return {
        id,
        source: src,
        target: tgt,
        animated: true,
        sourceHandle: "bottom",
        targetHandle: "top",
        style: {
          stroke: isFather ? "#3b82f6" : "#ec4899",
          strokeWidth: 2,
          strokeDasharray: "4 3", // putus-putus (dashed)
        },
      };
    },
    [],
  );

  const mergeEdges = useCallback(
    (existing: Edge[], incoming: any[]) => {
      const edgeSet = new Set(existing.map((e) => `${e.source}-${e.target}`));

      const mapped = incoming
        .map((e: any) => {
          // Normalize backend shapes: /api/tree/related returns {from,to}, main tree returns {source,target}
          const src = e.source ?? e.from;
          const tgt = e.target ?? e.to;
          if (!src || !tgt) return null;

          // If the edge already carries full style (from main /api/tree), keep it
          if (e.style) {
            return {
              id: e.id || `${src}-${tgt}`,
              source: String(src),
              target: String(tgt),
              animated: e.animated ?? true,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
              style: e.style,
            } as Edge;
          }

          // Otherwise build styled edge from the relation type we receive from /related
          const relType = e.type || "default";
          return createStyledEdge(String(src), String(tgt), relType);
        })
        .filter((e): e is Edge => e !== null);

      const newEdges = mapped.filter(
        (e) => !edgeSet.has(`${e.source}-${e.target}`),
      );

      return [...existing, ...newEdges];
    },
    [createStyledEdge],
  );

  const addRelatedNodes = useCallback(
    (newNodes: any[], newEdges: any[], exploredFromNodeId?: string) => {
      if (!newNodes || newNodes.length === 0) return;

      // Phase 4: Incremental loading sekarang bersifat read-only terhadap posisi.
      // Posisi sudah diatur di server saat invite accept (spouse/child).
      // Kita hanya render apa yang ada di database (position_x / position_y).
      setNodes((prev) => mergeNodes(prev, newNodes));
      setEdges((prev) => mergeEdges(prev, newEdges || []));

      // Tandai node sebagai sudah dieksplorasi (untuk tombol reload)
      if (exploredFromNodeId) {
        setExploredNodeIds((prev) => {
          const next = new Set(prev);
          next.add(String(exploredFromNodeId));
          return next;
        });
      }
    },
    [mergeNodes, mergeEdges],
  );

  const markNodeAsExplored = useCallback((nodeId: string) => {
    setExploredNodeIds((prev) => {
      const next = new Set(prev);
      next.add(String(nodeId));
      return next;
    });
  }, []);

  const markNodesAsExplored = useCallback((nodeIds: string[]) => {
    setExploredNodeIds((prev) => {
      const next = new Set(prev);
      nodeIds.forEach((id) => next.add(String(id)));
      return next;
    });
  }, []);

  // Returns list of currently loaded nodes that have not been marked as fully explored yet.
  // These are good candidates to show a "Reload" button on.
  const getNodesWithMoreRelations = useCallback((): string[] => {
    return nodes.map((n) => n.id).filter((id) => !exploredNodeIds.has(id));
  }, [nodes, exploredNodeIds]);

  // A4: Current user's extended groups (from their node data)
  const currentUserExtendedGroups = useMemo(() => {
    if (!currentUserNodeUuid) return [];
    const userNode = nodes.find((n) => n.id === currentUserNodeUuid);
    return (userNode?.data?.extended_group_ids as number[]) || [];
  }, [nodes, currentUserNodeUuid]);

  // Fase 5: Global "load more" — picks several unexplored nodes and fetches more relations in one shot (capped)
  const loadMoreGlobally = useCallback(
    async (maxAdditional: number = 50) => {
      const seeds = getNodesWithMoreRelations().slice(0, 8); // use up to 8 seeds for breadth
      if (seeds.length === 0) return { added: 0 };

      const currentNodeIds = nodes.map((n) => n.id);

      try {
        const res = await apiFetch("/api/tree/related", {
          method: "POST",
          body: JSON.stringify({
            node_ids: seeds,
            exclude_node_ids: currentNodeIds,
            limit: maxAdditional,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Global load more failed:", err);
          return { added: 0 };
        }

        const { nodes: newNodes, relations } = await res.json();

        if (newNodes && newNodes.length > 0) {
          // Use the first seed as the "from" for positioning; others will spread anyway
          addRelatedNodes(newNodes, relations || [], seeds[0]);

          // Mark all seeds we used as explored
          markNodesAsExplored(seeds);

          return { added: newNodes.length };
        }
        return { added: 0 };
      } catch (e) {
        console.error("loadMoreGlobally error:", e);
        return { added: 0 };
      }
    },
    [nodes, getNodesWithMoreRelations, addRelatedNodes, markNodesAsExplored],
  );

  // A4: Load nodes belonging to the user's extended groups (with max groups limit)
  // Now supports explicit groupIds override for reliable trigger right after loadUserNode
  const loadFromUserExtendedGroups = useCallback(
    async (
      maxGroups: number = 3,
      groupIdsOverride?: number[],
      maxNodes: number = 150,
    ): Promise<{ added: number }> => {
      const groups = groupIdsOverride ?? currentUserExtendedGroups;

      if (groups.length === 0) {
        return { added: 0 };
      }
      // When explicit override is passed (reliable trigger from loadUserNode),
      // we may still have stale closed-over currentUserNodeUuid, so skip that guard.
      if (!groupIdsOverride && !currentUserNodeUuid) {
        return { added: 0 };
      }

      const groupsToLoad = groups.slice(0, maxGroups);
      if (groupsToLoad.length === 0) return { added: 0 };

      const currentNodeIds = nodes.map((n) => n.id);

      try {
        const groupIdsParam = groupsToLoad.join(",");
        const res = await apiFetch(
          `/api/tree/by-groups?group_ids=${groupIdsParam}&limit=${maxNodes}`,
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("loadFromUserExtendedGroups failed:", err);
          return { added: 0 };
        }

        const { nodes: newNodes, edges: newEdges = [] } = await res.json();
        console.log(
          `[ExtendedLoad] /by-groups returned ${newNodes?.length || 0} nodes and ${newEdges.length} edges for groups [${groupsToLoad.join(",")}]`,
        );

        if (newNodes && newNodes.length > 0) {
          const nodesToAdd = newNodes.filter(
            (n: any) => !currentNodeIds.includes(String(n.id)),
          );

          if (nodesToAdd.length > 0) {
            addRelatedNodes(nodesToAdd, newEdges, undefined);
            return { added: nodesToAdd.length };
          }
        }

        return { added: 0 };
      } catch (e) {
        console.error("loadFromUserExtendedGroups error:", e);
        return { added: 0 };
      }
    },
    [currentUserNodeUuid, currentUserExtendedGroups, nodes, addRelatedNodes],
  );

  // Ref for reliable triggering of extended group load from inside loadUserNode
  const loadFromUserExtendedGroupsRef = useRef(loadFromUserExtendedGroups);
  loadFromUserExtendedGroupsRef.current = loadFromUserExtendedGroups;

  const connectSpouse = useCallback(
    async (nodeAId: string, nodeBId: string) => {
      try {
        const response = await fetch(`/api/tree/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "spouse",
            node_a_id: nodeAId,
            node_b_id: nodeBId,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          alert(err.error || "Gagal menghubungkan sebagai pasangan");
          return;
        }

        // Refetch current family tree
        if (familyId) {
          const treeRes = await fetch(`/api/tree?family_id=${familyId}`);
          const treeData = await treeRes.json();
          if (treeData.nodes && treeData.edges) {
            setNodes(treeData.nodes);
            setEdges(treeData.edges);
          }
        }
      } catch (error) {
        console.error("Connect spouse error:", error);
        alert("Terjadi kesalahan saat menghubungkan pasangan");
      }
    },
    [familyId, setNodes, setEdges],
  );

  const addChild = useCallback(
    async (parentId: string, data: NewNodeData) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;

      const position = {
        x: parent.position.x + (parent.data.gender === "male" ? -200 : 200),
        y: parent.position.y + 200,
      };

      await addNode(data, position);
    },
    [nodes, addNode],
  );

  const connectChild = useCallback(
    async (parentId: string, childId: string) => {
      try {
        const response = await fetch(`/api/tree/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "child",
            parent_id: parentId,
            child_id: childId,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          alert(err.error || "Gagal menambahkan sebagai anak");
          return;
        }

        // Refetch tree after successful connection
        if (familyId) {
          const treeRes = await fetch(`/api/tree?family_id=${familyId}`);
          const treeData = await treeRes.json();
          if (treeData.nodes && treeData.edges) {
            setNodes(treeData.nodes);
            setEdges(treeData.edges);
          }
        }
      } catch (error) {
        console.error("Connect child error:", error);
        alert("Terjadi kesalahan saat menghubungkan anak");
      }
    },
    [familyId, setNodes, setEdges],
  );

  const deleteNode = useCallback(
    async (id: string) => {
      try {
        const node = nodes.find((n) => n.id === id);
        if (!node) return;

        if (
          node.data.invitation_status === "accepted" &&
          node.data.user_id !== user?.id
        ) {
          alert("Tidak dapat menghapus node milik anggota lain");
          return;
        }

        const response = await fetch(`/api/tree/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const error = await response.json();
          alert(error.error || "Gagal menghapus node");
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
        console.error("Delete node error:", error);
      }
    },
    [nodes, user?.id, familyId, setNodes, setEdges],
  );

  const reinviteNode = useCallback(async (_id: string) => {
    // Legacy reinvite removed during schema migration.
    console.warn("[Tree] reinviteNode is disabled.");
    alert(
      "Fitur kirim ulang undangan node lama sudah tidak tersedia. Gunakan tombol Tambah Anggota untuk mengundang ulang.",
    );
  }, []);

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
    currentUserNodeUuid,
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
    // Fase 1 & 2
    addRelatedNodes,
    markNodeAsExplored,
    markNodesAsExplored,
    getNodesWithMoreRelations,
    // Fase 5
    loadMoreGlobally,
    // A4: Extended groups
    currentUserExtendedGroups,
    loadFromUserExtendedGroups,
  };
}
