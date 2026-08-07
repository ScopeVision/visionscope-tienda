import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Tablas con referencias a usuarios; si el usuario aparece aquí no se puede borrar.
const DEPENDENCIES: Array<{ table: string; column: string; label: string }> = [
  { table: "booking_audit_log", column: "actor_user_id", label: "histórico de cambios en reservas" },
  { table: "booking_communications", column: "created_by", label: "comunicaciones de reservas" },
  { table: "booking_items", column: "overridden_by", label: "ajustes manuales de precio en reservas" },
  { table: "finance_entries", column: "created_by", label: "movimientos financieros" },
  { table: "finance_expenses", column: "created_by", label: "gastos" },
  { table: "finance_owner_payments", column: "created_by", label: "pagos a owners" },
  { table: "finance_debt_repayments", column: "created_by", label: "devoluciones de deuda" },
  { table: "finance_partner_share_history", column: "created_by", label: "histórico de equity" },
  { table: "finance_asset_owner_history", column: "changed_by", label: "histórico de propiedad de activos" },
  { table: "finance_reconciliation_notes", column: "created_by", label: "notas de conciliación" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- AUTENTICACIÓN: identifica a QUIEN LLAMA por el JWT, nunca por el body ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "No autenticado." }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sesión inválida." }, 401);
    const callerId = userData.user.id;

    // --- AUTORIZACIÓN: quien llama debe ser admin (reutiliza has_role existente) ---
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) return json({ error: "No se pudo verificar el rol." }, 500);
    if (!isAdmin) return json({ error: "Acceso denegado. Solo administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // Helper: lista de IDs con rol admin
    const getAdminIds = async (): Promise<Set<string>> => {
      const { data, error } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      return new Set((data ?? []).map((a: { user_id: string }) => a.user_id));
    };

    switch (action) {
      case "list": {
        const users: any[] = [];
        let page = 1;
        const perPage = 1000;
        while (true) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
          if (error) throw error;
          users.push(...data.users);
          if (data.users.length < perPage) break;
          page++;
        }
        const { data: roles, error: rolesErr } = await admin
          .from("user_roles")
          .select("user_id, role");
        if (rolesErr) throw rolesErr;
        const roleByUser = new Map<string, string>();
        for (const r of roles ?? []) roleByUser.set(r.user_id, r.role);

        const { data: profiles, error: profErr } = await admin
          .from("profiles")
          .select("id, full_name, phone, job_title");
        if (profErr) throw profErr;
        const profileById = new Map<string, any>();
        for (const p of profiles ?? []) profileById.set(p.id, p);

        const now = Date.now();
        const result = users.map((u) => {
          const bannedUntil = (u as any).banned_until as string | null;
          const p = profileById.get(u.id);
          return {
            id: u.id,
            email: u.email,
            name: p?.full_name ?? u.user_metadata?.name ?? u.user_metadata?.full_name ?? null,
            full_name: p?.full_name ?? null,
            phone: p?.phone ?? null,
            job_title: p?.job_title ?? null,
            role: roleByUser.get(u.id) ?? null,
            created_at: u.created_at ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
            blocked: !!bannedUntil && new Date(bannedUntil).getTime() > now,
          };
        });
        result.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
        return json({ users: result });
      }

      case "create": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const name = body.name ? String(body.name).trim() : null;
        const role = (body.role ?? "admin") as string;
        if (!email || !password) return json({ error: "Email y contraseña son obligatorios." }, 400);
        if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
        if (role !== "admin" && role !== "user") return json({ error: "Rol no válido." }, 400);

        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: name ? { name } : {},
        });
        if (createErr || !created?.user) {
          return json({ error: createErr?.message ?? "No se pudo crear el usuario." }, 400);
        }

        const { error: roleInsertErr } = await admin
          .from("user_roles")
          .insert({ user_id: created.user.id, role });
        if (roleInsertErr) {
          // rollback: si no se pudo asignar el rol, elimina el usuario recién creado
          await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
          return json({ error: "No se pudo asignar el rol: " + roleInsertErr.message }, 500);
        }

        if (name) {
          await admin.from("profiles").update({ full_name: name }).eq("id", created.user.id);
        }

        return json({
          user: { id: created.user.id, email: created.user.email, name, role },
        });
      }

      case "reset_password": {
        const userId = String(body.user_id ?? "");
        const newPassword = String(body.new_password ?? "");
        if (!userId || !newPassword) return json({ error: "Faltan datos." }, 400);
        if (newPassword.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "update": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);

        const { data: target, error: targetErr } = await admin.auth.admin.getUserById(userId);
        if (targetErr || !target?.user) return json({ error: "El usuario no existe." }, 404);

        // Perfil
        const profilePatch: Record<string, unknown> = {};
        if (body.full_name !== undefined) profilePatch.full_name = String(body.full_name ?? "").trim() || null;
        if (body.phone !== undefined) profilePatch.phone = String(body.phone ?? "").trim() || null;
        if (body.job_title !== undefined) profilePatch.job_title = String(body.job_title ?? "").trim() || null;
        if (Object.keys(profilePatch).length > 0) {
          const { error: pErr } = await admin
            .from("profiles")
            .upsert({ id: userId, ...profilePatch }, { onConflict: "id" });
          if (pErr) return json({ error: "No se pudieron guardar los datos del perfil." }, 400);
        }

        // Email
        if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
          const email = String(body.email).trim().toLowerCase();
          if (!EMAIL_RE.test(email)) return json({ error: "El email no tiene un formato válido." }, 400);
          if (email !== (target.user.email ?? "").toLowerCase()) {
            const { error: eErr } = await admin.auth.admin.updateUserById(userId, {
              email,
              email_confirm: true,
            });
            if (eErr) {
              const msg = /already|exists|registered|duplicate/i.test(eErr.message)
                ? "Ese email ya está en uso por otra cuenta."
                : "No se pudo cambiar el email.";
              return json({ error: msg }, 400);
            }
          }
        }

        // Rol
        if (body.role !== undefined && body.role !== null && String(body.role) !== "") {
          const role = String(body.role);
          if (role !== "admin" && role !== "user") return json({ error: "Rol no válido." }, 400);
          const adminIds = await getAdminIds();
          const isTargetAdmin = adminIds.has(userId);
          if (role !== "admin" && isTargetAdmin) {
            if (userId === callerId) {
              return json({ error: "No puedes quitarte a ti mismo el rol de administrador." }, 400);
            }
            if (adminIds.size <= 1) {
              return json({ error: "No puedes degradar al último administrador." }, 400);
            }
          }
          const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
          if (delErr) return json({ error: "No se pudo actualizar el rol." }, 400);
          const { error: insErr } = await admin.from("user_roles").insert({ user_id: userId, role });
          if (insErr) return json({ error: "No se pudo actualizar el rol." }, 400);
        }

        return json({ ok: true });
      }

      case "block": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);
        if (userId === callerId) return json({ error: "No puedes bloquear tu propia cuenta." }, 400);
        const adminIds = await getAdminIds();
        if (adminIds.has(userId) && adminIds.size <= 1) {
          return json({ error: "No puedes bloquear al último administrador." }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        if (error) return json({ error: "No se pudo bloquear la cuenta." }, 400);
        return json({ ok: true });
      }

      case "unblock": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
        if (error) return json({ error: "No se pudo desbloquear la cuenta." }, 400);
        return json({ ok: true });
      }

      case "delete": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);
        if (userId === callerId) return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
        const adminIds = await getAdminIds();
        if (adminIds.has(userId) && adminIds.size <= 1) {
          return json({ error: "No puedes eliminar al último administrador." }, 400);
        }

        // Integridad del histórico: si hay registros dependientes, no se borra.
        const found: string[] = [];
        for (const dep of DEPENDENCIES) {
          const { count, error } = await admin
            .from(dep.table)
            .select("*", { count: "exact", head: true })
            .eq(dep.column, userId);
          if (error) continue; // tabla/columna no disponible: se ignora
          if ((count ?? 0) > 0) found.push(dep.label);
        }
        if (found.length > 0) {
          return json(
            {
              error:
                "Esta cuenta tiene actividad registrada en: " +
                [...new Set(found)].join(", ") +
                ". No se puede eliminar sin romper el histórico contable. Bloquea la cuenta en lugar de eliminarla.",
            },
            409,
          );
        }

        const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
        if (delErr) return json({ error: "No se pudieron eliminar los permisos del usuario." }, 400);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return json({ error: "No se pudo eliminar la cuenta." }, 400);
        return json({ ok: true });
      }

      case "revoke": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);
        // Guarda 1: no puedes revocarte a ti mismo
        if (userId === callerId) return json({ error: "No puedes revocar tu propia cuenta." }, 400);
        // Guarda 2: nunca dejar la empresa con cero administradores
        const adminIds = await getAdminIds();
        if (adminIds.has(userId) && adminIds.size <= 1) {
          return json({ error: "No puedes revocar al último administrador." }, 400);
        }
        // Elimina roles y bloquea el login (ban), pero NO borra el usuario de auth.users
        const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
        if (delErr) throw delErr;
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });
        if (banErr) return json({ error: "No se pudo bloquear la cuenta." }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "Acción no reconocida." }, 400);
    }
  } catch (_e) {
    return json({ error: "Se ha producido un error interno. Inténtalo de nuevo." }, 500);
  }
});
