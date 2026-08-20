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
  role: "hr", departman: "", allowed_companies: [], aktif: true, aciklama: "",
};

export function UserFormDialog({ open, onOpenChange, initial, onSaved }) {
  const isEdit = !!initial;
  const [f, setF] = useState(emptyForm);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (!open) return;
    api.get("/personnel/facets", { params: { include_inactive: true } })
      .then(({ data }) => setCompanies(data?.companies || []))
      .catch(() => setCompanies([]));
  }, [open]);

  useEffect(() => {
    if (initial) {
      setF({
        name: initial.name || "", email: initial.email || "", username: initial.username || "",
        password: "", password2: "", role: initial.role || "hr",
        departman: initial.departman || "",
        allowed_companies: initial.role === "admin" ? [] : (initial.allowed_companies || []),
        aktif: initial.aktif !== false,
        aciklama: initial.aciklama || "",
      });
    } else {
      setF(emptyForm);
    }
  }, [initial, open]);

  const toggleCompany = (company) => {
    setF((s) => {
      const exists = s.allowed_companies.includes(company);
      return {
        ...s,
        allowed_companies: exists
          ? s.allowed_companies.filter((x) => x !== company)
          : [...s.allowed_companies, company],
      };
    });
  };

  const save = async () => {
    if (!f.name || !f.email) return toast.error("Ad Soyad ve E-posta zorunlu");
    if (f.role !== "admin" && f.allowed_companies.length === 0) {
      return toast.error("HR ve Rapor kullanıcıları için en az bir şirket seçilmelidir");
    }

    const common = {
      name: f.name,
      email: f.email,
      username: f.username || f.email,
      role: f.role,
      departman: f.departman,
      allowed_companies: f.role === "admin" ? [] : f.allowed_companies,
      aktif: f.aktif,
      aciklama: f.aciklama,
    };

    if (!isEdit) {
      if (!f.password) return toast.error("Şifre zorunlu");
      if (f.password !== f.password2) return toast.error("Şifreler eşleşmiyor");
      try {
        await api.post("/users", { ...common, password: f.password });
        toast.success("Kullanıcı oluşturuldu");
        onOpenChange(false); onSaved();
      } catch (e) { toast.error(formatApiError(e)); }
    } else {
      try {
        await api.put(`/users/${initial.id}`, common);
        toast.success("Kullanıcı güncellendi");
        onOpenChange(false); onSaved();
      } catch (e) { toast.error(formatApiError(e)); }
    }
  };

  const allSelected = companies.length > 0 && companies.every((c) => f.allowed_companies.includes(c));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid={isEdit ? "edit-user-dialog" : "new-user-dialog"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}</DialogTitle>
          <DialogDescription>
            Kullanıcı bilgilerini {isEdit ? "güncelleyin" : "girin"}. Yönetici tüm şirketleri görür; diğer rollerde şirket erişimi aşağıdan belirlenir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Ad Soyad *</Label><Input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} data-testid="uf-name" /></div>
          <div><Label>E-posta *</Label><Input type="email" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} data-testid="uf-email" /></div>
          <div><Label>Kullanıcı Adı</Label><Input value={f.username} onChange={(e) => setF((s) => ({ ...s, username: e.target.value }))} placeholder="Boş bırakırsanız e-posta kullanılır" data-testid="uf-username" /></div>
          <div>
            <Label>Rol *</Label>
            <Select value={f.role} onValueChange={(v) => setF((s) => ({ ...s, role: v, allowed_companies: v === "admin" ? [] : s.allowed_companies }))}>
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

          {f.role === "admin" ? (
            <div className="md:col-span-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <b>Şirket Erişimi:</b> Yönetici rolü tüm şirketleri görür. Şirket kısıtı uygulanmaz.
            </div>
          ) : (
            <div className="md:col-span-2 rounded-md border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Görebileceği Şirketler *</Label>
                  <div className="text-xs text-slate-500 mt-0.5">Kullanıcı yalnızca işaretlenen şirketlerin personel ve izin kayıtlarını görebilir.</div>
                </div>
                {companies.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setF((s) => ({ ...s, allowed_companies: allSelected ? [] : [...companies] }))}
                  >
                    {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded border border-slate-100 p-2 bg-slate-50/50">
                {companies.map((company) => (
                  <label key={company} className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={f.allowed_companies.includes(company)}
                      onChange={() => toggleCompany(company)}
                    />
                    <span>{company}</span>
                  </label>
                ))}
                {companies.length === 0 && <div className="text-xs text-slate-500 col-span-2">Şirket kaydı bulunamadı.</div>}
              </div>

              <div className="text-xs">
                Seçili: <b>{f.allowed_companies.length}</b> şirket
              </div>
            </div>
          )}

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