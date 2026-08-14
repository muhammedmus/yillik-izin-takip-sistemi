import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, API_BASE } from "@/lib/api";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/**
 * İzin Talep Formu — Ön İzleme (A4 Portrait, fit-to-page)
 *
 * Kullanıcı personel detayındaki yazıcı ikonuna basınca DOĞRUDAN bu ön izleme
 * açılır. Backend'den bearer token ile PDF blob'u çekilir, A4 dikey oranını
 * koruyan bir iframe içinde gösterilir. Fit-to-page için PDF viewer'a
 * `#view=Fit` hint'i verilir; kullanıcı gerekirse zoom yapabilir.
 * Yazdırma iframe.print() ile orijinal A4 boyutunda gerçekleşir.
 */
export default function LeavePrint() {
  const { id } = useParams();
  const nav = useNavigate();
  const [meta, setMeta] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    api.get(`/leaves/${id}/print`)
      .then(({ data }) => setMeta(data))
      .catch(() => setError("İzin kaydı bulunamadı"));

    let objectUrl = "";
    fetch(`${API_BASE}/leaves/${id}/talep-formu.pdf`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : r.text().then((t) => Promise.reject(new Error(t || "İzin talep formu ön izlemesi oluşturulamadı")))))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        // #view=Fit → PDF viewer'ı fit-to-page moduna al (Chrome/Edge/Firefox destekler)
        setPdfUrl(`${objectUrl}#view=Fit&toolbar=1&navpanes=0`);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "İzin talep formu ön izlemesi oluşturulamadı");
        setLoading(false);
      });

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doDownload = async (kind) => {
    try {
      const r = await fetch(`${API_BASE}/leaves/${id}/talep-formu.${kind}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("İndirilemedi");
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const name = m ? m[1] : `izin-talep-formu.${kind}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    } catch (e) {
      toast.error(e.message || "İndirilemedi");
    }
  };

  const printPreview = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (_) { /* fall through */ }
    }
    window.print();
  };

  const p = meta?.personnel;
  const L = meta?.leave;
  const subtitle = p && L
    ? `${p.ad_soyad} · ${p.sicil_no} — ${toTr(L.start_date)} → ${toTr(L.end_date)} · ${L.days} gün`
    : loading ? "Yükleniyor..." : "İzin Talep Formu";

  // A4 Portrait aspect (210 x 297 mm) — height fills viewport below toolbar,
  // width derived from aspect-ratio, clamped by container.
  const iframeStyle = {
    height: "calc(100vh - 110px)",
    aspectRatio: "210 / 297",
    maxWidth: "100%",
    border: "1px solid #e2e8f0",
    background: "#fff",
  };

  return (
    <DocumentPreviewShell
      title="Yıllık Ücretli İzin Talep ve Onay Formu"
      subtitle={subtitle}
      onClose={() => (p?.id ? nav(`/personel/${p.id}`) : nav(-1))}
      onPrint={printPreview}
      onPdf={() => doDownload("pdf")}
    >
      {loading && (
        <div className="bg-white rounded shadow-sm p-12 text-center text-slate-500" data-testid="izin-form-loading">
          <div className="animate-pulse">İzin talep formu ön izlemesi hazırlanıyor...</div>
        </div>
      )}
      {!loading && error && (
        <div className="bg-white rounded shadow-sm p-8 border border-red-200 text-red-700" data-testid="izin-form-error">
          <div className="font-semibold mb-1">İzin talep formu ön izlemesi oluşturulamadı.</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}
      {!loading && !error && pdfUrl && (
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          title="İzin Talep Formu Ön İzleme"
          className="document-preview shadow-md"
          style={iframeStyle}
          data-testid="izin-form-iframe"
        />
      )}
    </DocumentPreviewShell>
  );
}
