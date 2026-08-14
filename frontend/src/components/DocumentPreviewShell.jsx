import { Printer, FileSpreadsheet, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DocumentPreviewShell — Muvafakatname, İzin Talep Formu, Cetvel gibi tüm
 * belge önizlemeleri için ortak üst-çubuk. Yazdırma sırasında yalnızca .document-preview
 * içeriği yazdırılır (index.css @media print kuralları).
 *
 * Body alanı tam genişlikte çalışır; child (genelde iframe) A4 aspect-ratio
 * ile fit-to-page olarak yerleştirilir.
 */
export function DocumentPreviewShell({
  title,
  subtitle,
  onClose,
  onPrint,
  onPdf,
  onXlsx,
  extras,
  children,
}) {
  const doPrint = () => (onPrint ? onPrint() : window.print());
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm no-print" data-testid="preview-toolbar">
        <div className="w-full flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Belge Önizleme</div>
            <h1 className="text-base font-bold text-slate-900 truncate" data-testid="doc-title">{title}</h1>
            {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {extras}
            <Button onClick={doPrint} className="bg-blue-600 hover:bg-blue-700" data-testid="preview-print-btn">
              <Printer size={14} className="mr-1" /> Yazdır
            </Button>
            {onPdf && (
              <Button variant="outline" onClick={onPdf} data-testid="preview-pdf-btn">
                <FileText size={14} className="mr-1 text-red-600" /> PDF İndir
              </Button>
            )}
            {onXlsx && (
              <Button variant="outline" onClick={onXlsx} className="border-emerald-200 hover:bg-emerald-50" data-testid="preview-xlsx-btn">
                <FileSpreadsheet size={14} className="mr-1 text-emerald-700" /> Excel İndir
              </Button>
            )}
            <Button variant="ghost" onClick={onClose || (() => window.close())} data-testid="preview-close-btn">
              <X size={14} className="mr-1" /> Kapat
            </Button>
          </div>
        </div>
      </div>
      <div
        className="flex-1 flex justify-center items-start w-full px-3 py-4 md:px-6"
        style={{ minHeight: "calc(100vh - 74px)" }}
      >
        {children}
      </div>
    </div>
  );
}

export default DocumentPreviewShell;
