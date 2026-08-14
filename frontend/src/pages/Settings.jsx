import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, History, CalendarClock, ChevronRight, AlertTriangle, Trash2, ShieldAlert, Bell, Save } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import Users from "./Users";
import BulkUploadHistory from "./BulkUploadHistory";
import Holidays from "./Holidays";

const tiles = [
  { to: "/ayarlar/kullanicilar", icon: ShieldCheck, label: "Kullanıcılar", desc: "Sistem kullanıcıları, roller, işlem geçmişi (içe aktarma & silinen izinler dahil)", role: "admin" },
  { to: "/ayarlar/tatiller", icon: CalendarClock, label: "Tatiller", desc: "Resmî ve dinî tatiller — yıl bazlı", role: "hr" },
];

function WipeTile() {
  const [open, setOpen] = useState(false);
  const [delPersonnel, setDelPersonnel] = useState(false);
  const [delLeaves, setDelLeaves] = useState(false);
  const [pw, setPw] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setDelPersonnel(false); setDelLeaves(false); setPw(""); setReason(""); setConfirm(""); };

  const canSubmit = (delPersonnel || delLeaves) && pw && reason.trim() && confirm === "SİL";

  const doWipe = async () => {
    if (!canSubmit) return toast.error("En az bir seçim + şifre + gerekçe + 'SİL' onayı zorunlu");
    setBusy(true);
    try {
      // Personel işaretliyse (izinler zaten dahil) tek çağrı; değilse yalnız izinler.
      const endpoint = delPersonnel ? "/personnel/wipe-all" : "/leaves/wipe-all";
      const { data } = await api.post(endpoint, { password: pw, reason: reason.trim(), confirm });
      toast.success(delPersonnel
        ? `Silindi: ${data.personnel} personel · ${data.leaves} izin · ${data.entitlements} hak ediş`
        : `Silindi: ${data.leaves} izin · ${data.entitlements} hak ediş`);
      setOpen(false); reset();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div onClick={() => setOpen(true)} data-testid="wipe-tile" className="cursor-pointer">
        <Card className="p-5 border-2 border-red-300 bg-red-50/50 hover:border-red-500 hover:shadow-md transition-all group">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 grid place-items-center rounded-md bg-red-100 text-red-700 group-hover:bg-red-200 shrink-0"><ShieldAlert size={20} /></div>
            <div className="flex-1">
              <div className="text-base font-semibold text-red-900">Toplu Veri Silme</div>
              <div className="text-xs text-red-700 mt-1">Personel ve/veya izin kayıtlarını kalıcı sil — yönetici onayı</div>
            </div>
            <ChevronRight size={16} className="text-red-300 group-hover:text-red-600" />
          </div>
        </Card>
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md" data-testid="wipe-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><ShieldAlert size={18} /> Toplu Veri Silme</DialogTitle>
            <DialogDescription>Bu işlem GERİ ALINAMAZ. Audit kayıtları korunur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Silinecek Veri</Label>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-2 p-2 border border-red-200 rounded cursor-pointer hover:bg-red-50/60">
                  <input type="checkbox" className="mt-0.5" checked={delPersonnel} onChange={(e) => setDelPersonnel(e.target.checked)} data-testid="wipe-check-personnel" />
                  <div className="text-sm">
                    <div className="font-semibold text-red-900">Personel</div>
                    <div className="text-[11px] text-red-700">TÜM personel + izin + hak ediş kayıtları silinir. (Personel silindiğinde izinler de otomatik silinir.)</div>
                  </div>
                </label>
                <label className={`flex items-start gap-2 p-2 border rounded cursor-pointer ${delPersonnel ? "border-slate-200 bg-slate-50 opacity-60" : "border-red-200 hover:bg-red-50/60"}`}>
                  <input type="checkbox" className="mt-0.5" checked={delLeaves || delPersonnel} disabled={delPersonnel} onChange={(e) => setDelLeaves(e.target.checked)} data-testid="wipe-check-leaves" />
                  <div className="text-sm">
                    <div className="font-semibold text-red-900">İzin Kayıtları</div>
                    <div className="text-[11px] text-red-700">TÜM izin + hak ediş kayıtları silinir. Personel korunur.</div>
                  </div>
                </label>
              </div>
            </div>
            <div><Label>Yönetici Şifresi</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="wipe-pw" /></div>
            <div><Label>Silme Gerekçesi *</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="wipe-reason" /></div>
            <div><Label>Onay için <b className="text-red-700">SİL</b> yazın</Label><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SİL" data-testid="wipe-confirm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={doWipe} disabled={busy || !canSubmit} data-testid="wipe-confirm-btn">
              {busy ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationEmailCard() {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    api.get("/settings/notifications")
      .then(({ data }) => { setEmail(data.hr_alert_email || ""); setSaved(data.hr_alert_email || ""); })
      .catch(() => {});
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/settings/notifications", { hr_alert_email: email.trim() });
      setSaved(data.hr_alert_email || "");
      toast.success("Bildirim e-postası güncellendi");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };
  const sendTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/settings/notifications/test");
      toast.success(`Test e-postası gönderildi: ${data.sent_to}`);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setTesting(false); }
  };
  const dirty = email.trim() !== saved;
  return (
    <Card className="p-5 border border-slate-200 shadow-sm md:col-span-3" data-testid="notification-email-card">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 grid place-items-center rounded-md bg-emerald-50 text-emerald-700 shrink-0"><Bell size={20} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-slate-900">Bildirim E-postası (HR Uyarı Özeti)</div>
          <div className="text-xs text-slate-500 mt-1">Her sabah 08:00'de (İstanbul) Süt İzni ve Gebelik çalışamaz raporu yaklaşanların özeti bu adrese e-posta olarak gönderilir. Boş bırakılırsa e-posta gönderilmez.</div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@merkoteks.com"
              className="max-w-md"
              data-testid="notification-email-input"
            />
            <Button onClick={save} disabled={busy || !dirty} className="bg-blue-600 hover:bg-blue-700" data-testid="notification-email-save">
              <Save size={13} className="mr-1" /> {busy ? "Kaydediliyor..." : "Kaydet"}
            </Button>
            <Button onClick={sendTest} disabled={testing || !saved || dirty} variant="outline" data-testid="notification-email-test">
              {testing ? "Gönderiliyor..." : "Test E-postası Gönder"}
            </Button>
            {saved && <span className="text-xs text-slate-500 ml-2">Aktif: <b className="text-slate-800">{saved}</b></span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <div className="sticky-page-title">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ayarlar</h1>
        <p className="text-sm text-slate-500 mt-1">Sistem yönetimi ve yapılandırma sayfaları.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="settings-tiles">
        {tiles.filter((t) => t.role === "hr" || user?.role === "admin").map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} data-testid={`settings-tile-${t.label.toLowerCase()}`}>
              <Card className="p-5 border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 grid place-items-center rounded-md bg-blue-50 text-blue-700 group-hover:bg-blue-100 shrink-0"><Icon size={20} /></div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-slate-900">{t.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{t.desc}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600" />
                </div>
              </Card>
            </Link>
          );
        })}
        {user?.role === "admin" && <WipeTile />}
        {user?.role === "admin" && <NotificationEmailCard />}
      </div>
    </div>
  );
}

export function SettingsUsers() { return <Users />; }
export function SettingsBulkHistory() { return <BulkUploadHistory />; }
export function SettingsHolidays() { return <Holidays />; }
