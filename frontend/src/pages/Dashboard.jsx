import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, TrendingUp, PartyPopper, TriangleAlert, RotateCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

function fmtTr(n) {
  if (n === null || n === undefined || n === "") return "0";
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  const parts = num.toFixed(num % 1 === 0 ? 0 : 1).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}

function StatCard({ label, value, icon: Icon, tone = "blue", loading, error, onRetry, testid }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <Card className="p-4 border border-slate-200 shadow-sm" data-testid={testid}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-md grid place-items-center ${tones[tone]}`}><Icon size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          {loading ? (
            <div className="mt-1 h-7 w-16 bg-slate-100 animate-pulse rounded" />
          ) : error ? (
            <div className="mt-0.5">
              <div className="text-xs text-red-700 font-medium flex items-center gap-1"><AlertCircle size={12} /> Veri alınamadı</div>
              <button onClick={onRetry} className="text-xs text-blue-700 hover:underline mt-0.5" data-testid={`${testid}-retry`}>
                <RotateCw size={10} className="inline mr-0.5" /> Yeniden dene
              </button>
            </div>
          ) : (
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{value}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [summaryErr, setSummaryErr] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [over20, setOver20] = useState({ total: 0, items: [] });
  const [over20Loading, setOver20Loading] = useState(true);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true); setSummaryErr(false);
    try {
      const { data } = await api.get("/dashboard/summary");
      setSummary(data);
    } catch {
      setSummaryErr(true);
    } finally { setSummaryLoading(false); }
  }, []);

  const loadOver20 = useCallback(async () => {
    setOver20Loading(true);
    try {
      const { data } = await api.get("/dashboard/over-20", { params: { limit: 50 } });
      setOver20(data);
    } catch { /* silently */ }
    finally { setOver20Loading(false); }
  }, []);

  useEffect(() => {
    loadSummary();
    loadOver20();
  }, [loadSummary, loadOver20]);

  return (
    <div className="space-y-6">
      <div className="sticky-page-title">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel</h1>
        <p className="text-sm text-slate-500 mt-1">Merkoteks Personel ve İzin Sistemi genel durum özeti.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Toplam Personel" tone="blue" icon={Users}
          testid="stat-total-personnel"
          loading={summaryLoading} error={summaryErr} onRetry={loadSummary}
          value={fmtTr(summary?.total_active_personnel ?? 0)}
        />
        <StatCard
          label="Bugün İzinli" tone="emerald" icon={PartyPopper}
          testid="stat-today-on-leave"
          loading={summaryLoading} error={summaryErr} onRetry={loadSummary}
          value={fmtTr(summary?.today_on_leave ?? 0)}
        />
        <StatCard
          label="Toplam Kalan İzin" tone="slate" icon={TrendingUp}
          testid="stat-total-remaining"
          loading={summaryLoading} error={summaryErr} onRetry={loadSummary}
          value={`${fmtTr(summary?.total_remaining_leave ?? 0)} gün`}
        />
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <TriangleAlert size={18} className="text-amber-600" />
          <h3 className="text-base font-semibold">20 Gün Üzeri İzni Olan Personeller</h3>
          <span className="ml-auto text-xs text-slate-500" data-testid="over20-count">{over20.total} kişi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead><tr><th>Sicil</th><th>Ad Soyad</th><th>Departman</th><th className="text-right">Kalan İzin</th></tr></thead>
            <tbody>
              {over20Loading && (<tr><td colSpan={4} className="text-center text-slate-400 py-6">Yükleniyor...</td></tr>)}
              {!over20Loading && over20.items.map((r) => (
                <tr key={r.id} data-testid={`over20-row-${r.sicil_no}`}>
                  <td className="font-mono text-xs">{r.sicil_no}</td>
                  <td><Link to={`/personel/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.ad_soyad}</Link></td>
                  <td>{r.departman || "—"}</td>
                  <td className="text-right tabular-nums font-semibold text-amber-700">{fmtTr(r.remaining)} gün</td>
                </tr>
              ))}
              {!over20Loading && over20.items.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6">Kalan izni 20 günü aşan personel yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {over20.total > over20.items.length && (
          <div className="p-3 text-xs text-slate-500 border-t border-slate-100 bg-slate-50 text-center">
            İlk {over20.items.length} kayıt gösteriliyor. Detaylı liste için Personel sayfasına gidin.
          </div>
        )}
      </Card>
    </div>
  );
}
