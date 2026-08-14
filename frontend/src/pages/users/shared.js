// Users modülü ortak sabitler ve yardımcılar
import { Badge } from "@/components/ui/badge";

export const roleLabel = { admin: "Yönetici", hr: "İnsan Kaynakları", viewer: "Sadece Rapor" };

export const moduleLabel = {
  auth: "Kimlik Doğrulama",
  users: "Kullanıcılar",
  personnel: "Personel",
  leaves: "İzinler",
  holidays: "Tatiller",
  reports: "Raporlar",
};

export const actionLabel = {
  create: "Oluştur", update: "Güncelle", delete: "Sil",
  terminate: "İşten Ayrılış", reactivate: "Aktife Al",
  bulk_create: "Toplu Oluşturma",
  reset_password: "Şifre Sıfırla",
  activate: "Aktifleştir", deactivate: "Pasifleştir",
  login_success: "Başarılı Giriş", login_failed: "Başarısız Giriş", logout: "Çıkış",
};

export function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function toDateTime(iso) {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = dt.getFullYear();
    const H = String(dt.getHours()).padStart(2, "0");
    const M = String(dt.getMinutes()).padStart(2, "0");
    return `${d}.${m}.${y} ${H}:${M}`;
  } catch { return iso; }
}

export function roleBadge(role) {
  const tones = {
    admin: "bg-blue-50 text-blue-700 border-blue-200",
    hr: "bg-emerald-50 text-emerald-700 border-emerald-200",
    viewer: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge className={`${tones[role] || tones.viewer} border`}>{roleLabel[role] || role}</Badge>;
}

export function formatVal(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
