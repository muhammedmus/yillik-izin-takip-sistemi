import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav("/personel"); }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Hoş geldiniz");
      nav("/personel");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:block relative">
        <img
          alt="office"
          className="absolute inset-0 w-full h-full object-cover"
          src="https://images.unsplash.com/photo-1582647509711-c8aa8a8bda71?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBvZmZpY2UlMjBidWlsZGluZyUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg1OTQzMDkyfDA&ixlib=rb-4.1.0&q=85"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 to-blue-900/70" />
        <div className="relative h-full p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-blue-600 grid place-items-center"><Building2 /></div>
            <div>
              <div className="text-lg font-semibold tracking-tight">MERKOTEKS</div>
              <div className="text-xs text-blue-100">Personel & İzin Sistemi</div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight max-w-md">Personelinizi ve yıllık izinlerini tek panelden yönetin.</h1>
            <p className="mt-3 text-blue-100 max-w-md text-sm">Türkiye resmi tatilleri, kıdem hesaplaması ve A4 izin formu — hepsi hazır.</p>
          </div>
          <div className="text-[11px] text-blue-200">© {new Date().getFullYear()} Merkoteks</div>
        </div>
      </div>

      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-10 h-10 rounded-md bg-blue-600 text-white grid place-items-center"><Building2 size={20} /></div>
            <div>
              <div className="text-base font-semibold">MERKOTEKS</div>
              <div className="text-xs text-slate-500">Personel & İzin Sistemi</div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Giriş Yap</h2>
            <p className="text-sm text-slate-500 mt-1">Hesabınızla oturum açın</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" data-testid="login-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="ornek@merkoteks.com" />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" data-testid="login-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
          </div>
          <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full bg-blue-600 hover:bg-blue-700">
            <LogIn size={16} className="mr-2" />
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
          <div className="text-[11px] text-slate-400 text-center">Yönetici hesabınızla giriş yapın. Yeni kullanıcıyı Yönetici oluşturur.</div>
        </form>
      </div>
    </div>
  );
}
