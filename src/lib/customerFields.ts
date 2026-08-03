export type CustomerFieldKey =
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "tax_id"
  | "address_line1"
  | "address_line2"
  | "city"
  | "region"
  | "postal_code"
  | "country";

export const CUSTOMER_FIELDS: {
  key: CustomerFieldKey;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}[] = [
  { key: "full_name", label: "Nombre", required: true, placeholder: "Nombre completo" },
  { key: "email", label: "Email", type: "email", required: true, placeholder: "email@ejemplo.com" },
  { key: "phone", label: "Teléfono", placeholder: "+34…" },
  { key: "company", label: "Empresa" },
  { key: "tax_id", label: "NIF/CIF" },
  { key: "address_line1", label: "Dirección" },
  { key: "address_line2", label: "Dirección (línea 2)" },
  { key: "city", label: "Ciudad" },
  { key: "region", label: "Provincia" },
  { key: "postal_code", label: "Código postal" },
  { key: "country", label: "País" },
];

export const CUSTOMER_SELECT =
  "id, full_name, email, phone, company, tax_id, address_line1, address_line2, city, region, postal_code, country, notes, status";

export const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

/** Trims values, caps length at 100 (255 for notes/email) and converts empties to null. */
export const buildCustomerPayload = (form: Record<string, unknown>) => {
  const clean = (v: unknown, max = 100) => {
    const s = typeof v === "string" ? v.trim().slice(0, max) : "";
    return s || null;
  };
  return {
    full_name: clean(form.full_name, 200) as string,
    email: (clean(form.email, 255) ?? "").toLowerCase(),
    phone: clean(form.phone, 50),
    company: clean(form.company, 200),
    tax_id: clean(form.tax_id, 50),
    address_line1: clean(form.address_line1, 200),
    address_line2: clean(form.address_line2, 200),
    city: clean(form.city, 100),
    region: clean(form.region, 100),
    postal_code: clean(form.postal_code, 20),
    country: clean(form.country, 100),
    notes: clean(form.notes, 2000),
  };
};
