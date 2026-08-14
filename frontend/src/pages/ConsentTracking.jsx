import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Printer, FileText, RefreshCw, X, Loader2, CheckSquare, Search } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtDays(n) { if (n === null || n === undefined || n === "") return "—"; return String(n).replace(".", ","); }

function StatusBadge({ status }) {
  const map = {
    pending: { label: "Hazırlanmadı", cls: "bg-slate-100 text-slate-700 border-slate-200" },
    printed: { label: "Yazdırıldı", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    signed_uploaded: { label: "İmzalı Yüklendi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const m = map[status] || map.pending;
  return <Badge className={`${m.cls} border font-medium text-xs`}>{m.label}</Badge>;
}

export default function ConsentTracking() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [persons, setPersons] = useState(0);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("latest");
  const [q, setQ] = useState("");
  const [departman, setDepartman] = useState("");
  const [sirket, setSirket] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [limit, setLimit] = useState(100);
  const [skip, setSkip] = useState(0);

  const [selected, setSelected] = useState(new Set());
  const [selectAllBusy, setSelectAllBusy] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);

  const qDebounce = useRef(null);
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    clearTimeout(qDebounce.current);
    qDebounce.current = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(qDebounce.current);
  }, [q]);

  useEffect(() => {
    api.get("/personnel/facets").then(({ data }) => {
      setDepartments(data.departments || []);
      setCompanies(data.companies || []);
    }).catch(() => {});
  }, []);

  const params = useMemo(() => {
    const p = { view, limit, skip };
    if (qDebounced) p.q = qDebounced;
    if (departman) p.departman = departman;
    if (sirket) p.sirket = sirket;
    if (start) p.start = start;
    if (end) p.end = end;
    return p;
  }, [view, qDebounced, departman, sirket, start, end, limit, skip]);

  const load = () => {
    setLoading(true);
    api.get("/personnel/consent-tracking", { params })
      .then(({ data }) => {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPersons(data.persons || 0);
      })
      .catch((e) => toast.error(formatApiError(e, "Liste alınamadı")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [view, qDebounced, departman, sirket, start, end, limit, skip]);
  useEffect(() => { setSkip(0); setSelected(new Set()); /* eslint-disable-next-line */ }, [view, qDebounced, departman, sirket, start, end]);

  const clearFilters = () => {
    setQ(""); setDepartman(""); setSirket(""); setStart(""); setEnd(""); setSkip(0);
  };
  const isFiltered = !!(qDebounced || departman || sirket || start || end);

  const pageAllChecked = items.length > 0 && items.every((it) => selected.has(it.id));
  const togglePageAll = () => {
    const s = new Set(selected);
    if (pageAllChecked) items.forEach((it) => s.delete(it.id));
    else items.forEach((it) => s.add(it.id));
    setSelected(s);
  };
  const toggleOne = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };
  const clearSelection = () => setSelected(new Set());

  const selectAllFiltered = async () => {
    setSelectAllBusy(true);
    try {
      const { data } = await api.get("/personnel/consent-tracking", { params: { ...params, ids_only: true, limit: 10000, skip: 0 } });
      const ids = data.ids || [];
      setSelected(new Set(ids));
      toast.success(`${ids.length.toLocaleString("tr-TR")} kayıt seçildi`);
    } catch (e) {
      toast.error(formatApiError(e, "Toplu seçim başarısız"));
    } finally { setSelectAllBusy(false); }
  };

  // Ön izleme URL'i — leave.id'ler ile (eski şablonu doğrudan besler)
  const previewUrlOne = (leaveId, auto) =>
    `/muvafakatnameler/toplu?ids=${encodeURIComponent(leaveId)}${auto ? `&auto=${auto}` : ""}`;
  const previewUrlBulk = (auto) => {
    const ids = Array.from(selected);
    return `/muvafakatnameler/toplu?ids=${encodeURIComponent(ids.join(","))}${auto ? `&auto=${auto}` : ""}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <div className="space-y-3">
      <Card className="p-3 border border-slate-200 shadow-sm space-y-2">
        {/* Satır 1: Departman | Şirket | Tarih aralık */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={departman || "__all__"} onValueChange={(v) => setDepartman(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-56 h-9" data-testid="consent-department"><SelectValue placeholder="Departman" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Tüm departmanlar</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sirket || "__all__"} onValueChange={(v) => setSirket(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-52 h-9" data-testid="consent-company"><SelectValue placeholder="Şirket" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">Tüm şirketler</SelectItem>
              {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label className="text-xs text-slate-500 ml-2">Avans bşl.</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" data-testid="consent-start" />
          <span className="text-slate-400">→</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" data-testid="consent-end" />
        </div>

        {/* Satır 2: Ara | Filtreleri Temizle | Görünüm | Filtrelenenleri Seç | Yenile */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad soyad veya sicil ara..." className="pl-9 h-9" data-testid="consent-search" />
          </div>
          {isFiltered && (
            <Button size="sm" variant="ghost" onClick={clearFilters} data-testid="consent-clear-filters">
              <X size={13} className="mr-1" /> Filtreleri Temizle
            </Button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Label className="text-xs text-slate-500">Görünüm</Label>
            <Select value={view} onValueChange={setView}>
              <SelectTrigger className="w-48 h-9" data-testid="consent-view"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Son Avans İzni</SelectItem>
                <SelectItem value="all">Tüm Avans İzinleri</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={selectAllBusy || total === 0} data-testid="consent-select-all-filtered">
            {selectAllBusy ? <Loader2 size={13} className="mr-1 animate-spin" /> : <CheckSquare size={13} className="mr-1" />}
            Filtrelenenleri Seç
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} data-testid="consent-reload">
            {loading ? <Loader2 size={13} className="mr-1 animate-spin" /> : <RefreshCw size={13} className="mr-1" />}
            Yenile
          </Button>
        </div>

        {/* Sayaç + toplu aksiyonlar (seçim varsa) */}
        <div className="flex flex-wrap items-center gap-2 text-sm pt-1 border-t border-slate-100">
          <div className="text-slate-600">
            {view === "latest" ? (
              <><b className="text-slate-900 tabular-nums" data-testid="consent-total">{persons.toLocaleString("tr-TR")}</b> kişi bulundu</>
            ) : (
              <>
                <b className="text-slate-900 tabular-nums" data-testid="consent-total">{persons.toLocaleString("tr-TR")}</b> kişi /
                <b className="ml-1 text-slate-900 tabular-nums">{total.toLocaleString("tr-TR")}</b> avans izin kaydı
              </>
            )}
            {selected.size > 0 && (
              <span className="ml-3 text-blue-700"><b className="tabular-nums">{selected.size.toLocaleString("tr-TR")}</b> seçili</span>
            )}
          </div>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="ghost" onClick={clearSelection} data-testid="consent-clear-selection">
                <X size={13} className="mr-1" /> Seçimi Temizle
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => window.open(previewUrlBulk(), "_blank")} data-testid="consent-bulk-preview">
                <Eye size={13} className="mr-1" /> Seçilenleri Ön İzle ({selected.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(previewUrlBulk("print"), "_blank")} data-testid="consent-bulk-print">
                <Printer size={13} className="mr-1" /> Seçilenleri Yazdır
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(previewUrlBulk("pdf"), "_blank")} data-testid="consent-bulk-pdf">
                <FileText size={13} className="mr-1 text-red-600" /> Seçilenleri PDF İndir
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean w-full">
            <thead>
              <tr>
                <th className="w-8"><Checkbox checked={pageAllChecked} onCheckedChange={togglePageAll} data-testid="consent-page-check-all" /></th>
                <th>Sicil</th>
                <th>Ad Soyad</th>
                <th>Departman</th>
                <th>Şirket</th>
                <th className="text-right">Kalan İzin</th>
                <th>Avans İzin Başlangıç</th>
                <th>Avans İzin Bitiş</th>
                <th className="text-right">Avans İzin Gün</th>
                <th>Muvafakatname Durumu</th>
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={11} className="text-center text-slate-400 py-10">Muvafakatname gerektiren avans izin bulunamadı.</td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id} data-testid={`consent-row-${it.sicil_no}`}>
                  <td><Checkbox checked={selected.has(it.id)} onCheckedChange={() => toggleOne(it.id)} data-testid={`consent-check-${it.sicil_no}`} /></td>
                  <td className="font-mono text-xs">{it.sicil_no}</td>
                  <td className="font-medium text-slate-900">{it.ad_soyad}</td>
                  <td className="text-slate-700">{it.departman || "—"}</td>
                  <td className="text-slate-700">{it.sirket || "—"}</td>
                  <td className="text-right tabular-nums font-semibold text-red-600">{fmtDays(it.remaining)} gün</td>
                  <td className="font-mono text-xs">{toTr(it.start_date)}</td>
                  <td className="font-mono text-xs">{toTr(it.end_date)}</td>
                  <td className="text-right tabular-nums font-semibold text-amber-700">{fmtDays(it.advance_days)} gün</td>
                  <td><StatusBadge status={it.consent_status} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => window.open(previewUrlOne(it.id), "_blank")} data-testid={`consent-preview-${it.sicil_no}`}>
                        <Eye size={13} className="mr-1" /> Ön İzle
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(previewUrlOne(it.id, "print"), "_blank")} data-testid={`consent-print-${it.sicil_no}`}>
                        <Printer size={13} className="mr-1" /> Yazdır
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(previewUrlOne(it.id, "pdf"), "_blank")} data-testid={`consent-pdf-${it.sicil_no}`}>
                        <FileText size={13} className="mr-1 text-red-600" /> PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50 text-sm">
            <div className="text-slate-600">
              <b className="tabular-nums">{(skip + 1).toLocaleString("tr-TR")}–{Math.min(skip + items.length, total).toLocaleString("tr-TR")}</b>
              <span className="mx-1 text-slate-400">/</span>
              <b className="tabular-nums">{total.toLocaleString("tr-TR")}</b> kayıt
              <span className="mx-2 text-slate-400">•</span>
              Sayfa <b className="tabular-nums">{currentPage}</b> / <b className="tabular-nums">{totalPages}</b>
            </div>
            <div className="flex items-center gap-1">
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setSkip(0)} disabled={loading || skip === 0}>« İlk</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={loading || skip === 0}>‹ Önceki</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(skip + limit)} disabled={loading || skip + items.length >= total}>Sonraki ›</Button>
              <Button size="sm" variant="outline" onClick={() => setSkip(Math.max(0, (totalPages - 1) * limit))} disabled={loading || currentPage >= totalPages}>Son »</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
