import { useEffect, useState } from "react";
import { Plus, Pencil, KeyRound, Power, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { toDateTime, roleBadge } from "./shared";
import { UserFormDialog } from "./UserFormDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserHistoryDialog } from "./UserHistoryDialog";

export function UsersTab() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [historyUser, setHistoryUser] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delStep, setDelStep] = useState(0);
  const [delData, setDelData] = useState({ password: "", reason: "" });
  const [delBusy, setDelBusy] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/users"); setItems(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    if (u.id === me?.id) return toast.error("Kendi hesabınızı pasif yapamazsınız");
    try {
      await api.post(`/users/${u.id}/toggle-active`);
      toast.success(u.aktif !== false ? "Kullanıcı pasif yapıldı" : "Kullanıcı aktif yapıldı");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const doHardDelete = async () => {
    if (!delData.password || !delData.reason.trim()) return toast.error("Şifre ve gerekçe zorunlu");
    setDelBusy(true);
    try {
      await api.post(`/users/${delTarget.id}/delete`, { password: delData.password, reason: delData.reason.trim() });
      toast.success("Kullanıcı kalıcı olarak silindi");
      setDelStep(0); setDelTarget(null); await load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setDelBusy(false); }
  };

  const companyAccess = (u) => {
    if (u.role === "admin") {
      return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">Tüm Şirketler</Badge>;
    }
    const companies = u.allowed_companies || [];
    if (companies.length === 0) {
      return <Badge variant="secondary" className="bg-red-50 text-red-700 border border-red-200">Şirket Yetkisi Yok</Badge>;
    }
    return (
      <div className="flex flex-wrap gap-1 max-w-[280px]">
        {companies.map((c) => (
          <Badge key={c} variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">{c}</Badge>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpenNew(true)} data-testid="add-user-btn">
          <Plus size={16} className="mr-1" /> Yeni Kullanıcı
        </Button>
      </div>

      <Card className="border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="table-clean w-full text-sm">
            <thead>
              <tr>
                <th>Ad Soyad</th><th>Kullanıcı Adı</th><th>E-posta</th>
                <th>Rol</th><th>Departman</th><th>Görebileceği Şirketler</th><th>Durum</th>
                <th>Son Giriş</th><th>Son İşlem</th><th>Oluşturulma</th>
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.email}`}
                    className={u.aktif === false ? "bg-slate-50/60 text-slate-500" : ""}>
                  <td className="font-medium text-slate-900">{u.name}</td>
                  <td className="font-mono text-xs">{u.username || "—"}</td>
                  <td>{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{u.departman || "—"}</td>
                  <td>{companyAccess(u)}</td>
                  <td>
                    {u.aktif === false
                      ? <Badge variant="secondary" className="bg-slate-100 text-slate-600">Pasif</Badge>
                      : <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Aktif</Badge>}
                  </td>
                  <td className="font-mono text-xs">{toDateTime(u.last_login)}</td>
                  <td className="font-mono text-xs">{toDateTime(u.last_action)}</td>
                  <td className="font-mono text-xs">{toDateTime(u.created_at)}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" title="Düzenle" onClick={() => setEditUser(u)} data-testid={`edit-user-${u.email}`}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" title="Şifre Sıfırla" onClick={() => setResetUser(u)} data-testid={`reset-user-${u.email}`}><KeyRound size={14} /></Button>
                    <Button variant="ghost" size="sm" title={u.aktif === false ? "Aktif Yap" : "Pasif Yap"}
                            className={u.aktif === false ? "text-emerald-600" : "text-amber-600"}
                            onClick={() => toggleActive(u)} data-testid={`toggle-user-${u.email}`} disabled={u.id === me?.id}><Power size={14} /></Button>
                    <Button variant="ghost" size="sm" title="İşlem Geçmişi" onClick={() => setHistoryUser(u)} data-testid={`history-user-${u.email}`}><History size={14} /></Button>
                    {u.id !== me?.id && (
                      <Button variant="ghost" size="sm" title="Kullanıcıyı Sil" className="text-red-600 hover:bg-red-50"
                              onClick={() => { setDelTarget(u); setDelData({ password: "", reason: "" }); setDelStep(1); }}
                              data-testid={`delete-user-${u.email}`}><Trash2 size={14} /></Button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-400 py-8">Kullanıcı kaydı yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UserFormDialog open={openNew} onOpenChange={setOpenNew} onSaved={load} />
      <UserFormDialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)} initial={editUser} onSaved={load} />
      <ResetPasswordDialog user={resetUser} onOpenChange={(v) => !v && setResetUser(null)} />
      <UserHistoryDialog user={historyUser} onOpenChange={(v) => !v && setHistoryUser(null)} />

      <Dialog open={delStep === 1} onOpenChange={(v) => !v && setDelStep(0)}>
        <DialogContent data-testid="user-delete-step1">
          <DialogHeader>
            <DialogTitle className="text-red-700">Kullanıcıyı Kalıcı Olarak Sil</DialogTitle>
            <DialogDescription>Denetim kayıtları korunur. Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm space-y-1">
            <div><b>Ad Soyad:</b> {delTarget?.name}</div>
            <div><b>Kullanıcı Adı:</b> {delTarget?.username || "—"}</div>
            <div><b>E-posta:</b> {delTarget?.email}</div>
            <div><b>Rol:</b> {delTarget?.role}</div>
            <div><b>Son Giriş:</b> {toDateTime(delTarget?.last_login)}</div>
          </div>
          <div className="text-xs text-slate-600 border-l-4 border-amber-400 pl-3">Normalde kullanıcıyı pasif yapmayı tercih edin. Kalıcı silme yalnızca hatalı/mükerrer/test kullanıcıları içindir.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelStep(0)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setDelStep(2)} data-testid="user-delete-continue">Devam Et</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delStep === 2} onOpenChange={(v) => !v && setDelStep(0)}>
        <DialogContent data-testid="user-delete-step2">
          <DialogHeader>
            <DialogTitle className="text-red-700">Yönetici Şifresi Doğrulama</DialogTitle>
            <DialogDescription>Şifre doğrulanır; audit kaydında saklanmaz.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600">Yönetici: <b>{me?.name}</b></div>
            <div><Label>Yönetici Şifresi</Label><Input type="password" value={delData.password} onChange={(e) => setDelData((s) => ({ ...s, password: e.target.value }))} data-testid="user-delete-pw" /></div>
            <div><Label>Silme Gerekçesi *</Label><Textarea rows={3} value={delData.reason} onChange={(e) => setDelData((s) => ({ ...s, reason: e.target.value }))} data-testid="user-delete-reason" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelStep(0)}>İptal</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doHardDelete} disabled={delBusy} data-testid="user-delete-final">
              {delBusy ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}