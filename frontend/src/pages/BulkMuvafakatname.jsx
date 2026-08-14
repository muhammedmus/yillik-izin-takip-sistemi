import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";

/**
 * Toplu Muvafakatname — eski Muvafakatname.jsx şablonunun BİREBİR aynısı, her
 * seçilen izin kaydı için ayrı A4 sayfa. Şablona (metin, tasarım, hesaplama)
 * DOKUNULMAZ.
 * Query params:
 *   ids=leave1,leave2,...
 *   auto=print|pdf (opsiyonel — otomatik yazdırma diyaloğu tetikler)
 */

function toTr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}
function fmtDays(n) {
  if (n === null || n === undefined || n === "") return "—";
  return `${String(n).replace(".", ",")} günlük`;
}

/** Eski Muvafakatname.jsx şablonunun BİREBİR aynısı. Değiştirme. */
function MuvafakatnameSheet({ leaf }) {
  const p = leaf.personnel || {};
  const L = leaf.leave || {};
  const bal = leaf.balance || {};
  const nextEnt = bal?.next_entitlement?.date;
  return (
    <div
      className="document-preview bg-white p-16 print-page shadow-md mx-auto mb-6"
      style={{
        fontFamily: "'Times New Roman', Georgia, serif",
        fontSize: "12pt",
        lineHeight: 1.8,
        maxWidth: "800px",
        pageBreakAfter: "always",
      }}
      data-testid={`muvafakatname-body-${p?.sicil_no || L?.id}`}
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
  );
}

export default function BulkMuvafakatname() {
  const [sp] = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").filter(Boolean);
  const auto = sp.get("auto"); // "print" | "pdf" | null
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!ids.length) { setErr("Kayıt seçilmedi"); setRows([]); return; }
    api.get("/leaves/consent-batch", { params: { ids: ids.join(",") } })
      .then(({ data }) => setRows(data.items || []))
      .catch((e) => { setErr(e?.response?.data?.detail || "Yüklenemedi"); setRows([]); });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (rows && rows.length && (auto === "print" || auto === "pdf")) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [rows, auto]);

  const doPrint = () => window.print();

  if (rows === null) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Muvafakatnameler yükleniyor...</div>;
  }

  return (
    <DocumentPreviewShell
      title={ids.length === 1 ? "Muvafakatname" : "Toplu Muvafakatname"}
      subtitle={`${rows.length} kayıt · Her biri ayrı A4 sayfa`}
      onClose={() => window.close()}
      onPrint={doPrint}
      onPdf={doPrint}
    >
      <div className="w-full max-w-4xl">
        {err && (
          <div className="p-3 mb-4 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">{err}</div>
        )}
        {rows.length === 0 && !err && (
          <div className="p-6 text-center text-slate-400 bg-white rounded shadow-sm">Kayıt bulunamadı.</div>
        )}
        {rows.map((r, i) => <MuvafakatnameSheet key={r.leave?.id || i} leaf={r} />)}
      </div>
    </DocumentPreviewShell>
  );
}
