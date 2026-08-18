import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Printer,
  Building2,
  ArrowLeft,
  Eye,
  BarChart3,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";

import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function toTr(iso) {
  if (!iso) return "—";

  const [y, m, d] = iso.slice(0, 10).split("-");

  if (!y || !m || !d) return iso;

  return `${d}.${m}.${y}`;
}

function fmtNum(n) {
  return String(n ?? 0).replace(".", ",");
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function Reports() {
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/reports/charts")
      .then(({ data }) => {
        if (!cancelled) setCharts(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="sticky-page-title">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Raporlar
        </h1>

        <p className="text-sm text-slate-500 mt-1">
          Grafikler ve Departman Bazlı Rapor. Personel bazlı rapor için ilgili
          personel kartını açın.
        </p>
      </div>

      <MenuGrid charts={charts} />
    </div>
  );
}

function MenuGrid({ charts }) {
  const [mode, setMode] = useState(null);

  if (mode === "departman") {
    return <DepartmanReport onBack={() => setMode(null)} />;
  }

  return (
    <>
      <Card
        className="p-6 border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow max-w-2xl"
        onClick={() => setMode("departman")}
        data-testid="report-departman-card"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-md bg-emerald-50 text-emerald-700 grid place-items-center">
            <Building2 size={22} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Departman Bazlı İzin Raporu
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Bir departman seçin; personel listesini ve izin özetini önizleyip
              yazdırın.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-blue-600" />

            <h3 className="font-semibold">
              Son 12 Ay İzin Kullanım Trendi
            </h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={charts?.monthly_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis dataKey="month" tick={{ fontSize: 11 }} />

                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#1D4ED8" }}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#DC2626" }}
                  allowDecimals={false}
                />

                <Tooltip formatter={(v, n) => [v, n]} />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="days"
                  name="Kullanılan Gün Sayısı"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="people"
                  name="Kullanan Kişi Sayısı"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#1D4ED8]"></span>
              Kullanılan Gün
            </span>

            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#DC2626] border-t border-dashed"></span>
              Kullanan Kişi
            </span>
          </div>
        </Card>

        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-emerald-600" />

            <h3 className="font-semibold">Departman Personel Dağılımı</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={charts?.departments || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis dataKey="name" tick={{ fontSize: 11 }} />

                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />

                <Tooltip />

                <Bar
                  dataKey="value"
                  name="Kişi"
                  fill="#16A34A"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}

function DepartmanReport({ onBack }) {
  const [personnel, setPersonnel] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dep, setDep] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortBy, setSortBy] = useState("sicil_no");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/personnel", {
        params: {
          aktif: true,
          limit: 5000,
        },
      })
      .then(({ data }) => {
        setPersonnel(data);

        const norm = new Map();

        data.forEach((p) => {
          if (p.aktif === false) return;

          const raw = (p.departman || "").trim();

          if (!raw) return;

          const key = raw.toLocaleUpperCase("tr-TR");

          if (!norm.has(key)) {
            norm.set(key, raw);
          }
        });

        setDepartments(
          Array.from(norm.values()).sort((a, b) =>
            a.localeCompare(b, "tr")
          )
        );
      })
      .catch(() => {});
  }, []);

  const build = async () => {
    if (!dep) {
      return toast.error("Departman seçin");
    }

    setBusy(true);

    try {
      const isAll = dep === "__ALL__";
      const depKey = isAll ? "" : dep.toLocaleUpperCase("tr-TR");

      const persInDep = isAll
        ? personnel
        : personnel.filter(
            (p) =>
              (p.departman || "").toLocaleUpperCase("tr-TR") === depKey
          );

      const filteredPers = onlyActive
        ? persInDep.filter((p) => p.aktif)
        : persInDep;

      const rows = [];

      for (const p of filteredPers) {
        try {
          const { data: bal } = await api.get(
            `/personnel/${p.id}/balance`
          );

          rows.push({
            personnel: p,
            balance: bal.balance,
          });
        } catch (e) {
          toast.error(formatApiError(e));
        }
      }

      const cmp =
        {
          sicil_no: (a, b) =>
            String(a.personnel.sicil_no || "").localeCompare(
              String(b.personnel.sicil_no || ""),
              "tr",
              { numeric: true }
            ),

          ad_soyad: (a, b) =>
            String(a.personnel.ad_soyad || "").localeCompare(
              String(b.personnel.ad_soyad || ""),
              "tr"
            ),

          remaining: (a, b) =>
            Number(a.balance.remaining || 0) -
            Number(b.balance.remaining || 0),
        }[sortBy] || (() => 0);

      rows.sort(cmp);

      setPreview({
        department: dep,
        rows,
      });
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    return (
      <PreviewDepartman
        data={preview}
        onBack={() => setPreview(null)}
      />
    );
  }

  return (
    <Card className="p-6 border border-slate-200 shadow-sm max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} className="mr-1" />
          Geri
        </Button>

        <h2 className="text-lg font-semibold">
          Departman Bazlı İzin Raporu
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Departman</Label>

          <Select value={dep} onValueChange={setDep}>
            <SelectTrigger data-testid="rd-select">
              <SelectValue placeholder="Departman seçin..." />
            </SelectTrigger>

            <SelectContent className="max-h-72">
              <SelectItem value="__ALL__">Tümü</SelectItem>

              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Sıralama</Label>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger data-testid="rd-sort">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="sicil_no">
                Sicil No (artan)
              </SelectItem>

              <SelectItem value="ad_soyad">
                Ad Soyad (A→Z)
              </SelectItem>

              <SelectItem value="remaining">
                Kalan İzin (az → çok)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            id="only-active"
            data-testid="rd-only-active"
          />

          <Label
            htmlFor="only-active"
            className="cursor-pointer"
          >
            Yalnızca aktif personel
          </Label>
        </div>

        <Button
          onClick={build}
          disabled={!dep || busy}
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="rd-preview-btn"
        >
          <Eye size={16} className="mr-1" />

          {busy ? "Hazırlanıyor..." : "Raporu Ön İzle"}
        </Button>
      </div>
    </Card>
  );
}

function downloadReportExcel(data) {
  try {
    const { department, rows } = data;

    const isAll = department === "__ALL__";

    const title = isAll
      ? "TÜM PERSONEL İZİN RAPORU"
      : `${department} İZİN RAPORU`;

    const reportDate = toTr(new Date().toISOString());

    const excelData = [
      [title],
      [
        isAll
          ? `Aktif Personel: ${rows.length}   -   Rapor Tarihi: ${reportDate}`
          : `Departman: ${department}   -   Aktif Personel: ${rows.length}   -   Rapor Tarihi: ${reportDate}`,
      ],
      [],
      [
        "Sicil",
        "Ad Soyad",
        "İşe Giriş",
        "Hak Edilen",
        "Kullanılan",
        "Kalan",
      ],
      ...rows.map((r) => [
        String(r.personnel.sicil_no ?? ""),
        String(r.personnel.ad_soyad ?? ""),
        toTr(r.personnel.ise_giris),
        numberValue(r.balance.entitled_total),
        numberValue(r.balance.used_total),
        numberValue(r.balance.remaining),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    worksheet["!merges"] = [
      XLSX.utils.decode_range("A1:F1"),
      XLSX.utils.decode_range("A2:F2"),
    ];

    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 32 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    if (rows.length > 0) {
      worksheet["!autofilter"] = {
        ref: `A4:F${rows.length + 4}`,
      };
    }

    const numericColumns = ["D", "E", "F"];

    numericColumns.forEach((col) => {
      for (let row = 5; row <= rows.length + 4; row += 1) {
        const cell = worksheet[`${col}${row}`];

        if (cell) {
          cell.t = "n";
          cell.z = "0.00";
        }
      }
    });

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "İzin Raporu"
    );

    workbook.Props = {
      Title: title,
      Subject: "Personel İzin Raporu",
      Author: "Personel İzin Takip Sistemi",
      CreatedDate: new Date(),
    };

    const safeName = isAll
      ? "Tum_Personel_Izin_Raporu"
      : `${department}_Izin_Raporu`.replace(
          /[\\/:*?"<>|]+/g,
          "_"
        );

    const fileName =
      `${safeName}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, fileName, {
      bookType: "xlsx",
      compression: true,
    });

    toast.success("Excel raporu oluşturuldu.");
  } catch (error) {
    console.error("Excel oluşturma hatası:", error);

    toast.error(
      "Excel raporu oluşturulurken hata oluştu."
    );
  }
}

function PreviewDepartman({ data, onBack }) {
  const { department, rows } = data;

  const isAll = department === "__ALL__";

  const activeCount = rows.length;

  const reportDate = toTr(new Date().toISOString());

  const reportTitle = isAll
    ? "TÜM PERSONEL İZİN RAPORU"
    : "DEPARTMAN BAZLI İZİN RAPORU";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="rd-change"
        >
          <ArrowLeft size={14} className="mr-1" />
          Rapor Seçimini Değiştir
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => downloadReportExcel(data)}
            variant="outline"
          >
            <Download size={14} className="mr-1" />
            Excel İndir
          </Button>

          <Button
            onClick={() => window.print()}
            variant="outline"
          >
            <Printer size={14} className="mr-1" />
            Yazdır
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-8 max-w-[1100px] mx-auto print-page">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-5">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            MERKOTEKS TEKSTİL SAN. VE TİC. A.Ş.
          </div>

          <h2 className="text-xl font-bold mt-1">
            {reportTitle}
          </h2>

          <div
            className="text-sm font-semibold mt-2 text-slate-800"
            data-testid="rd-subtitle"
          >
            {!isAll && (
              <>
                <span className="uppercase">
                  {department}
                </span>

                <span className="text-slate-400 mx-1">
                  —
                </span>
              </>
            )}

            Aktif Personel: <b>{activeCount}</b>

            <span className="text-slate-400 mx-1">
              —
            </span>

            Rapor Tarihi: {reportDate}
          </div>
        </div>

        <table className="w-full text-xs border border-slate-800 border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-800 px-2 py-1.5">
                Sicil
              </th>

              <th className="border border-slate-800 px-2 py-1.5 text-left">
                Ad Soyad
              </th>

              <th className="border border-slate-800 px-2 py-1.5">
                İşe Giriş
              </th>

              <th className="border border-slate-800 px-2 py-1.5">
                Hak Edilen
              </th>

              <th className="border border-slate-800 px-2 py-1.5">
                Kullanılan
              </th>

              <th className="border border-slate-800 px-2 py-1.5">
                Kalan
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.personnel.id}
                className="odd:bg-slate-50"
              >
                <td className="border border-slate-400 px-2 py-1 text-center font-mono">
                  {r.personnel.sicil_no}
                </td>

                <td className="border border-slate-400 px-2 py-1 font-medium">
                  <Link
                    to={`/personel/${r.personnel.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {r.personnel.ad_soyad}
                  </Link>
                </td>

                <td className="border border-slate-400 px-2 py-1 text-center font-mono">
                  {toTr(r.personnel.ise_giris)}
                </td>

                <td className="border border-slate-400 px-2 py-1 text-center">
                  {fmtNum(r.balance.entitled_total)}
                </td>

                <td className="border border-slate-400 px-2 py-1 text-center">
                  {fmtNum(r.balance.used_total)}
                </td>

                <td
                  className={`border border-slate-400 px-2 py-1 text-center font-semibold ${
                    Number(r.balance.remaining) < 0
                      ? "text-red-600"
                      : Number(r.balance.remaining) < 10
                        ? "text-amber-600"
                        : ""
                  }`}
                >
                  {fmtNum(r.balance.remaining)}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="border border-slate-400 px-2 py-4 text-center text-slate-500"
                >
                  Personel bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}