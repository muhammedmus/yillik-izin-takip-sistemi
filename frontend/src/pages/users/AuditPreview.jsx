import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDateTime, toTr, roleLabel, moduleLabel, actionLabel } from "./shared";

export function AuditPreview({ items, filters, onBack }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="audit-preview-back">
          <ArrowLeft size={14} className="mr-1" /> Filtrelere Dön
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700" data-testid="audit-preview-print">
          <Printer size={14} className="mr-1" /> Yazdır
        </Button>
      </div>
      <div className="bg-white border border-slate-200 rounded-md p-8 max-w-[1100px] mx-auto print-page">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">MERKOTEKS TEKSTİL SAN. VE TİC. A.Ş.</div>
          <h2 className="text-xl font-bold mt-1">DENETİM KAYITLARI RAPORU</h2>
          <div className="text-xs text-slate-500 mt-1">Rapor Tarihi: {toDateTime(new Date().toISOString())}</div>
        </div>
        {(filters.start || filters.end) && (
          <div className="text-xs text-slate-600 mb-3">Tarih Aralığı: {filters.start ? toTr(filters.start) : "—"} → {filters.end ? toTr(filters.end) : "—"}</div>
        )}
        <table className="w-full text-[11px] border border-slate-800 border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-800 px-2 py-1.5 text-left">Tarih & Saat</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">Kullanıcı</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">Rol</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">Modül</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">İşlem</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">Etkilenen Kayıt</th>
              <th className="border border-slate-800 px-2 py-1.5">Durum</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="odd:bg-slate-50 align-top">
                <td className="border border-slate-400 px-2 py-1 font-mono whitespace-nowrap">{toDateTime(a.created_at)}</td>
                <td className="border border-slate-400 px-2 py-1">{a.user_name || "—"}</td>
                <td className="border border-slate-400 px-2 py-1">{roleLabel[a.user_role] || "—"}</td>
                <td className="border border-slate-400 px-2 py-1">{moduleLabel[a.module] || a.module}</td>
                <td className="border border-slate-400 px-2 py-1">{actionLabel[a.action] || a.action}</td>
                <td className="border border-slate-400 px-2 py-1">{a.entity_name || "—"}</td>
                <td className="border border-slate-400 px-2 py-1 text-center">{a.success ? "✔" : "✖"}</td>
                <td className="border border-slate-400 px-2 py-1 font-mono text-slate-500">{a.ip_address || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="border border-slate-400 px-2 py-4 text-center text-slate-500">Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
