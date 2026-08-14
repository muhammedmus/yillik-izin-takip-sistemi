import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TrDatePicker } from "@/components/TrDatePicker";
import { AutoCombobox } from "@/components/AutoCombobox";

const Row = ({ children }) => <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-slate-500">{label}</Label>
    {children}
  </div>
);

const empty = {
  sicil_no: "", ad_soyad: "", tc_no: "", ise_giris: "", isten_cikis: "",
  dogum_tarihi: "", departman: "", gorev: "", sirket: "", aktif: true,
  onceki_kidem_yil: 0, telefon: "", email: "", aciklama: "",
};

export default function PersonnelForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [facets, setFacets] = useState({ departments: [], companies: [], roles: [] });

  useEffect(() => {
    // Autocomplete cache — bir kez yükle (aktif+pasif tüm değerler önerilsin)
    api.get("/personnel/facets", { params: { include_inactive: true } })
      .then(({ data }) => setFacets({
        departments: data.departments || [],
        companies: data.companies || [],
        roles: data.roles || [],
      }))
      .catch(() => { /* sessiz — autocomplete opsiyonel */ });
    if (id) {
      api.get(`/personnel/${id}`).then(({ data }) => {
        setF({
          ...empty,
          ...data,
          isten_cikis: data.isten_cikis || "",
          dogum_tarihi: data.dogum_tarihi || "",
        });
      }).catch((e) => toast.error(formatApiError(e)));
    }
  }, [id]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.ise_giris) return toast.error("İşe Giriş Tarihi zorunlu");
    setSaving(true);
    const payload = { ...f, isten_cikis: f.isten_cikis || null, dogum_tarihi: f.dogum_tarihi || null };
    try {
      if (id) {
        await api.put(`/personnel/${id}`, payload);
        toast.success("Personel güncellendi");
      } else {
        await api.post("/personnel", payload);
        toast.success("Personel eklendi");
      }
      nav("/personel");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl" data-testid="personnel-form">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {id ? "Personel Düzenle" : "Yeni Personel"}
        </h1>
      </div>

      <Card className="p-6 border border-slate-200 shadow-sm space-y-5">
        <Row>
          <Field label="Sicil Numarası *">
            <Input required value={f.sicil_no} onChange={(e) => set("sicil_no", e.target.value)} data-testid="sicil-input" />
          </Field>
          <Field label="Ad Soyad *">
            <Input required value={f.ad_soyad} onChange={(e) => set("ad_soyad", e.target.value)} data-testid="adsoyad-input" />
          </Field>
        </Row>
        <Row>
          <Field label="T.C. Kimlik No">
            <Input value={f.tc_no} onChange={(e) => set("tc_no", e.target.value)} maxLength={11} />
          </Field>
          <Field label="Telefon">
            <Input value={f.telefon} onChange={(e) => set("telefon", e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="E-posta">
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)}
              placeholder="Personel bildirim adresi" data-testid="email-input" />
          </Field>
          <Field label="Önceki Kıdem (tam yıl)">
            <Input type="number" step="1" min="0" value={f.onceki_kidem_yil}
              onChange={(e) => set("onceki_kidem_yil", parseInt(e.target.value) || 0)} data-testid="prev-seniority-input" />
          </Field>
        </Row>
        <Row>
          <Field label="İşe Giriş Tarihi *">
            <TrDatePicker value={f.ise_giris} onChange={(v) => set("ise_giris", v)} testId="hire-date-input"
              clearable={false} fromYear={1950} />
          </Field>
          <Field label="İşten Çıkış Tarihi">
            <TrDatePicker value={f.isten_cikis} onChange={(v) => set("isten_cikis", v)} testId="exit-date-input" />
          </Field>
        </Row>
        <Row>
          <Field label="Doğum Tarihi">
            <TrDatePicker value={f.dogum_tarihi} onChange={(v) => set("dogum_tarihi", v)} testId="birth-date-input"
              fromYear={1930} toYear={new Date().getFullYear()} />
          </Field>
          <Field label="Departman">
            <AutoCombobox value={f.departman} onChange={(v) => set("departman", v)}
              suggestions={facets.departments} placeholder="Örn. İNSAN KAYNAKLARI"
              testId="departman-input" />
          </Field>
        </Row>
        <Row>
          <Field label="Görev">
            <AutoCombobox value={f.gorev} onChange={(v) => set("gorev", v)}
              suggestions={facets.roles} placeholder="Örn. Uzman"
              testId="gorev-input" />
          </Field>
          <Field label="Şirket">
            <AutoCombobox value={f.sirket} onChange={(v) => set("sirket", v)}
              suggestions={facets.companies} placeholder="Şirket"
              testId="sirket-input" />
          </Field>
        </Row>
        <Row>
          <Field label="Durum">
            <div className="flex items-center gap-3 h-10">
              <Switch checked={f.aktif} onCheckedChange={(v) => set("aktif", v)} data-testid="aktif-switch" />
              <span className="text-sm">{f.aktif ? "Aktif" : "İşten Ayrıldı"}</span>
            </div>
          </Field>
          <div />
        </Row>
        <Field label="Açıklama">
          <Textarea rows={3} value={f.aciklama} onChange={(e) => set("aciklama", e.target.value)} />
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700" data-testid="save-personnel-btn">
          {saving ? "Kaydediliyor..." : id ? "Güncelle" : "Kaydet"}
        </Button>
        <Button type="button" variant="outline" onClick={() => nav(-1)}>Vazgeç</Button>
      </div>
    </form>
  );
}
