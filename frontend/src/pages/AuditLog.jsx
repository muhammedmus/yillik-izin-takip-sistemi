import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  History,
  X,
} from "lucide-react";

import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const ROLE_LABELS = {
  admin: "Yönetici",
  hr: "İnsan Kaynakları",
  viewer: "Rapor Kullanıcısı",
};

const MODULE_LABELS = {
  auth: "Giriş / Güvenlik",
  users: "Kullanıcılar",
  personnel: "Personel",
  leaves: "İzinler",
  holidays: "Tatiller",
  reports: "Raporlar",
  special_leave: "Özel İzinler",
  special_leaves: "Özel İzinler",
  audit: "İşlem Geçmişi",
};

const ACTION_LABELS = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  hard_delete: "Kalıcı Silme",
  bulk_create: "Toplu Oluşturma",
  bulk_update: "Toplu Güncelleme",
  bulk_delete: "Toplu Silme",
  terminate: "İşten Ayrılış",
  reactivate: "Aktife Alma",
  activate: "Aktifleştirme",
  deactivate: "Pasifleştirme",
  reset_password: "Şifre Sıfırlama",
  login_success: "Başarılı Giriş",
  login_failed: "Başarısız Giriş",
  logout: "Çıkış",
  export: "Dışa Aktarma",
  wipe_all: "Toplu/Kalıcı Temizleme",
  delete_failed: "Başarısız Silme",
  excel_days_override: "Excel Gün Değeri Kullanımı",
};

function roleLabel(value) {
  return ROLE_LABELS[value] || value || "—";
}

function moduleLabel(value) {
  return MODULE_LABELS[value] || value || "—";
}

function actionLabel(value) {
  return ACTION_LABELS[value] || value || "—";
}

