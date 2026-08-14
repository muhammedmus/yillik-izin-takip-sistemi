import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const emptyForm = {
  name: "", email: "", username: "", password: "", password2: "",
  role: "hr", departman: "", aktif: true, aciklama: "",
};

export function UserFormDialog({ open, onOpenChange, initial, onSaved }) {
  const isEdit = !!initial;
  const [f, setF] = useState(emptyForm);

  useEffect(() => {
    if (initial) {
      setF({
        name: initial.name || "", email: initial.email || "", username: initial.username || "",
        password: "", password2: "", role: initial.role || "hr",
        departman: initial.departman || "", aktif: initial.aktif !== false,
        aciklama: initial.aciklama || "",
      });
    } else {
      setF(emptyForm);
    }
  }, [initial, open]);

  const save = async () => {
    if (!f.name || !f.email) return toast.error("Ad Soyad ve E-posta zorunlu");
    if (!isEdit) {
      if (!f.password) return toast.error("Şifre zorunlu");
      if (f.password !== f.password2) return toast.error("Şifreler eşleşmiyor");
      try {
        await api.post("/users", {
          name: f.name, email: f.email, username: f.username || f.email,
          password: f.password, role: f.role, departman: f.departman,
          aktif: f.aktif, aciklama: f.aciklama,
        });
        toast.success("Kullanıcı oluşturuldu");
        onOpenChange(false); onSaved();
      } catch (e) { toast.error(formatApiError(e)); }
    } else {
      try {
        await api.put(`/users/${initial.id}`, {
          name: f.name, email: f.email, username: f.username,
          role: f.role, departman: f.departman, aktif: f.aktif, aciklama: f.aciklama,
        });
        toast.success("Kullanıcı güncellendi");
        onOpenChange(false); onSaved();
      } catch (e) { toast.error(formatApiError(e)); }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid={isEdit ? "edit-user-dialog" : "new-user-dialog"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}</DialogTitle>
          <DialogDescription>Kullanıcı bilgilerini {isEdit ? "güncelleyin" : "girin"}. E-posta ve kullanıcı adı benzersiz olmalıdır.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Ad Soyad *</Label><Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} data-testid="uf-name" /></div>
          <div><Label>E-posta *</Label><Input type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} data-testid="uf-email" /></div>
          <div><Label>Kullanıcı Adı</Label><Input value={f.username} onChange={(e) => setF((s) => ({ ...s, username: e.target.value }))} placeholder="Boş bırakırsanız e-posta kullanılır" data-testid="uf-username" /></div>
          <div>
            <Label>Rol *</Label>
            <Select value={f.role} onValueChange={(v) => setF((s) => ({ ...s, role: v }))}>
              <SelectTrigger data-testid="uf-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Yönetici</SelectItem>
                <SelectItem value="hr">İnsan Kaynakları</SelectItem>
                <SelectItem value="viewer">Sadece Rapor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Departman</Label><Input value={f.departman} onChange={(e) => setF((s) => ({ ...s, departman: e.target.value }))} data-testid="uf-departman" /></div>
          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={f.aktif} onChange={(e) => setF((s) => ({ ...s, aktif: e.target.checked }))} id="uf-aktif" data-testid="uf-aktif" />
            <Label htmlFor="uf-aktif" className="cursor-pointer">Aktif kullanıcı</Label>
          </div>
          {!isEdit && (
            <>
              <div><Label>Şifre *</Label><Input type="password" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} data-testid="uf-password" /></div>
              <div><Label>Şifre (tekrar) *</Label><Input type="password" value={f.password2} onChange={(e) => setF((s) => ({ ...s, password2: e.target.value }))} data-testid="uf-password2" /></div>
            </>
          )}
          <div className="md:col-span-2"><Label>Açıklama</Label><Textarea rows={2} value={f.aciklama} onChange={(e) => setF((s) => ({ ...s, aciklama: e.target.value }))} data-testid="uf-aciklama" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="uf-save">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
