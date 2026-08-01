import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, ShieldOff, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  last_sign_in_at: string | null;
  blocked: boolean;
};

async function callAdminUsers<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    // Intenta extraer el mensaje del cuerpo de la respuesta de error
    let msg = "";
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = await ctx.json();
        msg = parsed?.error ?? "";
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg || "No se pudo conectar con el servicio de usuarios. Inténtalo de nuevo.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await callAdminUsers<{ users: AdminUser[] }>({ action: "list" });
      return res.users ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createMut = useMutation({
    mutationFn: () =>
      callAdminUsers({
        action: "create",
        email: email.trim(),
        password,
        name: name.trim() || null,
        role: "admin",
      }),
    onSuccess: () => {
      toast.success("Usuario creado con acceso de administrador.");
      setCreateOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: () =>
      callAdminUsers({
        action: "reset_password",
        user_id: resetTarget?.id,
        new_password: newPassword,
      }),
    onSuccess: () => {
      toast.success("Contraseña restablecida.");
      setResetTarget(null);
      setNewPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: () => callAdminUsers({ action: "revoke", user_id: revokeTarget?.id }),
    onSuccess: () => {
      toast.success("Acceso revocado.");
      setRevokeTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const users = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios y accesos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona quién puede entrar al panel de administración.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Añadir usuario
        </Button>
      </div>

      <div className="rounded-md border">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando usuarios…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No hay usuarios todavía.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {u.email ?? "—"}
                        {isSelf && <Badge variant="secondary">Tú</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{u.name ?? "—"}</TableCell>
                    <TableCell>{u.role === "admin" ? "Admin" : u.role ?? "—"}</TableCell>
                    <TableCell>{formatDate(u.last_sign_in_at)}</TableCell>
                    <TableCell>
                      {u.blocked ? (
                        <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/15 dark:text-red-400">
                          Bloqueado
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
                          Activo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => {
                            setResetTarget(u);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="mr-2 h-3.5 w-3.5" />
                          Restablecer contraseña
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => setRevokeTarget(u)}
                        >
                          <ShieldOff className="mr-2 h-3.5 w-3.5" />
                          Revocar acceso
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir usuario</DialogTitle>
            <DialogDescription>
              Se creará una cuenta con acceso inmediato al panel.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>⚠️ Esta persona tendrá acceso completo de administrador a todo el panel.</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Contraseña *</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nombre (opcional)</Label>
              <Input
                id="new-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !email.trim() || !password}
            >
              {createMut.isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restablecer contraseña */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para {resetTarget?.email ?? ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Nueva contraseña</Label>
            <Input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending || newPassword.length < 8}
            >
              {resetMut.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revocar acceso */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar acceso</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres revocar el acceso de {revokeTarget?.email ?? ""}? Se bloqueará su
              inicio de sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                revokeMut.mutate();
              }}
              disabled={revokeMut.isPending}
            >
              {revokeMut.isPending ? "Revocando…" : "Revocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
