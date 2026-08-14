import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Eye, FileUp, Trash2, ListChecks, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toDateTime, moduleLabel, actionLabel } from "./shared";
import { AuditDetailDialog } from "./AuditDetailDialog";

// İçe Aktarma sayılan action türleri
const IMPORT_ACTIONS = new Set([
  "bulk_import", "bulk_import_excel", "historical_import",
  "bulk_excel_create", "bulk_create", "excel_days_override",
]);
// Silinen izin sayılan action türleri (module=leaves üzerinde)
const DELETE_LEAVE_ACTIONS = new Set(["delete", "bulk_delete"]);

function isImport(a) {
  if (IMPORT_ACTIONS.has(a?.action)) return true;
  if (a?.module === "imports") return true;
  if (a?.entity_type === "bulk_upload" || a?.entity_type === "import_history") return true;
  return false;
}
function isDeletedLeave(a) {
  return a?.module === "leaves" && DELETE_LEAVE_ACTIONS.has(a?.action);
}

function StatCard({ icon: Icon, label, value, cls = "text-slate-700" }) {
  return (
    <Card className="p-3 border border-slate-200">
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded grid place-items-center bg-slate-100 ${cls}`}><Icon size={16} /></div>
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function AuditTable({ items, onDetail, testIdPrefix = "user-history" }) {
  return (
    <table className="table-clean w-full text-xs">
      <thead>
        <tr><th>Tarih &amp; Saat</th><th>Modül</th><th>İşlem</th><th>Etkilenen</th><th>Durum</th><th>IP</th><th className="text-right"></th></tr>
      </thead>
      <tbody>
        {items.map((a) => (
          <tr key={a.id} data-testid={`${testIdPrefix}-row-${a.id}`}>
            <td className="font-mono">{toDateTime(a.created_at)}</td>
            <td>{moduleLabel[a.module] || a.module}</td>
            <td>{actionLabel[a.action] || a.action}</td>
            <td className="truncate max-w-[260px]">{a.entity_name || "—"}</td>
            <td>{a.success ? <CheckCircle2 size={14} className="text-emerald-600 inline" /> : <XCircle size={14} className="text-red-600 inline" />}</td>
            <td className="font-mono text-slate-500">{a.ip_address || "—"}</td>
            <td className="text-right">
              <Button variant="ghost" size="sm" onClick={() => onDetail(a)}><Eye size={13} /></Button>
            </td>
          </tr>
        ))}
        {items.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">Kayıt yok.</td></tr>}
      </tbody>
    </table>
  );
}

export function UserHistoryDialog({ user, onOpenChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = () => {
    if (!user) return;
    setLoading(true);
    api.get(`/users/${user.id}/audit-log`, { params: { limit: 1000 } })
      .then(({ data }) => setItems(data.items || []))
      .catch((e) => toast.error(formatApiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    let arr = items;
    if (from) arr = arr.filter((a) => (a.created_at || "") >= from);
    if (to) arr = arr.filter((a) => (a.created_at || "") <= `${to}T23:59:59`);
    return arr;
  }, [items, from, to]);

  const imports = useMemo(() => filtered.filter(isImport), [filtered]);
  const deletes = useMemo(() => filtered.filter(isDeletedLeave), [filtered]);
  const others = useMemo(() => filtered.filter((a) => !isImport(a) && !isDeletedLeave(a)), [filtered]);
  const lastItem = filtered[0];

  return (
    <>
      <Dialog open={!!user} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="user-history-dialog">
          <DialogHeader>
            <DialogTitle>{user?.name} — İşlem Geçmişi</DialogTitle>
            <DialogDescription>
              {user?.email} · {user?.role === "admin" ? "Yönetici" : user?.role}
              {" — "}Bu kullanıcının sistem üzerindeki tüm audit kayıtları. Yalnızca Yönetici görebilir.
            </DialogDescription>
          </DialogHeader>

          {/* Özet kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard icon={ClipboardList} label="Toplam İşlem" value={filtered.length.toLocaleString("tr-TR")} cls="text-slate-700" />
            <StatCard icon={FileUp} label="İçe Aktarma" value={imports.length.toLocaleString("tr-TR")} cls="text-blue-700" />
            <StatCard icon={Trash2} label="Silinen İzin" value={deletes.length.toLocaleString("tr-TR")} cls="text-red-700" />
            <StatCard icon={ListChecks} label="Son İşlem" value={lastItem ? toDateTime(lastItem.created_at) : "—"} cls="text-emerald-700" />
          </div>

          {/* Tarih filtresi */}
          <div className="flex items-center gap-2 mt-2">
            <Label className="text-xs text-slate-500">Başlangıç</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" data-testid="user-history-from" />
            <span className="text-slate-400">→</span>
            <Label className="text-xs text-slate-500">Bitiş</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" data-testid="user-history-to" />
            {(from || to) && (
              <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Temizle</Button>
            )}
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="ml-auto" data-testid="user-history-reload">
              <RefreshCw size={13} className="mr-1" /> Yenile
            </Button>
          </div>

          {/* Sekmeler */}
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden mt-1">
            <TabsList data-testid="user-history-tabs">
              <TabsTrigger value="all" data-testid="uh-tab-all">Tümü <Badge className="ml-2 bg-slate-100 text-slate-700 border">{filtered.length}</Badge></TabsTrigger>
              <TabsTrigger value="imports" data-testid="uh-tab-imports"><FileUp size={13} className="mr-1" /> İçe Aktarma <Badge className="ml-2 bg-blue-50 text-blue-700 border-blue-200 border">{imports.length}</Badge></TabsTrigger>
              <TabsTrigger value="deletes" data-testid="uh-tab-deletes"><Trash2 size={13} className="mr-1" /> Silinen İzinler <Badge className="ml-2 bg-red-50 text-red-700 border-red-200 border">{deletes.length}</Badge></TabsTrigger>
              <TabsTrigger value="others" data-testid="uh-tab-others">Diğer İşlemler <Badge className="ml-2 bg-slate-100 text-slate-700 border">{others.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="overflow-auto flex-1"><AuditTable items={filtered} onDetail={setDetail} testIdPrefix="uh-all" /></TabsContent>
            <TabsContent value="imports" className="overflow-auto flex-1"><AuditTable items={imports} onDetail={setDetail} testIdPrefix="uh-imports" /></TabsContent>
            <TabsContent value="deletes" className="overflow-auto flex-1"><AuditTable items={deletes} onDetail={setDetail} testIdPrefix="uh-deletes" /></TabsContent>
            <TabsContent value="others" className="overflow-auto flex-1"><AuditTable items={others} onDetail={setDetail} testIdPrefix="uh-others" /></TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <AuditDetailDialog item={detail} onOpenChange={(v) => !v && setDetail(null)} />
    </>
  );
}
