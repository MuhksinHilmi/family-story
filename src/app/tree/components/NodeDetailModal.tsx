import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FamilyNodeData } from '@/types';
import { Node } from '@xyflow/react';
import { Mail, Phone, Calendar, User, Send, Heart, Users, Trash2, Cake } from 'lucide-react';

interface NodeDetailModalProps {
  open: boolean;
  onClose: () => void;
  node: FamilyNodeData | null;
  nodes: Node<FamilyNodeData>[];
  onReinvite?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  currentUserId?: string;
}

export function NodeDetailModal({ open, onClose, node, nodes, onReinvite, onDelete, currentUserId }: NodeDetailModalProps) {
  const [isReinviting, setIsReinviting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  if (!node) return null;

  const isPending = node.invitation_status === 'pending';
  const isOwnNode = node.user_id === currentUserId;
  const canDelete = isOwnNode || isPending;

  const getNodeName = (id?: string) => {
    if (!id) return null;
    const n = nodes.find(n => n.id === id);
    return n?.data?.full_name || null;
  };

  const getGender = (id?: string) => {
    if (!id) return null;
    const n = nodes.find(n => n.id === id);
    return n?.data?.gender || null;
  };

  const getChildrenSorted = () => {
    if (!node.children_ids || node.children_ids.length === 0) return [];
    return node.children_ids
      .map(id => ({ id, name: getNodeName(id) || '', gender: getGender(id) }))
      .sort((a, b) => {
        const orderA = nodes.find(n => n.id === a.id)?.data?.birth_order;
        const orderB = nodes.find(n => n.id === b.id)?.data?.birth_order;
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        return 0;
      });
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
    setConfirmText('');
    onClose();
  };

  const spouseName = node.spouse_ids.map(id => getNodeName(id)).find(Boolean);
  const fatherName = getNodeName(node.father_id);
  const motherName = getNodeName(node.mother_id);
  const children = getChildrenSorted();

  const isWife = node.gender === 'female' && spouseName;
  const isHusband = node.gender === 'male' && spouseName;
  const hasFather = !!fatherName;
  const hasMother = !!motherName && !hasFather;
  const hasChildren = children.length > 0;

  const siblings = nodes
    .filter(n => n.id !== node.id)
    .filter(n => (n.data.father_id === node.father_id && node.father_id) || 
                  (n.data.mother_id === node.mother_id && node.mother_id))
    .map(n => n.data.full_name);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informasi Anggota</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full overflow-hidden border">
              {node.photo_url ? (
                <img src={node.photo_url} alt={node.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xl font-bold">
                  {node.full_name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{node.full_name}</h3>
              <p className="text-sm text-gray-500">
                {isPending ? 'Menunggu konfirmasi' : 'Anggota aktif'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {node.invitation_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{node.invitation_email}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{node.gender === 'male' ? 'Laki-laki' : 'Perempuan'}</span>
            </div>
            {node.birth_date && (
              <div className="flex items-center gap-2">
                <Cake className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{new Date(node.birth_date).toLocaleDateString('id-ID')}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {isWife && (
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Istri: {spouseName}</span>
              </div>
            )}
            {isHusband && (
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Suami: {spouseName}</span>
              </div>
            )}
            {hasFather && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Ayah: {fatherName}</span>
              </div>
            )}
            {hasMother && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Ibu: {motherName}</span>
              </div>
            )}
            {hasChildren && children.map((child, index) => {
              const nasab = child.gender === 'male' && fatherName ? `bin ${fatherName}` : 
                           child.gender === 'female' && fatherName ? `binti ${fatherName}` : '';
              return (
                <div key={child.id} className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    Anak {index + 1}: {child.name} ({child.gender === 'male' ? 'L' : 'P'}){nasab && ` ${nasab}`}
                  </span>
                </div>
              );
            })}
          </div>

          {siblings.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Saudara kandung: {siblings.join(', ')}</span>
            </div>
          )}

          {isPending && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-700">
                Undangan belum diterima. Klik tombol di bawah untuk mengirim ulang undangan.
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
              {isReinviting ? 'Mengirim...' : 'Kirim Ulang Undangan'}
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
            <Label className="text-sm font-medium">Ketik "HAPUS" untuk konfirmasi</Label>
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
                disabled={confirmText !== 'HAPUS'}
              >
                Ya, Hapus
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}