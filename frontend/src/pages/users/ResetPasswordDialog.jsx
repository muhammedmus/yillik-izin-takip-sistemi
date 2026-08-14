import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ResetPasswordDialog({ user, onOpenChange }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => { if (user) { setPw(""); setPw2(""); } }, [user]);
  const save = async () => {
    if (!pw || pw.length < 4) return toast.error("Şifre en az 4 karakter olmalı");
    if (pw !== pw2) return toast.error("Şifreler eşleşmiyor");
    try {
      await api.post(`/users/${user.id}/reset-password`, { new_password: pw });
      toast.success("Şifre sıfırlandı");
      onOpenChange(false);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent data-testid="reset-password-dialog">
        <DialogHeader>
          <DialogTitle>Şifre Sıfırla — {user?.name}</DialogTitle>
          <DialogDescription>Kullanıcıya yeni bir şifre atayın. Kullanıcı bu şifreyle giriş yapabilir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Yeni Şifre</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="rp-pw1" /></div>
          <div><Label>Yeni Şifre (tekrar)</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} data-testid="rp-pw2" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="rp-save">Şifreyi Sıfırla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
