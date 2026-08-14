import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, API_BASE } from "@/lib/api";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtDays(n) {
  if (n === null || n === undefined || n === "") return "—";
  return `${String(n).replace(".", ",")} günlük`;
}
async function download(url, filename) {
  const t = localStorage.getItem("token");
  const r = await fetch(url, { credentials: "include", headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!r.ok) throw new Error("İndirilemedi");
  const blob = await r.blob();
  const cd = r.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const name = filename || (m ? m[1] : "muvafakatname");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

export default function Muvafakatname() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const track = sp.get("track") === "1";
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get(`/leaves/${id}/print`)
      .then(({ data }) => setD(data))
      .catch(() => toast.error("Muvafakatname ön izlemesi oluşturulamadı"));
  }, [id]);

  if (!d) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">
        Muvafakatname yükleniyor...
      </div>
    );
  }

  const p = d.personnel;
  const L = d.leave;
  const bal = d.balance;
  const nextEnt = bal?.next_entitlement?.date;

  const doDownload = (kind) => {
    // Muvafakatname için Excel/PDF endpoint henüz backendde yok — HTML print/PDF-save fallback
    if (kind === "pdf") {
      // Print → tarayıcı "PDF olarak kaydet" seçeneği ile PDF üretir
      window.print();
      return;
    }
    if (kind === "xlsx") {
      // Excel endpointi eklenene kadar bilgilendirici toast
      download(`${API_BASE}/leaves/${id}/talep-formu.xlsx`, `muvafakatname-${p?.sicil_no}.xlsx`)
        .catch((e) => toast.error(e.message || "İndirilemedi"));
    }
  };

  const doPrint = async () => {
    // Yazdır butonu — takip modu aktifse önce backend'e mark-printed at.
    if (track) {
      try {
        await api.post(`/leaves/${id}/consent/mark-printed`);
      } catch (_) { /* sessiz — yazdırmayı bloklama */ }
    }
    window.print();
  };

  return (
    <DocumentPreviewShell
      title="Muvafakatname"
      subtitle={`${p?.ad_soyad || "—"} · ${p?.sicil_no || "—"}`}
      onClose={() => (track ? window.close() : (p?.id ? nav(`/personel/${p.id}`) : nav(-1)))}
      onPrint={doPrint}
      onPdf={() => doDownload("pdf")}
    >
      <div
        className="document-preview bg-white p-16 print-page shadow-md mx-auto"
        style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "12pt", lineHeight: 1.8, maxWidth: "800px" }}
        data-testid="muvafakatname-body"
      >
        <div className="text-center mb-14">
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ letterSpacing: "0.1em" }}>MUVAFAKATNAME</h1>
        </div>

        <p className="text-justify mb-6" style={{ textIndent: "3em" }}>
          MERKOTEKS TEKSTİL SAN. VE TİC. A.Ş. unvanlı işyerinde{" "}
          <b>{p?.tc_no || "—"}</b> T.C. Kimlik numarası ile{" "}
          <b>{toTr(p?.ise_giris)}</b> tarihinden bu yana{" "}
          <b>{p?.departman || "—"}</b> departmanında çalışmaktayım.
        </p>

        <p className="text-justify mb-6" style={{ textIndent: "3em" }}>
          İşverenlikten henüz yıllık ücretli izne hak kazanmamama rağmen{" "}
          <b>{toTr(L.start_date)}</b> tarihinden itibaren{" "}
          <b>{fmtDays(L.days)}</b> yıllık izin talep etmekteyim.
        </p>

        <p className="text-justify mb-20" style={{ textIndent: "3em" }}>
          Yıllık ücretli izne hak kazanacağım <b>{toTr(nextEnt)}</b>{" "}
          tarihinden önce işyerinden ayrılmam söz konusu olursa,
          hak etmeden kullandığım <b>{fmtDays(L.days)}</b> izne
          ait ücretin işten ayrılış sürecimde hak etmiş olduğum son ücretimden
          düşülmesine onay veriyorum.
        </p>

        <div className="mt-24 space-y-6">
          <div>ADI SOYADI : <b>{p?.ad_soyad || "—"}</b></div>
          <div>İMZA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
        </div>
      </div>
    </DocumentPreviewShell>
  );
}
