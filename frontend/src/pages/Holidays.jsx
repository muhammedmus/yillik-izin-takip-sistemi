import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, FileText, AlertTriangle, Save, Trash2, Check, Globe } from "lucide-react";
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

export default function Holidays() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "hr";
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [availableYears, setAvailableYears] = useState([]);
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  // Manuel tatil ekleme — Tarih / Tatil Adı / Gün alanlarını içeren form.
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addName, setAddName] = useState("");
  const [addDayValue, setAddDayValue] = useState("1");
  const [addBusy, setAddBusy] = useState(false);

  // Resmi kaynaktan otomatik çekim — dialog kendi bağımsız yıl alanına
  // sahiptir, sayfanın üstündeki "Yıl" seçicisinin aralığıyla sınırlı
  // değildir; her yıl (geçmiş/gelecek) serbestçe girilebilir.
  const [fetchOpen, setFetchOpen] = useState(false);
  const [fetchYear, setFetchYear] = useState(String(currentYear));
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);

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

  const doManualAdd = async () => {
    if (!addDate) { toast.error("Tarih seçin"); return; }
    if (!addName.trim()) { toast.error("Tatil/izin adı girin"); return; }
    const [y, m, d] = addDate.split("-");
    const line = `${d}.${m}.${y}\t${addName.trim()}\t${addDayValue}`;
    setAddBusy(true);
    try {
      const { data } = await api.post("/holidays/bulk-import-text", {
        text: line, filename: "Manuel Ekleme",
      });
      toast.success(`"${addName.trim()}" eklendi (${d}.${m}.${y})`);
      setYear(y);
      setActiveTab("all");
      setAddOpen(false);
      setAddDate(""); setAddName(""); setAddDayValue("1");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setAddBusy(false); }
  };

  const doFetchOfficial = async () => {
    setFetchBusy(true);
    try {
      const { data } = await api.post("/holidays/fetch-official", null, { params: { year: fetchYear } });
      setFetchResult(data);
      toast.success(`${fetchYear} yılı çekildi: +${data.added} yeni, ~${data.updated} güncel — "Kontrol Gerekli" sekmesinden onaylayın`);
      setYear(String(fetchYear));
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setFetchBusy(false); }
  };

  const doDeleteRecord = async (h) => {
    if (!window.confirm(`"${h.name}" (${toTr(h.date)}) kalıcı olarak silinsin mi?`)) return;
    try {
      await api.delete(`/holidays/records/${h.id}`);
      toast.success("Tatil kaydı silindi");
      setRecords((prev) => prev.filter((r) => r.id !== h.id));
    } catch (e) { toast.error(formatApiError(e)); }
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

  // Yıl seçici SADECE zaten kaydı olan yılları göstermesin — "Resmi Kaynaktan
  // Getir" ile henüz hiç kaydı olmayan bir yılı (ör. gelecek yıl) seçebilmek
  // için makul bir aralık (bugünden birkaç yıl öncesi/sonrası) her zaman
  // listeye eklenir, mevcut kayıtlı yıllarla birleştirilir (Iter 67).
  const yearOptions = useMemo(() => {
    const set = new Set((availableYears || []).map(Number));
    for (let y = currentYear - 3; y <= currentYear + 10; y++) set.add(y);
    return Array.from(set).sort((a, b) => a - b);
  }, [availableYears, currentYear]);

  return (
    <div className="space-y-4" data-testid="holidays-page">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tatiller</h1>
          <p className="text-sm text-slate-500 mt-1">Yıl bazlı tatil kayıtları. Manuel ekleyin veya resmi kaynaktan otomatik çekin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setFetchResult(null); setFetchYear(year); setFetchOpen(true); }} variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50" data-testid="holidays-fetch-official-btn">
            <Globe size={14} className="mr-1" /> Resmi Kaynaktan Getir
          </Button>
          <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="holidays-add-btn">
            <Plus size={14} className="mr-1" /> Tatil Ekle
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
                  {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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
                  <tr><th>Tarih</th><th>Tatil Adı</th><th>Yıl</th><th className="text-right">Gün</th><th>Süre</th><th>Durum</th><th>Kaynak</th>{isAdmin && <th className="w-12">İşlem</th>}</tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr key={h.id} data-testid={`holiday-row-${h.date}-${(h.name || "").slice(0, 8)}`}>
                      <td className="font-mono">{toTr(h.date)}</td>
                      <td className={`font-medium ${h.needs_review ? "text-amber-700" : ""}`}>{h.name}</td>
                      <td className="tabular-nums">{h.year}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtNum(h.day_value)}</td>
                      <td className="text-xs">{h.type === "half" ? "Yarım Gün" : "Tam Gün"}</td>
                      <td>{h.needs_review ? <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Kontrol Gerekli</Badge> : (h.active ? <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Aktif</Badge> : <Badge className="bg-slate-50 text-slate-400 text-[10px]">Pasif</Badge>)}</td>
                      <td className="text-xs text-slate-500"><FileText size={11} className="inline mr-1" />{h.source}</td>
                      {isAdmin && (
                        <td>
                          <Button size="sm" variant="ghost" onClick={() => doDeleteRecord(h)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`holiday-delete-${h.id}`} title="Bu tatili sil">
                            <Trash2 size={13} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && !busy && (<tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-400">{records.length === 0 ? `${year} yılı için kayıt yok.` : "Filtreye uyan kayıt yok."}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-3">
          <ReviewTab records={reviewRecords} canManage={canManage} onRefresh={load} year={year} setYear={setYear} availableYears={yearOptions} currentYear={currentYear} />
        </TabsContent>
      </Tabs>

      {/* Manuel tatil ekleme dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) { setAddDate(""); setAddName(""); setAddDayValue("1"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tatil Ekle</DialogTitle>
            <DialogDescription>Tarih, tatil/izin adı ve gün süresini girip kaydedin. Kaydedilen tatil "Tüm Tatiller" listesinde görünür.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tarih</Label>
              <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} data-testid="holidays-add-date" />
            </div>
            <div>
              <Label className="text-xs">Tatil / İzin Adı</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Örn: 1 Mayıs Emek ve Dayanışma Günü" data-testid="holidays-add-name" />
            </div>
            <div>
              <Label className="text-xs">Gün</Label>
              <Select value={addDayValue} onValueChange={setAddDayValue}>
                <SelectTrigger className="h-9" data-testid="holidays-add-dayvalue"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tam Gün (1)</SelectItem>
                  <SelectItem value="0.5">Yarım Gün / Arife (0,5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Vazgeç</Button>
            <Button onClick={doManualAdd} disabled={addBusy} className="bg-blue-600 hover:bg-blue-700" data-testid="holidays-add-confirm">
              <Save size={13} className="mr-1" /> Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resmi kaynaktan otomatik çekim dialog */}
      <Dialog open={fetchOpen} onOpenChange={(v) => { setFetchOpen(v); if (!v) setFetchResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resmi Kaynaktan Getir</DialogTitle>
            <DialogDescription>
              Getirmek istediğiniz yılı girin. O yıla ait resmi ve dinî tatiller
              (arife dahil) çevrimiçi resmi kaynaktan otomatik çekilip içe
              aktarılacak. Dinî bayram tarihleri de dahil olduğu için, içe
              aktarılan tüm kayıtlar bir kerelik göz kontrolü için "Kontrol
              Gerekli" sekmesine düşer. Herhangi bir geçmiş veya gelecek yıl
              girilebilir.
            </DialogDescription>
          </DialogHeader>
          {!fetchResult ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Yıl</Label>
                <Input type="number" value={fetchYear} onChange={(e) => setFetchYear(e.target.value)}
                       className="w-32" data-testid="holidays-fetch-year-input" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setFetchOpen(false)}>Vazgeç</Button>
                <Button onClick={doFetchOfficial} disabled={fetchBusy || !fetchYear}
                        className="bg-blue-600 hover:bg-blue-700" data-testid="holidays-fetch-official-confirm">
                  <Globe size={13} className={`mr-1 ${fetchBusy ? "animate-spin" : ""}`} />
                  {fetchBusy ? "Çekiliyor..." : `${fetchYear || ""} Yılını Getir`}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3" data-testid="fetch-official-result">
              <Card className="p-3 border border-emerald-200 bg-emerald-50">
                <div className="text-sm font-semibold text-emerald-800 mb-2">Çekim Tamamlandı</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Toplam satır: <b>{fetchResult.total_lines}</b></div>
                  <div>Eklenen: <b className="text-emerald-700">{fetchResult.added}</b></div>
                  <div>Güncellenen: <b className="text-blue-700">{fetchResult.updated}</b></div>
                  <div>Mükerrer (atlanan): <b className="text-slate-600">{fetchResult.duplicates_skipped}</b></div>
                  <div className="col-span-2">Kaynak: <b>{fetchResult.source}</b></div>
                </div>
              </Card>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Bu kayıtlar "Kontrol Gerekli" sekmesine düştü — özellikle dinî bayram
                tarihlerini bir kez göz atıp onaylamanız önerilir.
              </div>
              <DialogFooter>
                <Button onClick={() => { setFetchOpen(false); setFetchResult(null); }}>Kapat</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
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