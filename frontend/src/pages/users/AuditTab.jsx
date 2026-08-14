import { useEffect, useState } from "react";
import { Filter, X, Eye, CheckCircle2, XCircle, FileSpreadsheet, FileText, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrDatePicker } from "@/components/TrDatePicker";
import { useAuth } from "@/context/AuthContext";
import { toDateTime, moduleLabel, actionLabel, roleBadge } from "./shared";
import { AuditDetailDialog } from "./AuditDetailDialog";
import { AuditPreview } from "./AuditPreview";

const defaultFilters = {
  user_id: "", user_role: "", module: "", action: "",
  start: "", end: "", success: "", q: "", entity_name: "",
  limit: 100, skip: 0,
};

// Ortak param builder — sıfırdan olmayan alanları döner
function buildParams(filters) {
  const params = {};
  Object.entries(filters).forEach(([k, v]) => { if (v !== "" && v !== null) params[k] = v; });
  return params;
}

async function downloadUrl(url) {
  const t = localStorage.getItem("token");
  const r = await fetch(url, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) throw new Error(`İndirilemedi (HTTP ${r.status})`);
  const blob = await r.blob();
  const cd = r.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const name = m ? m[1] : "denetim-kayitlari";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

export function AuditTab() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [preview, setPreview] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [busy, setBusy] = useState(false);
  // Iter 52: Wipe dialog
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeAdmin, setWipeAdmin] = useState(false);
  const [wipeUser, setWipeUser] = useState(false);
  const [wipePw, setWipePw] = useState("");
  const [wipeReason, setWipeReason] = useState("");
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);

  const doWipe = async () => {
    if (!(wipeAdmin || wipeUser) || !wipePw || !wipeReason.trim() || wipeConfirm !== "SİL") {
      return toast.error("En az bir seçim + şifre + gerekçe + 'SİL' onayı zorunlu");
    }
    setWipeBusy(true);
    try {
      const { data } = await api.post("/audit-log/wipe", {
        password: wipePw, reason: wipeReason.trim(), confirm: wipeConfirm,
        include_admin: wipeAdmin, include_non_admin: wipeUser,
      });
      toast.success(`İşlem geçmişi silindi: ${data.deleted} kayıt`);
      setWipeOpen(false); setWipeAdmin(false); setWipeUser(false);
      setWipePw(""); setWipeReason(""); setWipeConfirm("");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setWipeBusy(false); }
  };

  useEffect(() => {
    api.get("/users").then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  const load = async () => {
    try {
      const { data } = await api.get("/audit-log", { params: buildParams(filters) });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.limit, filters.skip]);

  const applyFilters = () => { setFilters((s) => ({ ...s, skip: 0 })); setTimeout(load, 50); };
  const clearFilters = () => { setFilters(defaultFilters); setTimeout(load, 50); };

  const downloadExport = async (kind) => {
    setBusy(true);
    try {
      const qs = new URLSearchParams(buildParams({ ...filters, limit: 5000, skip: 0 })).toString();
      await downloadUrl(`${API_BASE}/audit-log/export.${kind}?${qs}`);
    } catch (e) { toast.error(e.message || "İndirilemedi"); }
    finally { setBusy(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const currentPage = Math.floor(filters.skip / filters.limit) + 1;

  if (preview) return <AuditPreview items={items} filters={filters} onBack={() => setPreview(false)} />;

  return (
    <>
      <Card className="p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={14} /> Filtreler
          <span className="text-xs text-slate-500 font-normal ml-auto">Toplam <b>{total}</b> kayıt, {items.length} gösteriliyor.</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
          <div>
            <Label className="text-xs">Kullanıcı</Label>
            <Select value={filters.user_id || "__all__"} onValueChange={(v) => setFilters((s) => ({ ...s, user_id: v === "__all__" ? "" : v }))}>
              <SelectTrigger data-testid="af-user"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all__">Tümü</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rol</Label>
            <Select value={filters.user_role || "__all__"} onValueChange={(v) => setFilters((s) => ({ ...s, user_role: v === "__all__" ? "" : v }))}>
              <SelectTrigger data-testid="af-role"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tümü</SelectItem>
                <SelectItem value="admin">Yönetici</SelectItem>
                <SelectItem value="hr">İnsan Kaynakları</SelectItem>
                <SelectItem value="viewer">Sadece Rapor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Modül</Label>
            <Select value={filters.module || "__all__"} onValueChange={(v) => setFilters((s) => ({ ...s, module: v === "__all__" ? "" : v }))}>
              <SelectTrigger data-testid="af-module"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tümü</SelectItem>
                {Object.entries(moduleLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">İşlem Türü</Label>
            <Select value={filters.action || "__all__"} onValueChange={(v) => setFilters((s) => ({ ...s, action: v === "__all__" ? "" : v }))}>
              <SelectTrigger data-testid="af-action"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tümü</SelectItem>
                {Object.entries(actionLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Başlangıç</Label>
            <TrDatePicker value={filters.start} onChange={(v) => setFilters((s) => ({ ...s, start: v }))} testId="af-start" />
          </div>
          <div>
            <Label className="text-xs">Bitiş</Label>
            <TrDatePicker value={filters.end} onChange={(v) => setFilters((s) => ({ ...s, end: v }))} testId="af-end" />
          </div>
          <div>
            <Label className="text-xs">Durum</Label>
            <Select value={filters.success || "__all__"} onValueChange={(v) => setFilters((s) => ({ ...s, success: v === "__all__" ? "" : v }))}>
              <SelectTrigger data-testid="af-success"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tümü</SelectItem>
                <SelectItem value="true">Başarılı</SelectItem>
                <SelectItem value="false">Başarısız</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Personel / Kayıt Adı</Label>
            <Input value={filters.entity_name} onChange={(e) => setFilters((s) => ({ ...s, entity_name: e.target.value }))} placeholder="örn. Ali Yılmaz" data-testid="af-entity" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <Label className="text-xs">Serbest Arama (açıklama / kullanıcı)</Label>
            <Input value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} placeholder="Anahtar kelime ara" data-testid="af-q" />
          </div>
          <div className="flex items-end gap-2 col-span-2">
            <Button onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 flex-1" data-testid="af-apply"><Filter size={14} className="mr-1" /> Uygula</Button>
            <Button variant="outline" onClick={clearFilters} data-testid="af-clear"><X size={14} className="mr-1" /> Temizle</Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setPreview(true)} data-testid="audit-preview-btn">
          <Eye size={14} className="mr-1" /> Ön İzle & Yazdır
        </Button>
        <Button variant="outline" onClick={() => downloadExport("xlsx")} disabled={busy || items.length === 0} data-testid="audit-xlsx-btn">
          <FileSpreadsheet size={14} className="mr-1 text-emerald-600" /> Excel İndir
        </Button>
        <Button variant="outline" onClick={() => downloadExport("pdf")} disabled={busy || items.length === 0} data-testid="audit-pdf-btn">
          <FileText size={14} className="mr-1 text-red-600" /> PDF İndir
        </Button>
        {me?.role === "admin" && (
          <Button variant="destructive" onClick={() => setWipeOpen(true)} data-testid="audit-wipe-btn">
            <Trash2 size={14} className="mr-1" /> İşlem Geçmişini Sil
          </Button>
        )}
      </div>

      {/* Iter 52: İşlem Geçmişi Silme Dialog */}
      <Dialog open={wipeOpen} onOpenChange={(v) => { setWipeOpen(v); if (!v) { setWipeAdmin(false); setWipeUser(false); setWipePw(""); setWipeReason(""); setWipeConfirm(""); } }}>
        <DialogContent className="max-w-md" data-testid="audit-wipe-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><ShieldAlert size={18} /> İşlem Geçmişini Sil</DialogTitle>
            <DialogDescription>Bu işlem GERİ ALINAMAZ. Yeni silme kaydı denetim için tutulur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Silinecek Kayıtlar</Label>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 p-2 border border-red-200 rounded cursor-pointer hover:bg-red-50/60">
                  <input type="checkbox" className="mt-0.5" checked={wipeUser} onChange={(e) => setWipeUser(e.target.checked)} data-testid="audit-wipe-user" />
                  <div className="text-sm">
                    <div className="font-semibold text-red-900">Kullanıcı İşlem Geçmişi</div>
                    <div className="text-[11px] text-red-700">İnsan Kaynakları / Sadece Rapor rollü kullanıcıların tüm işlem kayıtları silinir.</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2 border border-red-200 rounded cursor-pointer hover:bg-red-50/60">
                  <input type="checkbox" className="mt-0.5" checked={wipeAdmin} onChange={(e) => setWipeAdmin(e.target.checked)} data-testid="audit-wipe-admin" />
                  <div className="text-sm">
                    <div className="font-semibold text-red-900">Yönetici İşlem Geçmişi</div>
                    <div className="text-[11px] text-red-700">Tüm Yönetici rollü kullanıcıların işlem kayıtları silinir.</div>
                  </div>
                </label>
              </div>
            </div>
            <div><Label>Yönetici Şifresi</Label><Input type="password" value={wipePw} onChange={(e) => setWipePw(e.target.value)} data-testid="audit-wipe-pw" /></div>
            <div><Label>Silme Gerekçesi *</Label><Textarea rows={2} value={wipeReason} onChange={(e) => setWipeReason(e.target.value)} data-testid="audit-wipe-reason" /></div>
            <div><Label>Onay için <b className="text-red-700">SİL</b> yazın</Label><Input value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} placeholder="SİL" data-testid="audit-wipe-confirm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeOpen(false)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doWipe}
                    disabled={wipeBusy || !(wipeAdmin || wipeUser) || !wipePw || !wipeReason.trim() || wipeConfirm !== "SİL"}
                    data-testid="audit-wipe-final">
              {wipeBusy ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean w-full text-xs">
            <thead>
              <tr>
                <th>Tarih & Saat</th><th>Kullanıcı</th><th>Rol</th><th>Modül</th>
                <th>İşlem</th><th>Etkilenen Kayıt</th><th>Durum</th><th>IP</th><th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} onClick={() => setDetail(a)} className="cursor-pointer" data-testid={`audit-row-${a.id}`}>
                  <td className="font-mono">{toDateTime(a.created_at)}</td>
                  <td className="font-medium">{a.user_name || "—"}</td>
                  <td>{a.user_role ? roleBadge(a.user_role) : "—"}</td>
                  <td>{moduleLabel[a.module] || a.module}</td>
                  <td>{actionLabel[a.action] || a.action}</td>
                  <td className="truncate max-w-[260px]">{a.entity_name || "—"}</td>
                  <td>{a.success ? <CheckCircle2 size={14} className="text-emerald-600 inline" /> : <XCircle size={14} className="text-red-600 inline" />}</td>
                  <td className="font-mono text-slate-500">{a.ip_address || "—"}</td>
                  <td className="text-right"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetail(a); }}><Eye size={13} /></Button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">Kayıt bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-slate-100 text-xs">
          <div className="text-slate-500">Sayfa <b>{currentPage}</b> / {totalPages}</div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={filters.skip === 0}
                    onClick={() => setFilters((s) => ({ ...s, skip: Math.max(0, s.skip - s.limit) }))}
                    data-testid="audit-prev">Önceki</Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages}
                    onClick={() => setFilters((s) => ({ ...s, skip: s.skip + s.limit }))}
                    data-testid="audit-next">Sonraki</Button>
          </div>
        </div>
      </Card>

      <AuditDetailDialog item={detail} onOpenChange={(v) => !v && setDetail(null)} />
    </>
  );
}
