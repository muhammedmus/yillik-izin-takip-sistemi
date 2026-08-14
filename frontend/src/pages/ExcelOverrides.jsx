import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, User, Calendar, FileSpreadsheet } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function toTr(iso) { if (!iso) return "—"; const s = String(iso); if (s.length < 10) return s; const [y, m, d] = s.slice(0, 10).split("-"); return `${d}.${m}.${y}`; }
function toTrDate(iso) { if (!iso) return "—"; try { const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString("tr-TR"); } catch { return iso; } }
function fmtNum(n) { if (n === null || n === undefined) return "—"; return String(n).replace(".", ","); }

export default function ExcelOverrides() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [skip, setSkip] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports/excel-overrides", { params: { limit, skip } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip]);

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5" data-testid="excel-overrides-page">
      <div className="sticky-page-title">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <AlertTriangle size={24} className="text-amber-600" /> Excel Override Raporu
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Toplu Excel yüklemesinde kullanıcının sistem hesabını ezerek manuel gün belirttiği kayıtlar. Denetim izi.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} data-testid="overrides-refresh">
            <RefreshCw size={13} className={loading ? "animate-spin mr-1" : "mr-1"} /> Yenile
          </Button>
        </div>
      </div>

      <Card className="p-3 border border-slate-200 shadow-sm sticky top-[68px] z-20 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-slate-700 flex items-center gap-2">
            <FileSpreadsheet size={15} className="text-amber-600" />
            <b className="text-slate-900 tabular-nums" data-testid="overrides-total">{total.toLocaleString("tr-TR")}</b>
            <span>manuel gün üzerine yazma kaydı bulundu</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Sayfa boyutu:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setSkip(0); }}>
              <SelectTrigger className="w-20 h-9" data-testid="overrides-limit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Personel</th>
                <th>İzin Aralığı</th>
                <th className="text-right">Sistem</th>
                <th className="text-right">Excel</th>
                <th className="text-right">Fark</th>
                <th>Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const diff = row.difference;
                const diffClass = diff === null || diff === undefined ? ""
                  : diff > 0 ? "text-red-700 font-semibold"
                  : diff < 0 ? "text-amber-700 font-semibold"
                  : "text-slate-500";
                const diffSign = diff === null || diff === undefined ? "" : diff > 0 ? "+" : "";
                return (
                  <tr key={row.id} data-testid={`override-row-${row.id}`}>
                    <td className="text-xs whitespace-nowrap">{toTrDate(row.timestamp)}</td>
                    <td className="text-xs">
                      <div className="font-medium text-slate-900 flex items-center gap-1"><User size={11} /> {row.user_name || "—"}</div>
                      <div className="text-[11px] text-slate-500">{row.user_email}</div>
                    </td>
                    <td>
                      <div className="font-medium">{row.ad_soyad || "—"}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Sicil: {row.sicil_no || "—"}</div>
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      <Calendar size={11} className="inline mr-1 text-slate-400" />
                      {toTr(row.start_date)} → {toTr(row.end_date)}
                    </td>
                    <td className="text-right tabular-nums">{fmtNum(row.system_days)}</td>
                    <td className="text-right tabular-nums font-semibold">{fmtNum(row.manual_days)}</td>
                    <td className={`text-right tabular-nums ${diffClass}`}>
                      {diff === null || diff === undefined ? "—" : `${diffSign}${fmtNum(diff)}`}
                    </td>
                    <td className="text-xs max-w-md">
                      {row.reason ? (
                        <span className="inline-block">{row.reason}</span>
                      ) : (
                        <Badge variant="secondary" className="bg-red-50 text-red-700 border border-red-200 text-[10px]">Gerekçe yok</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Manuel gün üzerine yazma kaydı bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50 text-sm">
            <div className="text-slate-600">
              <b className="text-slate-900 tabular-nums" data-testid="overrides-range">
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
    </div>
  );
}
