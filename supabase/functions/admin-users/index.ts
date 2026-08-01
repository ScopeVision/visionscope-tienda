import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

        const now = Date.now();
        const result = users.map((u) => {
          const bannedUntil = (u as any).banned_until as string | null;
          return {
            id: u.id,
            email: u.email,
            name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? null,
            role: roleByUser.get(u.id) ?? null,
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

      case "revoke": {
        const userId = String(body.user_id ?? "");
        if (!userId) return json({ error: "Falta el usuario objetivo." }, 400);
        // Guarda 1: no puedes revocarte a ti mismo
        if (userId === callerId) return json({ error: "No puedes revocar tu propia cuenta." }, 400);
        // Guarda 2: nunca dejar la empresa con cero administradores
        const { data: admins, error: adminsErr } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (adminsErr) throw adminsErr;
        const adminIds = new Set((admins ?? []).map((a) => a.user_id));
        if (adminIds.has(userId) && adminIds.size <= 1) {
          return json({ error: "No puedes revocar al último administrador." }, 400);
        }
        // Elimina roles y bloquea el login (ban), pero NO borra el usuario de auth.users
        const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
        if (delErr) throw delErr;
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });
        if (banErr) return json({ error: banErr.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "Acción no reconocida." }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message ?? "Error interno." }, 500);
  }
});
