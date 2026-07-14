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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json({ found: false, error: "Invalid email format" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log(`[lookup-customer] query for email domain: ${normalizedEmail.split("@")[1] ?? "unknown"}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[lookup-customer] Missing Supabase configuration");
      return json({ found: false });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("customers")
      .select("full_name, email, phone, company, tax_id, address_line1, city, postal_code, country")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[lookup-customer] DB error:", error.message);
      return json({ found: false });
    }

    if (!data) {
      return json({ found: false });
    }

    return json({
      found: true,
      customer: {
        full_name: data.full_name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        company: data.company ?? "",
        tax_id: data.tax_id ?? "",
        address_line1: data.address_line1 ?? "",
        city: data.city ?? "",
        postal_code: data.postal_code ?? "",
        country: data.country ?? "",
      },
    });
  } catch (err) {
    console.error("[lookup-customer] Unexpected error:", err);
    return json({ found: false });
  }
});
