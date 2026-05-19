import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddNodeModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, fullName: string, gender: 'male' | 'female', phone?: string) => void;
  title?: string;
}

export function AddNodeModal({ open, onClose, onInvite, title = 'Tambah Anggota' }: AddNodeModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    invitation_email: '',
    gender: 'male' as 'male' | 'female',
    phone: '',
  });
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({
        full_name: '',
        invitation_email: '',
        gender: 'male',
        phone: '',
      });
      setErrors({});
    }
  }, [open]);

  const validateField = async (field: 'email' | 'phone', value: string) => {
    if (!value) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
      return true;
    }

    setIsValidating(true);
    try {
      const response = await fetch(`/api/tree/validate?email=${encodeURIComponent(value)}${field === 'phone' && value ? `&phone=${encodeURIComponent(value)}` : ''}`);
      const data = await response.json();

      if (field === 'email' && data.emailExists) {
        setErrors(prev => ({ ...prev, email: 'Email sudah terdaftar atau sedang diundang' }));
        return false;
      }
      if (field === 'phone' && data.phoneExists) {
        setErrors(prev => ({ ...prev, phone: 'Nomor HP sudah terdaftar' }));
        return false;
      }
      setErrors(prev => ({ ...prev, [field]: undefined }));
      return true;
    } catch {
      setErrors(prev => ({ ...prev, [field]: undefined }));
      return true;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invitation_email || !formData.full_name) return;
    if (errors.email || errors.phone) return;
    setIsLoading(true);
    setTimeout(() => {
      onInvite(formData.invitation_email, formData.full_name, formData.gender, formData.phone || undefined);
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
            <Label htmlFor="invitation_email">Email</Label>
            <Input
              id="invitation_email"
              type="email"
              placeholder="email@contoh.com"
              value={formData.invitation_email}
              onChange={(e) => {
                setFormData({ ...formData, invitation_email: e.target.value });
                if (e.target.value) validateField('email', e.target.value);
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
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (e.target.value) validateField('phone', e.target.value);
              }}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || isValidating || !!errors.email || !!errors.phone}>
              {isLoading ? 'Memproses...' : 'Kirim Undangan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}