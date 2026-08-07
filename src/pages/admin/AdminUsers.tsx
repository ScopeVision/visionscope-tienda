import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Unlock,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  role: string | null;
  created_at: string | null;
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

/** Envuelve una opción del menú para poder mostrar un tooltip aunque esté deshabilitada. */
function MenuItemWithReason({
  disabled,
  reason,
  children,
}: {
  disabled: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  if (!disabled || !reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="left">{reason}</TooltipContent>
    </Tooltip>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    role: "user",
  });

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await callAdminUsers<{ users: AdminUser[] }>({ action: "list" });
      return res.users ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const users = data ?? [];
  const adminCount = users.filter((u) => u.role === "admin").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const displayName = (u.full_name ?? u.name ?? "").toLowerCase();
      if (q && !displayName.includes(q) && !(u.email ?? "").toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && u.blocked) return false;
      if (statusFilter === "blocked" && !u.blocked) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

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

  const updateMut = useMutation({
    mutationFn: () =>
      callAdminUsers({
        action: "update",
        user_id: editTarget?.id,
        full_name: editForm.full_name.trim() || null,
        phone: editForm.phone.trim() || null,
        job_title: editForm.job_title.trim() || null,
        email: editForm.email.trim(),
        role: editForm.role,
      }),
    onSuccess: () => {
      toast.success("Usuario actualizado.");
      setEditTarget(null);
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
      toast.success("Contraseña actualizada.");
      setResetTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockMut = useMutation({
    mutationFn: () => callAdminUsers({ action: "block", user_id: blockTarget?.id }),
    onSuccess: () => {
      toast.success("Acceso bloqueado.");
      setBlockTarget(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => callAdminUsers({ action: "unblock", user_id: userId }),
    onSuccess: () => {
      toast.success("Acceso desbloqueado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => callAdminUsers({ action: "delete", user_id: deleteTarget?.id }),
    onSuccess: () => {
      toast.success("Usuario eliminado permanentemente.");
      setDeleteTarget(null);
      setDeleteConfirmEmail("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (u: AdminUser) => {
    setEditForm({
      full_name: u.full_name ?? u.name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      job_title: u.job_title ?? "",
      role: u.role === "admin" ? "admin" : "user",
    });
    setEditTarget(u);
  };

  const editIsSelf = editTarget?.id === user?.id;
  const editIsLastAdmin = !!editTarget && editTarget.role === "admin" && adminCount <= 1;
  const roleLocked = editIsSelf || editIsLastAdmin;

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

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="user">Usuario</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} de {users.length}
        </span>
      </div>

      <div className="rounded-md border">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Cargando usuarios…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {users.length === 0
              ? "No hay usuarios todavía."
              : "Ningún usuario coincide con los filtros."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                const isLastAdmin = u.role === "admin" && adminCount <= 1;
                const blockDisabled = isSelf || isLastAdmin;
                const deleteDisabled = isSelf || isLastAdmin;
                const blockReason = isSelf
                  ? "No puedes bloquear tu propia cuenta."
                  : "Es el último administrador; no se puede bloquear.";
                const deleteReason = isSelf
                  ? "No puedes eliminar tu propia cuenta."
                  : "Es el último administrador; no se puede eliminar.";

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {u.full_name ?? u.name ?? "—"}
                        {isSelf && <Badge variant="secondary">Tú</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Admin" : u.role === "user" ? "Usuario" : "Sin rol"}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.job_title ?? "—"}</TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
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
                    <TableCell>{formatDate(u.last_sign_in_at)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Acciones">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => openEdit(u)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar usuario
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setNewPassword("");
                              setConfirmPassword("");
                              setResetTarget(u);
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Cambiar contraseña
                          </DropdownMenuItem>

                          {u.blocked ? (
                            <DropdownMenuItem
                              disabled={unblockMut.isPending}
                              onClick={() => unblockMut.mutate(u.id)}
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              Desbloquear acceso
                            </DropdownMenuItem>
                          ) : (
                            <MenuItemWithReason disabled={blockDisabled} reason={blockReason}>
                              <DropdownMenuItem
                                disabled={blockDisabled}
                                onClick={() => setBlockTarget(u)}
                              >
                                <Lock className="mr-2 h-4 w-4" />
                                Bloquear acceso
                              </DropdownMenuItem>
                            </MenuItemWithReason>
                          )}

                          <DropdownMenuSeparator />

                          <MenuItemWithReason disabled={deleteDisabled} reason={deleteReason}>
                            <DropdownMenuItem
                              disabled={deleteDisabled}
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setDeleteConfirmEmail("");
                                setDeleteTarget(u);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar permanentemente
                            </DropdownMenuItem>
                          </MenuItemWithReason>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <span>Esta persona tendrá acceso completo de administrador a todo el panel.</span>
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
              <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
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

      {/* Editar usuario */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{editTarget?.email ?? ""}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre completo</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-job">Puesto</Label>
                <Input
                  id="edit-job"
                  value={editForm.job_title}
                  onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Select
                      value={editForm.role}
                      disabled={roleLocked}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="user">Usuario</SelectItem>
                      </SelectContent>
                    </Select>
                  </span>
                </TooltipTrigger>
                {roleLocked && (
                  <TooltipContent>
                    {editIsSelf
                      ? "No puedes cambiar tu propio rol de administrador."
                      : "Es el último administrador; no se puede degradar."}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !editForm.email.trim()}
            >
              {updateMut.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar contraseña */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>Nueva contraseña para {resetTarget?.email ?? ""}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="reset-password-2">Repetir contraseña</Label>
              <Input
                id="reset-password-2"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-sm text-destructive">Las contraseñas no coinciden.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => resetMut.mutate()}
              disabled={
                resetMut.isPending || newPassword.length < 8 || newPassword !== confirmPassword
              }
            >
              {resetMut.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloquear acceso */}
      <AlertDialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear acceso</AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget?.email ?? ""} no podrá iniciar sesión hasta que se desbloquee. No se
              elimina ningún dato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                blockMut.mutate();
              }}
              disabled={blockMut.isPending}
            >
              {blockMut.isPending ? "Bloqueando…" : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar permanentemente */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteConfirmEmail("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible: se elimina la cuenta y sus permisos. Si el usuario tiene
              actividad registrada en el histórico, el sistema lo impedirá y deberás bloquearlo en
              su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Escribe <span className="font-medium">{deleteTarget?.email ?? ""}</span> para
              confirmar
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                deleteMut.mutate();
              }}
              disabled={
                deleteMut.isPending ||
                deleteConfirmEmail.trim().toLowerCase() !== (deleteTarget?.email ?? "").toLowerCase()
              }
            >
              {deleteMut.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
