import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddNodeModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, fullName: string, gender: 'male' | 'female', phone: string | undefined, relationshipType: 'spouse' | 'child') => void;
  title?: string;
}

export function AddNodeModal({ open, onClose, onInvite, title = 'Tambah Anggota' }: AddNodeModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    invitation_email: '',
    gender: 'male' as 'male' | 'female',
    phone: '',
  });
  const [relationshipType, setRelationshipType] = useState<'spouse' | 'child'>('child');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({
        full_name: '',
        invitation_email: '',
        gender: 'male',
        phone: '',
      });
      setRelationshipType('child');
      setErrors({});
    }
  }, [open]);

  // Note: Real-time duplicate check against old family_nodes removed during legacy cleanup.
  // New invitations go through /api/invitations which has its own validation for existing users.

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invitation_email || !formData.full_name) return;
    if (errors.email) return;
    setIsLoading(true);
    setTimeout(() => {
      onInvite(formData.invitation_email, formData.full_name, formData.gender, formData.phone || undefined, relationshipType);
      setIsLoading(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nama</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Undang sebagai</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="relationship"
                  value="child"
                  checked={relationshipType === 'child'}
                  onChange={() => setRelationshipType('child')}
                />
                <span>Saya sebagai Orang Tua</span>
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
                ? 'Jenis kelamin akan dikunci berlawanan saat pendaftaran.' 
                : 'Anak akan ditambahkan ke keluarga nuklir Anda (aturan ayah sebagai pemilik).'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invitation_email">Email</Label>
            <Input
              id="invitation_email"
              type="email"
              placeholder="email@contoh.com"
              value={formData.invitation_email}
              onChange={(e) => {
                setFormData({ ...formData, invitation_email: e.target.value });
                if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
              }}
              required
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label>Jenis Kelamin</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={() => setFormData({ ...formData, gender: 'male' })}
                />
                Laki-laki
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={() => setFormData({ ...formData, gender: 'female' })}
                />
                Perempuan
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">No. HP (Opsional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="081234567890"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              aria-invalid={false}
            />

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || !!errors.email}>
              {isLoading ? 'Memproses...' : 'Kirim Undangan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}