function formatDateTime(value) {
  if (!value) return "—";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value).replace("T", " ").slice(0, 16);
    }

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return String(value).replace("T", " ").slice(0, 19);
  }
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "—";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function buildChangedFields(oldValues, newValues) {
  const oldObj =
    oldValues && typeof oldValues === "object" && !Array.isArray(oldValues)
      ? oldValues
      : {};

  const newObj =
    newValues && typeof newValues === "object" && !Array.isArray(newValues)
      ? newValues
      : {};

  const keys = Array.from(
    new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  );

  return keys.map((key) => ({
    key,
    oldValue: oldObj[key],
    newValue: newObj[key],
  }));
}

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");

  const [page, setPage] = useState(1);

  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [userId, setUserId] = useState("all");
  const [userRole, setUserRole] = useState("all");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [success, setSuccess] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const params = useMemo(() => {
    const result = {
      limit: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    };

    if (userId !== "all") result.user_id = userId;
    if (userRole !== "all") result.user_role = userRole;
    if (module !== "all") result.module = module;
    if (action !== "all") result.action = action;
    if (success !== "all") result.success = success === "true";
    if (start) result.start = start;
    if (end) result.end = end;
    if (appliedSearch.trim()) result.q = appliedSearch.trim();

    return result;
  }, [
    page,
    userId,
    userRole,
    module,
    action,
    success,
    start,
    end,
    appliedSearch,
  ]);

  const exportParams = useMemo(() => {
    const result = { ...params };
    delete result.skip;
    result.limit = 5000;
    return result;
  }, [params]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Kullanıcı listesi alınamadı:", error);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/audit-log", { params });

      setItems(response.data?.items || []);
      setTotal(Number(response.data?.total || 0));
    } catch (error) {
      toast.error(formatApiError(error));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(searchText);
  };

  const clearFilters = () => {
    setSearchText("");
    setAppliedSearch("");
    setUserId("all");
    setUserRole("all");
    setModule("all");
    setAction("all");
    setSuccess("all");
    setStart("");
    setEnd("");
    setPage(1);
  };

  const openDetail = async (item) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(item);

    try {
      if (!item?.id) return;

      const response = await api.get(`/audit-log/${item.id}`);
      setDetail(response.data);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadExport = async (type) => {
    setExporting(type);

    try {
      const endpoint =
        type === "xlsx"
          ? "/audit-log/export.xlsx"
          : "/audit-log/export.pdf";

      const response = await api.get(endpoint, {
        params: exportParams,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type:
          type === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        type === "xlsx"
          ? "denetim-kayitlari.xlsx"
          : "denetim-kayitlari.pdf";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      toast.success(
        type === "xlsx"
          ? "Excel dosyası indirildi."
          : "PDF dosyası indirildi."
      );

      setTimeout(() => {
        loadAudit();
      }, 500);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setExporting("");
    }
  };

  const changedFields = useMemo(() => {
    if (!detail) return [];

    return buildChangedFields(
      detail.old_values,
      detail.new_values
    );
  }, [detail]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <History className="h-7 w-7 text-blue-600" />

            <h1 className="text-3xl font-bold tracking-tight">
              İşlem Geçmişi
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Sistemde yapılan kullanıcı ve veri işlemlerini görüntüleyin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => downloadExport("xlsx")}
            disabled={exporting !== ""}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />

            {exporting === "xlsx"
              ? "Hazırlanıyor..."
              : "Excel"}
          </Button>

          <Button
            variant="outline"
            onClick={() => downloadExport("pdf")}
            disabled={exporting !== ""}
          >
            <FileText className="mr-2 h-4 w-4" />

            {exporting === "pdf"
              ? "Hazırlanıyor..."
              : "PDF"}
          </Button>

          <Button
            variant="outline"
            onClick={loadAudit}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />

            Yenile
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Başlangıç Tarihi
            </div>

            <Input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Bitiş Tarihi
            </div>

            <Input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => {
                setEnd(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Kullanıcı
            </div>

            <Select
              value={userId}
              onValueChange={(value) => {
                setUserId(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm kullanıcılar" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tüm Kullanıcılar
                </SelectItem>

                {users.map((user) => (
                  <SelectItem
                    key={user.id}
                    value={user.id}
                  >
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Rol
            </div>

            <Select
              value={userRole}
              onValueChange={(value) => {
                setUserRole(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm roller" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tüm Roller
                </SelectItem>
                <SelectItem value="admin">
                  Yönetici
                </SelectItem>
                <SelectItem value="hr">
                  İnsan Kaynakları
                </SelectItem>
                <SelectItem value="viewer">
                  Rapor Kullanıcısı
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Modül
            </div>

            <Select
              value={module}
              onValueChange={(value) => {
                setModule(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm modüller" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tüm Modüller
                </SelectItem>
                <SelectItem value="auth">
                  Giriş / Güvenlik
                </SelectItem>
                <SelectItem value="users">
                  Kullanıcılar
                </SelectItem>
                <SelectItem value="personnel">
                  Personel
                </SelectItem>
                <SelectItem value="leaves">
                  İzinler
                </SelectItem>
                <SelectItem value="holidays">
                  Tatiller
                </SelectItem>
                <SelectItem value="special_leave">
                  Özel İzinler
                </SelectItem>
                <SelectItem value="reports">
                  Raporlar
                </SelectItem>
                <SelectItem value="audit">
                  İşlem Geçmişi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              İşlem
            </div>

            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm işlemler" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tüm İşlemler
                </SelectItem>
                <SelectItem value="create">
                  Oluşturma
                </SelectItem>
                <SelectItem value="update">
                  Güncelleme
                </SelectItem>
                <SelectItem value="delete">
                  Silme
                </SelectItem>
                <SelectItem value="hard_delete">
                  Kalıcı Silme
                </SelectItem>
                <SelectItem value="bulk_create">
                  Toplu Oluşturma
                </SelectItem>
                <SelectItem value="bulk_update">
                  Toplu Güncelleme
                </SelectItem>
                <SelectItem value="bulk_delete">
                  Toplu Silme
                </SelectItem>
                <SelectItem value="terminate">
                  İşten Ayrılış
                </SelectItem>
                <SelectItem value="reactivate">
                  Aktife Alma
                </SelectItem>
                <SelectItem value="activate">
                  Aktifleştirme
                </SelectItem>
                <SelectItem value="deactivate">
                  Pasifleştirme
                </SelectItem>
                <SelectItem value="reset_password">
                  Şifre Sıfırlama
                </SelectItem>
                <SelectItem value="login_success">
                  Başarılı Giriş
                </SelectItem>
                <SelectItem value="login_failed">
                  Başarısız Giriş
                </SelectItem>
                <SelectItem value="logout">
                  Çıkış
                </SelectItem>
                <SelectItem value="export">
                  Dışa Aktarma
                </SelectItem>
                <SelectItem value="wipe_all">
                  Kalıcı Temizleme
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Durum
            </div>

            <Select
              value={success}
              onValueChange={(value) => {
                setSuccess(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tüm durumlar" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tüm Durumlar
                </SelectItem>
                <SelectItem value="true">
                  Başarılı
                </SelectItem>
                <SelectItem value="false">
                  Başarısız
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Arama
            </div>

            <div className="flex gap-2">
              <Input
                value={searchText}
                placeholder="Kullanıcı, kayıt, açıklama..."
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applySearch();
                  }
                }}
              />

              <Button
                onClick={applySearch}
                size="icon"
                title="Ara"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="text-sm text-slate-500">
            Toplam{" "}
            <span className="font-semibold text-slate-900">
              {total.toLocaleString("tr-TR")}
            </span>{" "}
            işlem kaydı
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X className="mr-2 h-4 w-4" />
            Filtreleri Temizle
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-left">
              <tr className="border-b">
                <th className="px-4 py-3 font-semibold">
                  Tarih / Saat
                </th>

                <th className="px-4 py-3 font-semibold">
                  Kullanıcı
                </th>

                <th className="px-4 py-3 font-semibold">
                  Rol
                </th>

                <th className="px-4 py-3 font-semibold">
                  Modül
                </th>

                <th className="px-4 py-3 font-semibold">
                  İşlem
                </th>

                <th className="px-4 py-3 font-semibold">
                  Etkilenen Kayıt
                </th>

                <th className="px-4 py-3 font-semibold">
                  Açıklama
                </th>

                <th className="px-4 py-3 font-semibold">
                  Durum
                </th>

                <th className="px-4 py-3 text-center font-semibold">
                  Detay
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    İşlem kayıtları yükleniyor...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Bu filtrelere uygun işlem kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(item.created_at)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {item.user_name || "Sistem"}
                      </div>

                      {item.ip_address && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          IP: {item.ip_address}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {roleLabel(item.user_role)}
                    </td>

                    <td className="px-4 py-3">
                      {moduleLabel(item.module)}
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {actionLabel(item.action)}
                      </Badge>
                    </td>

                    <td className="max-w-[220px] px-4 py-3">
                      <div className="truncate font-medium">
                        {item.entity_name || "—"}
                      </div>
                    </td>

                    <td className="max-w-[320px] px-4 py-3">
                      <div
                        className="truncate"
                        title={item.description || ""}
                      >
                        {item.description || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {item.success === false ? (
                        <Badge variant="destructive">
                          Başarısız
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Başarılı
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetail(item)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Detay
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Sayfa{" "}
            <span className="font-semibold text-slate-900">
              {page}
            </span>{" "}
            / {pageCount}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Önceki
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || loading}
              onClick={() =>
                setPage((current) =>
                  Math.min(pageCount, current + 1)
                )
              }
            >
              Sonraki
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              İşlem Detayı
            </DialogTitle>

            <DialogDescription>
              İşlem öncesi ve sonrası kayıt bilgileri.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />
              Detay yükleniyor...
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">
                    Tarih / Saat
                  </div>

                  <div className="mt-1 font-medium">
                    {formatDateTime(detail.created_at)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Kullanıcı
                  </div>

                  <div className="mt-1 font-medium">
                    {detail.user_name || "Sistem"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Rol
                  </div>

                  <div className="mt-1 font-medium">
                    {roleLabel(detail.user_role)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Durum
                  </div>

                  <div className="mt-1">
                    {detail.success === false ? (
                      <Badge variant="destructive">
                        Başarısız
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Başarılı
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Modül
                  </div>

                  <div className="mt-1 font-medium">
                    {moduleLabel(detail.module)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    İşlem
                  </div>

                  <div className="mt-1 font-medium">
                    {actionLabel(detail.action)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    Etkilenen Kayıt
                  </div>

                  <div className="mt-1 font-medium">
                    {detail.entity_name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">
                    IP Adresi
                  </div>

                  <div className="mt-1 font-medium">
                    {detail.ip_address || "—"}
                  </div>
                </div>
              </div>

              {detail.description && (
                <div className="rounded-lg border p-4">
                  <div className="mb-2 text-sm font-semibold">
                    Açıklama
                  </div>

                  <div className="text-sm text-slate-700">
                    {detail.description}
                  </div>
                </div>
              )}

              {changedFields.length > 0 ? (
                <div>
                  <div className="mb-3 text-sm font-semibold">
                    Değişen Alanlar
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left">
                            Alan
                          </th>

                          <th className="px-4 py-3 text-left">
                            Önceki Değer
                          </th>

                          <th className="px-4 py-3 text-left">
                            Yeni Değer
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {changedFields.map((field) => (
                          <tr
                            key={field.key}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {field.key}
                            </td>

                            <td className="max-w-[350px] px-4 py-3 align-top">
                              <pre className="whitespace-pre-wrap break-words font-sans text-xs text-slate-600">
                                {stringifyValue(field.oldValue)}
                              </pre>
                            </td>

                            <td className="max-w-[350px] px-4 py-3 align-top">
                              <pre className="whitespace-pre-wrap break-words font-sans text-xs text-slate-900">
                                {stringifyValue(field.newValue)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-500">
                  Bu işlem için eski/yeni değer bilgisi bulunmuyor.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold">
                    Önceki Kayıt
                  </div>

                  <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                    {stringifyValue(detail.old_values)}
                  </pre>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold">
                    Yeni Kayıt
                  </div>

                  <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                    {stringifyValue(detail.new_values)}
                  </pre>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t pt-4 text-xs text-slate-500 md:grid-cols-3">
                <div>
                  <span className="font-semibold">
                    Kayıt ID:
                  </span>{" "}
                  {detail.id || "—"}
                </div>

                <div>
                  <span className="font-semibold">
                    Entity ID:
                  </span>{" "}
                  {detail.entity_id || "—"}
                </div>

                <div>
                  <span className="font-semibold">
                    Cihaz:
                  </span>{" "}
                  {detail.device_name || "—"}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}