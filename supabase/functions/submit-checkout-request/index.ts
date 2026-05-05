import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const payload = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing backend checkout configuration");
      return json({ error: "Checkout no configurado correctamente" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc("submit_checkout_request", {
      _full_name: payload.full_name,
      _email: payload.email,
      _phone: payload.phone,
      _company: payload.company ?? null,
      _tax_id: payload.tax_id ?? null,
      _address_line1: payload.address_line1 ?? null,
      _city: payload.city ?? null,
      _postal_code: payload.postal_code ?? null,
      _country: payload.country ?? null,
      _notes: payload.notes ?? null,
      _start_date: payload.start_date,
      _end_date: payload.end_date,
      _items: payload.items,
    });

    if (error) {
      console.error("submit_checkout_request failed", error);
      return json({ ok: false, error: error.message || "No se pudo procesar la reserva" });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return json({ ok: true, reference: result?.reference ?? "", booking_id: result?.booking_id ?? null });
  } catch (error) {
    console.error("Checkout function error", error);
    return json({ error: "No se pudo procesar la reserva. Revisa los datos e inténtalo de nuevo." }, 500);
  }
});
