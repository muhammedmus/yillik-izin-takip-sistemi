import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Trash2, Search, Filter,
  HeartPulse, Baby, Milk, Cake, HeartCrack, Sparkles,
  Paperclip, Upload, Download, FileText, Eye, X, Loader2, Image as ImageIcon,
  ChevronDown, ChevronRight, Activity, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrDatePicker } from "@/components/TrDatePicker";
import { toTr } from "@/pages/users/shared";

const TYPES = [
  { v: "gebelik", label: "Gebelik, Doğum ve Süt İzni Takibi", short: "Gebelik/Doğum/Süt Takibi", icon: HeartPulse, color: "text-pink-700 bg-pink-100" },
  { v: "evlilik", label: "Evlilik İzni", short: "Evlilik İzni", icon: Cake, color: "text-emerald-700 bg-emerald-100" },
  { v: "cenaze", label: "Ölüm/Cenaze İzni", short: "Cenaze İzni", icon: HeartCrack, color: "text-slate-700 bg-slate-100" },
  { v: "diger", label: "Diğer Özel İzin", short: "Diğer", icon: Sparkles, color: "text-amber-700 bg-amber-100" },
];
// Iter 69: Eski kayıtlar için etiketler (dropdown'da görünmez, listede okunur)
const LEGACY_TYPE_LABELS = {
  dogum: { label: "Doğum İzni/Raporu (eski kayıt)", short: "Gebelik/Doğum/Süt Takibi", icon: Baby, color: "text-purple-700 bg-purple-100" },
  sut_izni: { label: "Süt İzni (eski kayıt)", short: "Gebelik/Doğum/Süt Takibi", icon: Milk, color: "text-sky-700 bg-sky-100" },
};
const TYPE_MAP = { ...Object.fromEntries(TYPES.map((t) => [t.v, t])), ...LEGACY_TYPE_LABELS };
const YAKINLIK_OPTIONS = ["Anne", "Baba", "Eş", "Çocuk", "Kardeş", "Diğer"];

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE_MB = 10;

