import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Building2, UserCheck, Eye, AlertTriangle, CheckCircle2, XCircle, Save, FileSpreadsheet, MousePointer2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ExcelBulkLeave from "./ExcelBulkLeave";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtNum(n) { return String(n).replace(".", ","); }

export default function BulkLeave() {
  const { user } = useAuth();
  const nav = useNavigate();
  const canEdit = user?.role === "admin" || user?.role === "hr";

  const [personnel, setPersonnel] = useState([]);
  const [targetType, setTargetType] = useState("all"); // all | department | selected
  const [department, setDepartment] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    start_date: "", end_date: "", izin_turu: "Yıllık İzin", aciklama: "",
  });
  const [previewRows, setPreviewRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canEdit) return;
    api.get("/personnel", { params: { aktif: true } })
      .then(({ data }) => setPersonnel(data))
      .catch((e) => toast.error(formatApiError(e)));
  }, [canEdit]);

  const departments = useMemo(() => {
    const norm = new Map();
    personnel.forEach((p) => {
      const raw = (p.departman || "").trim();
      if (!raw) return;
      const key = raw.toLocaleUpperCase("tr-TR");
      if (!norm.has(key)) norm.set(key, raw);
    });
    return Array.from(norm.values()).sort();
  }, [personnel]);

  const filteredList = useMemo(() => {
    if (!search) return personnel;
    const s = search.toLocaleLowerCase("tr-TR");
    return personnel.filter((p) =>
      (p.ad_soyad || "").toLocaleLowerCase("tr-TR").includes(s) ||
      (p.sicil_no || "").toLocaleLowerCase("tr-TR").includes(s) ||
      (p.departman || "").toLocaleLowerCase("tr-TR").includes(s)
    );
  }, [search, personnel]);

  const toggleSel = (pid) => {
    setSelectedIds((s) => s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]);
  };
  const toggleAllFiltered = () => {
    const ids = filteredList.map((p) => p.id);
    const allSelected = ids.every((i) => selectedIds.includes(i));
    if (allSelected) setSelectedIds((s) => s.filter((x) => !ids.includes(x)));
    else setSelectedIds((s) => Array.from(new Set([...s, ...ids])));
  };

  const buildPayload = () => ({
    target: {
      type: targetType,
      department: targetType === "department" ? department : null,
      personnel_ids: targetType === "selected" ? selectedIds : null,
    },
    start_date: form.start_date,
    end_date: form.end_date,
    izin_turu: form.izin_turu,
    aciklama: form.aciklama,
  });

  const validateInputs = () => {
    if (!form.start_date || !form.end_date) { toast.error("Başlangıç ve bitiş tarihi zorunlu"); return false; }
    if (form.end_date < form.start_date) { toast.error("Bitiş tarihi başlangıçtan önce olamaz"); return false; }
    if (targetType === "department" && !department) { toast.error("Departman seçin"); return false; }
    if (targetType === "selected" && selectedIds.length === 0) { toast.error("En az bir personel seçin"); return false; }
    return true;
  };

  const doPreview = async () => {
    if (!validateInputs()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/leaves/bulk/preview", buildPayload());
      setPreviewRows(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const confirmApply = async () => {
    if (!previewRows) return;
    setBusy(true);
    try {
      const { data } = await api.post("/leaves/bulk", buildPayload());
      toast.success(`${data.created?.length || 0} kayıt oluşturuldu, ${data.skipped?.length || 0} atlandı`);
      // reset form
      setPreviewRows(null);
      setForm({ start_date: "", end_date: "", izin_turu: "Yıllık İzin", aciklama: "" });
      setSelectedIds([]);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => nav("/izinler")}><ArrowLeft size={14} className="mr-1" /> Geri</Button>
        <Card className="p-6 border border-slate-200">
          <div className="text-sm text-slate-600">Bu sayfaya yalnızca Yönetici ve İnsan Kaynakları kullanıcıları erişebilir.</div>
        </Card>
      </div>
    );
  }

  // Preview JSX (manual tab)
  let manualPreviewJsx = null;
  if (previewRows) {
    const applyable = previewRows.filter((r) => r.can_apply);
    const blocked = previewRows.filter((r) => !r.can_apply);
    const totalDaysApplyable = applyable.reduce((s, r) => s + Number(r.computed_days || 0), 0);
    manualPreviewJsx = (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPreviewRows(null)} data-testid="bulk-back-btn">
            <ArrowLeft size={14} className="mr-1" /> Ayarları Düzenle
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
              {applyable.length} uygulanabilir
            </Badge>
            {blocked.length > 0 && <Badge variant="secondary" className="bg-red-50 text-red-700 border border-red-200">{blocked.length} engelli</Badge>}
            <Button onClick={confirmApply} disabled={busy || applyable.length === 0} className="bg-blue-600 hover:bg-blue-700" data-testid="bulk-confirm-btn">
              <Save size={14} className="mr-1" /> {applyable.length} İzin Kaydını Oluştur
            </Button>
          </div>
        </div>

        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-500">Tarih Aralığı: </span><b className="font-mono">{toTr(form.start_date)} → {toTr(form.end_date)}</b></div>
            <div><span className="text-slate-500">İzin Türü: </span><b>{form.izin_turu}</b></div>
            <div><span className="text-slate-500">Uygulanabilir kişi: </span><b>{applyable.length}</b></div>
            <div><span className="text-slate-500">Toplam gün (uygulanabilir): </span><b>{fmtNum(totalDaysApplyable)}</b></div>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-clean w-full text-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>Sicil</th><th>Ad Soyad</th><th>Departman</th>
                  <th className="text-right">Hak</th><th className="text-right">Kullanılan</th><th className="text-right">Kalan (Şu An)</th>
                  <th className="text-right">Yeni Gün</th>
                  <th className="text-right">Kalan (Sonra)</th>
                  <th>Uyarılar</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.personnel_id} data-testid={`bulk-row-${r.sicil_no}`}
                      className={r.can_apply ? "" : "bg-red-50/40"}>
                    <td>
                      {r.can_apply
                        ? <CheckCircle2 size={16} className="text-emerald-600" />
                        : <XCircle size={16} className="text-red-600" />}
                    </td>
                    <td className="font-mono text-xs">{r.sicil_no}</td>
                    <td className="font-medium">{r.ad_soyad}</td>
                    <td>{r.departman || "—"}</td>
                    <td className="text-right tabular-nums">{fmtNum(r.entitled_total)}</td>
                    <td className="text-right tabular-nums">{fmtNum(r.used_total)}</td>
                    <td className="text-right tabular-nums">{fmtNum(r.remaining)}</td>
                    <td className="text-right tabular-nums font-semibold">{fmtNum(r.computed_days)}</td>
                    <td className={`text-right tabular-nums font-semibold ${r.remaining_after < 0 ? "text-red-600" : r.remaining_after < 10 ? "text-amber-700" : ""}`}>
                      {fmtNum(r.remaining_after)}
                    </td>
                    <td className="text-xs">
                      {r.warnings && r.warnings.length > 0 ? (
                        <div className="space-y-0.5">
                          {r.warnings.map((w, i) => (
                            <div key={i} className={`inline-flex items-center gap-1 mr-1 ${w.level === "error" ? "text-red-700" : "text-amber-700"}`}>
                              <AlertTriangle size={11} /> {w.message}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-emerald-600">—</span>}
                    </td>
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-6 text-slate-400">Personel bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Toplu İzin Ekleme</h1>
          <p className="text-sm text-slate-500 mt-1">Personel seçerek veya Excel dosyası ile birden fazla izin kaydı oluşturun. Önizleme ekranında çakışma ve bakiye kontrolleri görüntülenir.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => nav("/izinler")}><ArrowLeft size={14} className="mr-1" /> İzinler</Button>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList data-testid="bulk-mode-tabs">
          <TabsTrigger value="manual" data-testid="bulk-tab-manual"><MousePointer2 size={13} className="mr-1" /> Personel Seçerek</TabsTrigger>
          <TabsTrigger value="excel" data-testid="bulk-tab-excel"><FileSpreadsheet size={13} className="mr-1" /> Excel'den Yükle</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          {manualPreviewJsx || (
            <Card className="p-5 border border-slate-200 shadow-sm space-y-4">
        <div>
          <Label>Hedef Grup</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <TargetOption
              icon={Users}
              active={targetType === "all"}
              onClick={() => setTargetType("all")}
              title="Tüm Aktif Personel"
              desc={`${personnel.length} kişi`}
              testId="target-all"
            />
            <TargetOption
              icon={Building2}
              active={targetType === "department"}
              onClick={() => setTargetType("department")}
              title="Belirli Departman"
              desc={department || "Seçilmedi"}
              testId="target-department"
            />
            <TargetOption
              icon={UserCheck}
              active={targetType === "selected"}
              onClick={() => setTargetType("selected")}
              title="Seçili Personeller"
              desc={`${selectedIds.length} kişi seçildi`}
              testId="target-selected"
            />
          </div>
        </div>

        {targetType === "department" && (
          <div>
            <Label>Departman</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger data-testid="bulk-department-select"><SelectValue placeholder="Departman seçin..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {targetType === "selected" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ara: ad, sicil veya departman"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="bulk-search"
              />
              <Button variant="outline" size="sm" onClick={toggleAllFiltered} data-testid="bulk-toggle-all">
                {filteredList.every((p) => selectedIds.includes(p.id)) ? "Tümünü Kaldır" : "Tümünü Seç"}
              </Button>
            </div>
            <div className="border border-slate-200 rounded-md max-h-80 overflow-y-auto divide-y divide-slate-100">
              {filteredList.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSel(p.id)}
                    data-testid={`bulk-check-${p.sicil_no}`}
                  />
                  <span className="font-mono text-xs w-16 shrink-0">{p.sicil_no}</span>
                  <span className="font-medium text-slate-900 flex-1 truncate">{p.ad_soyad}</span>
                  <span className="text-xs text-slate-500 truncate">{p.departman || "—"}</span>
                </label>
              ))}
              {filteredList.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400">Personel yok.</div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div>
            <Label>Başlangıç Tarihi</Label>
            <Input type="date" value={form.start_date}
              onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
              data-testid="bulk-start-date" />
          </div>
          <div>
            <Label>Bitiş Tarihi</Label>
            <Input type="date" value={form.end_date}
              onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
              data-testid="bulk-end-date" />
          </div>
        </div>

        <div>
          <Label>İzin Türü</Label>
          <Select value={form.izin_turu} onValueChange={(v) => setForm((s) => ({ ...s, izin_turu: v }))}>
            <SelectTrigger data-testid="bulk-izin-turu"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yıllık İzin">Yıllık İzin</SelectItem>
              <SelectItem value="Avans İzin">Avans İzin</SelectItem>
              <SelectItem value="İdari İzin">İdari İzin</SelectItem>
              <SelectItem value="Ücretsiz İzin">Ücretsiz İzin</SelectItem>
              <SelectItem value="Mazeret İzni">Mazeret İzni</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Açıklama (opsiyonel)</Label>
          <Textarea rows={2} value={form.aciklama}
            onChange={(e) => setForm((s) => ({ ...s, aciklama: e.target.value }))}
            placeholder="Örn. Toplu üretim durması nedeniyle."
            data-testid="bulk-aciklama" />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={doPreview} disabled={busy} className="bg-blue-600 hover:bg-blue-700" data-testid="bulk-preview-btn">
            <Eye size={14} className="mr-1" /> Ön İzle
          </Button>
        </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="excel" className="mt-4">
          <ExcelBulkLeave />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TargetOption({ icon: Icon, active, onClick, title, desc, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={`flex items-start gap-3 p-4 rounded-md border-2 text-left transition-colors ${
        active ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
      }`}>
      <div className={`w-10 h-10 rounded-md grid place-items-center shrink-0 ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 truncate">{desc}</div>
      </div>
    </button>
  );
}
