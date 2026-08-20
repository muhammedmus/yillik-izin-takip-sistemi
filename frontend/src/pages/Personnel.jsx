import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Upload, Download, ArrowUp, ArrowDown, Trash2, X, Loader2, CheckCircle2, XCircle, AlertCircle, Users, PartyPopper, TrendingUp, TriangleAlert, ChevronDown, ChevronUp } from "lucide-react";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ConsentTracking from "@/pages/ConsentTracking";

function toTr(iso) { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}.${m}.${y}`; }
function fmtNum(n) { if (n === null || n === undefined || n === "") return "—"; return String(n).replace(".", ","); }

function SortableTh({ label, field, sort, setSort }) {
  const active = sort.field === field;
  const dir = active ? sort.dir : null;
  return (
    <th onClick={() => setSort({ field, dir: active && dir === "asc" ? "desc" : "asc" })}
        className="cursor-pointer select-none" data-testid={`sort-${field}`}>
      <span className="inline-flex items-center gap-1">{label}
        {active && (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}

export default function Personnel() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [balances, setBalances] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [tab, setTab] = useState("active");
  const [departman, setDepartman] = useState("");
  const [sirket, setSirket] = useState("");
  const [consentAdvance, setConsentAdvance] = useState(false);
  const [sort, setSort] = useState({ field: "ad_soyad", dir: "asc" });
  const [limit, setLimit] = useState(100);
  const [skip, setSkip] = useState(0);

  const [departments, setDepartments] = useState([]);
  // Iter 48: Panel → Personel birleştirmesi
  const [summary, setSummary] = useState(null);
  const [over20, setOver20] = useState({ total: 0, items: [] });
  const [over20Open, setOver20Open] = useState(false);
  const [todayOnLeave, setTodayOnLeave] = useState({ total: 0, items: [] });
  const [todayOnLeaveOpen, setTodayOnLeaveOpen] = useState(false);
  const [companies, setCompanies] = useState([]);

  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // {new_personnel, missing_from_file, changed, rehire, matched, summary, headers?, needs_mapping?}
  const [importResult, setImportResult] = useState(null);
  const [manualMap, setManualMap] = useState({});
  const [termDate, setTermDate] = useState(new Date().toISOString().slice(0, 10));
  // Iter 44: satır bazlı seçimler + son onay dialog
  const [selectedChanged, setSelectedChanged] = useState(new Set());
  const [selectedRehire, setSelectedRehire] = useState(new Set());
  const [rehireDates, setRehireDates] = useState({}); // personnel_id → new hire date
  const [termOverrides, setTermOverrides] = useState({}); // personnel_id → date override
  const [safetyAck, setSafetyAck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [delTarget, setDelTarget] = useState(null);
  const [delStep, setDelStep] = useState(0);
  const [delData, setDelData] = useState({ password: "", reason: "" });
  const [delBusy, setDelBusy] = useState(false);
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || user?.role === "hr";

  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  useEffect(() => {
    let cancel = false;
    api.get("/personnel/facets").then(({ data }) => {
      if (cancel) return;
      setDepartments(data.departments || []);
      setCompanies(data.companies || []);
    }).catch(() => {});
    return () => { cancel = true; };
  }, []);

  const load = async () => {
    setLoading(true);
    // Iter 57+63: Bu alanlar backend'de mevcut değil (virtual/computed),
    // TÜM filtrelenmiş kayıtları alıp memory'de sıralayıp burada sayfalıyoruz.
    const CLIENT_SORT_FIELDS = ["remaining", "age", "ten_day", "cetvel"];
    const isClientSort = CLIENT_SORT_FIELDS.includes(sort.field);
    const params = {
      aktif: tab === "active",
      sort_by: isClientSort ? "sicil_no" : sort.field,
      sort_dir: isClientSort ? "asc" : sort.dir,
      limit: isClientSort ? 99999 : limit,
      skip: isClientSort ? 0 : skip,
    };
    if (qDebounced) params.q = qDebounced;
    if (departman) params.departman = departman;
    if (sirket) params.sirket = sirket;
    if (consentAdvance) params.consent_advance = true;
    try {
      const [{ data }, { data: cnt }, sum] = await Promise.all([
        api.get("/personnel", { params }),
        api.get("/personnel/count", { params: { ...params, limit: undefined, skip: undefined, sort_by: undefined, sort_dir: undefined } }),
        api.get("/personnel/balance-summary", { params: { aktif: tab === "active" } }).catch(() => ({ data: [] })),
      ]);
      const balMap = Object.fromEntries((sum.data || []).map((b) => [b.id, { remaining: b.remaining, entitled_total: b.entitled_total, used_total: b.used_total, ten_day_check: b.ten_day_check, cetvel_generated_at: b.cetvel_generated_at }]));
      setBalances(balMap);
      let display = data;
      if (isClientSort) {
        const ageOf = (dob) => {
          if (!dob) return -1;
          const d = new Date(dob); if (isNaN(d.getTime())) return -1;
          const n = new Date();
          let a = n.getFullYear() - d.getFullYear();
          const m = n.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
          return a;
        };
        const tenDayOrder = { earned_ok: 0, advance_ok: 1, missing: 2 };
        const valueOf = (p) => {
          const b = balMap[p.id] || {};
          if (sort.field === "remaining") return b.remaining ?? Number.POSITIVE_INFINITY;
          if (sort.field === "age") return ageOf(p.dogum_tarihi);
          if (sort.field === "ten_day") return tenDayOrder[b.ten_day_check?.status] ?? 99;
          if (sort.field === "cetvel") return b.cetvel_generated_at ? 0 : 1;
          return 0;
        };
        display = [...data].sort((a, b) => {
          const va = valueOf(a); const vb = valueOf(b);
          return sort.dir === "asc" ? va - vb : vb - va;
        }).slice(skip, skip + limit);
      }
      setItems(display);
      setTotal(cnt?.total ?? data.length);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, qDebounced, departman, sirket, consentAdvance, sort.field, sort.dir, limit, skip]);
  useEffect(() => { setSkip(0); /* eslint-disable-next-line */ }, [tab, qDebounced, departman, sirket, consentAdvance, sort.field, sort.dir, limit]);

  // Iter 48: Panel özet + 20 Gün Üzeri (yalnız aktif sekmesindeyken göster)
  const loadSummary = async () => {
    try {
      const [{ data: s }, { data: o }, { data: t }] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/dashboard/over-20", { params: { limit: 100 } }),
        api.get("/dashboard/today-on-leave", { params: { limit: 500 } }),
      ]);
      setSummary(s);
      setOver20(o || { total: 0, items: [] });
      setTodayOnLeave(t || { total: 0, items: [] });
    } catch { /* sessiz */ }
  };
  useEffect(() => { loadSummary(); }, []);

  const downloadTemplate = async () => {
    const t = localStorage.getItem("token");
    const r = await fetch(`${API_BASE}/personnel/import/template`, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} });
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "personel_sablon.xlsx"; a.click();
  };

  const downloadPersonnelList = async () => {
    const t = localStorage.getItem("token");
    try {
      const r = await fetch(`${API_BASE}/personnel/export/list.xlsx`, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!r.ok) throw new Error("İndirme başarısız");
      const blob = await r.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `Personel_Listesi_${today}.xlsx`; a.click();
      toast.success("Personel listesi indirildi");
    } catch (e) {
      toast.error(e.message || "İndirme başarısız");
    }
  };

  // Iter 43: Toplu Personel Yükle artık tek adımda "senkronizasyon" gibi çalışır:
  // 1) Dosya yüklenir → /personnel/sync/compare çağrılır → önizleme
  // 2) Kullanıcı onaylayınca /personnel/sync/apply çağrılır → yeni eklenir + eksikler işten ayrıldı yapılır
  const doImportPreview = async () => {
    if (!file) return;
    setImporting(true); setImportPreview(null); setImportResult(null); setSafetyAck(false);
    setSelectedChanged(new Set()); setSelectedRehire(new Set()); setRehireDates({}); setTermOverrides({});
    try {
      const fd = new FormData(); fd.append("file", file);
      if (manualMap && Object.keys(manualMap).length > 0) {
        fd.append("mapping", JSON.stringify(manualMap));
      }
      const { data } = await api.post("/personnel/sync/compare", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.error && !data.needs_mapping) { toast.error(data.error); return; }
      setImportPreview(data);
      // Iter 44: Bilgisi değişen ve rehire varsayılan olarak SEÇİLMEZ — kullanıcı bilinçli seçsin
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setImporting(false); }
  };

  const doImportApply = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const updateRows = (importPreview.changed || [])
        .filter((c) => selectedChanged.has(c.personnel_id))
        .map((c) => ({ personnel_id: c.personnel_id, ad_soyad: c.ad_soyad, diffs: c.diffs }));
      // Iter 44: Rehire seçilenler için ayrıca personel güncellemesi (aktif=true + ise_giris)
      const rehireUpdates = (importPreview.rehire || [])
        .filter((r) => selectedRehire.has(r.personnel_id))
        .map((r) => ({
          personnel_id: r.personnel_id, ad_soyad: r.ad_soyad,
          diffs: {
            aktif: { old: false, new: true },
            ise_giris: { old: null, new: rehireDates[r.personnel_id] || r.excel_ise_giris || new Date().toISOString().slice(0, 10) },
            isten_cikis: { old: r.old_isten_cikis, new: "" },
          },
        }));
      const { data } = await api.post("/personnel/sync/apply", {
        new_rows: importPreview.new_personnel || [],
        update_rows: [...updateRows, ...rehireUpdates],
        terminate_ids: (importPreview.missing_from_file || []).map((m) => m.personnel_id),
        terminate_date: termDate,
        terminate_overrides: termOverrides,
        terminate_reason: "Toplu yüklenen listede bulunmuyor",
      });
      setImportResult(data);
      toast.success(`Uygulandı: +${data.created} yeni · ${data.updated} güncelleme · ${data.terminated} işten ayrıldı`);
      setImportPreview(null); setFile(null); setManualMap({}); setConfirmOpen(false);
      setSelectedChanged(new Set()); setSelectedRehire(new Set()); setRehireDates({}); setTermOverrides({});
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setImporting(false); }
  };

  const startDelete = async (p) => {
    try {
      const { data } = await api.get(`/personnel/${p.id}/delete-preview`);
      setDelTarget({ ...p, preview: data });
      setDelData({ password: "", reason: "" });
      setDelStep(1);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const doHardDelete = async () => {
    if (!delData.password || !delData.reason.trim()) return toast.error("Şifre ve gerekçe zorunlu");
    setDelBusy(true);
    try {
      await api.post(`/personnel/${delTarget.id}/delete`, { password: delData.password, reason: delData.reason.trim() });
      toast.success("Personel kalıcı olarak silindi");
      setDelStep(0); setDelTarget(null); await load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setDelBusy(false); }
  };

  const clearFilters = () => { setQ(""); setDepartman(""); setSirket(""); setConsentAdvance(false); setSkip(0); };
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      <div className="sticky-page-title flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Personel</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setFile(null); setImportResult(null); setImportPreview(null); setManualMap({}); } }}>
              <DialogTrigger asChild><Button variant="outline" data-testid="bulk-import-btn"><Upload size={16} className="mr-1" /> Toplu İşlem</Button></DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Toplu Personel Yükle</DialogTitle>
                  <DialogDescription>Excel yüklediğinizde: listedeki yeni personeller eklenir, listede olmayan mevcut aktif personeller İşten Ayrıldı olarak işaretlenir.</DialogDescription></DialogHeader>

                <div className="space-y-3 mt-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={downloadTemplate} data-testid="download-template-btn">
                      <Download size={14} className="mr-1" /> Personel Yükleme Şablonu İndir
                    </Button>
                    <Button variant="outline" onClick={downloadPersonnelList} data-testid="download-personnel-list-btn"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                      <Download size={14} className="mr-1" /> Personel Listesi İndir
                    </Button>
                  </div>
                  <div>
                    <Label>Excel Dosyası (.xlsx)</Label>
                    <Input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0]); setImportPreview(null); setImportResult(null); }} data-testid="bulk-file-input" />
                  </div>

                  {importPreview?.needs_mapping && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="text-sm font-medium text-amber-800">⚠ {importPreview.error}</div>
                      <div className="text-xs text-amber-700">Aşağıdan her sistem alanı için Excel sütununu seçin ve tekrar deneyin.</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {["sicil_no", "ad_soyad", "tc_no", "departman", "sirket", "ise_giris", "dogum_tarihi", "onceki_kidem_yil"].map((fld) => (
                          <div key={fld} className="flex items-center gap-2">
                            <Label className="w-32 text-right">
                              {fld === "sicil_no" ? "Sicil Numarası *" : fld === "ad_soyad" ? "Ad Soyad" : fld === "tc_no" ? "TC Kimlik" : fld === "departman" ? "Departman" : fld === "sirket" ? "Şirket" : fld === "ise_giris" ? "İşe Giriş" : fld === "dogum_tarihi" ? "Doğum" : "Önceki Kıdem"}:
                            </Label>
                            <Select value={manualMap[fld] || "__none__"} onValueChange={(v) => setManualMap({ ...manualMap, [fld]: v === "__none__" ? "" : v })}>
                              <SelectTrigger className="h-8 flex-1" data-testid={`import-map-${fld}`}><SelectValue placeholder="Sütun seç..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— seçilmedi —</SelectItem>
                                {(importPreview.headers || []).map((h, i) => <SelectItem key={i} value={h}>{h}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importPreview && !importPreview.needs_mapping && (
                    <div className="space-y-3">
                      {/* Ön izleme özeti — Iter 44 kullanıcı spec */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                        <div className="rounded border p-2 bg-slate-50 border-slate-200"><div className="text-[10px] uppercase text-slate-500">Excel Toplam</div><div className="text-lg font-bold tabular-nums text-slate-800">{importPreview.summary?.excel_total || 0}</div></div>
                        <div className="rounded border p-2 bg-emerald-50 border-emerald-200"><div className="text-[10px] uppercase text-emerald-700">Mevcut</div><div className="text-lg font-bold tabular-nums text-emerald-800">{importPreview.summary?.matched || 0}</div></div>
                        <div className="rounded border p-2 bg-blue-50 border-blue-200"><div className="text-[10px] uppercase text-blue-700">Yeni</div><div className="text-lg font-bold tabular-nums text-blue-800">{importPreview.summary?.new || 0}</div></div>
                        <div className="rounded border p-2 bg-amber-50 border-amber-200"><div className="text-[10px] uppercase text-amber-700">Bilgisi Değişen</div><div className="text-lg font-bold tabular-nums text-amber-800">{importPreview.summary?.changed || 0}</div></div>
                        <div className="rounded border p-2 bg-red-50 border-red-200"><div className="text-[10px] uppercase text-red-700">İşten Ayrılacak</div><div className="text-lg font-bold tabular-nums text-red-800">{importPreview.summary?.missing || 0}</div></div>
                        <div className="rounded border p-2 bg-purple-50 border-purple-200"><div className="text-[10px] uppercase text-purple-700">Yeniden İşe Giriş</div><div className="text-lg font-bold tabular-nums text-purple-800">{importPreview.summary?.rehire || 0}</div></div>
                      </div>

                      {/* Güvenlik uyarısı: aktifin >%30'u işten çıkarılıyor */}
                      {importPreview.summary && importPreview.summary.term_ratio > 0.30 && importPreview.summary.missing > 0 && (
                        <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm">
                          <div className="font-bold text-red-900">⚠ Dikkat — Anormal İşten Çıkış Oranı</div>
                          <div className="text-xs text-red-800 mt-1">
                            Yüklenen listede mevcut aktif personelin büyük bölümü bulunmuyor. Bu işlem <b>{importPreview.summary.missing}</b> personeli (%{(importPreview.summary.term_ratio * 100).toFixed(0)}) işten ayrılmış duruma getirecek. Devam etmeden önce Excel'in doğru dosya olduğundan emin olun.
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input type="checkbox" id="safety-ack" checked={safetyAck} onChange={(e) => setSafetyAck(e.target.checked)} data-testid="import-safety-ack" />
                            <label htmlFor="safety-ack" className="text-xs text-red-900 font-medium">Riski kabul ediyorum, işlemi yine de yapmak istiyorum.</label>
                          </div>
                        </div>
                      )}

                      {/* Yeni Eklenecek */}
                      {importPreview.new_personnel?.length > 0 && (
                        <details className="border rounded p-2 bg-blue-50/40" open>
                          <summary className="cursor-pointer font-medium text-blue-800">+ Yeni Eklenecek Personeller ({importPreview.new_personnel.length})</summary>
                          <div className="max-h-48 overflow-auto mt-2 text-xs">
                            <table className="w-full">
                              <thead className="text-slate-500"><tr><th className="text-left px-1">Sicil</th><th className="text-left px-1">Ad Soyad</th><th className="text-left px-1">Departman</th><th className="text-left px-1">İşe Giriş</th></tr></thead>
                              <tbody>
                                {importPreview.new_personnel.map((r) => (
                                  <tr key={r._row} className="border-t border-slate-100"><td className="font-mono px-1 py-0.5">{r.sicil_no}</td><td className="px-1">{r.ad_soyad}</td><td className="px-1">{r.departman || "—"}</td><td className="px-1">{r.ise_giris || "—"}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {/* Bilgisi Değişen */}
                      {importPreview.changed?.length > 0 && (
                        <details className="border rounded p-2 bg-amber-50/40">
                          <summary className="cursor-pointer font-medium text-amber-800">≠ Bilgisi Değişen Personeller ({importPreview.changed.length}) — Onaylananlar güncellenir</summary>
                          <div className="flex items-center gap-3 mt-2 mb-1 px-1 py-1.5 bg-white/60 border border-amber-200 rounded text-xs">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-amber-900" data-testid="import-changed-select-all-label">
                              <input
                                type="checkbox"
                                data-testid="import-changed-select-all"
                                checked={importPreview.changed.length > 0 && selectedChanged.size === importPreview.changed.length}
                                ref={(el) => { if (el) el.indeterminate = selectedChanged.size > 0 && selectedChanged.size < importPreview.changed.length; }}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedChanged(new Set(importPreview.changed.map((c) => c.personnel_id)));
                                  else setSelectedChanged(new Set());
                                }}
                              />
                              Hepsini Seç
                            </label>
                            <span className="text-slate-500">{selectedChanged.size} / {importPreview.changed.length} seçili</span>
                          </div>
                          <div className="max-h-56 overflow-auto mt-1 text-xs space-y-1">
                            {importPreview.changed.map((c) => (
                              <label key={c.personnel_id} className="flex flex-col gap-0.5 py-1 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={selectedChanged.has(c.personnel_id)} onChange={() => { const n = new Set(selectedChanged); n.has(c.personnel_id) ? n.delete(c.personnel_id) : n.add(c.personnel_id); setSelectedChanged(n); }} />
                                  <span className="font-mono">{c.sicil_no}</span> · {c.ad_soyad}
                                </div>
                                {Object.entries(c.diffs).map(([f, d]) => (
                                  <div key={f} className="pl-6 text-[11px]">
                                    <b>{f}:</b> <span className="text-red-600">{d.old || "—"}</span> → <span className="text-emerald-700">{d.new}</span>
                                  </div>
                                ))}
                              </label>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Rehire — Iter 44 */}
                      {importPreview.rehire?.length > 0 && (
                        <details className="border rounded p-2 bg-purple-50/40" open>
                          <summary className="cursor-pointer font-medium text-purple-800">↺ Yeniden İşe Giriş Adayları ({importPreview.rehire.length}) — daha önce işten ayrılmış personeller</summary>
                          <div className="max-h-48 overflow-auto mt-2 text-xs">
                            <table className="w-full">
                              <thead className="text-slate-500"><tr><th className="text-left px-1">Seç</th><th className="text-left px-1">Sicil</th><th className="text-left px-1">Ad Soyad</th><th className="text-left px-1">Eski Çıkış</th><th className="text-left px-1">Yeni İşe Giriş</th></tr></thead>
                              <tbody>
                                {importPreview.rehire.map((r) => (
                                  <tr key={r.personnel_id} className="border-t border-slate-100">
                                    <td className="px-1"><input type="checkbox" checked={selectedRehire.has(r.personnel_id)} onChange={() => { const n = new Set(selectedRehire); n.has(r.personnel_id) ? n.delete(r.personnel_id) : n.add(r.personnel_id); setSelectedRehire(n); }} /></td>
                                    <td className="font-mono px-1 py-0.5">{r.sicil_no}</td>
                                    <td className="px-1">{r.ad_soyad}</td>
                                    <td className="px-1">{r.old_isten_cikis || "—"}</td>
                                    <td className="px-1">
                                      <Input type="date" className="h-7 w-36" value={rehireDates[r.personnel_id] || r.excel_ise_giris || new Date().toISOString().slice(0, 10)} onChange={(e) => setRehireDates({ ...rehireDates, [r.personnel_id]: e.target.value })} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-[11px] text-purple-700 mt-1">Eski izin ve hak ediş kayıtları KORUNUR. Yeni işe giriş tarihi personel bilgisine yazılır, aktif=true olur.</div>
                          </div>
                        </details>
                      )}

                      {/* İşten Ayrılacak */}
                      {importPreview.missing_from_file?.length > 0 && (
                        <details className="border rounded p-2 bg-red-50/40" open>
                          <summary className="cursor-pointer font-medium text-red-800">✕ İşten Ayrılacak Personeller ({importPreview.missing_from_file.length})</summary>
                          <div className="mt-2 flex items-center gap-2 text-xs bg-white rounded p-2 border border-red-200">
                            <Label className="whitespace-nowrap">Toplu İşten Çıkış Tarihi:</Label>
                            <Input type="date" value={termDate} onChange={(e) => setTermDate(e.target.value)} className="w-40 h-8" data-testid="import-term-date" />
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setTermOverrides({})} data-testid="import-term-reset">Tümüne Uygula</Button>
                            <span className="text-[10px] text-slate-500">Sağdaki tarihler satır bazlı değişiklik içindir.</span>
                          </div>
                          <div className="max-h-56 overflow-auto mt-2 text-xs">
                            <table className="w-full">
                              <thead className="text-slate-500"><tr><th className="text-left px-1">Sicil</th><th className="text-left px-1">Ad Soyad</th><th className="text-left px-1">Departman</th><th className="text-left px-1">İşe Giriş</th><th className="text-left px-1">İşten Çıkış</th></tr></thead>
                              <tbody>
                                {importPreview.missing_from_file.map((m) => (
                                  <tr key={m.personnel_id} className="border-t border-slate-100">
                                    <td className="font-mono px-1 py-0.5">{m.sicil_no}</td>
                                    <td className="px-1">{m.ad_soyad}</td>
                                    <td className="px-1">{m.departman || "—"}</td>
                                    <td className="px-1">{m.ise_giris || "—"}</td>
                                    <td className="px-1"><Input type="date" className="h-7 w-36" value={termOverrides[m.personnel_id] || termDate} onChange={(e) => setTermOverrides({ ...termOverrides, [m.personnel_id]: e.target.value })} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {/* Mevcut (matched) */}
                      {importPreview.matched?.length > 0 && (
                        <details className="border rounded p-2 bg-emerald-50/30">
                          <summary className="cursor-pointer font-medium text-emerald-800">✓ Mevcut Personeller ({importPreview.matched.length}) — dokunulmayacak</summary>
                          <div className="max-h-48 overflow-auto mt-2 text-xs">
                            <table className="w-full">
                              <thead className="text-slate-500"><tr><th className="text-left px-1">Sicil</th><th className="text-left px-1">Ad Soyad</th><th className="text-left px-1">Departman</th></tr></thead>
                              <tbody>
                                {importPreview.matched.map((m) => (
                                  <tr key={m.personnel_id} className="border-t border-slate-100"><td className="font-mono px-1 py-0.5">{m.sicil_no}</td><td className="px-1">{m.ad_soyad}</td><td className="px-1">{m.departman || "—"}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {importPreview.duplicates?.length > 0 && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                          ⚠ Dosyada mükerrer sicil: {importPreview.duplicates.map((d) => d.sicil_no).join(", ")} — düzeltip tekrar yükleyin
                        </div>
                      )}
                    </div>
                  )}

                  {importResult && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
                      <div><b className="text-emerald-700">Eklenen:</b> {importResult.created}</div>
                      <div><b className="text-red-700">İşten Ayrılan:</b> {importResult.terminated}</div>
                      {(importResult.errors?.length || 0) > 0 && <div className="text-amber-700">Hata: {importResult.errors.length}</div>}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    {!importPreview ? (
                      <Button onClick={doImportPreview} disabled={!file || importing} className="bg-blue-600 hover:bg-blue-700" data-testid="bulk-upload-btn">
                        {importing ? "Analiz ediliyor..." : "Yükle & Ön İzle"}
                      </Button>
                    ) : importPreview.needs_mapping ? (
                      <Button onClick={doImportPreview} disabled={importing || !manualMap.sicil_no} className="bg-blue-600 hover:bg-blue-700" data-testid="bulk-upload-remap-btn">
                        {importing ? "Analiz ediliyor..." : "Tekrar Analiz Et"}
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" onClick={() => { setImportPreview(null); setManualMap({}); setSafetyAck(false); }}>Vazgeç</Button>
                        <Button
                          onClick={() => setConfirmOpen(true)}
                          disabled={importing
                            || ((importPreview.new_personnel?.length || 0) + (importPreview.missing_from_file?.length || 0) + selectedChanged.size + selectedRehire.size === 0)
                            || (importPreview.summary?.term_ratio > 0.30 && importPreview.summary?.missing > 0 && !safetyAck)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                          data-testid="bulk-apply-btn"
                        >
                          Senkronizasyonu Uygula
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Iter 44: Son Onay Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent className="max-w-md" data-testid="import-confirm-dialog">
                <DialogHeader><DialogTitle>Son Onay — Senkronizasyonu Uygula</DialogTitle></DialogHeader>
                <div className="text-sm space-y-2">
                  <div>Bu işlem sonucunda:</div>
                  <ul className="list-disc pl-6 space-y-1 text-slate-800">
                    <li><b className="text-blue-700">{importPreview?.new_personnel?.length || 0}</b> yeni personel eklenecek</li>
                    <li><b className="text-amber-700">{selectedChanged.size}</b> personel bilgisi güncellenecek</li>
                    <li><b className="text-purple-700">{selectedRehire.size}</b> personel yeniden işe giriş yapacak</li>
                    <li><b className="text-red-700">{importPreview?.missing_from_file?.length || 0}</b> personel işten ayrılmış olarak işaretlenecek</li>
                  </ul>
                  <div className="text-xs text-slate-500 mt-3">İşten ayrılan personel silinmez; İşten Ayrılanlar sekmesinde görünmeye devam eder. İzin geçmişi, hak ediş kayıtları ve audit kayıtları korunur.</div>
                </div>
                <DialogFooter className="mt-3">
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={importing}>Vazgeç</Button>
                  <Button onClick={doImportApply} disabled={importing} className="bg-emerald-600 hover:bg-emerald-700" data-testid="import-confirm-apply-btn">
                    {importing ? "Uygulanıyor..." : "Onayla ve Uygula"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button asChild className="bg-blue-600 hover:bg-blue-700" data-testid="new-personnel-btn"><Link to="/personel/yeni"><Plus size={16} className="mr-1" /> Yeni Personel</Link></Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="personnel-tabs">
          <TabsTrigger value="active" data-testid="tab-active">Aktif Personeller</TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">İşten Ayrılanlar</TabsTrigger>
          <TabsTrigger value="consent" data-testid="tab-consent">Muvafakatnameler</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "consent" ? (
        <ConsentTracking />
      ) : (
      <>

      {/* Iter 61: Panel özet kartları — 4 kart yan yana (Aktif sekmesinde) */}
      {tab === "active" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="personnel-summary-grid">
            <Card className="p-4 border border-slate-200 shadow-sm h-full" data-testid="stat-total-personnel">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center bg-blue-50 text-blue-700"><Users size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Toplam Aktif Personel</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{summary?.total_active_personnel ?? "…"}</div>
                </div>
              </div>
            </Card>
            <button
              type="button"
              onClick={() => {
                setTodayOnLeaveOpen((v) => !v);
                setOver20Open(false);
              }}
              className={`text-left h-full rounded-lg border shadow-sm transition p-4 bg-white hover:bg-emerald-50 ${todayOnLeaveOpen ? "border-emerald-400 ring-2 ring-emerald-300" : "border-slate-200"}`}
              data-testid="stat-today-on-leave"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center bg-emerald-50 text-emerald-700"><PartyPopper size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Bugün İzinli</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums flex items-center gap-2">
                    <span>{summary?.today_on_leave ?? "…"} kişi</span>
                    <span className="text-slate-400 ml-auto">{todayOnLeaveOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                  </div>
                </div>
              </div>
            </button>
            <Card className="p-4 border border-slate-200 shadow-sm h-full" data-testid="stat-total-remaining">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center bg-slate-100 text-slate-700"><TrendingUp size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Toplam Kalan İzin</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
                    {summary?.total_remaining_leave !== undefined ? `${String(summary.total_remaining_leave).replace(".", ",")} gün` : "…"}
                  </div>
                </div>
              </div>
            </Card>
            <button
              type="button"
              onClick={() => {
                setOver20Open((v) => !v);
                setTodayOnLeaveOpen(false);
              }}
              className={`text-left h-full rounded-lg border shadow-sm transition p-4 bg-white hover:bg-amber-50 ${over20Open ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-200"}`}
              data-testid="stat-over20-card"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md grid place-items-center bg-amber-50 text-amber-700"><TriangleAlert size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">20 Gün ve Üzeri İzni Olan Personeller</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums flex items-center gap-2">
                    <span data-testid="over20-count">{over20.total} kişi</span>
                    <span className="text-slate-400 ml-auto">{over20Open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {todayOnLeaveOpen && (
            <Card className="border border-emerald-200 shadow-sm" data-testid="today-on-leave-list">
              <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/50">
                <div className="font-semibold text-emerald-900">Bugün İzinli Personeller</div>
                <div className="text-xs text-emerald-700 mt-0.5">Bugün izin başlangıç ve bitiş tarihleri arasında bulunan aktif personeller</div>
              </div>
              <div className="overflow-x-auto">
                <table className="table-clean w-full text-sm">
                  <thead><tr><th>Sicil</th><th>Ad Soyad</th><th>Departman</th><th>Şirket</th><th>İzin Türü</th><th>Başlangıç</th><th>Bitiş</th><th className="text-right">Gün</th></tr></thead>
                  <tbody>
                    {todayOnLeave.items.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-slate-400 py-4">Bugün izinli personel yok.</td></tr>
                    )}
                    {todayOnLeave.items.map((r) => (
                      <tr key={r.id} data-testid={`today-leave-row-${r.sicil_no}`}>
                        <td className="font-mono text-xs">{r.sicil_no}</td>
                        <td><Link to={`/personel/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.ad_soyad}</Link></td>
                        <td>{r.departman || "—"}</td>
                        <td>{r.sirket || "—"}</td>
                        <td>{r.izin_turu || "—"}</td>
                        <td className="font-mono text-xs">{toTr(r.start_date)}</td>
                        <td className="font-mono text-xs">{toTr(r.end_date)}</td>
                        <td className="text-right tabular-nums font-semibold text-emerald-700">{fmtNum(r.days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Açılır liste — 4. karttan */}
          {over20Open && (
            <Card className="border border-amber-200 shadow-sm" data-testid="over20-list">
              <div className="overflow-x-auto">
                <table className="table-clean w-full text-sm">
                  <thead><tr><th>Sicil</th><th>Ad Soyad</th><th>Departman</th><th className="text-right">Kalan İzin</th></tr></thead>
                  <tbody>
                    {over20.items.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-slate-400 py-4">20 gün ve üzeri izni olan personel yok.</td></tr>
                    )}
                    {over20.items.map((r) => (
                      <tr key={r.id} data-testid={`over20-row-${r.sicil_no}`}>
                        <td className="font-mono text-xs">{r.sicil_no}</td>
                        <td><Link to={`/personel/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.ad_soyad}</Link></td>
                        <td>{r.departman || "—"}</td>
                        <td className="text-right tabular-nums font-semibold text-amber-700">{String(r.remaining).replace(".", ",")} gün</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-4 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9" placeholder="Ad, sicil no veya TC ile ara..." data-testid="personnel-search" />
          </div>
          {(q || departman || sirket || consentAdvance) && (
            <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="personnel-clear-filters">
              <X size={13} className="mr-1" /> Temizle
            </Button>
          )}
          <Select value={departman || "__all__"} onValueChange={(v) => setDepartman(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-52 h-9" data-testid="personnel-department"><SelectValue placeholder="Departman" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Tüm departmanlar</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sirket || "__all__"} onValueChange={(v) => setSirket(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-52 h-9" data-testid="personnel-company"><SelectValue placeholder="Şirket" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Tüm şirketler</SelectItem>
              {companies.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-20 h-9" data-testid="personnel-limit"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
          {loading && <Loader2 size={13} className="animate-spin text-slate-400" />}
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full">
            <thead>
              <tr>
                <SortableTh label="Sicil" field="sicil_no" sort={sort} setSort={setSort} />
                <SortableTh label="Ad Soyad" field="ad_soyad" sort={sort} setSort={setSort} />
                <SortableTh label="Departman" field="departman" sort={sort} setSort={setSort} />
                <SortableTh label="Şirket" field="sirket" sort={sort} setSort={setSort} />
                <SortableTh label="İşe Giriş" field="ise_giris" sort={sort} setSort={setSort} />
                <th
                  onClick={() => setSort({ field: "age", dir: sort.field === "age" && sort.dir === "asc" ? "desc" : "asc" })}
                  className="text-center cursor-pointer select-none"
                  data-testid="sort-age"
                >
                  <span className="inline-flex items-center gap-1">Yaş
                    {sort.field === "age" && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
                <th
                  onClick={() => setSort({ field: "remaining", dir: sort.field === "remaining" && sort.dir === "asc" ? "desc" : "asc" })}
                  className="cursor-pointer select-none"
                  data-testid="sort-remaining"
                >
                  <span className="inline-flex items-center gap-1">Kalan İzin
                    {sort.field === "remaining" && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
                <th
                  onClick={() => setSort({ field: "ten_day", dir: sort.field === "ten_day" && sort.dir === "asc" ? "desc" : "asc" })}
                  className="text-center cursor-pointer select-none"
                  title="4857 s.K. m.56 — Yıllık iznin bir bölümü 10 günden az olamaz. Kontrol İÇİNDE BULUNULAN TAKVİM YILI için yapılır; her 1 Ocak'ta sıfırlanır. ✓ Yeşil: bu yıl hak edilmiş bakiyeden 10+ gün tek parça izin. 🟡 Sarı: bu yıl hak edişsiz/avans 10+ gün tek parça izin. ✕ Kırmızı: bu yıl tek parça 10+ günlük yıllık izin yok. Artan sırayla yeşil→sarı→kırmızı."
                  data-testid="sort-ten-day"
                >
                  <span className="inline-flex items-center gap-1">10 Gün İzin Kullanımı
                    {sort.field === "ten_day" && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
                <th
                  onClick={() => setSort({ field: "cetvel", dir: sort.field === "cetvel" && sort.dir === "asc" ? "desc" : "asc" })}
                  className="text-center cursor-pointer select-none"
                  title="Personel için İzin Cetveli üretildiyse yeşil onay (✓) simgesi görünür. Artan sırayla oluşturulanlar üstte."
                  data-testid="sort-cetvel"
                >
                  <span className="inline-flex items-center gap-1">İzin Cetveli
                    {sort.field === "cetvel" && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
                {isAdmin && <th className="text-right">İşlemler</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const rem = balances[p.id]?.remaining;
                const remClr = rem === undefined || rem === null ? "" : rem < 0 ? "text-red-600 font-semibold" : rem < 10 ? "text-amber-700" : "";
                return (
                  <tr key={p.id} className="cursor-pointer" data-testid={`personnel-row-${p.sicil_no}`}>
                    <td className="font-mono text-xs" onClick={() => nav(`/personel/${p.id}`)}>{p.sicil_no}</td>
                    <td className="font-medium text-slate-900" onClick={() => nav(`/personel/${p.id}`)}>{p.ad_soyad}</td>
                    <td onClick={() => nav(`/personel/${p.id}`)}>{p.departman || "—"}</td>
                    <td onClick={() => nav(`/personel/${p.id}`)}>{p.sirket || "—"}</td>
                    <td className="font-mono text-xs" onClick={() => nav(`/personel/${p.id}`)}>{toTr(p.ise_giris)}</td>
                    <td className="text-center tabular-nums" onClick={() => nav(`/personel/${p.id}`)}>{(() => {
                      if (!p.dogum_tarihi) return "—";
                      const d = new Date(p.dogum_tarihi);
                      if (isNaN(d.getTime())) return "—";
                      const now = new Date();
                      let age = now.getFullYear() - d.getFullYear();
                      const m = now.getMonth() - d.getMonth();
                      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
                      return age;
                    })()}</td>
                    <td className={`tabular-nums font-medium ${remClr}`} onClick={() => nav(`/personel/${p.id}`)}>
                      {rem === undefined || rem === null ? "—" : `${fmtNum(rem)} gün`}
                    </td>
                    <td onClick={() => nav(`/personel/${p.id}`)} data-testid={`ten-day-${p.sicil_no}`}>
                      {(() => {
                        const tdc = balances[p.id]?.ten_day_check;
                        if (!tdc) return <span className="text-slate-300 text-xs block text-center">—</span>;
                        const maxS = tdc.max_slice_days ?? 0;
                        const yr = tdc.year ?? new Date().getFullYear();
                        if (tdc.status === "earned_ok") {
                          return <CheckCircle2 size={20} className="text-emerald-600 mx-auto" strokeWidth={2.5}
                            aria-label={`Uygun (${yr}) — En uzun tek izin: ${maxS} gün`}
                            title={`${yr} yılında 10+ günlük yıllık izin kullanım şartı sağlandı. (En uzun tek izin: ${maxS} gün)`} />;
                        }
                        if (tdc.status === "advance_ok") {
                          return <AlertCircle size={20} className="text-amber-500 mx-auto" strokeWidth={2.5}
                            aria-label={`Avans (${yr}) — En uzun tek izin: ${maxS} gün`}
                            title={`${yr} yılında 10+ günlük izin kullanıldı ancak hak ediş oluşmamış / avans izin. (En uzun tek izin: ${maxS} gün)`} />;
                        }
                        // missing
                        return <XCircle size={20} className="text-red-500 mx-auto" strokeWidth={2.5}
                          aria-label={`10 Günlük İzin Eksik (${yr}) — En uzun tek izin: ${maxS} gün`}
                          title={`${yr} yılında tek seferde 10 gün veya üzeri yıllık izin kullanımı bulunmuyor. (En uzun tek izin: ${maxS} gün)`} />;
                      })()}
                    </td>
                    <td onClick={() => nav(`/personel/${p.id}`)} data-testid={`cetvel-status-${p.sicil_no}`}>
                      {balances[p.id]?.cetvel_generated_at
                        ? <CheckCircle2 size={20} className="text-emerald-600 mx-auto" strokeWidth={2.5} aria-label="İzin Cetveli Oluşturuldu" />
                        : <XCircle size={20} className="text-red-500 mx-auto" strokeWidth={2.5} aria-label="İzin Cetveli Doldurulmalı" />}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50"
                                onClick={(e) => { e.stopPropagation(); startDelete(p); }}
                                data-testid={`delete-personnel-${p.sicil_no}`} title="Personeli Sil">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 9 : 8} className="text-center text-slate-400 py-10">Personel bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50 text-sm">
            <div className="text-slate-600">
              <b className="text-slate-900 tabular-nums" data-testid="personnel-range">
                {items.length === 0 ? "0" : `${(skip + 1).toLocaleString("tr-TR")}–${(skip + items.length).toLocaleString("tr-TR")}`}
              </b>
              <span className="mx-1 text-slate-400">/</span>
              <b className="text-slate-900 tabular-nums">{total.toLocaleString("tr-TR")}</b> kayıt
              <span className="mx-2 text-slate-400">•</span>
              Sayfa <b className="tabular-nums">{currentPage}</b> / <b className="tabular-nums">{totalPages}</b>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setSkip(0)} disabled={loading || skip === 0} data-testid="page-first">« İlk</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={loading || skip === 0} data-testid="page-prev">‹ Önceki</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(skip + limit)} disabled={loading || skip + items.length >= total} data-testid="page-next">Sonraki ›</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, (totalPages - 1) * limit))} disabled={loading || currentPage >= totalPages} data-testid="page-last">Son »</Button>
            </div>
          </div>
        )}
      </Card>
      </>
      )}

      {/* Silme onay dialogları */}
      <Dialog open={delStep === 1} onOpenChange={(v) => !v && setDelStep(0)}>
        <DialogContent data-testid="personnel-delete-step1">
          <DialogHeader>
            <DialogTitle className="text-red-700">Personeli Kalıcı Olarak Sil</DialogTitle>
            <DialogDescription>Denetim kayıtları korunur. Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm space-y-1">
            <div><b>Ad Soyad:</b> {delTarget?.ad_soyad}</div>
            <div><b>Sicil:</b> {delTarget?.sicil_no}</div>
            <div><b>Departman:</b> {delTarget?.departman || "—"}</div>
            <div><b>Kalan İzin:</b> {balances[delTarget?.id]?.remaining ?? "—"} gün</div>
            <div><b>İzin Kaydı:</b> {delTarget?.preview?.leaves_count ?? 0} · <b>Hak Ediş:</b> {delTarget?.preview?.entitlements_count ?? 0}</div>
          </div>
          <div className="text-xs text-slate-600 border-l-4 border-amber-400 pl-3">Normal işten ayrılışlarda Personeli Sil işlemini kullanmayın. Bu işlem yalnızca hatalı, mükerrer veya test kayıtları içindir.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelStep(0)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setDelStep(2)} data-testid="personnel-delete-continue">Devam Et</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delStep === 2} onOpenChange={(v) => !v && setDelStep(0)}>
        <DialogContent data-testid="personnel-delete-step2">
          <DialogHeader>
            <DialogTitle className="text-red-700">Yönetici Şifresi Doğrulama</DialogTitle>
            <DialogDescription>Şifreniz denetim kaydına yazılmaz; yalnızca doğrulama için kullanılır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600">Yönetici: <b>{user?.name}</b></div>
            <div><Label>Yönetici Şifresi</Label><Input type="password" value={delData.password} onChange={(e) => setDelData((s) => ({ ...s, password: e.target.value }))} data-testid="personnel-delete-pw" /></div>
            <div><Label>Silme Gerekçesi *</Label><Textarea rows={3} value={delData.reason} onChange={(e) => setDelData((s) => ({ ...s, reason: e.target.value }))} data-testid="personnel-delete-reason" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelStep(0)}>İptal</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doHardDelete} disabled={delBusy} data-testid="personnel-delete-final">
              {delBusy ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}