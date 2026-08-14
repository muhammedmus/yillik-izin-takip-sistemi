import { UserCircle2, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UsersTab } from "./users/UsersTab";
import { AuditTab } from "./users/AuditTab";

export default function UsersPage() {
  return (
    <div className="space-y-5">
      <div className="sticky-page-title">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kullanıcılar ve İşlem Geçmişi</h1>
        <p className="text-sm text-slate-500 mt-1">Sistem kullanıcılarını yönetin ve tüm işlem geçmişini denetleyin. Yalnızca Yönetici rolü erişebilir.</p>
      </div>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList data-testid="users-tabs">
          <TabsTrigger value="users" data-testid="tab-users"><UserCircle2 size={14} className="mr-1" /> Kullanıcı Yönetimi</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit"><History size={14} className="mr-1" /> İşlem Geçmişi</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
