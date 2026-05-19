import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FamilyNodeData } from '@/types';
import { Mail, Phone, Calendar, User, Send, Heart, Users } from 'lucide-react';

interface NodeDetailModalProps {
  open: boolean;
  onClose: () => void;
  node: FamilyNodeData | null;
  onReinvite?: (nodeId: string) => void;
}

export function NodeDetailModal({ open, onClose, node, onReinvite }: NodeDetailModalProps) {
  const [isReinviting, setIsReinviting] = useState(false);

  if (!node) return null;

  const isPending = node.invitation_status === 'pending';
  const isDeceased = node.is_alive === false;

  const handleReinvite = () => {
    if (!node || !onReinvite) return;
    setIsReinviting(true);
    setTimeout(() => {
      onReinvite(node.id);
      setIsReinviting(false);
    }, 500);
  };

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
                {isPending ? 'Menunggu konfirmasi' : isDeceased ? 'Almarhum' : 'Anggota aktif'}
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
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{new Date(node.birth_date).toLocaleDateString('id-ID')}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{isDeceased ? 'Almarhum' : 'Hidup'}</span>
            </div>
          </div>

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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}