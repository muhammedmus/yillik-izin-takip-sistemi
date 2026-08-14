import { useEffect, useState } from "react";
import { Trash2, RefreshCw, User, AlertTriangle, Download, X, Filter, FileJson, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function toTr(iso) { if (!iso) return "—"; const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; }
function toTrDateTime(iso) { if (!iso) return "—"; try { const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString("tr-TR"); } catch { return iso; } }
function fmtNum(n) { if (n === null || n === undefined) return "—"; return String(n).replace(".", ","); }

export default function DeletedLeaves() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [skip, setSkip] = useState(0);

  // Filtreler
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [actionType, setActionType] = useState("");
  const [users, setUsers] = useState([]);

  // Detay modal
  const [detail, setDetail] = useState(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [dryRun, setDryRun] = useState(null); // full dry-run for the whole audit
  const [dryBusy, setDryBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState({}); // {idx: 'preview' | 'restore'}

  const doDryRun = async (idx = null) => {
    if (!detail) return;
    setDryBusy(idx === null);
    if (idx !== null) setRowBusy((m) => ({ ...m, [idx]: "preview" }));
    try {
      const body = { audit_id: detail.id };
      if (idx !== null) body.leave_index = idx;
      const { data } = await api.post("/reports/deleted-leaves/restore-preview", body);
      if (idx === null) {
        setDryRun(data);
      } else {
        setDryRun((prev) => {
          const base = prev || { results: [], ok: 0, conflicts: 0, warnings: 0, errors: 0, total: 0 };
          const next = { ...base, results: [...(base.results || [])] };
          const rIdx = next.results.findIndex((x) => x.leave_index === idx);
          const rec = data.results[0];
          if (rIdx >= 0) next.results[rIdx] = rec; else next.results.push(rec);
          return next;
        });
      }
    } catch (e) { toast.error(formatApiError(e)); }
    finally {
      setDryBusy(false);
      if (idx !== null) setRowBusy((m) => { const n = { ...m }; delete n[idx]; return n; });
    }
  };

  const doRestore = async (idx = null) => {
    if (!detail) return;
    // Silme türü tekliyse tümü direkt; toplu ve idx yoksa uyar
    const isBulk = detail.action === "bulk_delete";
    const label = idx !== null ? "Bu kayıt geri yüklenecek." : (isBulk ? "Tüm silinen kayıtlar tek tek geri yüklenecek." : "Bu silme kaydı geri yüklenecek.");
    if (!window.confirm(`${label} Aynı tarihlerde başka izin varsa çakışma raporlanır. Devam edilsin mi?`)) return;
    setRestoreBusy(idx === null);
    if (idx !== null) setRowBusy((m) => ({ ...m, [idx]: "restore" }));
    if (idx === null) setRestoreResult(null);
    try {
      const body = { audit_id: detail.id };
      if (idx !== null) body.leave_index = idx;
      const { data } = await api.post("/reports/deleted-leaves/restore", body);
      if (idx === null) {
        setRestoreResult(data);
        if (data.restored > 0) toast.success(`${data.restored} kayıt geri yüklendi${data.conflicts ? `, ${data.conflicts} çakışma atlandı` : ""}`);
        else if (data.conflicts) toast.error(`Çakışma: ${data.conflicts} kayıt geri yüklenemedi`);
        else toast.error("Geri yükleme yapılamadı");
        await load();
      } else {
        const r = (data.results || [])[0];
        if (r?.status === "restored") toast.success(`Geri yüklendi: ${r.personnel || ""}`);
        else if (r?.status === "conflict") toast.error(`Çakışma: ${r.message || ""}`);
        else if (r?.status === "warning") toast.warning(r.message || "Uyarı");
        else toast.error(r?.message || "Geri yükleme yapılamadı");
        // Dry-run listesini güncelle: bu satırı "restored" olarak işaretle
        setDryRun((prev) => {
          if (!prev) return prev;
          const next = { ...prev, results: (prev.results || []).map((x) => x.leave_index === idx ? { ...x, status: r?.status === "restored" ? "restored" : x.status, message: r?.message || x.message } : x) };
          return next;
        });
        await load();
      }
    } catch (e) { toast.error(formatApiError(e)); }
    finally {
      setRestoreBusy(false);
      if (idx !== null) setRowBusy((m) => { const n = { ...m }; delete n[idx]; return n; });
    }
  };

  const buildParams = () => {
    const p = { limit, skip };
    if (fromDate) p.from_date = fromDate;
    if (toDate) p.to_date = toDate;
    if (userEmail) p.user_email = userEmail;
    if (actionType) p.action_type = actionType;
    return p;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports/deleted-leaves", { params: buildParams() });
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip, fromDate, toDate, userEmail, actionType]);
  useEffect(() => { setSkip(0); /* eslint-disable-next-line */ }, [limit, fromDate, toDate, userEmail, actionType]);
  useEffect(() => {
    api.get("/reports/deleted-leaves/users").then(({ data }) => setUsers(data.users || [])).catch(() => {});
  }, []);

  const clearFilters = () => { setFromDate(""); setToDate(""); setUserEmail(""); setActionType(""); };
  const hasFilters = fromDate || toDate || userEmail || actionType;

  const downloadExcel = async () => {
    try {
      const p = buildParams();
      delete p.limit; delete p.skip;
      const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
      const t = localStorage.getItem("token");
      const r = await fetch(`${API_BASE}/reports/deleted-leaves/export.xlsx${qs ? `?${qs}` : ""}`, {
        credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) { toast.error("Excel indirilemedi"); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `silinen_izinler_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("Excel indirildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5" data-testid="deleted-leaves-page">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Trash2 size={24} className="text-red-600" /> Silinen İzinler Raporu
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tekli ve toplu izin silme kayıtları — kim/ne/neden/bakiye değişimi.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadExcel} disabled={loading || total === 0} data-testid="deleted-export-btn">
            <Download size={13} className="mr-1" /> Excel İndir
          </Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} data-testid="deleted-refresh">
            <RefreshCw size={13} className={loading ? "animate-spin mr-1" : "mr-1"} /> Yenile
          </Button>
        </div>
      </div>

      <Card className="p-3 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-slate-700"><b className="tabular-nums" data-testid="deleted-total">{total.toLocaleString("tr-TR")}</b> silme kaydı</div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-slate-400" />
            <Label className="text-xs">Tarih:</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36 h-8" data-testid="deleted-from" />
            <span className="text-slate-400">→</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36 h-8" data-testid="deleted-to" />
            <Select value={userEmail || "__all__"} onValueChange={(v) => setUserEmail(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-52 h-8" data-testid="deleted-user"><SelectValue placeholder="Kullanıcı" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tüm kullanıcılar</SelectItem>
                {users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionType || "__all__"} onValueChange={(v) => setActionType(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-32 h-8" data-testid="deleted-type"><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tüm türler</SelectItem>
                <SelectItem value="delete">Tekli</SelectItem>
                <SelectItem value="bulk_delete">Toplu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="250">250</SelectItem></SelectContent>
            </Select>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="deleted-clear"><X size={13} className="mr-1" /> Temizle</Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead>
              <tr>
                <th>Tarih</th><th>Kullanıcı</th><th>Tür</th><th>Personel</th><th>İzin</th>
                <th className="text-right">Gün</th><th>Bakiye</th><th>Gerekçe</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const isBulk = r.action === "bulk_delete";
                return (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50" data-testid={`deleted-row-${r.id}`} onClick={() => setDetail(r)}>
                    <td className="text-xs whitespace-nowrap">{toTrDateTime(r.timestamp)}</td>
                    <td className="text-xs">
                      <div className="font-medium flex items-center gap-1"><User size={11} /> {r.user_name || "—"}</div>
                      <div className="text-[10px] text-slate-500">{r.user_email}</div>
                    </td>
                    <td>{isBulk ? <Badge className="bg-red-100 text-red-800 border border-red-200 text-[10px]">Toplu ({r.bulk_count})</Badge> : <Badge className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px]">Tekli</Badge>}</td>
                    <td>{isBulk ? <span className="text-xs text-slate-500">{r.affected_personnel} personel</span> : (<><div className="font-medium">{r.ad_soyad || "—"}</div><div className="text-[10px] text-slate-500 font-mono">{r.sicil_no || "—"}</div></>)}</td>
                    <td className="text-xs">{isBulk ? "—" : <>{toTr(r.start_date)} → {toTr(r.end_date)}<div className="text-[10px] text-slate-500">{r.izin_turu}</div></>}</td>
                    <td className="text-right tabular-nums font-semibold text-emerald-700">+{fmtNum(isBulk ? r.bulk_total_days : r.days)}</td>
                    <td className="text-xs">{!isBulk && r.balance_before != null ? <span className="tabular-nums">{fmtNum(r.balance_before)} → <b>{fmtNum(r.balance_after)}</b></span> : "—"}</td>
                    <td className="text-xs max-w-md">{r.reason || <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px]">Gerekçe yok</Badge>}</td>
                    <td><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(r); }} data-testid={`deleted-detail-${r.id}`}><FileJson size={13} /></Button></td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (<tr><td colSpan={9} className="text-center py-10 text-slate-400"><AlertTriangle size={16} className="inline mr-1" /> Silme kaydı bulunamadı.</td></tr>)}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50 text-sm">
            <div className="text-slate-600"><b className="tabular-nums" data-testid="deleted-range">{items.length === 0 ? "0" : `${(skip + 1).toLocaleString("tr-TR")}–${(skip + items.length).toLocaleString("tr-TR")}`}</b><span className="mx-1">/</span><b className="tabular-nums">{total.toLocaleString("tr-TR")}</b> kayıt<span className="mx-2">•</span>Sayfa <b>{currentPage}</b> / <b>{totalPages}</b></div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setSkip(0)} disabled={loading || skip === 0}>« İlk</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={loading || skip === 0}>‹ Önceki</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(skip + limit)} disabled={loading || skip + items.length >= total}>Sonraki ›</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, (totalPages - 1) * limit))} disabled={loading || currentPage >= totalPages}>Son »</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detay modal — full audit JSON */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) { setDetail(null); setRestoreResult(null); setDryRun(null); setRowBusy({}); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileJson size={18} className="text-blue-600" /> Silme Kaydı Detayı</DialogTitle>
            <DialogDescription>Denetim kaydının tam JSON içeriği ve özet bilgileri. Geri yüklemede çakışma/bakiye kontrolü yapılır.</DialogDescription>
          </DialogHeader>
          {detail && (() => {
            const isBulk = detail.action === "bulk_delete";
            const bulkList = (detail.audit?.old_values?.deleted_leaves) || [];
            const dryMap = (dryRun?.results || []).reduce((m, r) => { m[r.leave_index ?? -1] = r; return m; }, {});
            const statusBadge = (st) => {
              const map = {
                ok: ["bg-emerald-100 text-emerald-800 border-emerald-200", "Uygun"],
                conflict: ["bg-amber-100 text-amber-800 border-amber-200", "Çakışma"],
                warning: ["bg-slate-200 text-slate-700 border-slate-300", "Uyarı"],
                error: ["bg-red-100 text-red-800 border-red-200", "Hata"],
                restored: ["bg-blue-100 text-blue-800 border-blue-200", "Geri Yüklendi"],
              };
              const [cls, txt] = map[st] || ["bg-slate-100 text-slate-600 border-slate-200", st];
              return <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cls}`}>{txt}</span>;
            };
            return (
            <div className="flex-1 overflow-auto space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><b>Tarih:</b> {toTrDateTime(detail.timestamp)}</div>
                <div><b>Kullanıcı:</b> {detail.user_name} <span className="text-slate-500">({detail.user_email})</span></div>
                <div><b>Tür:</b> {detail.action_label}</div>
                <div><b>Gerekçe:</b> {detail.reason || "—"}</div>
                {!isBulk && (<>
                  <div><b>Sicil:</b> {detail.sicil_no || "—"}</div>
                  <div><b>Ad Soyad:</b> {detail.ad_soyad || "—"}</div>
                  <div><b>İzin:</b> {toTr(detail.start_date)} → {toTr(detail.end_date)}</div>
                  <div><b>Gün:</b> {fmtNum(detail.days)} · <b>Bakiye:</b> {fmtNum(detail.balance_before)} → {fmtNum(detail.balance_after)}</div>
                </>)}
                {isBulk && (<>
                  <div><b>Etkilenen:</b> {detail.affected_personnel} personel</div>
                  <div><b>Toplam İade:</b> {fmtNum(detail.bulk_total_days)} gün</div>
                </>)}
              </div>

              {/* Üst aksiyon çubuğu */}
              <div className="border-t pt-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-slate-600">
                  Geri yükleme: izin kaydı yeniden oluşturulur, bakiye tekrar düşülür, FIFO yeniden hesaplanır. Silme audit kaydına dokunulmaz; restore ayrı audit olarak eklenir.
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => doDryRun(null)} disabled={dryBusy || restoreBusy} data-testid="deleted-dryrun-btn">
                    <RefreshCw size={13} className={dryBusy ? "animate-spin mr-1" : "mr-1"} /> Ön İzle
                  </Button>
                  <Button size="sm" onClick={() => doRestore(null)} disabled={restoreBusy || dryBusy} className="bg-emerald-600 hover:bg-emerald-700" data-testid="deleted-restore-btn">
                    <RotateCcw size={13} className={restoreBusy ? "animate-spin mr-1" : "mr-1"} /> {isBulk ? "Tümünü Geri Yükle" : "Geri Yükle"}
                  </Button>
                </div>
              </div>

              {/* Dry-run özeti */}
              {dryRun && (
                <div className="rounded border border-slate-200 p-3 bg-slate-50 text-xs" data-testid="dryrun-summary">
                  <div className="flex items-center gap-3 font-medium">
                    <span className="text-emerald-700"><CheckCircle2 size={13} className="inline mr-1" />{dryRun.ok} uygun</span>
                    {dryRun.conflicts > 0 && <span className="text-amber-700"><AlertTriangle size={13} className="inline mr-1" />{dryRun.conflicts} çakışma</span>}
                    {dryRun.warnings > 0 && <span className="text-slate-600">{dryRun.warnings} uyarı</span>}
                    {dryRun.errors > 0 && <span className="text-red-700"><XCircle size={13} className="inline mr-1" />{dryRun.errors} hata</span>}
                    <span className="text-slate-500 ml-auto">Toplam {dryRun.total} kayıt</span>
                  </div>
                </div>
              )}

              {/* Toplu silme — kayıt listesi + satır bazlı butonlar */}
              {isBulk && bulkList.length > 0 && (
                <div className="rounded border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Silinen İzinler ({bulkList.length})</span>
                    <span className="text-slate-500 font-normal">Her satır ayrı geri yüklenebilir.</span>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-xs" data-testid="bulk-leaves-table">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-slate-600">
                          <th className="text-left px-2 py-1.5">#</th>
                          <th className="text-left px-2 py-1.5">Personel</th>
                          <th className="text-left px-2 py-1.5">Tarih</th>
                          <th className="text-right px-2 py-1.5">Gün</th>
                          <th className="text-left px-2 py-1.5">Tür</th>
                          <th className="text-left px-2 py-1.5">Durum</th>
                          <th className="text-right px-2 py-1.5">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkList.map((L, i) => {
                          const dry = dryMap[i];
                          const busy = rowBusy[i];
                          const restored = dry?.status === "restored";
                          return (
                            <tr key={i} className="border-t border-slate-100" data-testid={`bulk-row-${i}`}>
                              <td className="px-2 py-1.5 text-slate-500 tabular-nums">{i + 1}</td>
                              <td className="px-2 py-1.5">
                                <div className="font-medium">{dry?.personnel || "—"}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{dry?.sicil_no || L.personnel_id?.slice(0, 8)}</div>
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{toTr(L.start)} → {toTr(L.end)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-700">+{fmtNum(L.days)}</td>
                              <td className="px-2 py-1.5">{L.turu || "—"}</td>
                              <td className="px-2 py-1.5">
                                {dry ? (
                                  <div className="space-y-0.5">
                                    {statusBadge(dry.status)}
                                    {dry.message && <div className="text-[10px] text-slate-500">{dry.message}</div>}
                                    {dry.balance_current != null && (
                                      <div className="text-[10px] text-slate-500 tabular-nums">Bakiye: {fmtNum(dry.balance_current)} → {fmtNum(dry.balance_after_restore)}</div>
                                    )}
                                  </div>
                                ) : <span className="text-slate-400 text-[10px]">—</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                <Button size="sm" variant="ghost" onClick={() => doDryRun(i)} disabled={!!busy || restored} data-testid={`bulk-preview-${i}`} title="Bu satırı ön izle">
                                  <RefreshCw size={11} className={busy === "preview" ? "animate-spin" : ""} />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => doRestore(i)} disabled={!!busy || restored || dry?.status === "conflict" || dry?.status === "error"} className="ml-1 h-7 px-2 text-[11px]" data-testid={`bulk-restore-${i}`}>
                                  <RotateCcw size={11} className={busy === "restore" ? "animate-spin mr-1" : "mr-1"} />
                                  {restored ? "Yüklendi" : "Geri Yükle"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {restoreResult && (
                <div className="rounded border p-3 bg-slate-50 space-y-2 text-xs" data-testid="restore-result">
                  <div className="flex items-center gap-3 font-medium">
                    <span className="text-emerald-700"><CheckCircle2 size={13} className="inline mr-1" />{restoreResult.restored} geri yüklendi</span>
                    {restoreResult.conflicts > 0 && <span className="text-amber-700"><AlertTriangle size={13} className="inline mr-1" />{restoreResult.conflicts} çakışma</span>}
                    {restoreResult.errors > 0 && <span className="text-red-700"><XCircle size={13} className="inline mr-1" />{restoreResult.errors} hata</span>}
                    {restoreResult.warnings > 0 && <span className="text-slate-600">{restoreResult.warnings} uyarı</span>}
                  </div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {(restoreResult.results || []).map((r, i) => (
                      <div key={i} className={`text-[11px] p-1.5 rounded ${
                        r.status === "restored" ? "bg-emerald-50 text-emerald-800" :
                        r.status === "conflict" ? "bg-amber-50 text-amber-800" :
                        r.status === "warning" ? "bg-slate-100 text-slate-700" :
                        "bg-red-50 text-red-800"
                      }`}>
                        <b className="uppercase">{r.status}</b> — {r.personnel || "?"} · {r.message || (r.days ? `${r.days} gün ${r.start_date}→${r.end_date}` : "")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Ham Audit Kaydı (JSON)</Label>
                <pre className="mt-1 border rounded p-3 bg-slate-50 text-[11px] overflow-auto max-h-96" data-testid="deleted-detail-json">
                  {JSON.stringify(detail.audit || detail, null, 2)}
                </pre>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
