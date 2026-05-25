import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddNodeModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, relationshipType: 'spouse' | 'child') => void;
  title?: string;
}

export function AddNodeModal({ open, onClose, onInvite, title = 'Undang User Baru' }: AddNodeModalProps) {
  const [email, setEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState<'spouse' | 'child'>('child');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setRelationshipType('child');
      setError('');
    }
  }, [open]);

  // Note: Real-time duplicate check against old family_nodes removed during legacy cleanup.
  // New invitations go through /api/invitations which has its own validation for existing users.

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email wajib diisi');
      return;
    }
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      onInvite(email, relationshipType);
      setIsLoading(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Undang sebagai</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="relationship"
                  value="child"
                  checked={relationshipType === 'child'}
                  onChange={() => setRelationshipType('child')}
                />
                <span>Saya sebagai Orang Tua (Anak)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="relationship"
                  value="spouse"
                  checked={relationshipType === 'spouse'}
                  onChange={() => setRelationshipType('spouse')}
                />
                <span>Pasangan saya</span>
              </label>
            </div>
            <p className="text-xs text-[#6B5F4D]">
              {relationshipType === 'spouse'
                ? 'Jenis kelamin penerima akan dikunci berlawanan saat pendaftaran.'
                : 'Anak akan ditambahkan ke keluarga Anda.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Penerima</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              required
            />
            <p className="text-xs text-[#6B5F4D]">
              Orang yang diundang akan mengisi nama, jenis kelamin, dan tanggal lahir sendiri saat mendaftar melalui link.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || !email}>
              {isLoading ? 'Mengirim...' : 'Kirim Undangan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}