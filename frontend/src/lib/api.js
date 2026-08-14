import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Bearer token fallback (in case cookies blocked)
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function formatApiError(err) {
  // 1) Ağ hatası (sunucuya ulaşılamadı, CORS preflight fail, container uyuyor vb.)
  if (err && !err.response) {
    // Kullanılan API URL'ini tanı için ekle — kullanıcı yanlış/eski adrese
    // gidiyorsa (bookmark, cache) hemen fark eder.
    const base = API_BASE || "(REACT_APP_BACKEND_URL tanımsız)";
    if (err.code === "ERR_NETWORK" || /network error/i.test(err.message || "")) {
      return `Sunucuya bağlanılamadı. (API: ${base}) — Sayfayı Ctrl+Shift+R ile yenileyin; sorun sürerse yönetici ile iletişime geçin.`;
    }
    if (err.code === "ECONNABORTED" || /timeout/i.test(err.message || "")) {
      return "Sunucu zaman aşımına uğradı. Lütfen tekrar deneyin.";
    }
  }
  // 2) HTTP kodlarına göre kullanıcı dostu mesaj
  const status = err?.response?.status;
  const d = err?.response?.data?.detail;
  let detailText = "";
  if (typeof d === "string") detailText = d;
  else if (Array.isArray(d)) detailText = d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  else if (d) detailText = String(d);

  switch (status) {
    case 400: return detailText || "Geçersiz istek.";
    case 401: return detailText || "Kullanıcı adı veya şifre hatalı.";
    case 403: return detailText || "Bu işlem için yetkiniz yok.";
    case 404: return detailText || "Kayıt bulunamadı.";
    case 409: return detailText || "Çakışma: bu kayıt zaten var.";
    case 412: return detailText || "Kayıt bu sırada başka biri tarafından güncellendi.";
    case 429: return "Çok fazla başarısız giriş denemesi. Lütfen kısa süre sonra tekrar deneyin.";
    case 500: return "Sunucuda bir hata oluştu. Lütfen yönetici ile iletişime geçin.";
    case 502:
    case 503: return "Sunucu şu anda kullanılamıyor. Kısa süre sonra tekrar deneyin.";
    default:
      if (detailText) return detailText;
      return err?.message || "Bir hata oluştu";
  }
}
