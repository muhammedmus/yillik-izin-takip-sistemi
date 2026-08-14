import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, Layers, ArrowUp, ArrowDown, Loader2, Search, X, Download, Trash2, ShieldAlert, FileSignature } from "lucide-react";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ConsentTracking from "@/pages/ConsentTracking";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtNum(n) { return String(n ?? "").replace(".", ","); }

function SortableTh({ label, field, sort, setSort, className = "" }) {
  const active = sort.field === field;
  const dir = active ? sort.dir : null;
  return (
    <th onClick={() => setSort({ field, dir: active && dir === "asc" ? "desc" : "asc" })}
        className={`cursor-pointer select-none ${className}`} data-testid={`sort-${field}`}>
      <span className="inline-flex items-center gap-1">{label}
        {active && (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function leaveStatus(L) {
  const today = todayIso();
  if (today < L.start_date) return { label: "Yaklaşan", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (today > L.end_date) return { label: "Geçmiş", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return { label: "Devam Ediyor", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function Leaves() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "hr";

  // Seçim
  const [selected, setSelected] = useState(new Set());

  // Silme dialogları
  const [singleDelete, setSingleDelete] = useState(null); // leave obj
  const [singleReason, setSingleReason] = useState("");
  const [singleReasonType, setSingleReasonType] = useState("Hatalı izin girişi");
  const [singleBusy, setSingleBusy] = useState(false);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkReasonType, setBulkReasonType] = useState("Hatalı izin girişi");
  const [bulkAdminPw, setBulkAdminPw] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [inactiveTotal, setInactiveTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Iter 47: Aktif / İşten Ayrılan sekmesi
  const [tab, setTab] = useState("active");

  // Filtreler (server-side)
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState("recent30");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [izinTuru, setIzinTuru] = useState("");
  const [departman, setDepartman] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sayfalama + sıralama (server-side)
  const [limit, setLimit] = useState(100);
  const [skip, setSkip] = useState(0);
  const [sort, setSort] = useState({ field: "created_at", dir: "desc" });

  // Facet listeleri
  const [izinTurleri, setIzinTurleri] = useState([]);
  const [departments, setDepartments] = useState([]);

  const debounceRef = useRef(null);
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  // Arama çubuğuna bir şey yazıldığında son 30 gün filtresi kaldırılır → tüm izin kayıtlarında ara
  // Arama temizlenince varsayılan (recent30) geri döner
  const prevQFilledRef = useRef(false);
  useEffect(() => {
    const filled = qDebounced.length > 0;
    if (filled && !prevQFilledRef.current) {
      setPreset("all");
    } else if (!filled && prevQFilledRef.current) {
      setPreset("recent30");
    }
    prevQFilledRef.current = filled;
  }, [qDebounced]);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.get("/leaves/facets").catch(() => ({ data: { izin_turleri: [] } })),
      api.get("/personnel/facets").catch(() => ({ data: { departments: [] } })),
    ]).then(([lf, pf]) => {
      if (cancel) return;
      setIzinTurleri(lf.data.izin_turleri || []);
      setDepartments(pf.data.departments || []);
    });
    return () => { cancel = true; };
  }, []);

  const buildParams = () => {
    const p = { limit, skip, sort_by: sort.field, sort_dir: sort.dir };
    if (preset === "recent10") p.recent_days = 10;
    else if (preset === "recent30") p.recent_days = 30;
    else if (preset === "recent90") p.recent_days = 90;
    else if (preset === "year") p.recent_days = 365;
    else if (preset === "custom") {
      if (start) p.start = start;
      if (end) p.end = end;
    }
    if (qDebounced) p.q = qDebounced;
    if (izinTuru) p.izin_turu = izinTuru;
    if (departman) p.departman = departman;
    // Iter 47: sekmeye göre personnel_active
    p.personnel_active = tab === "active" ? "true" : "false";
    return p;
  };

  const exportExcel = async () => {
    try {
      const params = buildParams();
      // limit/skip export'ta gerekmiyor — hepsi indirilsin
      delete params.limit; delete params.skip; delete params.sort_by; delete params.sort_dir;
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ).toString();
      const t = localStorage.getItem("token");
      const r = await fetch(`${API_BASE}/leaves/export.xlsx${qs ? `?${qs}` : ""}`, {
        credentials: "include",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) { toast.error("Excel indirilemedi"); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `izinler_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("Excel dosyası indirildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const countParamsBase = { ...params, limit: undefined, skip: undefined, sort_by: undefined, sort_dir: undefined };
      // Iter 47: iki sekme sayacını paralel çek
      const [{ data }, { data: cnt }, { data: cntOther }] = await Promise.all([
        api.get("/leaves", { params }),
        api.get("/leaves/count", { params: countParamsBase }),
        api.get("/leaves/count", { params: { ...countParamsBase, personnel_active: tab === "active" ? "false" : "true" } }),
      ]);
      setItems(data);
      setTotal(cnt?.total ?? data.length);
      if (tab === "active") { setActiveTotal(cnt?.total ?? 0); setInactiveTotal(cntOther?.total ?? 0); }
      else { setInactiveTotal(cnt?.total ?? 0); setActiveTotal(cntOther?.total ?? 0); }
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [
    tab, preset, start, end, limit, skip, qDebounced, izinTuru, departman, sort.field, sort.dir,
  ]);
  useEffect(() => { setSelected(new Set()); }, [items]);
  useEffect(() => { setSkip(0); /* eslint-disable-next-line */ },
    [tab, preset, start, end, limit, qDebounced, izinTuru, departman, sort.field, sort.dir]);

  const toggleRow = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAllVisible = () => {
    if (displayed.every((L) => selected.has(L.id))) {
      const next = new Set(selected);
      displayed.forEach((L) => next.delete(L.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      displayed.forEach((L) => next.add(L.id));
      setSelected(next);
    }
  };

  const askSingleDelete = (L) => { setSingleDelete(L); setSingleReasonType("Hatalı izin girişi"); setSingleReason(""); };

  const doSingleDelete = async () => {
    if (!singleDelete) return;
    const finalReason = singleReasonType === "Diğer" ? singleReason.trim() : singleReasonType;
    if (singleReasonType === "Diğer" && !singleReason.trim()) { toast.error("Açıklama zorunlu"); return; }
    setSingleBusy(true);
    try {
      const { data } = await api.delete(`/leaves/${singleDelete.id}`, { params: { reason: finalReason } });
      toast.success(`İzin silindi. Bakiye: ${data.balance_before ?? "?"} → ${data.balance_after ?? "?"}`);
      setSingleDelete(null); setSingleReason(""); await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSingleBusy(false); }
  };

  const openBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const { data } = await api.post("/leaves/delete-preview", { ids: Array.from(selected) });
      setBulkPreview(data);
      setBulkReasonType("Hatalı izin girişi");
      setBulkReason(""); setBulkAdminPw("");
      setBulkDeleteOpen(true);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBulkBusy(false); }
  };

  const doBulkDelete = async () => {
    const finalReason = bulkReasonType === "Diğer" ? bulkReason.trim() : bulkReasonType;
    if (bulkReasonType === "Diğer" && !bulkReason.trim()) { toast.error("Açıklama zorunlu"); return; }
    if (selected.size >= 20 && !bulkAdminPw) { toast.error("20+ kayıt için yönetici şifresi zorunlu"); return; }
    setBulkBusy(true);
    try {
      const { data } = await api.post("/leaves/bulk-delete", {
        ids: Array.from(selected), reason: finalReason, admin_password: bulkAdminPw || undefined,
      });
      toast.success(`${data.success} kayıt silindi. ${data.total_days_restored} gün iade edildi (${data.affected_personnel} personel).`);
      setBulkDeleteOpen(false); setBulkPreview(null); setSelected(new Set());
      setBulkReason(""); setBulkAdminPw(""); await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBulkBusy(false); }
  };

  // 3 katmanlı sıralama:
  //   Grup 0 — Son 24 saatte girilen izinler (en üstte)
  //   Grup 1 — Devam Eden + Yaklaşan
  //   Grup 2 — Geçmiş
  // Her grup içinde created_at desc (yeni eklenen üstte).
  const displayed = useMemo(() => {
    const today = todayIso();
    const dayAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const groupOf = (L) => {
      const c = L.created_at || "";
      if (c && c >= dayAgoISO) return 0; // son 24 saatte girilen
      if (today > L.end_date) return 2; // geçmiş
      return 1; // devam eden veya yaklaşan
    };
    let arr = items;
    if (statusFilter !== "all") {
      arr = items.filter((L) => {
        if (statusFilter === "upcoming") return today < L.start_date;
        if (statusFilter === "current") return today >= L.start_date && today <= L.end_date;
        if (statusFilter === "past") return today > L.end_date;
        return true;
      });
    }
    return [...arr].sort((a, b) => {
      const ga = groupOf(a), gb = groupOf(b);
      if (ga !== gb) return ga - gb;
      const ta = a.created_at || a.start_date || "";
      const tb = b.created_at || b.start_date || "";
      return tb.localeCompare(ta);
    });
  }, [items, statusFilter]);

  const clearAllFilters = () => {
    setQ(""); setPreset("recent30"); setStart(""); setEnd("");
    setIzinTuru(""); setDepartman(""); setStatusFilter("all");
    setSkip(0);
  };

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">İzinler</h1>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button variant="destructive" onClick={openBulkDelete} disabled={bulkBusy} data-testid="leaves-bulk-delete-btn">
                <Trash2 size={14} className="mr-1" /> Seçilenleri Sil ({selected.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => exportExcel()} disabled={loading || total === 0} data-testid="leaves-export-btn">
              <Download size={14} className="mr-1" /> Excel İndir
            </Button>
            {tab === "active" && (
              <Button asChild className="bg-blue-600 hover:bg-blue-700" data-testid="bulk-leave-btn">
                <Link to="/izinler/toplu"><Layers size={14} className="mr-1" /> Toplu İzin Ekle</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Iter 47: Aktif / İşten Ayrılan İzinleri sekmeleri */}
      <div className="flex items-end gap-1 border-b border-slate-200" data-testid="leaves-tabs">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === "active" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          data-testid="tab-leaves-active">
          Aktif Personel İzinleri <span className="ml-1 text-xs opacity-70">({activeTotal.toLocaleString("tr-TR")})</span>
        </button>
        <button
          onClick={() => setTab("inactive")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === "inactive" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          data-testid="tab-leaves-inactive">
          İşten Ayrılanların İzinleri <span className="ml-1 text-xs opacity-70">({inactiveTotal.toLocaleString("tr-TR")})</span>
        </button>
        <div className="ml-auto pb-1 flex items-center gap-2">
          <Label className="text-xs text-slate-500">Görüntüleme:</Label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-20 h-8" data-testid="leaves-limit"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-3 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur space-y-2">
        {/* Satır 1 — arama + Filtreleri Temizle + Departman + Tür + Durum + Tarih Aralığı */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9"
                   placeholder="Ad soyad, sicil no veya departman ara..." data-testid="leaves-search" />
          </div>
          {(q || preset !== "recent30" || izinTuru || departman || statusFilter !== "all") && (
            <Button size="sm" variant="ghost" onClick={clearAllFilters} data-testid="leaves-clear-filters" className="h-9">
              <X size={13} className="mr-1" /> Filtreleri Temizle
            </Button>
          )}
          <Select value={departman || "__all__"} onValueChange={(v) => setDepartman(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-52 h-9" data-testid="leaves-department"><SelectValue placeholder="Departman" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Tüm departmanlar</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9" data-testid="leaves-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              <SelectItem value="current">Devam Eden</SelectItem>
              <SelectItem value="upcoming">Yaklaşan</SelectItem>
              <SelectItem value="past">Geçmiş</SelectItem>
            </SelectContent>
          </Select>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-44 h-9" data-testid="leaves-preset"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent10">Son 10 gün</SelectItem>
              <SelectItem value="recent30">Son 30 gün</SelectItem>
              <SelectItem value="recent90">Son 90 gün</SelectItem>
              <SelectItem value="year">Son 1 yıl</SelectItem>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="custom">Özel tarih aralığı</SelectItem>
            </SelectContent>
          </Select>
          {loading && <Loader2 size={13} className="animate-spin text-slate-400 ml-2" />}
        </div>

        {/* Satır 2 — özel tarih aralığı (yalnızca custom preset seçildiğinde) */}
        {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-slate-500">Özel Aralık:</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" data-testid="leaves-start" />
          <span className="text-slate-400">→</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" data-testid="leaves-end" />
        </div>
        )}
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full">
            <thead>
              <tr>
                {canEdit && (
                  <th className="w-8">
                    <Checkbox
                      checked={displayed.length > 0 && displayed.every((L) => selected.has(L.id))}
                      onCheckedChange={toggleAllVisible}
                      data-testid="leaves-select-all"
                    />
                  </th>
                )}
                <th>Sicil</th>
                <th>Ad Soyad</th>
                <th>Departman</th>
                <SortableTh label="İzin Türü" field="izin_turu" sort={sort} setSort={setSort} />
                <SortableTh label="Başlangıç" field="start_date" sort={sort} setSort={setSort} />
                <SortableTh label="Bitiş" field="end_date" sort={sort} setSort={setSort} />
                <SortableTh label="Gün" field="days" sort={sort} setSort={setSort} />
                <th>İşbaşı</th>
                {tab === "inactive" && <th>İşten Çıkış</th>}
                <th>Durum</th>
                <SortableTh label="Kayıt Tarihi" field="created_at" sort={sort} setSort={setSort} className="text-right" />
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((L) => {
                const st = leaveStatus(L);
                const isSel = selected.has(L.id);
                return (
                  <tr key={L.id} data-testid={`leave-row-${L.id}`} className={isSel ? "bg-blue-50/40" : ""}>
                    {canEdit && (
                      <td>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleRow(L.id)} data-testid={`leaves-check-${L.id}`} />
                      </td>
                    )}
                    <td className="font-mono text-xs">{L.sicil_no || "—"}</td>
                    <td className="font-medium text-slate-900">
                      {L.personnel_id ? <Link to={`/personel/${L.personnel_id}`} className="hover:underline">{L.ad_soyad || "—"}</Link> : "—"}
                    </td>
                    <td>{L._departman || "—"}</td>
                    <td>{L.izin_turu}</td>
                    <td className="font-mono text-xs">{toTr(L.start_date)}</td>
                    <td className="font-mono text-xs">{toTr(L.end_date)}</td>
                    <td className="tabular-nums font-medium">{fmtNum(L.days)}</td>
                    <td className="font-mono text-xs">{toTr(L.isbasi_tarihi)}</td>
                    {tab === "inactive" && (
                      <td className="font-mono text-xs text-red-700" data-testid={`leave-term-${L.id}`}>{toTr(L._personnel_isten_cikis)}</td>
                    )}
                    <td>
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="font-mono text-xs text-slate-500 text-right" data-testid={`leave-created-${L.id}`}>
                      {L.created_at ? toTr(L.created_at) : "—"}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button asChild variant="ghost" size="sm" title="Yazdır">
                        <Link to={`/izin/${L.id}/yazdir`} target="_blank"><Printer size={14} /></Link>
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => askSingleDelete(L)}
                                className="text-red-600 hover:bg-red-50" title="Sil"
                                data-testid={`leaves-delete-${L.id}`}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && !loading && (
                <tr><td colSpan={canEdit ? (tab === "inactive" ? 13 : 12) : (tab === "inactive" ? 12 : 11)} className="text-center text-slate-400 py-10">Kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50 text-sm">
            <div className="text-slate-600">
              <b className="text-slate-900 tabular-nums" data-testid="leaves-range">
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

      {/* Tekli silme dialog */}
      <Dialog open={!!singleDelete} onOpenChange={(v) => !v && setSingleDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700">İzin Kaydını Sil</DialogTitle>
            <DialogDescription>Bu izin kaydını silmek istediğinize emin misiniz?</DialogDescription>
          </DialogHeader>
          {singleDelete && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
              <div><b>Personel:</b> {singleDelete.ad_soyad} · <span className="font-mono">{singleDelete.sicil_no}</span></div>
              <div><b>İzin Türü:</b> {singleDelete.izin_turu}</div>
              <div><b>Tarih:</b> {toTr(singleDelete.start_date)} → {toTr(singleDelete.end_date)}</div>
              <div><b>Gün Sayısı:</b> {fmtNum(singleDelete.days)}</div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Silme Gerekçesi</Label>
            <Select value={singleReasonType} onValueChange={setSingleReasonType}>
              <SelectTrigger data-testid="single-reason-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hatalı izin girişi">Hatalı izin girişi</SelectItem>
                <SelectItem value="Mükerrer kayıt">Mükerrer kayıt</SelectItem>
                <SelectItem value="Tarih hatası">Tarih hatası</SelectItem>
                <SelectItem value="Test kaydı">Test kaydı</SelectItem>
                <SelectItem value="Diğer">Diğer (açıklama zorunlu)</SelectItem>
              </SelectContent>
            </Select>
            {singleReasonType === "Diğer" && (
              <Textarea rows={2} value={singleReason} onChange={(e) => setSingleReason(e.target.value)}
                        placeholder="Açıklama..." data-testid="single-reason-text" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleDelete(null)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doSingleDelete} disabled={singleBusy} data-testid="single-delete-confirm">
              <Trash2 size={13} className="mr-1" /> İzin Kaydını Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toplu silme dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(v) => { if (!v) { setBulkDeleteOpen(false); setBulkPreview(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><Trash2 size={18} /> Toplu İzin Silme Onayı</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz. Silinen izin gün sayıları personel bakiyelerine iade edilir.</DialogDescription>
          </DialogHeader>
          {bulkPreview && (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded border p-2 bg-red-50 border-red-200"><div className="text-[10px] uppercase text-red-700">Toplam Kayıt</div><div className="text-lg font-bold text-red-900 tabular-nums">{bulkPreview.total}</div></div>
                <div className="rounded border p-2 bg-slate-50"><div className="text-[10px] uppercase">Personel</div><div className="text-lg font-bold tabular-nums">{bulkPreview.affected_personnel}</div></div>
                <div className="rounded border p-2 bg-emerald-50 border-emerald-200"><div className="text-[10px] uppercase text-emerald-700">İade Edilecek Gün</div><div className="text-lg font-bold text-emerald-800 tabular-nums">{fmtNum(bulkPreview.total_days_to_restore)}</div></div>
                <div className="rounded border p-2 bg-blue-50 border-blue-200"><div className="text-[10px] uppercase text-blue-700">Yıllık / Avans / Diğer</div><div className="text-sm font-bold text-blue-900 tabular-nums">{bulkPreview.annual} / {bulkPreview.advance} / {bulkPreview.other}</div></div>
              </div>
              <div className="flex-1 overflow-auto border border-slate-200 rounded-md" style={{ maxHeight: 200 }}>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr><th className="p-2 text-left">Sicil</th><th className="p-2 text-left">Personel</th><th className="p-2 text-left">Tür</th><th className="p-2 text-left">Tarih</th><th className="p-2 text-right">Gün</th></tr>
                  </thead>
                  <tbody>
                    {bulkPreview.items.map((i) => (
                      <tr key={i.id}><td className="p-1.5 font-mono">{i.sicil_no}</td><td className="p-1.5">{i.ad_soyad}</td><td className="p-1.5">{i.izin_turu}</td><td className="p-1.5 font-mono">{toTr(i.start_date)}→{toTr(i.end_date)}</td><td className="p-1.5 text-right tabular-nums">{fmtNum(i.days)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Silme Gerekçesi</Label>
                <Select value={bulkReasonType} onValueChange={setBulkReasonType}>
                  <SelectTrigger data-testid="bulk-reason-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hatalı izin girişi">Hatalı izin girişi</SelectItem>
                    <SelectItem value="Mükerrer kayıt">Mükerrer kayıt</SelectItem>
                    <SelectItem value="Tarih hatası">Tarih hatası</SelectItem>
                    <SelectItem value="Test kaydı">Test kaydı</SelectItem>
                    <SelectItem value="Diğer">Diğer (açıklama zorunlu)</SelectItem>
                  </SelectContent>
                </Select>
                {bulkReasonType === "Diğer" && (
                  <Textarea rows={2} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)}
                            placeholder="Açıklama..." data-testid="bulk-reason-text" />
                )}
                {bulkPreview.total >= 20 && (
                  <div className="mt-2">
                    <Label className="text-xs flex items-center gap-1 text-amber-700"><ShieldAlert size={12} /> 20+ Kayıt için Yönetici Şifresi Zorunlu</Label>
                    <Input type="password" value={bulkAdminPw} onChange={(e) => setBulkAdminPw(e.target.value)}
                           autoComplete="new-password" data-testid="bulk-admin-pw" />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doBulkDelete} disabled={bulkBusy} data-testid="bulk-delete-confirm">
              <Trash2 size={13} className="mr-1" /> Seçilen İzinleri Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
