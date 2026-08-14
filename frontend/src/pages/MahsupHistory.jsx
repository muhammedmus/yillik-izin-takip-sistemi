import { useEffect, useState } from "react";
import { Calendar, User as UserIcon, Clock, TrendingDown } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toTr(iso) {
  if (!iso) return "—";
  const s = String(iso);
  if (s.length < 10) return s;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function toTrDT(iso) {
  if (!iso) return "—";
  const [d, t] = String(iso).split("T");
  return `${toTr(d)} ${(t || "").slice(0, 5)}`;
}
function fmtNum(n) { return String(Number(n || 0)).replace(".", ","); }

export default function MahsupHistory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/audit-log", { params: { module: "leaves", action: "advance_offset", limit: 500 } });
      setItems(data.items || data || []);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const process = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/process-advance-offsets");
      toast.success(`${data.offsets_logged || 0} yeni mahsup kaydı işlendi`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((r) => {
    if (!q.trim()) return true;
    const term = q.trim().toLocaleLowerCase("tr-TR");
    const name = (r.entity_name || "").toLocaleLowerCase("tr-TR");
    return name.includes(term);
  });

  return (
    <div className="space-y-4" data-testid="mahsup-page">
      <div className="sticky-page-title flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mahsup Geçmişi</h1>
          <p className="text-sm text-slate-500 mt-1">Yeni yıl hak edişi kazanıldığında bekleyen avans izinlerin otomatik düşülme kayıtları.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={process} disabled={busy} data-testid="mahsup-process-btn"><TrendingDown size={14} className="mr-1" /> Tarama Çalıştır</Button>
        </div>
      </div>

      <Card className="p-3 border border-slate-200 shadow-sm">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Personel adı ara..." data-testid="mahsup-search" />
      </Card>

      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean table-sticky-head w-full text-sm">
            <thead>
              <tr>
                <th>Tarih</th><th>Personel</th>
                <th>Hak Ediş Yılı</th><th>Hak Ediş Tarihi</th>
                <th className="text-right">Mahsup Gün</th>
                <th>İzin Başlangıcı</th><th>Yapan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const nv = r.new_values || {};
                return (
                  <tr key={r.audit_id || r.id} data-testid={`mahsup-row-${r.audit_id || r.id}`}>
                    <td className="font-mono text-xs whitespace-nowrap"><Clock size={11} className="inline mr-1 text-slate-400" />{toTrDT(r.timestamp || r.created_at)}</td>
                    <td className="font-medium"><UserIcon size={11} className="inline mr-1 text-slate-400" />{r.entity_name || "—"}</td>
                    <td className="tabular-nums">{nv.entitlement_year || "—"}</td>
                    <td className="font-mono text-xs">{toTr(nv.entitlement_date)}</td>
                    <td className="text-right tabular-nums font-semibold text-amber-700">{fmtNum(nv.days)}</td>
                    <td className="font-mono text-xs"><Calendar size={11} className="inline mr-1 text-slate-400" />{toTr(nv.leave_start_date)}</td>
                    <td>{r.user_name || "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !busy && (<tr><td colSpan={7} className="text-center py-10 text-slate-400">Kayıt yok. "Tarama Çalıştır" ile yeni mahsuplar için tarama yapabilirsiniz.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
