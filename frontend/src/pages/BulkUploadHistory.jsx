import { useEffect, useState } from "react";
import { FileSpreadsheet, ChevronRight, User as UserIcon, ArrowLeft, CheckCircle2, XCircle, Calendar } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function toTr(iso) {
  if (!iso) return "—";
  const s = String(iso);
  if (s.length < 10) return s;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function toTrDT(iso) {
  if (!iso) return "—";
  const s = String(iso);
  const [d, t] = s.split("T");
  return `${toTr(d)} ${(t || "").slice(0, 5)}`;
}
function fmtNum(n) { return String(Number(n || 0)).replace(".", ","); }

export default function BulkUploadHistory() {
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploader, setUploader] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/bulk-uploads/history");
      setItems(data || []);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const filteredItems = items.filter((h) => {
    if (uploader.trim()) {
      const term = uploader.trim().toLocaleLowerCase("tr-TR");
      const name = (h.uploaded_by_name || "").toLocaleLowerCase("tr-TR");
      if (!name.includes(term)) return false;
    }
    const uploaded = (h.uploaded_at || "").slice(0, 10);
    if (fromDate && uploaded < fromDate) return false;
    if (toDate && uploaded > toDate) return false;
    return true;
  });

  const openDetail = async (id) => {
    setBusy(true);
    try {
      const { data } = await api.get(`/bulk-uploads/history/${id}`);
      setDetail(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  if (detail) {
    return (
      <div className="space-y-4">
        <div className="sticky-page-title flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Yükleme Detayı</h1>
            <p className="text-sm text-slate-500 mt-1">{detail.filename} — {toTrDT(detail.uploaded_at)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDetail(null)} data-testid="history-back-btn">
            <ArrowLeft size={14} className="mr-1" /> Geri
          </Button>
        </div>

        <Card className="p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
              {detail.created_count} oluşturuldu
            </Badge>
            {detail.skipped_count > 0 && (
              <Badge variant="secondary" className="bg-red-50 text-red-700 border border-red-200">
                {detail.skipped_count} atlandı
              </Badge>
            )}
            <span className="text-slate-500">Toplam <b>{detail.total_rows}</b> satır · <b>{fmtNum(detail.total_days)}</b> gün · Yükleyen: <b>{detail.uploaded_by_name}</b></span>
          </div>
          {detail.aciklama && <div className="text-xs text-slate-500 mt-2 italic">Açıklama: {detail.aciklama}</div>}
        </Card>

        {detail.created?.length > 0 && (
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
              <CheckCircle2 size={14} /> Oluşturulan Kayıtlar ({detail.created.length})
            </div>
            <div className="overflow-x-auto">
              <table className="table-clean table-sticky-head w-full text-sm">
                <thead>
                  <tr><th>Sicil</th><th>Ad Soyad</th><th>İzin Türü</th><th>Başlangıç</th><th>Bitiş</th><th className="text-right">Gün</th></tr>
                </thead>
                <tbody>
                  {detail.created.map((c, i) => (
                    <tr key={i} data-testid={`hist-created-${i}`}>
                      <td className="font-mono text-xs">{c.sicil_no}</td>
                      <td className="font-medium">{c.ad_soyad}</td>
                      <td>{c.izin_turu || "—"}</td>
                      <td className="font-mono text-xs">{toTr(c.start_date)}</td>
                      <td className="font-mono text-xs">{toTr(c.end_date)}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtNum(c.days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {detail.skipped?.length > 0 && (
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <XCircle size={14} /> Atlanan Kayıtlar ({detail.skipped.length})
            </div>
            <div className="overflow-x-auto">
              <table className="table-clean table-sticky-head w-full text-sm">
                <thead>
                  <tr><th>Sicil</th><th>Ad Soyad</th><th>Sebep</th></tr>
                </thead>
                <tbody>
                  {detail.skipped.map((s, i) => (
                    <tr key={i} data-testid={`hist-skipped-${i}`}>
                      <td className="font-mono text-xs">{s.sicil_no}</td>
                      <td>{s.ad_soyad || "—"}</td>
                      <td className="text-red-700">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="bulk-upload-history-page">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">İçe Aktarma Geçmişi</h1>
          <p className="text-sm text-slate-500 mt-1">Excel ile yapılan toplu izin yüklemelerinin dosya adı, tarih ve özet raporları.</p>
        </div>
      </div>

      <Card className="p-3 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input value={uploader} onChange={(e) => setUploader(e.target.value)} placeholder="Yükleyen ara..." className="h-9 px-3 rounded-md border border-slate-200 text-sm min-w-[180px]" data-testid="history-filter-uploader" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 px-3 rounded-md border border-slate-200 text-sm" data-testid="history-filter-from" />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 px-3 rounded-md border border-slate-200 text-sm" data-testid="history-filter-to" />
          {(uploader || fromDate || toDate) && (
            <button onClick={() => { setUploader(""); setFromDate(""); setToDate(""); }} className="text-xs text-blue-700 hover:underline">Temizle</button>
          )}
          <div className="ml-auto text-xs text-slate-500">
            <b className="text-slate-900 text-sm tabular-nums" data-testid="history-filter-count">{filteredItems.length}</b> / {items.length}
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead>
              <tr>
                <th>Tarih</th><th>Dosya</th><th>Yükleyen</th>
                <th className="text-right">Satır</th><th className="text-right">Oluşturulan</th>
                <th className="text-right">Atlanan</th><th className="text-right">Toplam Gün</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((h) => (
                <tr key={h.id} data-testid={`hist-row-${h.id}`} className="cursor-pointer" onClick={() => openDetail(h.id)}>
                  <td className="font-mono text-xs whitespace-nowrap"><Calendar size={11} className="inline mr-1 text-slate-400" />{toTrDT(h.uploaded_at)}</td>
                  <td className="font-medium text-slate-900"><FileSpreadsheet size={13} className="inline mr-1 text-emerald-600" />{h.filename || "—"}</td>
                  <td><UserIcon size={11} className="inline mr-1 text-slate-400" />{h.uploaded_by_name}</td>
                  <td className="text-right tabular-nums">{h.total_rows}</td>
                  <td className="text-right tabular-nums font-semibold text-emerald-700">{h.created_count}</td>
                  <td className="text-right tabular-nums text-red-700">{h.skipped_count}</td>
                  <td className="text-right tabular-nums font-semibold">{fmtNum(h.total_days)}</td>
                  <td className="text-right"><ChevronRight size={14} className="text-slate-400" /></td>
                </tr>
              ))}
              {filteredItems.length === 0 && !busy && (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Filtreye uyan yükleme yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