function humanSize(b) {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------------
// PersonnelPicker — klavyeden yazılabilen aranabilir combobox
// -----------------------------------------------------------------------------
function PersonnelPicker({ personnel, value, onChange }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(-1);
  const wrapRef = useRef(null);
  const selected = useMemo(() => personnel.find((p) => p.id === value) || null, [personnel, value]);

  const norm = (s) => (s || "").toString()
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/i̇/g, "i")
    .toLocaleLowerCase("tr");

  useEffect(() => {
    // Seçim varsa arama alanına ad göster; kullanıcı yazmaya başlayınca serbest
    if (selected && !open) setQ(`${selected.sicil_no} · ${selected.ad_soyad}`);
    if (!selected && !open) setQ("");
  }, [selected, open]);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const s = norm(q);
    if (!s) return personnel.slice(0, 30);
    return personnel.filter((p) =>
      norm(p.ad_soyad).includes(s) ||
      String(p.sicil_no || "").toLowerCase().includes(s.toLowerCase()) ||
      norm(p.departman).includes(s)
    ).slice(0, 50);
  }, [personnel, q]);

  const pick = (p) => {
    onChange(p.id);
    setQ(`${p.sicil_no} · ${p.ad_soyad}`);
    setOpen(false);
    setHover(-1);
  };

  const onKey = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover((h) => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHover((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && hover >= 0) { e.preventDefault(); pick(filtered[hover]); }
    else if (e.key === "Escape") { setOpen(false); setHover(-1); }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHover(0); if (value) onChange(""); }}
        onFocus={() => { setOpen(true); if (selected) setQ(""); }}
        onKeyDown={onKey}
        placeholder="Ad, sicil no veya departman ile ara..."
        autoComplete="off"
        data-testid="sl-form-personnel"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-auto text-sm"
             data-testid="sl-form-personnel-list">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${hover === i ? "bg-slate-100" : ""} ${value === p.id ? "font-semibold text-blue-700" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHover(i)}
              data-testid={`sl-form-personnel-opt-${p.sicil_no}`}
            >
              <span className="font-mono text-xs text-slate-500">{p.sicil_no}</span> · {p.ad_soyad} · <span className="text-slate-500">{p.departman || "—"}</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3 text-xs text-slate-400">
          Personel bulunamadı.
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Iter 65: Canlı Durum Panosu — 3 kart (Gebe Çalışan / Doğum İzninde / Süt İzni Kullanan)
// -----------------------------------------------------------------------------
function StatusPanel({ refreshKey }) {
  const [data, setData] = useState({
    gebe_calisan: { count: 0, items: [], upcoming_report_10d: 0 },
    dogum_izninde: { count: 0, items: [] },
    sut_izni_kullanan: { count: 0, items: [], ending_soon_10d: 0 },
  });
  const [open, setOpen] = useState(null); // "gebe" | "dogum" | "sut" | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: d } = await api.get("/special-leaves/status-panel");
        if (!cancel) setData(d);
      } catch (e) {
        if (!cancel) toast.error(formatApiError(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [refreshKey]);

  const cardMeta = {
    gebe: {
      key: "gebe_calisan", label: "GEBE ÇALIŞAN",
      sub: "Gebeliğini bildirmiş, çalışamaz raporu henüz başlamamış personel",
      color: "border-pink-300 hover:border-pink-400 bg-gradient-to-br from-pink-50 to-white text-pink-900",
      badge: "bg-pink-100 text-pink-700", ring: "ring-pink-400",
      icon: <HeartPulse size={20} />, dateLabel: "Tebliğ",
      alertText: (d) => d.upcoming_report_10d > 0
        ? `${d.upcoming_report_10d} kişinin çalışamaz raporuna ≤10 gün kaldı`
        : null,
    },
    dogum: {
      key: "dogum_izninde", label: "DOĞUM İZNİNDE",
      sub: "Doğum öncesi veya doğum sonrası raporu devam eden personel",
      color: "border-purple-300 hover:border-purple-400 bg-gradient-to-br from-purple-50 to-white text-purple-900",
      badge: "bg-purple-100 text-purple-700", ring: "ring-purple-400",
      icon: <Baby size={20} />, dateLabel: "Rapor Başlangıcı",
      alertText: () => null,
    },
    sut: {
      key: "sut_izni_kullanan", label: "SÜT İZNİ KULLANAN",
      sub: "Halen süt izni devam eden personel",
      color: "border-sky-300 hover:border-sky-400 bg-gradient-to-br from-sky-50 to-white text-sky-900",
      badge: "bg-sky-100 text-sky-700", ring: "ring-sky-400",
      icon: <Milk size={20} />, dateLabel: "Bitiş",
      alertText: (d) => {
        const nc = d.next_critical || {};
        return nc.date ? `En yakın: ${new Date(nc.date + "T00:00:00").toLocaleDateString("tr-TR")} — ${d.next_critical?.days_left ?? "?"} gün` : null;
      },
    },
  };

  // Kart alt satırında toplam_takip_gun göster (İşbaşı→1 yaş)
  const _renderCardKalan = (k, d) => {
    if (k !== "sut") return null;
    const first = (d.items || [])[0];
    if (!first) return null;
    return first.toplam_takip_gun ? ` — ${first.toplam_takip_gun} gün` : "";
  };

  const cardOrder = ["gebe", "dogum", "sut"];
  const activeMeta = open ? cardMeta[open] : null;
  const activeItems = activeMeta ? (data[activeMeta.key]?.items || []) : [];

  return (
    <div className="space-y-3" data-testid="status-panel">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cardOrder.map((k) => {
          const m = cardMeta[k];
          const d = data[m.key] || { count: 0 };
          const alert = m.alertText(d);
          const active = open === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setOpen(active ? null : k)}
              className={`text-left h-full rounded-lg border-2 ${m.color} p-4 shadow-sm transition ${active ? `ring-2 ${m.ring}` : ""}`}
              data-testid={`status-card-${k}`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${m.badge}`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">{m.label}</div>
                  <div className="text-4xl font-bold tabular-nums leading-tight mt-1" data-testid={`status-count-${k}`}>
                    {loading ? "…" : d.count}
                  </div>
                  <div className="text-[11px] opacity-70 mt-1 leading-tight">{m.sub}</div>
                  {d.next_critical && d.next_critical.date && (
                    <div className="text-[11px] mt-1 opacity-80">
                      <b>En yakın:</b> {toTr(d.next_critical.date)}
                      {d.next_critical.days_left !== null && d.next_critical.days_left !== undefined && (
                        <span> — {d.next_critical.days_left >= 0 ? `${d.next_critical.days_left} gün` : `${Math.abs(d.next_critical.days_left)} gün önce`}</span>
                      )}
                    </div>
                  )}
                  {alert && (
                    <div className="text-[11px] mt-1.5 font-medium bg-white/70 rounded px-2 py-1 border border-current inline-block" data-testid={`status-alert-${k}`}>
                      ⚠ {alert}
                    </div>
                  )}
                </div>
                {active ? <ChevronDown size={16} className="opacity-60 shrink-0" /> : <ChevronRight size={16} className="opacity-60 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      {activeMeta && (
        <Card className="border border-slate-200 overflow-hidden" data-testid={`status-list-${open}`}>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-700">{activeMeta.label} — {activeItems.length} personel</div>
            <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-600" data-testid="status-close-list">
              <X size={14} />
            </button>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Sicil</th>
                  <th className="text-left px-3 py-2">Ad Soyad</th>
                  <th className="text-left px-3 py-2">Departman</th>
                  {open === "gebe" && <>
                    <th className="text-left px-3 py-2">Tebliğ</th>
                    <th className="text-left px-3 py-2">Planlı Rapor</th>
                  </>}
                  {open === "dogum" && <>
                    <th className="text-left px-3 py-2">Rapor</th>
                    <th className="text-right px-3 py-2">Rapor Gün</th>
                    <th className="text-left px-3 py-2">Ücretsiz İzin</th>
                    <th className="text-right px-3 py-2">Ü.İ Gün</th>
                    <th className="text-right px-3 py-2">Toplam</th>
                    <th className="text-left px-3 py-2">Durum</th>
                  </>}
                    {open === "sut" && <>
                    <th className="text-left px-3 py-2">Çocuk DOB</th>
                    <th className="text-left px-3 py-2">İşbaşı</th>
                    <th className="text-left px-3 py-2">Süt İzni Bitiş</th>
                    <th className="text-right px-3 py-2">Kalan <span className="text-[10px] opacity-70">(İşbaşı→1 yaş)</span></th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {activeItems.length === 0 && (
                  <tr><td colSpan={open === "dogum" ? 9 : 7} className="text-center text-slate-400 py-6">Kayıt yok.</td></tr>
                )}
                {activeItems.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{it.sicil_no || "—"}</td>
                    <td className="px-3 py-1.5"><Link to={`/ozel-izinler/personel/${it.personnel_id}`} className="text-blue-700 hover:underline font-medium">{it.ad_soyad || "—"}</Link></td>
                    <td className="px-3 py-1.5">{it.departman || "—"}</td>
                    {open === "gebe" && <>
                      <td className="px-3 py-1.5 font-mono text-xs">{toTr(it.gebelik_teblig_tarihi)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{it.calisamaz_rapor_tarihi ? toTr(it.calisamaz_rapor_tarihi) : "—"}</td>
                    </>}
                    {open === "dogum" && <>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {it.calisamaz_rapor_tarihi ? `${toTr(it.calisamaz_rapor_tarihi)} → ${it.calisamaz_rapor_bitis ? toTr(it.calisamaz_rapor_bitis) : "—"}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{it.rapor_gun_sayisi ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {it.ucretsiz_izin_baslangic ? `${toTr(it.ucretsiz_izin_baslangic)} → ${it.ucretsiz_izin_bitis ? toTr(it.ucretsiz_izin_bitis) : "—"}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{it.ucretsiz_izin_gun_sayisi ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{it.toplam_uzak_gun || "—"}</td>
                      <td className="px-3 py-1.5 text-xs">{it.durum || (it.dogum_sonrasi_isbasi ? "İşbaşı Planlı" : "—")}</td>
                    </>}
                    {open === "sut" && <>
                      <td className="px-3 py-1.5 font-mono text-xs">{toTr(it.cocuk_dogum_tarihi)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{toTr(it.dogum_sonrasi_isbasi)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs font-semibold text-sky-800">{toTr(it.sut_izni_bitis)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{it.toplam_takip_gun ?? "—"} gün</td>
                    </>}
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

// -----------------------------------------------------------------------------
// Gebelik Otomatik Uyarıları — Çalışamaz Raporu yaklaşanlar (deprecated Iter 65)
// -----------------------------------------------------------------------------
function GebelikAlertsPanel({ refreshKey }) {
  const [data, setData] = useState({ upcoming: [], threshold_days: 10 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data: d } = await api.get("/special-leaves/gebelik-alerts", { params: { threshold_days: 10 } });
        if (!cancel) setData(d);
      } catch (e) {
        if (!cancel) toast.error(formatApiError(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [refreshKey]);

  const count = loading ? "…" : data.upcoming.length;

  return (
    <div className="space-y-2" data-testid="gebelik-alerts-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-left w-full rounded-lg border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-white text-pink-900 hover:border-pink-400 p-4 shadow-sm transition ${open ? "ring-2 ring-pink-400" : ""}`}
        data-testid="gebelik-alerts-card"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-pink-100 text-pink-700">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Gebelik — Çalışamaz Raporu Yaklaşan (≤ 10 gün)</div>
            <div className="text-3xl font-bold tabular-nums leading-tight">{count}</div>
            <div className="text-xs opacity-70">Doğum öncesi 8 hafta rapor başlangıcı bu tarihlerde başlıyor</div>
          </div>
          {open ? <ChevronDown size={16} className="opacity-60" /> : <ChevronRight size={16} className="opacity-60" />}
        </div>
      </button>
      {open && (
        <Card className="border border-pink-200 overflow-hidden" data-testid="gebelik-alerts-list">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pink-50 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Sicil</th>
                  <th className="text-left px-3 py-2">Ad Soyad</th>
                  <th className="text-left px-3 py-2">Departman</th>
                  <th className="text-left px-3 py-2">Rapor Tarihi</th>
                  <th className="text-left px-3 py-2">Tahmini Doğum</th>
                </tr>
              </thead>
              <tbody>
                {(data.upcoming || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6">Yakınlaşan çalışamaz raporu yok.</td></tr>
                )}
                {(data.upcoming || []).map((it) => (
                  <tr key={it.id} className="border-t border-pink-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{it.sicil_no || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Link to={`/personel/${it.personnel_id}`} className="text-blue-700 hover:underline font-medium">{it.ad_soyad || "—"}</Link>
                    </td>
                    <td className="px-3 py-1.5">{it.departman || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold text-pink-800">{toTr(it.calisamaz_rapor_tarihi)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{toTr(it.tahmini_dogum_tarihi)}</td>
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

// -----------------------------------------------------------------------------
// Süt İzni Uyarı Merkezi
// -----------------------------------------------------------------------------
function MilkAlertsPanel() {
  const [data, setData] = useState({ upcoming: [], ended: [], threshold_days: 10 });
  const [open, setOpen] = useState(null); // "upcoming" | "ended" | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: d } = await api.get("/special-leaves/milk-alerts", { params: { threshold_days: 10 } });
        if (!cancel) setData(d);
      } catch (e) {
        if (!cancel) toast.error(formatApiError(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const CardBtn = ({ variant, count, label, sub, testId }) => {
    const isBlue = variant === "upcoming";
    const active = open === variant;
    const base = isBlue
      ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white text-sky-900 hover:border-sky-400"
      : "border-slate-300 bg-gradient-to-br from-slate-50 to-white text-slate-800 hover:border-slate-400";
    const activeCls = active ? (isBlue ? "ring-2 ring-sky-400" : "ring-2 ring-slate-400") : "";
    return (
      <button
        type="button"
        onClick={() => setOpen(active ? null : variant)}
        className={`text-left rounded-lg border-2 ${base} ${activeCls} p-4 shadow-sm transition w-full`}
        data-testid={testId}
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isBlue ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
            <Milk size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
            <div className="text-3xl font-bold tabular-nums leading-tight">{count}</div>
            <div className="text-xs opacity-70">{sub}</div>
          </div>
          {active ? <ChevronDown size={16} className="opacity-60" /> : <ChevronRight size={16} className="opacity-60" />}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-2" data-testid="milk-alerts-panel">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CardBtn
          variant="upcoming"
          count={loading ? "…" : data.upcoming.length}
          label="Süt İzni — Yaklaşan (≤ 10 gün)"
          sub="Bitişine 10 gün veya daha az kaldı"
          testId="milk-upcoming-card"
        />
        <CardBtn
          variant="ended"
          count={loading ? "…" : data.ended.length}
          label="Süt İzni — Yakın Zamanda Bitmiş (son 10 gün)"
          sub="Son 10 gün içinde sona erdi"
          testId="milk-ended-card"
        />
      </div>
      {open && (
        <Card className="border border-slate-200 overflow-hidden" data-testid={`milk-list-${open}`}>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-700">
              {open === "upcoming" ? "Yaklaşan Süt İzni Bitişleri" : "Yakın Zamanda Biten Süt İzinleri"}
            </div>
            <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-600" data-testid="milk-close-list"><X size={14} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Sicil</th>
                  <th className="text-left px-3 py-2">Ad Soyad</th>
                  <th className="text-left px-3 py-2">Departman</th>
                  <th className="text-left px-3 py-2">Başlangıç</th>
                  <th className="text-left px-3 py-2">Bitiş</th>
                </tr>
              </thead>
              <tbody>
                {(data[open] || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6">Kayıt yok.</td></tr>
                )}
                {(data[open] || []).map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{it.sicil_no || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Link to={`/personel/${it.personnel_id}`} className="text-blue-700 hover:underline font-medium">{it.ad_soyad || "—"}</Link>
                    </td>
                    <td className="px-3 py-1.5">{it.departman || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{toTr(it.start_date)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold">{toTr(it._end || it.end_date)}</td>
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

// -----------------------------------------------------------------------------
// Belgeler Dialog
// -----------------------------------------------------------------------------
function AttachmentsDialog({ row, open, onOpenChange, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // { url, content_type, name }

  const load = async () => {
    if (!row?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/special-leaves/${row.id}/attachments`);
      setItems(data.items || []);
      onCountChange && onCountChange(row.id, (data.items || []).length);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, row?.id]);

  // Dialog kapatılınca preview blob URL temizle
  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);
  useEffect(() => { if (!open && preview?.url) { URL.revokeObjectURL(preview.url); setPreview(null); } }, [open, preview]);

  const fetchBlob = async (att) => {
    const t = localStorage.getItem("token");
    const r = await fetch(`${API_BASE}/special-leaves/${row.id}/attachments/${att.id}/download`, {
      credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) throw new Error("İndirilemedi");
    return await r.blob();
  };

  const showPreview = async (att) => {
    try {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const blob = await fetchBlob(att);
      const url = URL.createObjectURL(blob);
      setPreview({ url, content_type: att.content_type, name: att.original_filename });
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const uploadFiles = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    for (const f of arr) {
      if (!ACCEPTED_MIME.includes((f.type || "").toLowerCase())) {
        toast.error(`Kabul edilmeyen tür: ${f.name}`);
        return;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`Çok büyük: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB) — Maks ${MAX_SIZE_MB} MB`);
        return;
      }
    }
    setUploading(true);
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f, f.name));
      await api.post(`/special-leaves/${row.id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${arr.length} belge yüklendi`);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setUploading(false); }
  };

  const doDelete = async (aid) => {
    if (!window.confirm("Belgeyi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/special-leaves/${row.id}/attachments/${aid}`);
      toast.success("Belge silindi");
      if (preview?.url) { URL.revokeObjectURL(preview.url); setPreview(null); }
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const downloadOne = async (att) => {
    try {
      const blob = await fetchBlob(att);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = att.original_filename || "belge";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const isImage = (ct) => (ct || "").startsWith("image/");
  const isPdf = (ct) => (ct || "") === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" data-testid="sl-attachments-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Paperclip size={16} /> Belgeler — {row?.ad_soyad}</DialogTitle>
          <DialogDescription>
            {TYPE_MAP[row?.tur]?.label || row?.tur} · PDF, JPG veya PNG · Maks {MAX_SIZE_MB} MB / dosya
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-600">
            <b>Yeni belge yükle:</b> Kabul edilenler PDF · JPG · PNG.
          </div>
          <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded cursor-pointer text-sm font-medium" data-testid="sl-attachment-upload-btn">
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Yükleniyor...</> : <><Upload size={14} /> Dosya Seç</>}
            <input
              type="file"
              multiple
              accept={ACCEPTED_EXT}
              className="hidden"
              disabled={uploading}
              data-testid="sl-attachment-file-input"
              onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-slate-200 max-h-96 overflow-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-400 text-sm"><Loader2 size={16} className="animate-spin inline mr-1" /> Yükleniyor...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">Henüz belge yok.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-xs text-slate-600">
                    <th className="text-left px-3 py-2">Dosya</th>
                    <th className="text-right px-3 py-2">Boyut</th>
                    <th className="text-right px-3 py-2">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100" data-testid={`sl-attachment-row-${a.id}`}>
                      <td className="px-3 py-2 truncate max-w-[200px]">
                        <span className="inline-flex items-center gap-1.5">
                          {isPdf(a.content_type) ? <FileText size={13} className="text-red-600" /> : <ImageIcon size={13} className="text-blue-600" />}
                          <span className="font-medium truncate" title={a.original_filename}>{a.original_filename}</span>
                        </span>
                        <div className="text-[10px] text-slate-400">{a.created_at ? toTr(a.created_at) : "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{humanSize(a.size)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => showPreview(a)} title="Önizle" data-testid={`sl-attachment-preview-${a.id}`}>
                          <Eye size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadOne(a)} title="İndir" data-testid={`sl-attachment-download-${a.id}`}>
                          <Download size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => doDelete(a.id)} title="Sil" data-testid={`sl-attachment-delete-${a.id}`}>
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Preview Panel */}
          <div className="rounded border border-slate-200 bg-slate-50 min-h-[350px] max-h-96 overflow-hidden flex flex-col" data-testid="sl-attachment-preview-panel">
            {!preview ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center px-4">
                <div>
                  <Eye size={28} className="mx-auto mb-2 opacity-50" />
                  <div>Bir belge seçin — burada önizlenir.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
                  <div className="text-xs text-slate-600 truncate flex-1" title={preview.name}>
                    <b>Önizleme:</b> {preview.name}
                  </div>
                  <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="text-slate-400 hover:text-slate-700" title="Önizlemeyi kapat" data-testid="sl-preview-close">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-white">
                  {isImage(preview.content_type) ? (
                    <img src={preview.url} alt={preview.name} className="w-full h-auto object-contain" data-testid="sl-preview-image" />
                  ) : isPdf(preview.content_type) ? (
                    <iframe src={preview.url} title="PDF önizleme" className="w-full h-96" data-testid="sl-preview-pdf" />
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-sm">Bu dosya türü önizlenemiyor. Lütfen indirin.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Gebelik Zaman Çizelgesi — görsel timeline + kilometre taşı tarih editörü
// -----------------------------------------------------------------------------
const GEBELIK_MILESTONES = [
  { key: "gebelik_teblig_tarihi", label: "Gebelik Tebliği", color: "bg-pink-500", ring: "ring-pink-200" },
  { key: "calisamaz_rapor_tarihi", label: "Çalışamaz Raporu Başlangıç", color: "bg-fuchsia-500", ring: "ring-fuchsia-200" },
  { key: "calisamaz_rapor_bitis", label: "Çalışamaz Raporu Bitiş", color: "bg-fuchsia-700", ring: "ring-fuchsia-300" },
  { key: "cocuk_dogum_tarihi", label: "Çocuk Doğum Tarihi", color: "bg-rose-600", ring: "ring-rose-200" },
  { key: "ucretsiz_izin_baslangic", label: "Ücretsiz İzin Başlangıç", color: "bg-amber-500", ring: "ring-amber-200" },
  { key: "ucretsiz_izin_bitis", label: "Ücretsiz İzin Bitiş", color: "bg-amber-700", ring: "ring-amber-300" },
  { key: "dogum_sonrasi_isbasi", label: "İşbaşı Tarihi", color: "bg-purple-500", ring: "ring-purple-200" },
  { key: "sut_izni_bitis", label: "Süt İzni Bitişi (Otomatik)", color: "bg-sky-500", ring: "ring-sky-200" },
];

function GebelikTimelineDialog({ row, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (row) {
      setForm({
        gebelik_teblig_tarihi: row.gebelik_teblig_tarihi || "",
        calisamaz_rapor_tarihi: row.calisamaz_rapor_tarihi || "",
        calisamaz_rapor_bitis: row.calisamaz_rapor_bitis || "",
        cocuk_dogum_tarihi: row.cocuk_dogum_tarihi || row.dogum_tarihi_kayit || "",
        ucretsiz_izin_baslangic: row.ucretsiz_izin_baslangic || "",
        ucretsiz_izin_bitis: row.ucretsiz_izin_bitis || "",
        dogum_sonrasi_isbasi: row.dogum_sonrasi_isbasi || "",
        sut_izni_bitis: row.sut_izni_bitis || "",
      });
    }
  }, [row]);

  // Timeline hesapla — dolu olan tarihleri kronolojik sırala, %0-100 arası konum ver.
  const timeline = useMemo(() => {
    const points = GEBELIK_MILESTONES
      .map((m) => ({ ...m, date: form[m.key] }))
      .filter((p) => p.date);
    if (points.length < 1) return { points: [], min: null, max: null };
    const times = points.map((p) => new Date(p.date).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const range = Math.max(max - min, 1);
    const todayT = Date.now();
    return {
      points: points
        .map((p) => ({ ...p, pct: ((new Date(p.date).getTime() - min) / range) * 100 }))
        .sort((a, b) => a.pct - b.pct),
      min, max, range,
      todayPct: todayT >= min && todayT <= max ? ((todayT - min) / range) * 100 : null,
    };
  }, [form]);

  const save = async () => {
    if (!row) return;
    setBusy(true);
    try {
      // Iter 67: cocuk_dogum_tarihi doluysa sut_izni_bitis'i otomatik +1 yıl hesapla
      const auto = { ...form };
      if (auto.cocuk_dogum_tarihi && !auto.sut_izni_bitis) {
        const d = new Date(auto.cocuk_dogum_tarihi);
        auto.sut_izni_bitis = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()).toISOString().slice(0, 10);
      }
      const payload = {
        personnel_id: row.personnel_id,
        tur: row.tur,
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        gun_sayisi: row.gun_sayisi ?? null,
        aciklama: row.aciklama || "",
        durum: row.durum || "",
        yakinlik: row.yakinlik || "",
        ...auto,
      };
      await api.put(`/special-leaves/${row.id}`, payload);
      toast.success("Zaman çizelgesi güncellendi");
      onSaved && onSaved();
      onOpenChange(false);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const filledCount = Object.values(form).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="gebelik-timeline-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity size={16} className="text-pink-600" /> Gebelik Zaman Çizelgesi — {row?.ad_soyad}
          </DialogTitle>
          <DialogDescription>
            Doğum öncesi ve sonrası kilometre taşlarını girin. Timeline yalnızca dolu olan tarihleri gösterir.
          </DialogDescription>
        </DialogHeader>

        {/* Görsel Timeline */}
        <Card className="p-5 border-2 border-pink-100 bg-gradient-to-br from-pink-50/50 to-white" data-testid="gebelik-timeline-viz">
          {filledCount === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">Aşağıdan en az bir tarih girin, timeline burada görünecek.</div>
          ) : (
            <div className="space-y-4">
              <div className="relative h-2 bg-slate-200 rounded-full">
                {timeline.todayPct !== null && (
                  <div
                    className="absolute -top-1 w-0.5 h-4 bg-slate-800"
                    style={{ left: `${timeline.todayPct}%` }}
                    title="Bugün"
                  >
                    <div className="absolute -top-4 -translate-x-1/2 text-[10px] text-slate-600 font-semibold whitespace-nowrap">Bugün</div>
                  </div>
                )}
                {timeline.points.map((p) => (
                  <div
                    key={p.key}
                    className={`absolute -top-1.5 w-5 h-5 rounded-full border-2 border-white shadow ring-2 ${p.color} ${p.ring}`}
                    style={{ left: `calc(${p.pct}% - 10px)` }}
                    title={`${p.label}: ${toTr(p.date)}`}
                    data-testid={`timeline-dot-${p.key}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {timeline.points.map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${p.color}`} />
                    <span className="text-slate-700 font-medium">{p.label}:</span>
                    <span className="font-mono text-slate-900">{toTr(p.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Editor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {GEBELIK_MILESTONES.map((m) => (
            <div key={m.key}>
              <Label className="text-xs flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                {m.label}
              </Label>
              <TrDatePicker
                value={form[m.key] || ""}
                onChange={(v) => setForm({ ...form, [m.key]: v })}
                testId={`timeline-input-${m.key}`}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button className="bg-pink-600 hover:bg-pink-700" onClick={save} disabled={busy} data-testid="timeline-save-btn">
            {busy ? "Kaydediliyor..." : "Zaman Çizelgesini Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Özel İzinler ana ekranı
// -----------------------------------------------------------------------------
export default function SpecialLeaves() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [tur, setTur] = useState("");
  const [q, setQ] = useState("");
  const [personnel, setPersonnel] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ personnel_id: "", tur: "gebelik", start_date: "", end_date: "", gun_sayisi: "", aciklama: "", durum: "", yakinlik: "", cocuk_dogum_tarihi: "", gebelik_teblig_tarihi: "" });
  const [pendingFiles, setPendingFiles] = useState([]);  // Iter 64: kayıt öncesi yüklenecek belgeler
  const [busy, setBusy] = useState(false);
  const [attachRow, setAttachRow] = useState(null);
  const [timelineRow, setTimelineRow] = useState(null);

  const load = async () => {
    try {
      const p = { limit: 200 };
      if (tur) p.tur = tur;
      const { data } = await api.get("/special-leaves", { params: p });
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tur]);
  useEffect(() => {
    api.get("/personnel", { params: { aktif: true, limit: 5000 } }).then(({ data }) => setPersonnel(data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr-TR");
    if (!s) return items;
    return items.filter((it) => (it.ad_soyad || "").toLocaleLowerCase("tr-TR").includes(s) || String(it.sicil_no || "").includes(s));
  }, [items, q]);

  const submit = async () => {
    if (!form.personnel_id) return toast.error("Personel seçin");
    // Iter 69: Gebelik türü tek süreç kaydı — sadece tebliğ ilk aşamada zorunlu
    if (form.tur === "gebelik" && !form.gebelik_teblig_tarihi) {
      return toast.error("Gebelik Tebliğ Tarihi gerekli");
    }
    let payload = { ...form, gun_sayisi: form.gun_sayisi === "" ? null : Number(form.gun_sayisi) };
    if (form.tur === "gebelik" && form.gebelik_teblig_tarihi) {
      payload.start_date = payload.start_date || form.gebelik_teblig_tarihi;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/special-leaves", payload);
      if (pendingFiles.length > 0 && data?.id) {
        try {
          const fd = new FormData();
          pendingFiles.forEach((f) => fd.append("files", f, f.name));
          await api.post(`/special-leaves/${data.id}/attachments`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          toast.success(`Özel izin kaydı + ${pendingFiles.length} belge yüklendi`);
        } catch (e) {
          toast.error(`Kayıt oluştu ama belgeler yüklenemedi: ${formatApiError(e)}`);
        }
      } else {
        toast.success("Özel izin kaydı oluşturuldu");
      }
      setAddOpen(false);
      setForm({ personnel_id: "", tur: "gebelik", start_date: "", end_date: "", gun_sayisi: "", aciklama: "", durum: "", yakinlik: "", cocuk_dogum_tarihi: "", gebelik_teblig_tarihi: "" });
      setPendingFiles([]);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const doDelete = async (row) => {
    const reason = window.prompt(`"${row.ad_soyad}" özel izin kaydını silmek için gerekçe yazın:`, "");
    if (reason === null) return;
    try {
      await api.delete(`/special-leaves/${row.id}`, { params: { reason } });
      toast.success("Kayıt silindi");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const updateAttachmentCount = (sid, count) => {
    setItems((prev) => prev.map((it) => it.id === sid ? { ...it, attachment_count: count } : it));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Özel İzinler</h1>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)} data-testid="special-add-btn"><Plus size={14} className="mr-1" /> Yeni Özel İzin</Button>
      </div>

      {/* Iter 65: Canlı Durum Panosu — Gebe Çalışan / Doğum İzninde / Süt İzni Kullanan */}
      <StatusPanel refreshKey={items.length} />

      <Card className="p-3 border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"><Filter size={14} /> Filtreler</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div>
            <Label className="text-xs">Tür</Label>
            <Select value={tur || "__all__"} onValueChange={(v) => setTur(v === "__all__" ? "" : v)}>
              <SelectTrigger data-testid="sl-filter-type"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tümü</SelectItem>
                {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Ad Soyad / Sicil ara</Label>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Personel adı veya sicil..." data-testid="sl-search" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean w-full text-sm">
            <thead>
              <tr>
                <th>Sicil</th><th>Ad Soyad</th><th>Departman</th><th>Tür</th>
                <th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Durum</th>
                <th className="text-center">Belgeler</th>
                <th className="text-center">Zaman Çizelgesi</th>
                <th className="text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody data-testid="sl-list">
              {filtered.length === 0 && <tr><td colSpan={11} className="text-center text-slate-400 py-8">Kayıt yok.</td></tr>}
              {filtered.map((it) => {
                const t = TYPE_MAP[it.tur] || { label: it.tur, color: "text-slate-700 bg-slate-100" };
                const attCount = it.attachment_count || 0;
                const canTimeline = it.tur === "gebelik" || it.tur === "dogum";
                const timelineCount = canTimeline
                  ? ["gebelik_teblig_tarihi","calisamaz_rapor_tarihi","tahmini_dogum_tarihi","dogum_tarihi_kayit","dogum_sonrasi_isbasi","sut_izni_bitis"]
                      .filter((k) => it[k]).length
                  : 0;
                return (
                  <tr key={it.id} data-testid={`sl-row-${it.id}`}>
                    <td className="font-mono text-xs">{it.sicil_no}</td>
                    <td><Link to={`/ozel-izinler/personel/${it.personnel_id}`} className="text-blue-700 hover:underline font-medium">{it.ad_soyad}</Link></td>
                    <td>{it.departman || "—"}</td>
                    <td><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${t.color}`}>{t.short || t.label}</span></td>
                    <td className="font-mono text-xs">{toTr(it.start_date)}</td>
                    <td className="font-mono text-xs">{toTr(it.end_date)}</td>
                    <td className="tabular-nums text-center">{it.gun_sayisi ?? "—"}</td>
                    <td className="text-xs">{it.durum || "—"}</td>
                    <td className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachRow(it)}
                        title="Belgeleri Yönet"
                        data-testid={`sl-attachments-${it.id}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Paperclip size={13} className={attCount > 0 ? "text-blue-600" : "text-slate-400"} />
                          <span className={`text-xs tabular-nums ${attCount > 0 ? "font-semibold text-blue-700" : "text-slate-400"}`}>{attCount}</span>
                        </span>
                      </Button>
                    </td>
                    <td className="text-center">
                      {canTimeline ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTimelineRow(it)}
                          title="Gebelik Zaman Çizelgesi"
                          data-testid={`sl-timeline-${it.id}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Activity size={13} className={timelineCount > 0 ? "text-pink-600" : "text-slate-400"} />
                            <span className={`text-xs tabular-nums ${timelineCount > 0 ? "font-semibold text-pink-700" : "text-slate-400"}`}>{timelineCount}/6</span>
                          </span>
                        </Button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800" onClick={() => doDelete(it)} data-testid={`sl-delete-${it.id}`}><Trash2 size={13} /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-2 text-xs text-slate-500 border-t border-slate-100">Toplam <b>{total}</b> kayıt, {filtered.length} gösteriliyor.</div>
      </Card>

      {/* Yeni Özel İzin Dialogu */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg" data-testid="sl-add-dialog">
          <DialogHeader>
            <DialogTitle>Yeni Özel İzin Kaydı</DialogTitle>
            <DialogDescription>Yıllık izin bakiyesini etkilemez. Yalnız bilgi ve takip amaçlıdır. Kayıt oluşturulduktan sonra belgeleri "Belgeler" ikonundan yükleyebilirsiniz.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Personel *</Label>
              <PersonnelPicker
                personnel={personnel}
                value={form.personnel_id}
                onChange={(pid) => setForm({ ...form, personnel_id: pid })}
              />
            </div>
            <div>
              <Label>Tür *</Label>
              <Select value={form.tur} onValueChange={(v) => setForm({ ...form, tur: v })}>
                <SelectTrigger data-testid="sl-form-tur"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.tur === "gebelik" && (
              <div className="rounded-lg border-2 border-pink-200 bg-pink-50/50 p-3 space-y-2">
                <Label className="text-xs font-semibold text-pink-900 flex items-center gap-1.5">
                  <HeartPulse size={13} /> Gebelik Tebliğ Tarihi
                </Label>
                <TrDatePicker
                  value={form.gebelik_teblig_tarihi}
                  onChange={(v) => setForm({ ...form, gebelik_teblig_tarihi: v, start_date: v })}
                  testId="sl-form-teblig"
                />
                <div className="text-[11px] text-pink-800 bg-white/70 rounded p-2 border border-pink-200">
                  <b>Bilgi:</b> Sonraki aşamalar (Çalışamaz Raporu, Çocuk Doğum, Ücretsiz İzin, İşbaşı, Süt İzni) personel adına tıklayarak
                  Süreç Detay ekranından girilecek. İlk kayıtta yalnız tebliğ tarihini vermeniz yeterli.
                </div>
              </div>
            )}
            {form.tur === "cenaze" && (
              <div>
                <Label>Yakınlık Derecesi</Label>
                <Select value={form.yakinlik} onValueChange={(v) => setForm({ ...form, yakinlik: v })}>
                  <SelectTrigger data-testid="sl-form-yakinlik"><SelectValue placeholder="Seç..." /></SelectTrigger>
                  <SelectContent>{YAKINLIK_OPTIONS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Başlangıç</Label><TrDatePicker value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} testId="sl-form-start" /></div>
              <div><Label>Bitiş</Label><TrDatePicker value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} testId="sl-form-end" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gün Sayısı</Label><Input type="number" step="0.5" value={form.gun_sayisi} onChange={(e) => setForm({ ...form, gun_sayisi: e.target.value })} data-testid="sl-form-days" /></div>
              <div><Label>Durum</Label><Input value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })} placeholder="örn. Devam Ediyor" data-testid="sl-form-status" /></div>
            </div>
            <div><Label>Açıklama</Label><Textarea rows={2} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} data-testid="sl-form-note" /></div>
            {/* Iter 64: Kayıt öncesi belge ekleme */}
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3 space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Paperclip size={13} /> Belgeler (opsiyonel — kayıttan sonra da eklenebilir)
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded cursor-pointer text-xs font-medium">
                  <Upload size={12} /> Dosya Seç (PDF/JPG/PNG · Maks {MAX_SIZE_MB} MB)
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_EXT}
                    className="hidden"
                    data-testid="sl-form-attach-input"
                    onChange={(e) => {
                      const arr = Array.from(e.target.files || []);
                      for (const f of arr) {
                        if (!ACCEPTED_MIME.includes((f.type || "").toLowerCase())) {
                          toast.error(`Kabul edilmeyen tür: ${f.name}`);
                          e.target.value = ""; return;
                        }
                        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
                          toast.error(`Çok büyük: ${f.name}`);
                          e.target.value = ""; return;
                        }
                      }
                      setPendingFiles((prev) => [...prev, ...arr]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">{pendingFiles.length} dosya seçildi</span>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1 text-xs" data-testid="sl-form-attach-list">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-slate-200">
                      {f.type === "application/pdf" ? <FileText size={12} className="text-red-600" /> : <ImageIcon size={12} className="text-blue-600" />}
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-slate-400 tabular-nums">{humanSize(f.size)}</span>
                      <button type="button" className="text-red-500 hover:text-red-700" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Vazgeç</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submit} disabled={busy || !form.personnel_id} data-testid="sl-form-submit">{busy ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttachmentsDialog
        row={attachRow}
        open={!!attachRow}
        onOpenChange={(v) => !v && setAttachRow(null)}
        onCountChange={updateAttachmentCount}
      />

      <GebelikTimelineDialog
        row={timelineRow}
        open={!!timelineRow}
        onOpenChange={(v) => !v && setTimelineRow(null)}
        onSaved={load}
      />
    </div>
  );
}
