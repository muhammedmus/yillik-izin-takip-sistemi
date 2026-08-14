import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, FileDown, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Save,
  FileSpreadsheet, ShieldAlert, Download, CheckSquare, Square, Filter,
} from "lucide-react";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

function toTr(iso) {
  if (!iso) return "—";
  const s = String(iso);
  if (s.length < 10) return s;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "—";
  return String(Number(n)).replace(".", ",");
}

/**
 * Toplu İzin Ön İzleme — karar mantığı (Iter 21):
 *
 *  auto     : can_apply && days_status !== "mismatch"  → karar sorulmaz, otomatik kayda hazır
 *  pending  : can_apply && days_status === "mismatch" && kullanıcı henüz seçmedi
 *  system   : mismatch satırında kullanıcı "Sistem" dedi
 *  excel    : mismatch satırında kullanıcı "Excel" dedi (Yönetici + gerekçe)
 *  skip     : mismatch satırında kullanıcı "Dışla" dedi
 *  error    : can_apply=false — asla otomatik/toplu işleme girmez
 *
 * Kaydı Oluştur:
 *   • auto + system + excel dahil
 *   • pending / skip / error dışarıda
 */
export default function ExcelBulkLeave() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploadedFilename, setUploadedFilename] = useState("");
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({}); // rowIdx → { choice, reason }
  const [selected, setSelected] = useState(() => new Set());
  const [aciklama, setAciklama] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonDialog, setReasonDialog] = useState(null);
  const [bulkExcelDlg, setBulkExcelDlg] = useState(null); // {scope, reason}
  const [filter, setFilter] = useState("all"); // "all"|"auto"|"pending"|"error"|"skip"

  useEffect(() => {
    if (!preview) { setDecisions({}); setSelected(new Set()); setFilter("all"); return; }
    const init = {};
    preview.rows.forEach((r) => {
      if (!r.can_apply) init[r.row] = { choice: "error", reason: "" };
      else if (r.days_status === "mismatch") init[r.row] = { choice: "pending", reason: "" };
      else init[r.row] = { choice: "auto", reason: "" };
    });
    setDecisions(init);
    setSelected(new Set());
    // Karar bekleyen varsa oraya odakla
    const hasPending = preview.rows.some((r) => r.can_apply && r.days_status === "mismatch");
    setFilter(hasPending ? "pending" : "all");
  }, [preview]);

  // -------------------------------- API akışı --------------------------------
  const downloadTemplate = async () => {
    try {
      setBusy(true);
      const res = await api.get("/leaves/bulk/excel-template", { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "toplu_izin_sablonu.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setPreview(null);
  };

  const doPreview = async () => {
    if (!file) { toast.error("Excel dosyası seçin"); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/leaves/bulk/excel-preview", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(data); setUploadedFilename(file.name);
      const mismatches = data.rows.filter((r) => r.days_status === "mismatch" && r.can_apply).length;
      if (mismatches > 0) toast.warning(`${mismatches} satırda karar bekleniyor (Excel ≠ Sistem)`);
      else toast.success(`${data.summary.applicable} satır otomatik kayda hazır`);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  // ---------------------- Karar yönetimi (row + toplu) -----------------------
  const setChoice = (rowIdx, choice, reason = "") =>
    setDecisions((prev) => ({ ...prev, [rowIdx]: { choice, reason } }));

  const requestExcelChoice = (rowIdx) => {
    if (!isAdmin) { toast.error("Excel değerini kullanma yetkisi yalnızca Yönetici rolüne aittir"); return; }
    setReasonDialog({ rowIdx, reason: decisions[rowIdx]?.reason || "" });
  };
  const confirmReasonDialog = () => {
    if (!reasonDialog) return;
    if (!reasonDialog.reason.trim()) { toast.error("Gerekçe zorunlu"); return; }
    setChoice(reasonDialog.rowIdx, "excel", reasonDialog.reason.trim());
    setReasonDialog(null);
  };

  const rows = preview?.rows || [];
  const summary = preview?.summary;
  const mismatchRows = useMemo(
    () => rows.filter((r) => r.can_apply && r.days_status === "mismatch"),
    [rows]
  );
  const errorRows = useMemo(() => rows.filter((r) => !r.can_apply), [rows]);

  // Kararlara göre canlı özet
  const decisionSummary = useMemo(() => {
    const s = { auto: 0, pending: 0, system: 0, excel: 0, skip: 0, error: 0 };
    rows.forEach((r) => {
      const d = decisions[r.row] || {};
      const c = d.choice || (!r.can_apply ? "error" : (r.days_status === "mismatch" ? "pending" : "auto"));
      s[c] = (s[c] || 0) + 1;
    });
    return s;
  }, [rows, decisions]);

  // Toplu karar — sadece MISMATCH satırlara uygulanır. Otomatik eşleşenler dokunulmaz.
  const applyBulk = (scope, choice, opts = {}) => {
    const reason = (opts.reason || "").trim();
    let target = mismatchRows;
    if (scope === "selected") target = target.filter((r) => selected.has(r.row));
    if (target.length === 0) {
      toast.error(scope === "selected" ? "Farklı satırlardan seçili kayıt yok" : "Karar bekleyen farklı satır yok");
      return;
    }
    if (choice === "excel") {
      if (!isAdmin) { toast.error("Excel değerini kullanma yetkisi yalnızca Yönetici rolüne aittir"); return; }
      if (!reason) { setBulkExcelDlg({ scope, reason: "" }); return; }
    }
    setDecisions((prev) => {
      const next = { ...prev };
      target.forEach((r) => { next[r.row] = { choice, reason: choice === "excel" ? reason : "" }; });
      return next;
    });
    const label = choice === "excel" ? "Excel'den" : choice === "skip" ? "Dışla" : "Sistemden";
    toast.success(`${target.length} farklı satır → ${label}${reason ? " (ortak gerekçe eklendi)" : ""}`);
  };
  const confirmBulkExcel = () => {
    if (!bulkExcelDlg) return;
    const r = (bulkExcelDlg.reason || "").trim();
    if (!r) { toast.error("Ortak gerekçe zorunlu"); return; }
    applyBulk(bulkExcelDlg.scope, "excel", { reason: r });
    setBulkExcelDlg(null);
  };

  // Sadece MISMATCH satırlar arasında seçim yapılabilir
  const toggleRow = (rowNum) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(rowNum)) n.delete(rowNum); else n.add(rowNum); return n; });
  };
  const mismatchRowNums = useMemo(() => mismatchRows.map((r) => r.row), [mismatchRows]);
  const allMismatchSelected = mismatchRowNums.length > 0 && mismatchRowNums.every((n) => selected.has(n));
  const toggleSelectAll = () => setSelected(() => allMismatchSelected ? new Set() : new Set(mismatchRowNums));

  // Filtreleme
  const visibleRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => {
      const c = decisions[r.row]?.choice
        || (!r.can_apply ? "error" : (r.days_status === "mismatch" ? "pending" : "auto"));
      if (filter === "auto") return c === "auto";
      if (filter === "pending") return c === "pending" || c === "system" || c === "excel";
      if (filter === "error") return c === "error";
      if (filter === "skip") return c === "skip";
      return true;
    });
  }, [rows, decisions, filter]);

  const confirmApply = async () => {
    if (!preview) return;
    // Kaydı oluştur: auto + system + excel dahil. pending / skip / error → dahil değil.
    const applyRows = preview.rows
      .filter((r) => r.can_apply)
      .map((r) => {
        const d = decisions[r.row] || {};
        const c = d.choice || (r.days_status === "mismatch" ? "pending" : "auto");
        // Backend "system" | "excel" bekliyor. auto → system (değer zaten eşit)
        const days_choice = c === "excel" ? "excel" : (c === "system" || c === "auto") ? "system" : null;
        return { r, c, d, days_choice };
      })
      .filter((x) => !!x.days_choice)
      .map(({ r, d, days_choice }) => ({
        sicil_no: r.sicil_no, izin_turu: r.izin_turu,
        start_date: r.start_date, end_date: r.end_date,
        days_choice,
        excel_days: r.excel_days,
        override_reason: d.reason || "",
        aciklama: r.aciklama_row || "",
      }));
    const pendingCount = decisionSummary.pending;
    if (applyRows.length === 0) { toast.error("Uygulanacak satır yok"); return; }
    if (pendingCount > 0) {
      if (!window.confirm(`${pendingCount} farklı satır için karar verilmedi ve kayıt oluşturulmayacak. Devam edilsin mi?`)) return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/leaves/bulk/excel-confirm", {
        aciklama, filename: uploadedFilename || (file && file.name) || "toplu_izin.xlsx",
        rows: applyRows,
      });
      toast.success(`${data.created?.length || 0} kayıt oluşturuldu, ${data.skipped?.length || 0} atlandı`);
      setPreview(null); setFile(null); setAciklama(""); setUploadedFilename(""); setDecisions({}); setSelected(new Set());
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const downloadErrorReport = async () => {
    if (!errorRows.length) { toast.info("Atlanan/hatalı kayıt yok"); return; }
    const body = {
      filename: uploadedFilename || (file && file.name) || "toplu_izin.xlsx",
      rows: errorRows.map((r) => ({
        row: r.row, sicil_no: r.sicil_no || "",
        ad_soyad: r.matched_ad_soyad || r.ad_soyad_excel || "",
        status_label: r.status_label || "Hatalı",
        reason: r.warnings.filter((w) => w.level === "error").map((w) => w.message).join("; "),
      })),
    };
    try {
      const t = localStorage.getItem("token");
      const r = await fetch(`${API_BASE}/leaves/bulk/excel-error-report`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!r.ok) { toast.error("Hata raporu indirilemedi"); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(uploadedFilename || "toplu_izin").replace(/\.xlsx?$/i, "")}_atlanan_kayitlar.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("Atlanan kayıtlar Excel'i indirildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const statusBadgeCls = (code) => {
    switch (code) {
      case "esleti": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "eksik_sicil":
      case "personel_bulunamadi": return "bg-red-100 text-red-800 border border-red-200";
      case "pasif": return "bg-orange-50 text-orange-700 border border-orange-200";
      case "cakisan_izin":
      case "yetersiz_bakiye": return "bg-amber-50 text-amber-700 border border-amber-200";
      case "gecersiz_tarih": return "bg-red-50 text-red-700 border border-red-200";
      default: return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  const FilterTab = ({ id, label, count, color }) => (
    <button type="button" onClick={() => setFilter(id)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        filter === id ? `${color} shadow-sm` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
      data-testid={`filter-${id}`}
    >
      {label} <span className="ml-1 tabular-nums font-bold">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4" data-testid="excel-bulk-panel">
      <Card className="p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 grid place-items-center rounded-md bg-emerald-50 text-emerald-700 shrink-0"><FileSpreadsheet size={20} /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">Excel ile Toplu Yükleme</div>
            <div className="text-xs text-slate-500 mt-0.5">1) Şablonu indir, doldur. 2) Yükle + Ön İzle. 3) Sadece farklı satırlara karar ver + Onayla.</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate} disabled={busy} data-testid="excel-download-template"><FileDown size={14} className="mr-1" /> Şablonu İndir</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={onPickFile} className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" data-testid="excel-file-input" />
          <Button onClick={doPreview} disabled={busy || !file} className="bg-blue-600 hover:bg-blue-700" data-testid="excel-preview-btn"><Upload size={14} className="mr-1" /> Ön İzle</Button>
        </div>
        <div className="text-xs text-slate-500 border-l-2 border-slate-200 pl-3">
          <b>Kolonlar (8):</b> Sicil Numarası · Adı Soyadı · Departman · İzin Türü · Başlangıç · Bitiş · <b>İzin Gün Sayısı</b> · Açıklama.
          Tarih: <b>GG.AA.YYYY</b>. Gün Sayısı isteğe bağlıdır — ondalıklar virgülle (<span className="font-mono">0,5</span> · <span className="font-mono">20,5</span>).
        </div>
      </Card>

      {preview && (
        <>
          {decisionSummary.pending > 0 && (
            <Card className="p-3 border border-amber-200 bg-amber-50 shadow-sm text-sm text-amber-900 flex items-start gap-2" data-testid="mismatch-banner">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <b>{decisionSummary.pending} satırda Excel gün sayısı sistem hesabından farklı.</b> Yalnızca bu satırlar için karar verin (Excel / Sistem / Dışla). Eşleşen satırlar zaten kayda hazırdır.
              </div>
            </Card>
          )}

          {/* --------- Üst özet + kayıt oluştur --------- */}
          <Card className="p-4 border border-slate-200 shadow-sm space-y-3" data-testid="bulk-toolbar">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-500">Toplam <b className="text-slate-900 tabular-nums">{summary.total}</b> satır</span>
                {selected.size > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200" data-testid="selected-count">
                    {selected.size} seçili (farklılardan)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)} data-testid="excel-back-btn"><ArrowLeft size={14} className="mr-1" /> Yeni Dosya</Button>
                <Button onClick={confirmApply} disabled={busy} className="bg-blue-600 hover:bg-blue-700" data-testid="excel-confirm-btn">
                  <Save size={14} className="mr-1" /> Toplu İzinleri Oluştur
                </Button>
              </div>
            </div>

            {/* Özet kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs" data-testid="decision-summary">
              <div className="rounded border p-2 bg-slate-50 border-slate-200">
                <div className="text-[10px] uppercase text-slate-600 font-semibold">Toplam Satır</div>
                <div className="text-lg font-bold tabular-nums text-slate-900" data-testid="summary-total">{summary.total}</div>
              </div>
              <div className="rounded border p-2 bg-emerald-50 border-emerald-200">
                <div className="text-[10px] uppercase text-emerald-700 font-semibold">Otomatik Eşleşen</div>
                <div className="text-lg font-bold tabular-nums text-emerald-800" data-testid="summary-auto">{decisionSummary.auto}</div>
              </div>
              <div className="rounded border p-2 bg-amber-50 border-amber-200">
                <div className="text-[10px] uppercase text-amber-800 font-semibold">Karar Bekleyen</div>
                <div className="text-lg font-bold tabular-nums text-amber-800" data-testid="summary-pending">{decisionSummary.pending}</div>
              </div>
              <div className="rounded border p-2 bg-red-50 border-red-200">
                <div className="text-[10px] uppercase text-red-700 font-semibold">Hatalı</div>
                <div className="text-lg font-bold tabular-nums text-red-700 flex items-center gap-2" data-testid="summary-error">
                  {decisionSummary.error}
                  {decisionSummary.error > 0 && (
                    <Button size="sm" variant="ghost" onClick={downloadErrorReport} className="ml-auto h-6 px-1 text-[10px]" data-testid="download-error-report">
                      <Download size={11} className="mr-0.5" /> İndir
                    </Button>
                  )}
                </div>
              </div>
              <div className="rounded border p-2 bg-slate-100 border-slate-300">
                <div className="text-[10px] uppercase text-slate-700 font-semibold">Dışlanan</div>
                <div className="text-lg font-bold tabular-nums text-slate-700" data-testid="summary-skip">{decisionSummary.skip}</div>
              </div>
            </div>

            {/* Toplu karar — SADECE FARKLI (mismatch) satırlara */}
            {mismatchRows.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 flex items-center flex-wrap gap-2" data-testid="bulk-decision-bar">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide mr-1">Toplu Karar (yalnız farklı satırlar):</span>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-blue-300 hover:bg-blue-100"
                  onClick={() => applyBulk("all", "system")} data-testid="bulk-all-system">
                  Tüm Farklıları Sistemden
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-amber-300 hover:bg-amber-100"
                  disabled={!isAdmin} title={!isAdmin ? "Yalnızca Yönetici" : ""}
                  onClick={() => applyBulk("all", "excel")} data-testid="bulk-all-excel">
                  {!isAdmin && <ShieldAlert size={11} className="mr-0.5" />} Tüm Farklıları Excel'den
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-slate-300 hover:bg-slate-100"
                  onClick={() => applyBulk("all", "skip")} data-testid="bulk-all-skip">
                  Tüm Farklıları Dışla
                </Button>
                <div className="w-px h-5 bg-slate-300 mx-1" />
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-blue-300 hover:bg-blue-100"
                  onClick={() => applyBulk("selected", "system")}
                  disabled={selected.size === 0} data-testid="bulk-selected-system">
                  Seçilileri Sistemden
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-amber-300 hover:bg-amber-100"
                  onClick={() => applyBulk("selected", "excel")}
                  disabled={selected.size === 0 || !isAdmin}
                  title={!isAdmin ? "Yalnızca Yönetici" : ""}
                  data-testid="bulk-selected-excel">
                  {!isAdmin && <ShieldAlert size={11} className="mr-0.5" />} Seçilileri Excel'den
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px] border-slate-300 hover:bg-slate-100"
                  onClick={() => applyBulk("selected", "skip")}
                  disabled={selected.size === 0} data-testid="bulk-selected-skip">
                  Seçilileri Dışla
                </Button>
                <span className="ml-auto text-[11px] text-slate-500">Otomatik eşleşen satırlar bu işlemlerden <b>etkilenmez</b>.</span>
              </div>
            )}

            <div>
              <Label className="text-xs">Genel açıklama (opsiyonel, boş satırlar için)</Label>
              <Textarea rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Örn. Toplu üretim durması" data-testid="excel-aciklama" />
            </div>
          </Card>

          {/* --------- Filtre sekmeleri --------- */}
          <div className="flex items-center gap-2 flex-wrap" data-testid="row-filter">
            <Filter size={13} className="text-slate-500" />
            <FilterTab id="all" label="Tümü" count={rows.length} color="bg-slate-800 text-white border-slate-800" />
            <FilterTab id="auto" label="Otomatik Eşleşenler" count={decisionSummary.auto} color="bg-emerald-600 text-white border-emerald-600" />
            <FilterTab id="pending" label="Karar Bekleyenler" count={decisionSummary.pending + decisionSummary.system + decisionSummary.excel} color="bg-amber-500 text-white border-amber-500" />
            <FilterTab id="error" label="Hatalılar" count={decisionSummary.error} color="bg-red-600 text-white border-red-600" />
            <FilterTab id="skip" label="Dışlananlar" count={decisionSummary.skip} color="bg-slate-500 text-white border-slate-500" />
            {filter !== "all" && (
              <span className="text-[11px] text-slate-500">
                {visibleRows.length} / {rows.length} satır gösteriliyor
              </span>
            )}
          </div>

          {/* --------- Satır tablosu --------- */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-clean table-sticky-head w-full text-xs">
                <thead>
                  <tr>
                    <th className="w-8 text-center">
                      <button type="button" onClick={toggleSelectAll} className="p-0.5 hover:bg-slate-100 rounded" title="Farklı satırların tümünü seç" data-testid="select-all-checkbox" disabled={mismatchRowNums.length === 0}>
                        {allMismatchSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-slate-400" />}
                      </button>
                    </th>
                    <th className="w-6"></th>
                    <th>Satır</th><th>Sicil</th><th>Ad Soyad</th><th>Dept.</th><th>Tür</th>
                    <th>Başlangıç</th><th>Bitiş</th>
                    <th className="text-right">Excel Gün</th>
                    <th className="text-right">Sistem Gün</th>
                    <th className="text-right">Fark</th>
                    <th className="text-right">Kullanılacak</th>
                    <th>Durum</th>
                    <th>Karar</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const d = decisions[r.row] || {};
                    const c = d.choice
                      || (!r.can_apply ? "error" : (r.days_status === "mismatch" ? "pending" : "auto"));
                    const isMismatch = r.can_apply && r.days_status === "mismatch";
                    const isSel = selected.has(r.row);
                    const rowBg =
                      c === "error" ? "bg-red-50/40" :
                      c === "skip" ? "bg-slate-100 opacity-60" :
                      c === "excel" ? "bg-amber-50/40" :
                      c === "pending" ? "bg-amber-50/25" :
                      isSel ? "bg-blue-50/50" : "";
                    const finalDays =
                      c === "skip" || c === "error" ? null :
                      c === "excel" ? r.excel_days :
                      c === "auto" ? (r.excel_days ?? r.computed_days) :
                      r.computed_days;
                    return (
                      <tr key={r.row} data-testid={`excel-row-${r.row}`} className={rowBg}>
                        <td className="text-center">
                          {isMismatch ? (
                            <button type="button" onClick={() => toggleRow(r.row)} className="p-0.5 hover:bg-slate-100 rounded" data-testid={`row-${r.row}-checkbox`}>
                              {isSel ? <CheckSquare size={13} className="text-blue-600" /> : <Square size={13} className="text-slate-400" />}
                            </button>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td>{r.can_apply ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-red-600" />}</td>
                        <td className="font-mono">{r.row}</td>
                        <td className="font-mono">{r.sicil_no || <span className="text-red-600 italic">boş</span>}</td>
                        <td className="font-medium">
                          {r.matched_ad_soyad || <span className="text-red-600 italic">{r.status_code === "personel_bulunamadi" ? "Bulunamadı" : (r.ad_soyad_excel || "—")}</span>}
                        </td>
                        <td>{r.departman || "—"}</td>
                        <td>{r.izin_turu}</td>
                        <td className="font-mono">{toTr(r.start_date)}</td>
                        <td className="font-mono">{toTr(r.end_date)}</td>
                        <td className="text-right tabular-nums">{r.excel_days == null ? <span className="text-slate-400 italic">boş</span> : fmtNum(r.excel_days)}</td>
                        <td className="text-right tabular-nums font-semibold">{fmtNum(r.computed_days)}</td>
                        <td className={`text-right tabular-nums font-semibold ${isMismatch ? "text-amber-700" : "text-slate-400"}`}>
                          {isMismatch ? ((r.days_diff > 0 ? "+" : "") + fmtNum(r.days_diff)) : "—"}
                        </td>
                        <td className="text-right tabular-nums font-bold text-blue-700">
                          {finalDays == null ? "—" : fmtNum(finalDays)}
                        </td>
                        <td>
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] ${statusBadgeCls(r.status_code)}`}>
                            {r.status_label || (r.can_apply ? "Kayda Hazır" : "Hatalı")}
                          </span>
                        </td>
                        <td>
                          {c === "error" ? (
                            <span className="text-xs text-red-700">
                              {r.warnings.filter((w) => w.level === "error").map((w) => w.message).join("; ")}
                            </span>
                          ) : c === "auto" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium" data-testid={`row-${r.row}-auto`}>
                              <CheckCircle2 size={12} /> Otomatik
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1" data-testid={`row-${r.row}-decision`}>
                              <Button size="sm" variant={c === "system" ? "default" : "outline"}
                                className={c === "system" ? "bg-blue-600 hover:bg-blue-700 h-6 px-2 text-[10px]" : "h-6 px-2 text-[10px]"}
                                onClick={() => setChoice(r.row, "system")} data-testid={`row-${r.row}-choice-system`}>Sistem</Button>
                              <Button size="sm" variant={c === "excel" ? "default" : "outline"} disabled={!isAdmin}
                                className={c === "excel" ? "bg-amber-600 hover:bg-amber-700 h-6 px-2 text-[10px]" : "h-6 px-2 text-[10px]"}
                                onClick={() => requestExcelChoice(r.row)} data-testid={`row-${r.row}-choice-excel`}
                                title={!isAdmin ? "Yalnızca Yönetici" : ""}>
                                {!isAdmin && <ShieldAlert size={10} className="mr-0.5" />}Excel
                              </Button>
                              <Button size="sm" variant={c === "skip" ? "default" : "outline"}
                                className={c === "skip" ? "bg-slate-600 hover:bg-slate-700 h-6 px-2 text-[10px]" : "h-6 px-2 text-[10px]"}
                                onClick={() => setChoice(r.row, "skip")} data-testid={`row-${r.row}-choice-skip`}>Dışla</Button>
                              {c === "excel" && d.reason && <span className="text-[10px] text-amber-700 italic w-full">Gerekçe: {d.reason}</span>}
                              {c === "pending" && <span className="text-[10px] text-amber-800 font-medium w-full">Karar bekleniyor</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr><td colSpan={15} className="text-center py-6 text-slate-400">Bu filtrede satır yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Tekil override gerekçe dialog */}
      <Dialog open={!!reasonDialog} onOpenChange={(v) => !v && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excel Değerini Kullan — Gerekçe Zorunlu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Excel'de girilen gün değerinin sistem hesabı yerine kullanılması denetim kaydına yazılacaktır.</p>
            <div>
              <Label>Gerekçe</Label>
              <Input value={reasonDialog?.reason || ""} onChange={(e) => setReasonDialog((p) => ({ ...p, reason: e.target.value }))} placeholder="Örn. Yönetim onayı ile 20,5 yerine 21 uygulanacak" data-testid="excel-override-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonDialog(null)}>Vazgeç</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirmReasonDialog} data-testid="excel-override-confirm">Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toplu Excel gerekçe dialog */}
      <Dialog open={!!bulkExcelDlg} onOpenChange={(v) => !v && setBulkExcelDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Toplu: Excel Değerini Kullan — Ortak Gerekçe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {bulkExcelDlg?.scope === "selected" ? "Seçili" : "Tüm"} <b>farklı</b> satırlar için Excel gün değeri uygulanacak. Aynı gerekçe bütün override audit kayıtlarına yazılır.
            </p>
            <div>
              <Label>Ortak Gerekçe</Label>
              <Input value={bulkExcelDlg?.reason || ""}
                onChange={(e) => setBulkExcelDlg((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Örn. Şirket uygulaması gereği Excel gün değerleri esas alındı." data-testid="bulk-excel-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkExcelDlg(null)}>Vazgeç</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirmBulkExcel} data-testid="bulk-excel-confirm">Uygula</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
