import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toDateTime, roleLabel, moduleLabel, actionLabel, formatVal } from "./shared";

export function AuditDetailDialog({ item, onOpenChange }) {
  if (!item) return null;
  const oldV = item.old_values || {};
  const newV = item.new_values || {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="audit-detail-dialog">
        <DialogHeader>
          <DialogTitle>İşlem Detayı</DialogTitle>
          <DialogDescription>Bu denetim kaydında kaydedilen tüm alanlar aşağıda gösterilmektedir.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-3">
          <D k="Tarih & Saat" v={toDateTime(item.created_at)} />
          <D k="Kullanıcı" v={item.user_name || "—"} />
          <D k="Rol" v={roleLabel[item.user_role] || "—"} />
          <D k="Modül" v={moduleLabel[item.module] || item.module} />
          <D k="İşlem" v={actionLabel[item.action] || item.action} />
          <D k="Durum" v={item.success ? "Başarılı" : "Başarısız"} tone={item.success ? "emerald" : "red"} />
          <D k="Etkilenen Kayıt" v={item.entity_name || "—"} />
          <D k="Kayıt Türü" v={item.entity_type || "—"} />
          <D k="IP Adresi" v={item.ip_address || "—"} />
          <D k="Cihaz" v={item.device_name || "—"} />
          <D k="İstemci" v={(item.client_type || "—").slice(0, 60)} />
          <D k="Kayıt No" v={item.id} mono />
        </div>
        {item.description && (
          <div className="text-sm text-slate-700 border-l-4 border-blue-500 pl-3 mb-3">{item.description}</div>
        )}
        {keys.length > 0 && (
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">Alan</th>
                  <th className="text-left px-3 py-2 bg-red-50">Eski Değer</th>
                  <th className="text-left px-3 py-2 bg-emerald-50">Yeni Değer</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{k}</td>
                    <td className="px-3 py-1.5 bg-red-50/40 text-red-800 font-mono text-xs align-top break-all">{formatVal(oldV[k])}</td>
                    <td className="px-3 py-1.5 bg-emerald-50/40 text-emerald-800 font-mono text-xs align-top break-all">{formatVal(newV[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function D({ k, v, tone, mono }) {
  const toneCls = { emerald: "text-emerald-700", red: "text-red-700" }[tone] || "text-slate-900";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{k}</div>
      <div className={`text-sm font-medium ${toneCls} ${mono ? "font-mono text-xs break-all" : ""}`}>{v}</div>
    </div>
  );
}
