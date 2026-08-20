import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Personnel from "@/pages/Personnel";
import Leaves from "@/pages/Leaves";
import "@/App.css";

// Lazy-loaded modules (yalnızca kullanıcı menüye girdiğinde yüklenir)
const PersonnelForm = lazy(() => import("@/pages/PersonnelForm"));
const PersonnelDetail = lazy(() => import("@/pages/PersonnelDetail"));
const BulkLeave = lazy(() => import("@/pages/BulkLeave"));
const LeavePrint = lazy(() => import("@/pages/LeavePrint"));
const Muvafakatname = lazy(() => import("@/pages/Muvafakatname"));
const BulkMuvafakatname = lazy(() => import("@/pages/BulkMuvafakatname"));
const IzinCetveli = lazy(() => import("@/pages/IzinCetveli"));
const Reports = lazy(() => import("@/pages/Reports"));
const Holidays = lazy(() => import("@/pages/Holidays"));
const UsersPage = lazy(() => import("@/pages/Users"));
const BulkUploadHistory = lazy(() => import("@/pages/BulkUploadHistory"));
const Settings = lazy(() => import("@/pages/Settings"));
const SpecialLeaves = lazy(() => import("@/pages/SpecialLeaves"));
const SpecialLeaveProcess = lazy(() => import("@/pages/SpecialLeaveProcess"));
const ExcelOverrides = lazy(() => import("@/pages/ExcelOverrides"));
const DeletedLeaves = lazy(() => import("@/pages/DeletedLeaves"));
const AuditLog = lazy(() => import("@/pages/AuditLog"));

function PageFallback() {
  return (
    <div className="p-8 text-sm text-slate-500" data-testid="page-loading">
      Sayfa yükleniyor…
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />

        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/giris" element={<Login />} />

            <Route
              path="/izin/:id/yazdir"
              element={
                <ProtectedRoute>
                  <LeavePrint />
                </ProtectedRoute>
              }
            />

            <Route
              path="/izin/:id/muvafakatname"
              element={
                <ProtectedRoute>
                  <Muvafakatname />
                </ProtectedRoute>
              }
            />

            <Route
              path="/muvafakatnameler/toplu"
              element={
                <ProtectedRoute roles={["admin", "hr"]}>
                  <BulkMuvafakatname />
                </ProtectedRoute>
              }
            />

            <Route
              path="/personel/:id/cetveli"
              element={
                <ProtectedRoute>
                  <IzinCetveli />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/"
                element={<Navigate to="/personel" replace />}
              />

              <Route
                path="/panel"
                element={<Navigate to="/personel" replace />}
              />

              <Route
                path="/personel"
                element={<Personnel />}
              />

              <Route
                path="/personel/yeni"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <PersonnelForm />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/personel/:id"
                element={<PersonnelDetail />}
              />

              <Route
                path="/personel/:id/duzenle"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <PersonnelForm />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/izinler"
                element={<Leaves />}
              />

              <Route
                path="/izinler/toplu"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <BulkLeave />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/raporlar"
                element={<Reports />}
              />

              <Route
                path="/ozel-izinler"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <SpecialLeaves />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ozel-izinler/personel/:pid"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <SpecialLeaveProcess />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/tatiller"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <Holidays />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/ice-aktarma"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <BulkUploadHistory />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/kullanicilar"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/islem-gecmisi"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <AuditLog />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/excel-override"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <ExcelOverrides />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ayarlar/silinen-izinler"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <DeletedLeaves />
                  </ProtectedRoute>
                }
              />

              {/* Iter 62: /ayarlar/ozel-izinler → /ozel-izinler (geri uyum) */}
              <Route
                path="/ayarlar/ozel-izinler"
                element={<Navigate to="/ozel-izinler" replace />}
              />

              {/* Eski URL'ler geri uyumluluk için */}
              <Route
                path="/tatiller"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <Holidays />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ice-aktarma"
                element={
                  <ProtectedRoute roles={["admin", "hr"]}>
                    <BulkUploadHistory />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/kullanicilar"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />

              {/* Kaldırılan Takvim / Panel yönlendirmesi */}
              <Route
                path="/takvim"
                element={<Navigate to="/personel" replace />}
              />

              <Route
                path="/calendar"
                element={<Navigate to="/personel" replace />}
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;