import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, RefreshCw, FileText, FileSpreadsheet, AlertTriangle, Save, X, Trash2, Check } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

function toTr(iso) {
  if (!iso) return "—";
  const s = String(iso);
  if (s.length < 10) return s;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtNum(n) { return String(Number(n || 0)).replace(".", ","); }

const STATUS_LABEL = {
  valid: { text: "Geçerli", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  duplicate: { text: "Mükerrer", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  invalid: { text: "Hatalı", cls: "bg-red-50 text-red-700 border-red-200" },
  review: { text: "Kontrol Gerekli", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function Holidays() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "hr";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [availableYears, setAvailableYears] = useState([]);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);

  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [xlsxPreview, setXlsxPreview] = useState(null); // {filename, stats, rows}
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [xlsxFilter, setXlsxFilter] = useState("all");

  const load = async () => {
    setBusy(true);
    try {
      const [rec, yrs] = await Promise.all([
        api.get("/holidays/records", { params: { year } }),
        api.get("/holidays/years"),
      ]);
      setRecords(rec.data || []);
      setAvailableYears((yrs.data?.years || []));
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  const doTextImport = async () => {
    if (!importText.trim()) { toast.error("Yapıştırılan metin boş"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/holidays/bulk-import-text", {
        text: importText, filename: "Yapıştırılan metin.txt",
      });
      setImportResult(data);
      toast.success(`+${data.added} yeni, ~${data.updated} güncel · Yıllar: ${data.affected_years.join(", ")}`);
      if (data.affected_years?.length) setYear(String(data.affected_years[data.affected_years.length - 1]));
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => records.filter((r) => {
    if (typeFilter === "full" && r.type !== "full") return false;
    if (typeFilter === "half" && r.type !== "half") return false;
    if (!q.trim()) return true;
    const term = q.trim().toLocaleLowerCase("tr-TR");
    return (r.name || "").toLocaleLowerCase("tr-TR").includes(term) || (r.category || "").toLocaleLowerCase("tr-TR").includes(term);
  }), [records, q, typeFilter]);

  const reviewRecords = useMemo(() =>
    records.filter((r) => r.needs_review || (r.name || "").trim() === "Tatil Tanımı Belirtilmemiş"),
  [records]);

  return (
    <div className="space-y-4" data-testid="holidays-page">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Resmi ve Dinî Tatiller</h1>
          <p className="text-sm text-slate-500 mt-1">Yıl bazlı tatil kayıtları. Metin veya Excel dosyasından toplu yükleyin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setXlsxOpen(true)} variant="outline" data-testid="holidays-xlsx-btn">
            <FileSpreadsheet size={14} className="mr-1" /> Excel Yükle
          </Button>
          <Button onClick={() => setImportOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="holidays-import-btn">
            <Upload size={14} className="mr-1" /> Metinden Yükle
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="holidays-tabs">
          <TabsTrigger value="all" data-testid="tab-all">Tüm Tatiller ({records.length})</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review" className="text-amber-700 data-[state=active]:text-amber-800">
            <AlertTriangle size={13} className="mr-1" /> Kontrol Gerekli ({reviewRecords.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-3">
          <Card className="p-3 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs mr-1">Yıl:</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28 h-9" data-testid="holidays-year-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.length === 0 && <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>}
                  {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-9" data-testid="holidays-type-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm türler</SelectItem>
                  <SelectItem value="full">Tam Gün</SelectItem>
                  <SelectItem value="half">Yarım Gün / Arife</SelectItem>
                </SelectContent>
              </Select>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tatil adı ara..." className="max-w-xs" data-testid="holidays-search" />
              <Button variant="ghost" size="sm" onClick={load} disabled={busy} data-testid="holidays-refresh"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /></Button>
              <div className="ml-auto text-xs text-slate-500"><b className="text-slate-900 text-sm tabular-nums" data-testid="holidays-count">{filtered.length}</b> / {records.length}</div>
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-clean table-sticky-head w-full text-sm">
                <thead>
                  <tr><th>Tarih</th><th>Tatil Adı</th><th>Yıl</th><th>Tür</th><th>Kategori</th><th className="text-right">Gün</th><th>Süre</th><th>Durum</th><th>Kaynak</th></tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr key={h.id} data-testid={`holiday-row-${h.date}-${(h.name || "").slice(0, 8)}`}>
                      <td className="font-mono">{toTr(h.date)}</td>
                      <td className={`font-medium ${h.needs_review ? "text-amber-700" : ""}`}>{h.name}</td>
                      <td className="tabular-nums">{h.year}</td>
                      <td>{h.type === "half" ? <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Yarım</Badge> : <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Tam</Badge>}</td>
                      <td className="text-xs text-slate-600">{h.category || "—"}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtNum(h.day_value)}</td>
                      <td className="text-xs">{h.type === "half" ? "Yarım Gün" : "Tam Gün"}</td>
                      <td>{h.needs_review ? <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Kontrol Gerekli</Badge> : (h.active ? <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Aktif</Badge> : <Badge className="bg-slate-50 text-slate-400 text-[10px]">Pasif</Badge>)}</td>
                      <td className="text-xs text-slate-500"><FileText size={11} className="inline mr-1" />{h.source}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !busy && (<tr><td colSpan={9} className="text-center py-8 text-slate-400">{records.length === 0 ? `${year} yılı için kayıt yok.` : "Filtreye uyan kayıt yok."}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-3">
          <ReviewTab records={reviewRecords} canManage={canManage} onRefresh={load} year={year} setYear={setYear} availableYears={availableYears} currentYear={currentYear} />
        </TabsContent>
      </Tabs>

      {/* Metin yükleme dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tatil Listesi — Metinden Yükle</DialogTitle>
            <DialogDescription>Her satır: TARİH TAB TATIL_ADI TAB GUN_DEGERI. Örn: 28.10.2026 arefe 0,5</DialogDescription>
          </DialogHeader>
          {!importResult ? (
            <div className="space-y-3">
              <Textarea rows={14} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Tarih Tatil Tanımı    Gün Değeri..." className="font-mono text-xs" data-testid="holidays-import-textarea" />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setImportOpen(false)}>Vazgeç</Button>
                <Button onClick={doTextImport} disabled={busy} className="bg-blue-600 hover:bg-blue-700" data-testid="holidays-import-confirm"><Upload size={13} className="mr-1" /> İçe Aktar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3" data-testid="import-result">
              <Card className="p-3 border border-emerald-200 bg-emerald-50">
                <div className="text-sm font-semibold text-emerald-800 mb-2">Aktarım Tamamlandı</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Toplam satır: <b>{importResult.total_lines}</b></div>
                  <div>Eklenen: <b className="text-emerald-700">{importResult.added}</b></div>
                  <div>Güncellenen: <b className="text-blue-700">{importResult.updated}</b></div>
                  <div>Mükerrer (atlanan): <b className="text-slate-600">{importResult.duplicates_skipped}</b></div>
                  <div>Boş tatil adı: <b className="text-amber-700">{importResult.empty_name}</b></div>
                  <div>Geçersiz tarih: <b className="text-red-700">{importResult.invalid_date}</b></div>
                  <div className="col-span-2">Etkilenen yıllar: <b>{importResult.affected_years.join(", ")}</b></div>
                </div>
              </Card>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportResult(null); setImportText(""); }}>Yeni Aktarım</Button>
                <Button onClick={() => { setImportOpen(false); setImportResult(null); setImportText(""); }}>Kapat</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Excel yükleme dialog */}
      <XlsxImportDialog
        open={xlsxOpen}
        onOpenChange={(v) => { setXlsxOpen(v); if (!v) { setXlsxPreview(null); setXlsxFilter("all"); } }}
        preview={xlsxPreview}
        setPreview={setXlsxPreview}
        busy={xlsxBusy}
        setBusy={setXlsxBusy}
        onDone={async (affectedYears) => {
          if (affectedYears?.length) setYear(String(affectedYears[affectedYears.length - 1]));
          await load();
        }}
        filter={xlsxFilter}
        setFilter={setXlsxFilter}
      />
    </div>
  );
}

// ============================================================================
// XLSX Import Dialog — drag & drop + preview + confirm
// ============================================================================
function XlsxImportDialog({ open, onOpenChange, preview, setPreview, busy, setBusy, onDone, filter, setFilter }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    if (!isXlsx) { toast.error("Yalnızca .xlsx dosyaları destekleniyor"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/holidays/import/excel/preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const onDrop = (ev) => {
    ev.preventDefault();
    setDragOver(false);
    const f = ev.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const doConfirm = async () => {
    if (!preview?.rows?.length) return;
    setBusy(true);
    try {
      const { data } = await api.post("/holidays/import/excel/confirm", {
        rows: preview.rows, filename: preview.filename,
      });
      toast.success(`+${data.added} yeni kayıt, ${data.skipped} atlandı`);
      onDone(data.affected_years || []);
      onOpenChange(false);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const filteredRows = useMemo(() => {
    if (!preview?.rows) return [];
    if (filter === "all") return preview.rows;
    return preview.rows.filter((r) => r.status === filter);
  }, [preview, filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tatil Listesi — Excel'den Yükle</DialogTitle>
          <DialogDescription>Beklenen kolonlar: <b>Tarih</b> · <b>Tatil Tanımı</b> · <b>Gün Değeri</b> (1 = tam gün, 0,5 = yarım/arife). Kayıtlar önizlenecek, siz onaylayana dek DB'ye yazılmayacaktır.</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg py-16 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400"}`}
            data-testid="xlsx-dropzone"
          >
            <FileSpreadsheet size={48} className="mx-auto text-slate-400 mb-3" />
            <div className="text-sm font-medium text-slate-700">Excel dosyasını buraya sürükleyin veya tıklayın</div>
            <div className="text-xs text-slate-500 mt-1">.xlsx (Tarih · Tatil Tanımı · Gün Değeri)</div>
            <input type="file" accept=".xlsx" hidden ref={inputRef}
                   onChange={(e) => upload(e.target.files?.[0])} data-testid="xlsx-file-input" />
            {busy && <div className="mt-3 text-xs text-blue-700">Dosya işleniyor...</div>}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Stats */}
            <div className="grid grid-cols-5 gap-2 text-xs">
              <StatBox label="Toplam" value={preview.stats.total} color="slate" onClick={() => setFilter("all")} active={filter === "all"} />
              <StatBox label="Geçerli" value={preview.stats.valid} color="emerald" onClick={() => setFilter("valid")} active={filter === "valid"} />
              <StatBox label="Mükerrer" value={preview.stats.duplicate} color="slate" onClick={() => setFilter("duplicate")} active={filter === "duplicate"} />
              <StatBox label="Hatalı" value={preview.stats.invalid} color="red" onClick={() => setFilter("invalid")} active={filter === "invalid"} />
              <StatBox label="Kontrol Gerekli" value={preview.stats.review} color="amber" onClick={() => setFilter("review")} active={filter === "review"} />
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between">
              <div>Dosya: <b>{preview.filename}</b> · Gösterilen: <b>{filteredRows.length}</b></div>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)} data-testid="xlsx-reset"><X size={13} className="mr-1" /> Yeni Dosya</Button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Satır</th>
                    <th className="p-2 text-left">Tarih</th>
                    <th className="p-2 text-left">Tatil Tanımı</th>
                    <th className="p-2 text-right">Gün</th>
                    <th className="p-2 text-left">Tür</th>
                    <th className="p-2 text-left">Durum</th>
                    <th className="p-2 text-left">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const st = STATUS_LABEL[r.status] || STATUS_LABEL.invalid;
                    return (
                      <tr key={i} className={r.status === "invalid" ? "bg-red-50/40" : r.status === "duplicate" ? "bg-slate-50/40" : r.status === "review" ? "bg-amber-50/40" : ""}>
                        <td className="p-2 font-mono text-slate-500">{r.row}</td>
                        <td className="p-2 font-mono">{r.date_tr || r.raw_date || "—"}</td>
                        <td className="p-2">{r.name || <span className="text-slate-400 italic">(boş)</span>}</td>
                        <td className="p-2 text-right tabular-nums">{r.day_value !== undefined ? fmtNum(r.day_value) : (r.raw_day || "—")}</td>
                        <td className="p-2">{r.type === "half" ? "Yarım" : r.type === "full" ? "Tam" : "—"}</td>
                        <td className="p-2"><Badge className={`${st.cls} text-[10px]`}>{st.text}</Badge></td>
                        <td className="p-2 text-slate-500">{r.reason || (r.status === "valid" ? "Yazılacak" : r.status === "review" ? "Ad boş — Kontrol Gerekli olarak yazılacak" : "")}</td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-6 text-slate-400">Bu filtreye uyan satır yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="xlsx-cancel">Vazgeç</Button>
              <Button onClick={doConfirm} disabled={busy || preview.stats.valid === 0}
                      className="bg-blue-600 hover:bg-blue-700" data-testid="xlsx-confirm">
                <Check size={13} className="mr-1" /> Onayla ve Kaydet ({preview.stats.valid})
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, color, onClick, active }) {
  const colorMap = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded p-2 transition-shadow ${colorMap[color]} ${active ? "ring-2 ring-blue-500" : "hover:shadow"}`}
      data-testid={`xlsx-stat-${label}`}
    >
      <div className="text-[10px] uppercase font-semibold tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </button>
  );
}

// ============================================================================
// Review Tab — Kontrol Gerekli
// ============================================================================
function ReviewTab({ records, canManage, onRefresh, year, setYear, availableYears, currentYear }) {
  const [selected, setSelected] = useState(new Set());
  const [editMap, setEditMap] = useState({}); // {id: newName}
  const [bulkName, setBulkName] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => { setSelected(new Set()); setEditMap({}); }, [records.length, year]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map((r) => r.id)));
  };

  const saveRow = async (rec) => {
    const nm = (editMap[rec.id] || "").trim();
    if (!nm) { toast.error("Yeni tatil adı boş olamaz"); return; }
    try {
      await api.put(`/holidays/records/${rec.id}`, { name: nm });
      toast.success("Kayıt güncellendi");
      onRefresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const doBulkName = async () => {
    if (!selected.size || !bulkName.trim()) { toast.error("Kayıt seçin ve yeni ad girin"); return; }
    setBulkBusy(true);
    try {
      const { data } = await api.post("/holidays/records/bulk-update", {
        ids: Array.from(selected), name: bulkName.trim(),
      });
      toast.success(`${data.updated} kayıt güncellendi`);
      setBulkName(""); setSelected(new Set());
      onRefresh();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBulkBusy(false); }
  };

  const doBulkActive = async (active) => {
    if (!selected.size) { toast.error("Kayıt seçin"); return; }
    setBulkBusy(true);
    try {
      const { data } = await api.post("/holidays/records/bulk-update", {
        ids: Array.from(selected), active,
      });
      toast.success(`${data.updated} kayıt ${active ? "aktif" : "pasif"} yapıldı`);
      setSelected(new Set());
      onRefresh();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBulkBusy(false); }
  };

  const doBulkDelete = async () => {
    if (!selected.size) return;
    if (!deletePw || !deleteReason.trim()) { toast.error("Şifre ve gerekçe zorunlu"); return; }
    setBulkBusy(true);
    try {
      const { data } = await api.post("/holidays/records/bulk-delete", {
        ids: Array.from(selected), password: deletePw, reason: deleteReason.trim(),
      });
      toast.success(`${data.deleted} kayıt silindi`);
      setDeleteOpen(false); setDeletePw(""); setDeleteReason(""); setSelected(new Set());
      onRefresh();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBulkBusy(false); }
  };

  return (
    <div className="space-y-3" data-testid="review-tab">
      <Card className="p-3 border border-amber-200 bg-amber-50/40 shadow-sm sticky top-[68px] z-20 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs mr-1">Yıl:</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9" data-testid="review-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.length === 0 && <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>}
              {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-slate-600 ml-2">
            Seçili: <b className="text-amber-700 tabular-nums" data-testid="review-selected-count">{selected.size}</b> / {records.length}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input value={bulkName} onChange={(e) => setBulkName(e.target.value)} placeholder="Toplu tatil adı..." className="h-9 w-56" data-testid="review-bulk-name-input" />
            <Button size="sm" onClick={doBulkName} disabled={bulkBusy || !selected.size || !bulkName.trim()} className="bg-blue-600 hover:bg-blue-700" data-testid="review-bulk-name-btn">
              <Save size={13} className="mr-1" /> Ad Ver
            </Button>
            <Button size="sm" variant="outline" onClick={() => doBulkActive(true)} disabled={bulkBusy || !selected.size} data-testid="review-bulk-activate">
              <Check size={13} className="mr-1" /> Aktif Yap
            </Button>
            <Button size="sm" variant="outline" onClick={() => doBulkActive(false)} disabled={bulkBusy || !selected.size} data-testid="review-bulk-deactivate">
              Pasif Yap
            </Button>
            {canManage && (
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={bulkBusy || !selected.size} data-testid="review-bulk-delete">
                <Trash2 size={13} className="mr-1" /> Sil
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox checked={records.length > 0 && selected.size === records.length}
                            onCheckedChange={toggleAll} data-testid="review-select-all" />
                </th>
                <th>Tarih</th>
                <th>Yıl</th>
                <th>Gün</th>
                <th>Süre</th>
                <th>Mevcut Ad</th>
                <th>Yeni Ad</th>
                <th>Durum</th>
                <th className="w-24">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {records.map((h) => (
                <tr key={h.id} data-testid={`review-row-${h.id}`} className={selected.has(h.id) ? "bg-blue-50/50" : ""}>
                  <td>
                    <Checkbox checked={selected.has(h.id)} onCheckedChange={() => toggle(h.id)}
                              data-testid={`review-check-${h.id}`} />
                  </td>
                  <td className="font-mono">{toTr(h.date)}</td>
                  <td className="tabular-nums">{h.year}</td>
                  <td className="text-right tabular-nums font-semibold">{fmtNum(h.day_value)}</td>
                  <td className="text-xs">{h.type === "half" ? "Yarım Gün" : "Tam Gün"}</td>
                  <td className="italic text-amber-700">{h.name}</td>
                  <td>
                    <Input value={editMap[h.id] ?? ""} onChange={(e) => setEditMap({ ...editMap, [h.id]: e.target.value })}
                           placeholder="Tatil adı girin..." className="h-8 text-xs" data-testid={`review-input-${h.id}`} />
                  </td>
                  <td>{h.active ? <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Aktif</Badge> : <Badge className="bg-slate-100 text-slate-500 text-[10px]">Pasif</Badge>}</td>
                  <td>
                    <Button size="sm" onClick={() => saveRow(h)} disabled={!(editMap[h.id] || "").trim()}
                            className="h-7 bg-emerald-600 hover:bg-emerald-700" data-testid={`review-save-${h.id}`}>
                      <Save size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Bu yıl için kontrol gerektiren tatil yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Toplu Tatil Silme</DialogTitle>
            <DialogDescription>
              <b className="text-red-700">{selected.size}</b> kayıt kalıcı olarak silinecek. Bu işlem geri alınamaz.
              Devam etmek için yönetici şifrenizi ve gerekçe girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Yönetici Şifresi</Label>
              <Input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)}
                     autoComplete="new-password" data-testid="review-delete-pw" />
            </div>
            <div>
              <Label className="text-xs">Gerekçe</Label>
              <Textarea rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Silme nedenini yazın..." data-testid="review-delete-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Vazgeç</Button>
            <Button variant="destructive" onClick={doBulkDelete}
                    disabled={bulkBusy || !deletePw || !deleteReason.trim()}
                    data-testid="review-delete-confirm">
              <Trash2 size={13} className="mr-1" /> Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}