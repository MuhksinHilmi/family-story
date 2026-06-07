import { useState } from "react";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FamilyNodeData } from "@/types";
import { Node } from "@xyflow/react";
import {
  Mail,
  Calendar,
  User,
  Send,
  Heart,
  Users,
  Trash2,
  Unlock,
} from "lucide-react";

interface NodeDetailModalProps {
  open: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodes: Node<FamilyNodeData>[];
  onReinvite?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  currentUserId?: string;
  currentUserNodeUuid?: string | null;
  onBreakClick?: (nodeId: string, relatedNodeId: string | null, relationshipType: 'spouse' | 'father' | 'mother' | 'child' | null) => void;
}

export function NodeDetailModal({
  open,
  onClose,
  nodeId,
  nodes,
  onReinvite,
  onDelete,
  currentUserId,
  currentUserNodeUuid,
  onBreakClick,
}: NodeDetailModalProps) {
  const [isReinviting, setIsReinviting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const formatBirthDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      // Format: Kamis, 10 April 1987
      return format(date, 'EEEE, d MMMM yyyy', { locale: id });
    } catch {
      return dateStr;
    }
  };

  const node = nodeId
    ? nodes.find((n) => String(n.id) === String(nodeId))?.data
    : null;

  if (!node) return null;

  const isPending = node.invitation_status === "pending";
  const isOwnNode = node.user_id === currentUserId;
  const canDelete = isOwnNode || isPending;

  const getNodeName = (id?: string | number) => {
    if (id === undefined || id === null) return null;
    const idStr = String(id);
    const n = nodes.find((n) => String(n.id) === idStr);
    return n?.data?.full_name || null;
  };

  const getGender = (id?: string | number) => {
    if (id === undefined || id === null) return null;
    const idStr = String(id);
    const n = nodes.find((n) => String(n.id) === idStr);
    return n?.data?.gender || null;
  };

  const getChildrenSorted = () => {
    // prefer explicit children_ids returned by server
    if (node.children_ids && node.children_ids.length > 0) {
      return node.children_ids.map((id) => {
        const idStr = String(id);
        const childNode = nodes.find((n) => n.id === idStr)?.data || null;
        return {
          id: idStr,
          name: childNode?.full_name || getNodeName(idStr) || "",
          gender: childNode?.gender || getGender(idStr) || null,
          father_id: childNode?.father_id || null,
          mother_id: childNode?.mother_id || null,
        };
      });
    }

    // fallback: compute children by scanning other nodes for parent pointers
    const inferred = nodes
      .filter((n) => n.id !== node.id)
      .filter(
        (n) =>
          String(n.data.father_id) === String(node.id) ||
          String(n.data.mother_id) === String(node.id),
      )
      .map((n) => ({
        id: n.id,
        name: n.data.full_name,
        gender: n.data.gender,
        father_id: n.data.father_id,
        mother_id: n.data.mother_id,
      }));

    return inferred;
  };

  const handleReinvite = () => {
    if (!node || !onReinvite) return;
    setIsReinviting(true);
    setTimeout(() => {
      onReinvite(node.id);
      setIsReinviting(false);
    }, 500);
  };

  const handleDelete = () => {
    if (!onDelete || !node) return;
    onDelete(node.id);
    setShowConfirm(false);
    setConfirmText("");
    onClose();
  };

  const spouseName = node.spouse_ids.map((id) => getNodeName(id)).find(Boolean);
  const fatherName = node.father_id
    ? getNodeName(node.father_id)
    : nodes.find(
        (n) =>
          Array.isArray(n.data.children_ids) &&
          n.data.children_ids.map(String).includes(String(node.id)) &&
          n.data.gender === "male",
      )?.data?.full_name ||
      null;
  const motherName = node.mother_id
    ? getNodeName(node.mother_id)
    : nodes.find(
        (n) =>
          Array.isArray(n.data.children_ids) &&
          n.data.children_ids.map(String).includes(String(node.id)) &&
          n.data.gender === "female",
      )?.data?.full_name ||
      null;
  const children = getChildrenSorted();

  const isWife = node.gender === "female" && spouseName;
  const isHusband = node.gender === "male" && spouseName;
  const hasFather = !!fatherName;
  const hasMother = !!motherName;
  const hasChildren = children.length > 0;

  const siblings = node.father_id
    ? nodes
        .filter(
          (n) =>
            String(n.id) !== String(node.id) &&
            String(n.data.father_id) === String(node.father_id),
        )
        .map((n) => n.data.full_name)
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informasi Anggota</DialogTitle>
          <DialogDescription>
            Detail informasi kekeluargaan untuk {node.full_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-[#D4C4A8]">
              {node.photo_url ? (
                <img
                  src={node.photo_url}
                  alt={node.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#D6EAD9] flex items-center justify-center text-xl font-bold text-[#2E5239]">
                  {node.full_name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg text-[#3B2F1E]">{node.full_name}</h3>
              {node.nasab_line && (
                <h4 className="text-sm text-[#8B6F47]">{node.nasab_line}</h4>
              )}
              {fatherName && !node.nasab_line && (
                <div className="text-sm text-[#6B5B45]">
                  {node.gender === "male"
                    ? `bin ${fatherName.split(/\s+/)[0]}`
                    : `binti ${fatherName.split(/\s+/)[0]}`}
                </div>
              )}
              <p className="text-sm text-[#9C8B75]">
                {isPending ? "Menunggu konfirmasi" : "Anggota aktif"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {node.invitation_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#9C8B75]" />
                <span className="text-sm text-[#3B2F1E]">{node.invitation_email}</span>
              </div>
            )}
            {spouseName && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-[#9C8B75]" />
                  <span className="text-sm text-[#3B2F1E]">
                    {isHusband ? "Istri" : "Suami"}: {spouseName}
                  </span>
                </div>
                {/* Show break button if current user can break this marriage */}
                {onBreakClick && (
                  <button
                    type="button"
                    onClick={() => {
                      onBreakClick(node.id, node.spouse_ids?.[0] || null, 'spouse');
                    }}
                    className="p-1 rounded hover:bg-[#F5E8C8] text-[#C4922A] transition-colors"
                    title="Putuskan hubungan pernikahan"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {hasFather && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#9C8B75]" />
                  <span className="text-sm text-[#3B2F1E]">Ayah: {fatherName}</span>
                </div>
                {/* Show break button for father relationship */}
                {onBreakClick && (
                  <button
                    type="button"
                    onClick={() => {
                      onBreakClick(node.id, node.father_id || null, 'father');
                    }}
                    className="p-1 rounded hover:bg-[#F5E8C8] text-[#C4922A] transition-colors"
                    title="Putuskan hubungan ayah"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {hasMother && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#9C8B75]" />
                  <span className="text-sm text-[#3B2F1E]">Ibu kandung: {motherName}</span>
                </div>
                {/* Show break button for mother relationship */}
                {onBreakClick && (
                  <button
                    type="button"
                    onClick={() => {
                      onBreakClick(node.id, node.mother_id || null, 'mother');
                    }}
                    className="p-1 rounded hover:bg-[#F5E8C8] text-[#C4922A] transition-colors"
                    title="Putuskan hubungan ibu"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {node.birth_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#9C8B75]" />
                <span className="text-sm text-[#3B2F1E]">Lahir: {formatBirthDate(node.birth_date)}</span>
              </div>
            )}
            {hasChildren && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-[#9C8B75] mt-0.5" />
                <div className="flex flex-col gap-1">
                  {children.map((child, index) => (
                    <span key={child.id} className="text-sm text-[#3B2F1E]">
                      Anak {index + 1}: {child.name}
                      <span
                        className={`${child.gender === "male" ? "text-[#4A7C59]" : "text-[#8B6F47]"} inline-block ml-2`}
                      >
                        {child.gender === "male" ? "♂" : "♀"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {siblings.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#9C8B75]" />
                <span className="text-sm text-[#3B2F1E]">
                  Saudara kandung: {siblings.join(", ")}
                </span>
              </div>
            )}

            {isPending && (
              <div className="bg-[#F5E8C8] border border-[#D4C4A8] rounded-lg p-3">
                <p className="text-sm text-[#9C8B75]">
                  Undangan belum diterima. Klik tombol di bawah untuk mengirim
                  ulang undangan.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
            {isPending && (
              <Button onClick={handleReinvite} disabled={isReinviting}>
                <Send className="h-4 w-4 mr-1" />
                {isReinviting ? "Mengirim..." : "Kirim Ulang Undangan"}
              </Button>
            )}
            {canDelete && !showConfirm && (
              <Button variant="destructive" onClick={() => setShowConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Hapus Anggota
              </Button>
            )}
          </DialogFooter>

          {showConfirm && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium text-[#3B2F1E]">
                Ketik "HAPUS" untuk konfirmasi
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="HAPUS"
                className="mt-2"
              />
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmText !== "HAPUS"}
                >
                  Ya, Hapus
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
