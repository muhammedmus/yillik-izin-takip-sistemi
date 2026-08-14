import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, API_BASE } from "@/lib/api";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";

/**
 * İzin Cetveli — Ön İzleme (A4 Landscape, fit-to-page)
 */
export default function IzinCetveli() {
  const { id } = useParams();
  const nav = useNavigate();
  const [meta, setMeta] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const iframeRef = useRef(null);
  const token = localStorage.getItem("token");

  const doMarkGenerated = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/personnel/${id}/cetvel-mark`);
      setGeneratedAt(data.cetvel_generated_at);
      toast.success("İzin cetveli oluşturuldu olarak işaretlendi");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İşaretleme başarısız");
    } finally {
      setBusy(false);
    }
  };

  const doUnmark = async () => {
    if (!window.confirm("Bu personel için 'İzin Cetveli Oluşturuldu' işareti iptal edilecek. Devam edilsin mi?")) return;
    setBusy(true);
    try {
      await api.post(`/personnel/${id}/cetvel-unmark`);
      setGeneratedAt(null);
      toast.success("İzin cetveli iptal edildi");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İptal başarısız");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    api.get(`/personnel/${id}/balance`).then(({ data }) => {
      setMeta(data);
      setGeneratedAt(data?.personnel?.cetvel_generated_at || null);
    }).catch(() => setError("Personel bulunamadı"));
    let objectUrl = "";
    fetch(`${API_BASE}/personnel/${id}/cetveli.pdf`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : r.text().then((t) => Promise.reject(new Error(t || "İzin cetveli ön izlemesi oluşturulamadı")))))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(`${objectUrl}#view=Fit&toolbar=1&navpanes=0`);
        setLoading(false);
      })
      .catch((e) => { setError(e.message || "İzin cetveli ön izlemesi oluşturulamadı"); setLoading(false); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doDownload = async (kind) => {
    try {
      const r = await fetch(`${API_BASE}/personnel/${id}/cetveli.${kind}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("İndirilemedi");
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const name = m ? m[1] : `izin-cetveli.${kind}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
    } catch (e) { toast.error(e.message || "İndirilemedi"); }
  };

  const printPreview = () => {
    if (iframeRef.current?.contentWindow) {
      try { iframeRef.current.contentWindow.focus(); iframeRef.current.contentWindow.print(); return; }
      catch (_) { /* fall through */ }
    }
    window.print();
  };

  const p = meta?.personnel;
  const bal = meta?.balance;
  const subtitle = p
    ? `${p.ad_soyad} · ${p.sicil_no} — Kıdem: ${bal?.total_seniority || 0} yıl · Hak/Kul/Kalan: ${bal?.entitled_total || 0}/${bal?.used_total || 0}/${bal?.remaining || 0}`
    : loading ? "Yükleniyor..." : "İzin Cetveli";

  // A4 Landscape (297 x 210 mm) — cetveli her zaman yatay gösterilir.
  const iframeStyle = {
    height: "calc(100vh - 110px)",
    aspectRatio: "297 / 210",
    maxWidth: "100%",
    border: "1px solid #e2e8f0",
    background: "#fff",
  };

  return (
    <DocumentPreviewShell
      title="Yıllık Ücretli İzin Cetveli"
      subtitle={subtitle}
      onClose={() => (p?.id ? nav(`/personel/${p.id}`) : nav(-1))}
      onPrint={printPreview}
      onPdf={() => doDownload("pdf")}
      onXlsx={() => doDownload("xlsx")}
      extras={
        <div className="flex gap-2">
          <Button
            onClick={doMarkGenerated}
            disabled={busy || loading || !!error}
            className={generatedAt
              ? "bg-emerald-700 hover:bg-emerald-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"}
            data-testid="cetvel-mark-btn"
            title="Bu personel için İzin Cetveli üretildiğini işaretle. Yeni izin eklenene kadar Personel listesinde 'Oluşturuldu' olarak görünür."
          >
            {busy
              ? <><Loader2 size={14} className="mr-1 animate-spin" /> İşleniyor...</>
              : generatedAt
                ? <><CheckCircle2 size={14} className="mr-1" /> Oluşturuldu ✓</>
                : <><CheckCircle2 size={14} className="mr-1" /> İzin Cetveli Oluşturuldu</>}
          </Button>
          {generatedAt && (
            <Button
              onClick={doUnmark}
              disabled={busy || loading || !!error}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
              data-testid="cetvel-unmark-btn"
              title="Bu personel için 'İzin Cetveli Oluşturuldu' işaretini iptal et."
            >
              <XCircle size={14} className="mr-1" /> İzin Cetveli İptal Edildi
            </Button>
          )}
        </div>
      }
    >
      {loading && (
        <div className="bg-white rounded shadow-sm p-12 text-center text-slate-500" data-testid="cetveli-loading">
          <div className="animate-pulse">İzin cetveli ön izlemesi hazırlanıyor...</div>
        </div>
      )}
      {!loading && error && (
        <div className="bg-white rounded shadow-sm p-8 border border-red-200 text-red-700" data-testid="cetveli-error">
          <div className="font-semibold mb-1">İzin cetveli ön izlemesi oluşturulamadı.</div>
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}
      {!loading && !error && pdfUrl && (
        <iframe
          ref={iframeRef}
          src={pdfUrl}
          title="İzin Cetveli Ön İzleme"
          className="document-preview shadow-md"
          style={iframeStyle}
          data-testid="cetveli-iframe"
        />
      )}
    </DocumentPreviewShell>
  );
}
