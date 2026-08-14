import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Pencil, Trash2, CalendarPlus, Printer, FileSignature, FileText, AlertTriangle,
  LogOut, FileBarChart, ArrowLeft, FileSpreadsheet, Eye, EyeOff, Skull,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtNum(n) { return String(n).replace(".", ","); }
function intAge(a) {
  if (a === null || a === undefined || a === "") return "—";
  const n = Number(a);
  if (Number.isNaN(n)) return "—";
  return Math.floor(n);
}

function downloadUrl(url, filename) {
  const t = localStorage.getItem("token");
  return fetch(url, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} })
    .then(async (r) => {
      if (!r.ok) throw new Error("İndirilemedi");
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const name = filename || (m ? m[1] : "dosya");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
    });
}

function KV({ k, v, tr }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
      <div className="col-span-2 text-sm text-slate-800 whitespace-pre-wrap break-words">{tr ? toTr(v) : (v || "—")}</div>
    </div>
  );
}

function StatCell({ label, value, highlight }) {
  return (
    <div className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-blue-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export default function PersonnelDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "hr";
  const [data, setData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [openLeave, setOpenLeave] = useState(false);
  const [lf, setLf] = useState({ start_date: "", end_date: "", izin_turu: "Yıllık İzin", aciklama: "" });
  const [preview, setPreview] = useState(null);
  const [raporOpen, setRaporOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateData, setTerminateData] = useState({ isten_cikis: new Date().toISOString().slice(0,10), aciklama: "" });
  const [deleteStep, setDeleteStep] = useState(0); // 0=closed, 1=confirm, 2=password
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteData, setDeleteData] = useState({ password: "", reason: "", showPassword: false });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      const { data: bal } = await api.get(`/personnel/${id}/balance`);
      setData(bal);
      const { data: L } = await api.get("/leaves", { params: { personnel_id: id, include_consent: true } });
      setLeaves(L);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const delLeave = async (lid) => {
    if (!window.confirm("İzin kaydı silinsin mi?")) return;
    try { await api.delete(`/leaves/${lid}`); toast.success("İzin silindi"); await load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const openDelete = async () => {
    try {
      const { data } = await api.get(`/personnel/${id}/delete-preview`);
      setDeletePreview(data);
      setDeleteData({ password: "", reason: "", showPassword: false });
      setDeleteStep(1);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const doHardDelete = async () => {
    if (!deleteData.password) return toast.error("Yönetici şifresi zorunlu");
    if (!deleteData.reason.trim()) return toast.error("Silme gerekçesi zorunlu");
    setDeleteBusy(true);
    try {
      const { data } = await api.post(`/personnel/${id}/delete`, {
        password: deleteData.password,
        reason: deleteData.reason.trim(),
      });
      toast.success(`Personel kalıcı olarak silindi. (${data.leaves_removed || 0} izin, ${data.entitlements_removed || 0} hak ediş)`);
      setDeleteStep(0);
      nav("/personel");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setDeleteBusy(false); }
  };

  const doPreview = async () => {
    if (!lf.start_date || !lf.end_date) return;
    try {
      const { data } = await api.post("/leaves/preview", { ...lf, personnel_id: id });
      setPreview(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { doPreview(); /* eslint-disable-next-line */ }, [lf.start_date, lf.end_date]);

  const saveLeave = async () => {
    try {
      const { data } = await api.post("/leaves", { ...lf, personnel_id: id });
      if (data.notified?.length) toast.success(`İzin kaydedildi. ${data.notified.length} kişiye e-posta gönderildi.`);
      else toast.success("İzin kaydedildi");
      setOpenLeave(false);
      setLf({ start_date: "", end_date: "", izin_turu: "Yıllık İzin", aciklama: "" });
      setPreview(null);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!data) return <div className="text-slate-500 text-sm">Yükleniyor...</div>;
  const p = data.personnel; const bal = data.balance;
  const low = bal.entitled_total > 0 && bal.remaining < 10;
  // Iter 56: SADECE bugün eklenen (created_at BUGÜN) en son avans izin için uyarı.
  // Böylece eski avans izinler için sürekli uyarı çıkmaz — yalnız o gün girilen izne özel.
  const _todayIso = new Date().toISOString().slice(0, 10);
  const latestAdvanceLeave = [...leaves]
    .filter((L) => L.consent_required && String(L.created_at || "").slice(0, 10) === _todayIso)
    .sort((a, b) => {
      const ca = String(a.created_at || "");
      const cb = String(b.created_at || "");
      if (cb !== ca) return cb.localeCompare(ca);
      return String(b.start_date || "").localeCompare(String(a.start_date || ""));
    })[0] || null;

  const doTerminate = async () => {
    if (!terminateData.isten_cikis) return toast.error("İşten çıkış tarihi zorunlu");
    try {
      const suffix = `[İŞTEN AYRILIŞ ${toTr(terminateData.isten_cikis)}] ${terminateData.aciklama || ""}`.trim();
      const payload = { ...p, aktif: false, isten_cikis: terminateData.isten_cikis,
        aciklama: (p.aciklama ? p.aciklama + "\n" : "") + suffix };
      await api.put(`/personnel/${id}`, payload);
      toast.success("Personel işten ayrıldı olarak işaretlendi");
      setTerminateOpen(false);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  // ─────────────────────────────────────────────────────────────
  // Personel İzin Raporu — inline preview mode
  // ─────────────────────────────────────────────────────────────
  if (raporOpen) {
    const totalUsed = leaves.reduce((s, L) => s + Number(L.days || 0), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRaporOpen(false)} data-testid="rapor-back-btn">
            <ArrowLeft size={14} className="mr-1" /> Personel Kartına Dön
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} variant="outline" data-testid="rapor-print-btn">
              <Printer size={14} className="mr-1" /> Yazdır
            </Button>
            <Button onClick={() => downloadUrl(`${API_BASE}/personnel/${p.id}/cetveli.pdf`)} variant="outline" data-testid="rapor-pdf-btn">
              <FileText size={14} className="mr-1 text-red-600" /> PDF İndir
            </Button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-8 max-w-[900px] mx-auto print-page">
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
            <div className="text-xs uppercase tracking-wider text-slate-500">MERKOTEKS TEKSTİL SAN. VE TİC. A.Ş.</div>
            <h2 className="text-xl font-bold mt-1">PERSONEL İZİN RAPORU</h2>
            <div className="text-xs text-slate-500 mt-1">Rapor Tarihi: {toTr(new Date().toISOString())}</div>
          </div>

          <table className="w-full text-sm mb-6 border border-slate-500">
            <tbody>
              <tr>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Adı Soyadı</td>
                <td className="px-3 py-1.5 border border-slate-400">{p.ad_soyad}</td>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Sicil No</td>
                <td className="px-3 py-1.5 border border-slate-400">{p.sicil_no}</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Birim / Departman</td>
                <td className="px-3 py-1.5 border border-slate-400">{p.departman || "—"}</td>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">İşbaşı Tarihi</td>
                <td className="px-3 py-1.5 border border-slate-400">{toTr(p.ise_giris)}</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Doğum Tarihi</td>
                <td className="px-3 py-1.5 border border-slate-400">{toTr(p.dogum_tarihi)}</td>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Görevi</td>
                <td className="px-3 py-1.5 border border-slate-400">{p.gorev || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-sm mb-6 border-2 border-slate-800">
            <tbody>
              <tr className="bg-slate-100">
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Toplam İzin Hak Edişi</td>
                <td className="px-3 py-1.5 border border-slate-400 font-semibold">{fmtNum(bal.entitled_total)} gün</td>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Toplam Kullanılan İzin</td>
                <td className="px-3 py-1.5 border border-slate-400 font-semibold">{fmtNum(bal.used_total)} gün</td>
                <td className="px-3 py-1.5 border border-slate-400 bg-slate-100 font-semibold text-slate-700 text-xs uppercase">Kalan İzin</td>
                <td className={`px-3 py-1.5 border border-slate-400 font-semibold ${bal.remaining < 10 ? "text-red-600" : ""}`}>{fmtNum(bal.remaining)} gün</td>
              </tr>
            </tbody>
          </table>

          <h4 className="text-sm font-bold mb-2">İzin Kayıtları ({leaves.length} kayıt · Toplam {fmtNum(totalUsed)} gün)</h4>
          <table className="w-full text-xs border border-slate-800 border-collapse mb-4">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-slate-800 px-2 py-1.5 text-left">Adı Soyadı</th>
                <th className="border border-slate-800 px-2 py-1.5 text-left">Birim</th>
                <th className="border border-slate-800 px-2 py-1.5">İzin Başlama Tarihi</th>
                <th className="border border-slate-800 px-2 py-1.5">İzin Bitiş Tarihi</th>
                <th className="border border-slate-800 px-2 py-1.5">İzin Türü</th>
                <th className="border border-slate-800 px-2 py-1.5">İzin Günü</th>
              </tr>
            </thead>
            <tbody>
              {leaves.slice().reverse().map((L) => (
                <tr key={L.id} className="odd:bg-slate-50">
                  <td className="border border-slate-400 px-2 py-1">{p.ad_soyad}</td>
                  <td className="border border-slate-400 px-2 py-1">{p.departman || "—"}</td>
                  <td className="border border-slate-400 px-2 py-1 text-center font-mono">{toTr(L.start_date)}</td>
                  <td className="border border-slate-400 px-2 py-1 text-center font-mono">{toTr(L.end_date)}</td>
                  <td className="border border-slate-400 px-2 py-1">{L.izin_turu}</td>
                  <td className="border border-slate-400 px-2 py-1 text-center font-semibold">{fmtNum(L.days)}</td>
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan={6} className="border border-slate-400 px-2 py-4 text-center text-slate-500">İzin kaydı bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Personel #{p.sicil_no}</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">{p.ad_soyad}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span>{p.gorev || "Görev belirtilmemiş"}</span>
            <span>·</span><span>{p.departman || "—"}</span>
            <span>·</span>
            {p.aktif ? <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Aktif</Badge>
                     : <Badge variant="secondary">İşten Ayrıldı{p.isten_cikis ? ` · ${toTr(p.isten_cikis)}` : ""}</Badge>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button asChild variant="outline" data-testid="edit-personnel-btn">
                <Link to={`/personel/${id}/duzenle`}><Pencil size={14} className="mr-1" /> Düzenle</Link>
              </Button>
              <Button variant="outline" onClick={() => setRaporOpen(true)} data-testid="rapor-btn" title="Personel İzin Raporu — Önizleme">
                <FileBarChart size={14} className="mr-1" /> Personel İzin Raporu
              </Button>
              <Button asChild variant="outline" data-testid="cetveli-btn" title="Yıllık İzin Cetveli — Ön İzleme">
                <Link to={`/personel/${id}/cetveli`}><FileText size={14} className="mr-1" /> İzin Cetveli</Link>
              </Button>
              <Dialog open={openLeave} onOpenChange={setOpenLeave}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700" data-testid="add-leave-btn">
                    <CalendarPlus size={14} className="mr-1" /> İzin Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yeni Yıllık İzin</DialogTitle>
                    <DialogDescription>Başlangıç ve bitiş tarihini seçin. Sistem hafta sonu ve tatilleri düşerek gün sayısını hesaplar.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Başlangıç</Label>
                        <Input type="date" value={lf.start_date}
                          onChange={(e) => setLf((s) => ({ ...s, start_date: e.target.value }))}
                          data-testid="leave-start" />
                      </div>
                      <div>
                        <Label>Bitiş</Label>
                        <Input type="date" value={lf.end_date}
                          onChange={(e) => setLf((s) => ({ ...s, end_date: e.target.value }))}
                          data-testid="leave-end" />
                      </div>
                    </div>
                    {preview && (
                      <div className="rounded-lg border-2 border-blue-200 bg-blue-50/70 p-3 grid grid-cols-2 gap-3" data-testid="leave-preview-summary">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold">Toplam Kullanılacak İzin</div>
                          <div className="mt-0.5 text-2xl font-bold text-blue-700 tabular-nums" data-testid="preview-total-days">
                            {fmtNum(preview.days)} <span className="text-base font-semibold text-blue-600">gün</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold">İşbaşı Günü</div>
                          <div className="mt-0.5 text-2xl font-bold text-emerald-700 tabular-nums" data-testid="preview-return-date">
                            {preview.return_date ? toTr(preview.return_date) : "—"}
                            {preview.return_weekday && (
                              <span className="ml-2 text-base font-semibold text-emerald-600">{preview.return_weekday}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <Label>İzin Türü</Label>
                      <Input value={lf.izin_turu} onChange={(e) => setLf((s) => ({ ...s, izin_turu: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Açıklama</Label>
                      <Textarea rows={2} value={lf.aciklama} onChange={(e) => setLf((s) => ({ ...s, aciklama: e.target.value }))} />
                    </div>
                    {preview && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-1">Günlük Hesap Detayı</div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 text-xs">
                          {preview.breakdown.map((b) => (
                            <div key={b.date} className="flex justify-between gap-2">
                              <span className="text-slate-600 font-mono">{toTr(b.date)}</span>
                              <span className="text-slate-500">{b.reason}</span>
                              <span className="font-mono text-slate-800 w-10 text-right">{fmtNum(b.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={saveLeave} disabled={!preview || preview.days <= 0}
                            className="bg-blue-600 hover:bg-blue-700" data-testid="save-leave-btn">
                      Kaydet
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {user?.role === "admin" && p.aktif && (
            <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" data-testid="terminate-btn">
                  <LogOut size={14} className="mr-1" /> İşten Ayrılış Yap
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Personeli İşten Ayrılış Olarak İşaretle</DialogTitle>
                  <DialogDescription>Personel silinmez; yalnızca pasif duruma alınır. İzin geçmişi ve denetim kayıtları korunur.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    <b>{p.ad_soyad}</b> personelini işten ayrıldı olarak işaretleyeceksiniz. İzin kayıtları ve geçmiş korunur; personel silinmez, yalnızca <b>pasif</b> duruma alınır ve <b>Aktif Personel</b> listelerinden düşer.
                  </div>
                  <div>
                    <Label>İşten Çıkış Tarihi</Label>
                    <Input type="date" value={terminateData.isten_cikis}
                      onChange={(e) => setTerminateData((s) => ({ ...s, isten_cikis: e.target.value }))}
                      data-testid="terminate-date" />
                  </div>
                  <div>
                    <Label>Ayrılış Nedeni / Açıklama</Label>
                    <Textarea rows={3} value={terminateData.aciklama}
                      onChange={(e) => setTerminateData((s) => ({ ...s, aciklama: e.target.value }))}
                      placeholder="Örn. İstifa, ihbar süresi tamamlandı..."
                      data-testid="terminate-reason" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTerminateOpen(false)}>Vazgeç</Button>
                  <Button onClick={doTerminate} className="bg-amber-600 hover:bg-amber-700" data-testid="terminate-confirm-btn">
                    İşten Ayrılış Yap
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {user?.role === "admin" && (
            <>
              <Button variant="outline" className="text-red-700 border-red-300 hover:bg-red-50"
                      onClick={openDelete} data-testid="hard-delete-btn">
                <Skull size={14} className="mr-1" /> Personeli Sil
              </Button>
              {/* Aşama 1: Bilgi + Devam Et */}
              <Dialog open={deleteStep === 1} onOpenChange={(v) => !v && setDeleteStep(0)}>
                <DialogContent className="max-w-lg" data-testid="hard-delete-step1">
                  <DialogHeader>
                    <DialogTitle className="text-red-700">Personeli Kalıcı Olarak Sil</DialogTitle>
                    <DialogDescription>
                      Bu personel <b>kalıcı olarak</b> silinecek. İzinler, hak edişler ve ilişkili kayıtlar da silinebilir. Denetim kayıtları (audit log) korunur.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm space-y-1">
                    <div><b>Ad Soyad:</b> {deletePreview?.personnel?.ad_soyad}</div>
                    <div><b>Sicil No:</b> {deletePreview?.personnel?.sicil_no}</div>
                    <div><b>Departman:</b> {deletePreview?.personnel?.departman || "—"}</div>
                    <div><b>İşe Giriş:</b> {toTr(deletePreview?.personnel?.ise_giris)}</div>
                    <div><b>Toplam İzin Kaydı:</b> {deletePreview?.leaves_count ?? 0}</div>
                    <div><b>Toplam Hak Ediş:</b> {deletePreview?.entitlements_count ?? 0}</div>
                  </div>
                  <div className="text-sm text-red-800 border-l-4 border-red-500 pl-3">
                    Bu işlem geri alınamaz. Normal işten ayrılışlarda <b>İşten Ayrılış Yap</b> kullanın; kalıcı silme yalnızca hatalı, mükerrer veya test kayıtları içindir.
                  </div>
                  {((deletePreview?.leaves_count || 0) > 0 || (deletePreview?.entitlements_count || 0) > 0) && (
                    <div className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded p-3">
                      <AlertTriangle size={14} className="inline mr-1" />
                      Personelin gerçek izin/hak ediş geçmişi var. Silmek yerine <b>İşten Ayrılış Yap</b> tercih edilmelidir.
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteStep(0)}>Vazgeç</Button>
                    <Button className="bg-red-600 hover:bg-red-700"
                            onClick={() => setDeleteStep(2)} data-testid="hard-delete-continue-btn">
                      Devam Et
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Aşama 2: Şifre + Gerekçe */}
              <Dialog open={deleteStep === 2} onOpenChange={(v) => !v && setDeleteStep(0)}>
                <DialogContent className="max-w-lg" data-testid="hard-delete-step2">
                  <DialogHeader>
                    <DialogTitle className="text-red-700">Yönetici Şifresi Doğrulama</DialogTitle>
                    <DialogDescription>
                      Aktif yönetici oturumunuza ait şifreyi girin ve silme gerekçesi belirtin. Bu bilgiler denetim kaydında saklanacaktır.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="text-sm text-slate-600">Yönetici: <b>{user?.name}</b> <span className="text-slate-400">({user?.email})</span></div>
                    <div>
                      <Label>Yönetici Şifresi</Label>
                      <div className="flex gap-2">
                        <Input type={deleteData.showPassword ? "text" : "password"}
                          value={deleteData.password}
                          onChange={(e) => setDeleteData((s) => ({ ...s, password: e.target.value }))}
                          data-testid="hard-delete-password" autoComplete="current-password" />
                        <Button type="button" variant="outline" size="icon"
                          onClick={() => setDeleteData((s) => ({ ...s, showPassword: !s.showPassword }))}
                          title={deleteData.showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}>
                          {deleteData.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Silme Gerekçesi *</Label>
                      <Textarea rows={3} value={deleteData.reason}
                        onChange={(e) => setDeleteData((s) => ({ ...s, reason: e.target.value }))}
                        placeholder="Örn. Test kaydı, mükerrer kayıt, yanlış giriş..."
                        data-testid="hard-delete-reason" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteStep(0)}>İptal</Button>
                    <Button className="bg-red-600 hover:bg-red-700"
                            onClick={doHardDelete} disabled={deleteBusy}
                            data-testid="hard-delete-final-btn">
                      {deleteBusy ? "Siliniyor..." : "Personeli Kalıcı Olarak Sil"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {latestAdvanceLeave && (
        <Card className="p-4 border-2 border-amber-400 bg-amber-50 shadow-sm" data-testid="consent-warning">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AlertTriangle size={24} className="text-amber-700 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-amber-900 uppercase tracking-wide text-base">
                  Muvafakatname Doldurulması Gereklidir — {fmtNum(latestAdvanceLeave.consent_advance_days ?? latestAdvanceLeave.days)} Gün
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Son eklenen izin ({toTr(latestAdvanceLeave.start_date)} → {toTr(latestAdvanceLeave.end_date)}, {fmtNum(latestAdvanceLeave.days)} gün) hak ediş bakiyesini aşıyor. Ücret kesintisi taahhüdü için muvafakatname imzalatın.
                </p>
              </div>
            </div>
            <Button
              asChild
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              data-testid={`consent-preview-${latestAdvanceLeave.id}`}
              title={`Muvafakatname yazdır: ${toTr(latestAdvanceLeave.start_date)} → ${toTr(latestAdvanceLeave.end_date)}`}
            >
              <Link to={`/izin/${latestAdvanceLeave.id}/muvafakatname`} target="_blank" className="inline-flex items-center gap-1.5">
                <Printer size={14} />
                Muvafakatname Yazdır
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {p.cetvel_needs_refill && (
        <Card className="p-4 border-2 border-orange-400 bg-orange-50 shadow-sm" data-testid="cetvel-refill-warning">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AlertTriangle size={24} className="text-orange-700 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-orange-900 uppercase tracking-wide text-base">
                  İzin Cetveli Yeniden Doldurulmalıdır
                </h3>
                <p className="text-xs text-orange-800 mt-0.5">
                  Bu personel için daha önce onaylanan İzin Cetveli sonrasında yeni izin girişi yapılmıştır.
                  Güncel bakiyeyle İzin Cetvelini tekrar üretip onaylayın.
                </p>
              </div>
            </div>
            <Button
              asChild
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              data-testid="cetvel-refill-btn"
              title="İzin Cetveli — Yeniden Doldur"
            >
              <Link to={`/personel/${id}/cetveli`} className="inline-flex items-center gap-1.5">
                <FileText size={14} />
                İzin Cetvelini Yenile
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-base font-semibold">Kıdem ve Hak Ediş Özeti</h3>
          <div className="text-xs text-slate-500">4857 sayılı İş Kanunu</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-100">
          <StatCell label="Son İşe Giriş" value={toTr(bal.hire_date || p.ise_giris)} />
          <StatCell label="Doğum Tarihi" value={toTr(p.dogum_tarihi)} />
          <StatCell label="Önceki Kıdem" value={`${bal.prev_years || 0} yıl`} />
          <StatCell label="Yeni Dönemde Tamamlanan" value={`${bal.new_period_years || 0} yıl`} />
          <StatCell label="Toplam İzin Kıdemi" value={`${bal.total_seniority || 0} yıl`} highlight />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-100 border-t border-slate-100">
          <StatCell label="Son Hak Ediş Tarihi" value={toTr(bal.last_entitlement_date)} />
          <StatCell label="Yaş" value={(() => {
            if (!p.dogum_tarihi) return "—";
            const d = new Date(p.dogum_tarihi);
            if (isNaN(d.getTime())) return "—";
            const now = new Date();
            let age = now.getFullYear() - d.getFullYear();
            const m = now.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
            return `${age}`;
          })()} />
          <StatCell label="Sonraki Hak Ediş" value={toTr(bal.next_entitlement?.date)} />
          <StatCell label="Sonraki İzin Günü" value={bal.next_entitlement ? `${bal.next_entitlement.days} gün` : "—"} />
          <StatCell label="Toplam Hak Edilen" value={`${bal.entitled_total} gün`} highlight />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Hak Edilen</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{bal.entitled_total}</div>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Kullanılan</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{bal.used_total}</div>
        </Card>
        <Card className={`p-5 border shadow-sm ${low ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Kalan İzin</div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums ${low ? "text-red-600" : "text-slate-900"}`}>
            {bal.remaining}
          </div>
          {low && <div className="mt-1 text-xs text-red-600 font-medium">10 günün altında — dikkat</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200"><h3 className="text-base font-semibold">Personel Bilgileri</h3></div>
          <div className="px-5 py-3">
            <KV k="Sicil No" v={p.sicil_no} />
            <KV k="T.C. Kimlik" v={p.tc_no} />
            <KV k="Departman" v={p.departman} />
            <KV k="Görev" v={p.gorev} />
            <KV k="Şirket" v={p.sirket} />
            <KV k="İşe Giriş" v={p.ise_giris} tr />
            <KV k="İşten Çıkış" v={p.isten_cikis} tr />
            <KV k="Doğum Tarihi" v={p.dogum_tarihi} tr />
            <KV k="Önceki Kıdem" v={`${p.onceki_kidem_yil || 0} yıl`} />
            <KV k="Telefon" v={p.telefon} />
            <KV k="E-posta" v={p.email} />
            <KV k="Açıklama" v={p.aciklama} />
          </div>
        </Card>

        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-base font-semibold">Hak Ediş Kayıtları</h3>
            <p className="text-xs text-slate-500">Her hak ediş immutable — sonradan bozulmaz.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr><th>Tarih</th><th>Önc. Kıdem</th><th>Yeni Dönem</th><th>Toplam</th><th>Yaş</th><th className="text-right">Gün</th></tr>
              </thead>
              <tbody>
                {bal.entitlements?.map((e) => (
                  <tr key={e.date} title={e.explanation}>
                    <td className="font-mono text-xs">{toTr(e.date)}</td>
                    <td className="tabular-nums">{e.prev_years}</td>
                    <td className="tabular-nums">{e.new_period_years}</td>
                    <td className="tabular-nums font-semibold">{e.total_seniority}</td>
                    <td className="tabular-nums">{intAge(e.age_at)}</td>
                    <td className="text-right tabular-nums font-semibold">{e.days}</td>
                  </tr>
                ))}
                {(!bal.entitlements || bal.entitlements.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-6">İlk hak ediş henüz oluşmadı. Bir sonraki: {toTr(bal.next_entitlement?.date)}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-5 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">İzin Kullanımları</h4>
            <div className="overflow-x-auto">
              <table className="table-clean w-full">
                <thead><tr><th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Tür</th><th>Açıklama</th><th></th></tr></thead>
                <tbody>
                  {leaves.map((L) => (
                    <tr key={L.id} data-testid={`leave-row-${L.id}`}>
                      <td className="font-mono text-xs">{toTr(L.start_date)}</td>
                      <td className="font-mono text-xs">{toTr(L.end_date)}</td>
                      <td className="tabular-nums font-medium">{L.days}</td>
                      <td>{L.izin_turu}</td>
                      <td className="max-w-[220px] truncate">{L.aciklama || "—"}</td>
                      <td className="text-right whitespace-nowrap">
                        <Button asChild variant="ghost" size="sm" data-testid={`print-leave-${L.id}`} title="İzin Talep Formu — önizleme">
                          <Link to={`/izin/${L.id}/yazdir`} target="_blank"><Printer size={14} /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" title="Muvafakatname">
                          <Link to={`/izin/${L.id}/muvafakatname`} target="_blank" className="text-amber-700"><FileSignature size={14} /></Link>
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => delLeave(L.id)} className="text-red-600" data-testid={`del-leave-${L.id}`}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-slate-400">İzin kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
