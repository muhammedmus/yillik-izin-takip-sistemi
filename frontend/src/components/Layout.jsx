import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Users,
  CalendarDays,
  FileBarChart,
  Settings as SettingsIcon,
  LogOut,
  Building2,
  HeartPulse
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const roleLabel = {
  admin: "Yönetici",
  hr: "İnsan Kaynakları",
  viewer: "Rapor Kullanıcısı"
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items = [
    {
      to: "/personel",
      icon: Users,
      label: "Personel",
      roles: ["admin", "hr", "viewer"]
    },
    {
      to: "/izinler",
      icon: CalendarDays,
      label: "İzinler",
      roles: ["admin", "hr", "viewer"]
    },
    {
      to: "/raporlar",
      icon: FileBarChart,
      label: "Raporlar",
      roles: ["admin", "hr", "viewer"]
    },
    {
      to: "/ozel-izinler",
      icon: HeartPulse,
      label: "Özel İzinler",
      roles: ["admin", "hr"]
    },
    {
      to: "/ayarlar",
      icon: SettingsIcon,
      label: "Ayarlar",
      roles: ["admin", "hr"]
    },
  ];

  const handleLogout = async () => {
    await logout();
    nav("/giris");
  };

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <aside
        className="no-print w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0"
        data-testid="sidebar"
      >
        <div className="px-5 py-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-blue-600 grid place-items-center shrink-0">
              <Building2 size={20} />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight leading-tight">
                Personel İzin
              </div>
              <div className="text-sm font-semibold tracking-tight leading-tight">
                Takip Sistemi
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items
            .filter((i) => i.roles.includes(user?.role))
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={`nav-${label
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs shrink-0">
          <div className="text-slate-200 font-medium truncate">
            {user?.name}
          </div>

          <div className="text-slate-400 truncate">
            {user?.email}
          </div>

          <div className="text-slate-500 mt-1">
            {roleLabel[user?.role]}
          </div>

          <Button
            onClick={handleLogout}
            data-testid="logout-btn"
            size="sm"
            variant="secondary"
            className="mt-3 w-full"
          >
            <LogOut size={14} className="mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      <main
        className="flex-1 min-w-0 h-screen overflow-y-auto"
        data-testid="main-scroll"
      >
        <div className="p-6 md:p-8 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}