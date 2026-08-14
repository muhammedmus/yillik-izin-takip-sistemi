import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, HeartPulse, FileText, Baby, Milk, Coffee, LogIn, Paperclip, CheckCircle2, Circle, Loader2, Upload, Trash2, Download, History } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrDatePicker } from "@/components/TrDatePicker";
import { toTr } from "@/pages/users/shared";

const ACCEPTED_EXT = ".pdf,.jpg,.jpeg,.png";
const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_MB = 10;

function AttachmentSlot({ sid, sectionLabel }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!sid) return;
    try {
      const { data } = await api.get(`/special-leaves/${sid}/attachments`);
      setItems(data.items || []);
    } catch (e) { /* noop */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sid]);
  const upload = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length || !sid) return;
    for (const f of arr) {
      if (!ACCEPTED_MIME.includes((f.type || "").toLowerCase())) { toast.error(`Kabul edilmeyen tür: ${f.name}`); return; }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`Çok büyük: ${f.name}`); return; }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f, f.name));
      await api.post(`/special-leaves/${sid}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${sectionLabel}: ${arr.length} belge yüklendi`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };
  const del = async (aid) => {
    if (!window.confirm("Belgeyi sil?")) return;
    try { await api.delete(`/special-leaves/${sid}/attachments/${aid}`); await load(); } catch (e) { toast.error(formatApiError(e)); }
  };
  const dl = async (a) => {
    const t = localStorage.getItem("token");
    const r = await fetch(`${API_BASE}/special-leaves/${sid}/attachments/${a.id}/download`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    const link = document.createElement("a"); link.href = u; link.download = a.original_filename; link.click();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  };
  if (!sid) return <div className="mt-3 text-xs text-slate-400 italic">Belge yüklemek için önce süreci kaydedin.</div>;
  return (
    <div className="mt-3 rounded border border-dashed border-slate-300 bg-slate-50/50 p-2 space-y-2" data-testid={`process-attach-${sectionLabel}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2 py-1 rounded cursor-pointer">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {busy ? "Yükleniyor..." : `${sectionLabel} Belgesi Ekle`}
          <input type="file" multiple accept={ACCEPTED_EXT} className="hidden" disabled={busy}
                 onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="text-[11px] text-slate-500">{items.length} belge</span>
      </div>
      {items.length > 0 && (
        <div className="space-y-1 text-[11px]">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-slate-200">
              <FileText size={10} className="text-slate-500 shrink-0" />
              <span className="flex-1 truncate">{a.original_filename}</span>
              <button onClick={() => dl(a)} className="text-blue-600" title="İndir"><Download size={10} /></button>
              <button onClick={() => del(a.id)} className="text-red-500" title="Sil"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const daysBetween = (a, b) => {
  if (!a || !b) return null;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / (1000 * 60 * 60 * 24)) + 1;
};
const daysUntil = (a) => {
  if (!a) return null;
  const [y, m, d] = a.split("-").map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(y, m - 1, d) - t) / (1000 * 60 * 60 * 24));
};
const plusYear = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

function Section({ done, num, icon, title, children, hint }) {
  const [open, setOpen] = useState(!done);
  return (
    <Card className={`border-2 ${done ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"}`} data-testid={`process-section-${num}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className={`w-9 h-9 rounded-full grid place-items-center ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </div>
        <div className="flex-1">
          <div className="text-sm text-slate-500">Adım {num}</div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">{icon} {title}</div>
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
        <div className="text-xs text-slate-400">{open ? "Kapat" : "Aç"}</div>
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
    </Card>
  );
}

export default function SpecialLeaveProcess() {
  const { pid } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState({ personnel: null, records: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/special-leaves/personnel/${pid}/process`);
      setData(d);
      // En son gebelik/doğum kaydını form'a yükle
      const gd = (d.records || []).find((r) => r.tur === "gebelik" || r.tur === "dogum");
      const m = gd || {};
      setForm({
        _record_id: m.id || null,
        _record_type: m.tur || "gebelik",
        gebelik_teblig_tarihi: m.gebelik_teblig_tarihi || m.start_date || "",
        calisamaz_rapor_tarihi: m.calisamaz_rapor_tarihi || "",
        calisamaz_rapor_bitis: m.calisamaz_rapor_bitis || "",
        cocuk_dogum_tarihi: m.cocuk_dogum_tarihi || m.dogum_tarihi_kayit || "",
        ucretsiz_izin_baslangic: m.ucretsiz_izin_baslangic || "",
        ucretsiz_izin_bitis: m.ucretsiz_izin_bitis || "",
        dogum_sonrasi_isbasi: m.dogum_sonrasi_isbasi || "",
        aciklama: m.aciklama || "",
      });
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (pid) load(); /* eslint-disable-next-line */ }, [pid]);

  const p = data.personnel;
  const raporGun = useMemo(() => daysBetween(form.calisamaz_rapor_tarihi, form.calisamaz_rapor_bitis), [form.calisamaz_rapor_tarihi, form.calisamaz_rapor_bitis]);
  const ucretsizGun = useMemo(() => daysBetween(form.ucretsiz_izin_baslangic, form.ucretsiz_izin_bitis), [form.ucretsiz_izin_baslangic, form.ucretsiz_izin_bitis]);
  const sutBitis = useMemo(() => plusYear(form.cocuk_dogum_tarihi), [form.cocuk_dogum_tarihi]);
  const kalanSut = useMemo(() => daysUntil(sutBitis), [sutBitis]);

  // Durum
  const status = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (form.cocuk_dogum_tarihi && form.dogum_sonrasi_isbasi && form.dogum_sonrasi_isbasi <= today && sutBitis && today <= sutBitis) return "MILK_LEAVE";
    if ((form.calisamaz_rapor_tarihi || form.cocuk_dogum_tarihi) && (!form.dogum_sonrasi_isbasi || form.dogum_sonrasi_isbasi > today)) return "MATERNITY";
    if (form.gebelik_teblig_tarihi && !form.calisamaz_rapor_tarihi && !form.cocuk_dogum_tarihi) return "PREGNANT";
    return "COMPLETED";
  }, [form, sutBitis]);
  const statusLabel = { PREGNANT: "Gebe Çalışan", MATERNITY: "Doğum İzninde", MILK_LEAVE: "Süt İzni Kullanan", COMPLETED: "Tamamlandı" }[status];
  const statusColor = { PREGNANT: "bg-pink-100 text-pink-800 border-pink-300", MATERNITY: "bg-purple-100 text-purple-800 border-purple-300", MILK_LEAVE: "bg-sky-100 text-sky-800 border-sky-300", COMPLETED: "bg-slate-100 text-slate-600 border-slate-300" }[status];

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        personnel_id: pid,
        tur: form._record_type || "gebelik",
        gebelik_teblig_tarihi: form.gebelik_teblig_tarihi,
        calisamaz_rapor_tarihi: form.calisamaz_rapor_tarihi,
        calisamaz_rapor_bitis: form.calisamaz_rapor_bitis,
        cocuk_dogum_tarihi: form.cocuk_dogum_tarihi,
        ucretsiz_izin_baslangic: form.ucretsiz_izin_baslangic,
        ucretsiz_izin_bitis: form.ucretsiz_izin_bitis,
        dogum_sonrasi_isbasi: form.dogum_sonrasi_isbasi,
        sut_izni_bitis: sutBitis,
        aciklama: form.aciklama,
        start_date: form.gebelik_teblig_tarihi || form.calisamaz_rapor_tarihi,
        end_date: form.dogum_sonrasi_isbasi || form.calisamaz_rapor_bitis || form.ucretsiz_izin_bitis || sutBitis,
      };
      if (form._record_id) {
        await api.put(`/special-leaves/${form._record_id}`, payload);
      } else {
        const { data: r } = await api.post("/special-leaves", payload);
        setForm((f) => ({ ...f, _record_id: r.id }));
      }
      toast.success("Süreç kaydedildi");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center text-slate-400"><Loader2 size={16} className="animate-spin inline mr-1" /> Yükleniyor...</div>;
  if (!p) return <div className="p-8 text-center text-red-500">Personel bulunamadı</div>;

  const timeline = [
    { d: form.gebelik_teblig_tarihi, label: "Gebelik bildirildi", color: "bg-pink-500" },
    { d: form.calisamaz_rapor_tarihi, label: "Çalışamaz raporu başladı", color: "bg-fuchsia-500" },
    { d: form.calisamaz_rapor_bitis, label: "Çalışamaz raporu bitti", color: "bg-fuchsia-700" },
    { d: form.cocuk_dogum_tarihi, label: "Çocuk doğdu", color: "bg-rose-600" },
    { d: form.ucretsiz_izin_baslangic, label: "İlave ücretsiz izin başladı", color: "bg-amber-500" },
    { d: form.ucretsiz_izin_bitis, label: "İlave ücretsiz izin bitti", color: "bg-amber-700" },
    { d: form.dogum_sonrasi_isbasi, label: "İşbaşı yapıldı / süt izni başladı", color: "bg-purple-500" },
    { d: sutBitis, label: "Süt izni tamamlanacak", color: "bg-sky-500" },
  ].filter((t) => t.d).sort((a, b) => a.d.localeCompare(b.d));

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/ozel-izinler")} data-testid="process-back"><ArrowLeft size={14} className="mr-1" /> Özel İzinler</Button>
      </div>
      <Card className="p-5 border border-slate-200">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-pink-100 grid place-items-center text-pink-700"><HeartPulse size={26} /></div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold text-slate-900">{p.ad_soyad}</div>
            <div className="text-sm text-slate-500">Sicil: <b className="font-mono text-slate-800">{p.sicil_no}</b> · Departman: <b>{p.departman || "—"}</b></div>
          </div>
          <div className={`inline-flex items-center gap-2 border-2 px-4 py-2 rounded-full font-semibold ${statusColor}`} data-testid="process-status">
            {statusLabel}
          </div>
        </div>
      </Card>

      <Section done={!!form.gebelik_teblig_tarihi} num={1} icon={<HeartPulse size={16} className="text-pink-600" />} title="Gebelik Tebliği"
        hint="Personelin gebeliğini HR'a bildirdiği tarih">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div><Label className="text-xs">Gebelik Tebliğ Tarihi</Label>
            <TrDatePicker value={form.gebelik_teblig_tarihi} onChange={(v) => setForm({ ...form, gebelik_teblig_tarihi: v })} testId="process-teblig" />
          </div>
        </div>
        <AttachmentSlot sid={form._record_id} sectionLabel="Gebelik Tebliği" />
      </Section>

      <Section done={!!form.calisamaz_rapor_tarihi} num={2} icon={<FileText size={16} className="text-fuchsia-600" />} title="Çalışamaz Raporu"
        hint="Doğum öncesi çalışamaz raporu (genelde doğumdan 8 hafta önce)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div><Label className="text-xs">Rapor Başlangıç</Label>
            <TrDatePicker value={form.calisamaz_rapor_tarihi} onChange={(v) => setForm({ ...form, calisamaz_rapor_tarihi: v })} testId="process-rapor-start" />
          </div>
          <div><Label className="text-xs">Rapor Bitiş</Label>
            <TrDatePicker value={form.calisamaz_rapor_bitis} onChange={(v) => setForm({ ...form, calisamaz_rapor_bitis: v })} testId="process-rapor-end" />
          </div>
          <div><Label className="text-xs">Rapor Gün Sayısı (otomatik)</Label>
            <div className="h-10 flex items-center px-3 bg-slate-100 rounded font-bold text-lg tabular-nums">{raporGun ?? "—"}</div>
          </div>
        </div>
        <AttachmentSlot sid={form._record_id} sectionLabel="Çalışamaz Raporu" />
      </Section>

      <Section done={!!form.cocuk_dogum_tarihi} num={3} icon={<Baby size={16} className="text-rose-600" />} title="Çocuk Doğum Bilgisi"
        hint="Çocuğun fiili doğum tarihi girilir. Süt izni bitişi otomatik = +1 yıl.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div><Label className="text-xs">Çocuk Doğum Tarihi</Label>
            <TrDatePicker value={form.cocuk_dogum_tarihi} onChange={(v) => setForm({ ...form, cocuk_dogum_tarihi: v })} testId="process-cocuk-dob" />
          </div>
          {sutBitis && <div className="bg-sky-50 border border-sky-200 rounded p-3 text-xs text-sky-900">
            <b>Süt İzni Bitişi (otomatik):</b> {toTr(sutBitis)}<br />
            {kalanSut !== null && (kalanSut > 0 ? `1 yaşına kadar ${kalanSut} gün var` : `1 yaşını doldurdu (${Math.abs(kalanSut)} gün önce)`)}
          </div>}
        </div>
        <AttachmentSlot sid={form._record_id} sectionLabel="Doğum Belgesi" />
      </Section>

      <Section done={!!form.ucretsiz_izin_baslangic} num={4} icon={<Coffee size={16} className="text-amber-600" />} title="İlave Ücretsiz İzin"
        hint="Doğum sonrası talep edilirse (yıllık izne dokunmaz)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div><Label className="text-xs">Başlangıç</Label>
            <TrDatePicker value={form.ucretsiz_izin_baslangic} onChange={(v) => setForm({ ...form, ucretsiz_izin_baslangic: v })} testId="process-ui-start" />
          </div>
          <div><Label className="text-xs">Bitiş</Label>
            <TrDatePicker value={form.ucretsiz_izin_bitis} onChange={(v) => setForm({ ...form, ucretsiz_izin_bitis: v })} testId="process-ui-end" />
          </div>
          <div><Label className="text-xs">Ücretsiz İzin Gün (otomatik)</Label>
            <div className="h-10 flex items-center px-3 bg-slate-100 rounded font-bold text-lg tabular-nums">{ucretsizGun ?? "—"}</div>
          </div>
        </div>
        {(raporGun || ucretsizGun) && (
          <div className="mt-3 text-xs bg-purple-50 border border-purple-200 rounded p-2 text-purple-900">
            Toplam işten uzak: <b>{(raporGun || 0) + (ucretsizGun || 0)} gün</b> (Rapor: {raporGun || 0}, Ücretsiz: {ucretsizGun || 0})
          </div>
        )}
        <AttachmentSlot sid={form._record_id} sectionLabel="Ücretsiz İzin Formu" />
      </Section>

      <Section done={!!form.dogum_sonrasi_isbasi} num={5} icon={<LogIn size={16} className="text-purple-600" />} title="İşbaşı Tarihi"
        hint="Doğum/ücretsiz izin sonrası fiilen işe döndüğü tarih. Girildiğinde otomatik SÜT İZNİ başlar.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div><Label className="text-xs">İşbaşı Tarihi</Label>
            <TrDatePicker value={form.dogum_sonrasi_isbasi} onChange={(v) => setForm({ ...form, dogum_sonrasi_isbasi: v })} testId="process-isbasi" />
          </div>
        </div>
        <AttachmentSlot sid={form._record_id} sectionLabel="İşbaşı Belgesi" />
      </Section>

      <Section done={status === "MILK_LEAVE" || status === "COMPLETED"} num={6} icon={<Milk size={16} className="text-sky-600" />} title="Süt İzni Takibi"
        hint="Otomatik: İşbaşı → Çocuk Doğum + 1 Yıl">
        {sutBitis ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1"><span className="text-slate-500">Takip Başlangıcı</span><span className="font-mono">{form.dogum_sonrasi_isbasi ? toTr(form.dogum_sonrasi_isbasi) : "Bekleniyor"}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-1"><span className="text-slate-500">Süt İzni Bitişi (çocuğun 1 yaş tarihi)</span><span className="font-mono font-bold text-sky-800" data-testid="process-sut-bitis">{toTr(sutBitis)}</span></div>
            {form.dogum_sonrasi_isbasi && (() => {
              const toplam = daysBetween(form.dogum_sonrasi_isbasi, sutBitis);
              return (
                <div className="flex justify-between border-b border-slate-100 py-1"><span className="text-slate-500">Toplam Takip Süresi <span className="text-[10px] opacity-70">(İşbaşı → 1 yaş)</span></span><span className="font-bold tabular-nums" data-testid="process-sut-toplam">{toplam !== null ? `${toplam} gün` : "—"}</span></div>
              );
            })()}
            <div className="flex justify-between py-1"><span className="text-slate-500">Bugün İtibarıyla Kalan <span className="text-[10px] opacity-70">(Bugün → 1 yaş)</span></span><span className="font-bold tabular-nums" data-testid="process-sut-kalan">{kalanSut !== null ? (kalanSut > 0 ? `${kalanSut} gün` : "Tamamlandı") : "—"}</span></div>
          </div>
        ) : <div className="text-xs text-slate-400 mt-3">Çocuk doğum tarihi girilmemiş.</div>}
      </Section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg" data-testid="process-save-btn" size="lg">
          <Save size={16} className="mr-2" /> {saving ? "Kaydediliyor..." : "Süreci Kaydet"}
        </Button>
      </div>

      {/* Zaman Çizelgesi */}
      {timeline.length > 0 && (
        <Card className="p-5 border border-slate-200" data-testid="process-timeline">
          <div className="font-semibold text-slate-900 mb-3">Zaman Çizelgesi</div>
          <div className="space-y-2">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`w-3 h-3 rounded-full ${t.color}`} />
                <span className="font-mono text-xs w-24 text-slate-600">{toTr(t.d)}</span>
                <span className="text-slate-800">{t.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Iter 72-73: Geçmiş Süreçler (process_id ile ayrıştırılmış) */}
      {(() => {
        // process_id'ye göre grupla
        const groups = {};
        (data.records || []).forEach((r) => {
          const key = r.process_id || `legacy-${r.id}`;
          if (!groups[key]) groups[key] = { process_id: r.process_id || null, records: [] };
          groups[key].records.push(r);
        });
        const activeKey = form._record_id
          ? Object.keys(groups).find((k) => groups[k].records.some((r) => r.id === form._record_id))
          : null;
        const otherProcesses = Object.entries(groups).filter(([k]) => k !== activeKey);
        if (otherProcesses.length === 0) return null;
        return (
          <Card className="p-4 border border-slate-200" data-testid="process-history">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900"><History size={16} /> Geçmiş Gebelik/Doğum Süreçleri ({otherProcesses.length})</div>
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  if (!window.confirm("Yeni bir gebelik süreci başlatmak istiyor musunuz?")) return;
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    const { data: r } = await api.post("/special-leaves", {
                      personnel_id: pid, tur: "gebelik",
                      gebelik_teblig_tarihi: today, start_date: today,
                    });
                    toast.success("Yeni süreç başlatıldı");
                    await load();
                    setForm((f) => ({
                      ...f, _record_id: r.id,
                      gebelik_teblig_tarihi: today,
                      calisamaz_rapor_tarihi: "", calisamaz_rapor_bitis: "",
                      cocuk_dogum_tarihi: "", ucretsiz_izin_baslangic: "",
                      ucretsiz_izin_bitis: "", dogum_sonrasi_isbasi: "",
                    }));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } catch (e) { toast.error(formatApiError(e)); }
                }}
                data-testid="process-new-btn"
              >+ Yeni Süreç Başlat</Button>
            </div>
            <div className="space-y-2">
              {otherProcesses.map(([key, g]) => {
                const head = g.records[0];
                return (
                  <div key={key} className="flex items-center gap-3 text-xs bg-slate-50 rounded p-2 border border-slate-200">
                    <div className="flex-1">
                      <div className="font-medium">
                        {g.process_id ? "Gebelik/Doğum Süreci" : "Eski Kayıt"}
                        {head.cocuk_dogum_tarihi && <span className="text-slate-500 ml-2">Çocuk: {toTr(head.cocuk_dogum_tarihi)}</span>}
                        <span className="text-slate-400 ml-2 text-[10px]">({g.records.length} kayıt)</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {head.start_date && `Başlangıç: ${toTr(head.start_date)}`}
                        {head.dogum_sonrasi_isbasi && ` · İşbaşı: ${toTr(head.dogum_sonrasi_isbasi)}`}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setForm({
                          _record_id: head.id, _record_type: head.tur,
                          gebelik_teblig_tarihi: head.gebelik_teblig_tarihi || head.start_date || "",
                          calisamaz_rapor_tarihi: head.calisamaz_rapor_tarihi || "",
                          calisamaz_rapor_bitis: head.calisamaz_rapor_bitis || "",
                          cocuk_dogum_tarihi: head.cocuk_dogum_tarihi || head.dogum_tarihi_kayit || "",
                          ucretsiz_izin_baslangic: head.ucretsiz_izin_baslangic || "",
                          ucretsiz_izin_bitis: head.ucretsiz_izin_bitis || "",
                          dogum_sonrasi_isbasi: head.dogum_sonrasi_isbasi || "",
                          aciklama: head.aciklama || "",
                        });
                        toast.success("Süreç yüklendi");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-blue-600 hover:underline"
                    >Yükle & Düzenle</button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Belgeler kısayolu */}
      {form._record_id && (
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <Paperclip size={16} className="text-slate-500" />
            <span className="text-sm text-slate-700">Belgeler bu sürece bağlıdır.</span>
            <Link to={`/ozel-izinler?open=${form._record_id}`} className="text-blue-700 hover:underline text-sm ml-auto">Belgeleri Yönet →</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
