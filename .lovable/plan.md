## Plan: Sistema Operativo de Pedidos Editables (Rental Admin)

Transformar el panel `AdminBookings` en una herramienta operativa profesional, manteniendo intacta la lógica automática (pricing progresivo 6%, fianzas, stock, checkout público).

---

### 1. Cambios de base de datos (migration)

**Tabla `bookings` — nuevas columnas:**
- `payment_status` (enum nuevo `payment_status`: `unpaid`, `deposit_pending`, `partially_paid`, `paid`, `refunded`) default `unpaid`
- `discount_type` (`none` | `fixed` | `percent`) default `none`
- `discount_value` numeric default 0
- `extra_fees` jsonb default `[]` — lista de `{label, amount}` (transporte, montaje, etc.)
- `subtotal_override` numeric nullable (si no es null, sobrescribe el subtotal calculado)
- `total_override` numeric nullable (si no es null, sobrescribe el total final)
- `internal_notes` text nullable (notas internas — el campo `notes` existente queda como notas generales)

**Ampliar enum `booking_status`:** añadir `pending_review`, `awaiting_confirmation`, `ready_for_pickup`, `returned`. Mantener los actuales (`nuevo`, `confirmado`, `preparacion`, `alquiler`, `finalizado`, `cancelado`) y mapearlos al nuevo flujo en UI (nuevo→New, confirmado→Confirmed, preparacion→In Preparation, alquiler→Active Rental, finalizado→Completed, cancelado→Cancelled).

**Tabla `booking_items` — nuevas columnas:**
- `variant_id` uuid nullable
- `discount_type` (`none` | `fixed` | `percent`) default `none`
- `discount_value` numeric default 0
- `price_override` numeric nullable (override del subtotal de la línea)

**Nueva tabla `booking_audit_log`:**
- `id`, `booking_id`, `actor_user_id`, `action` (text), `changes` (jsonb), `created_at`
- RLS: solo admins leen/escriben

**Trigger `validate_booking_item_price`:** relajar para admins (ya lo hace) — no cambia. Para no-admin sigue estricto; admins pueden poner cualquier precio.

**RLS:** añadir política `Admins insert bookings` y `Admins insert booking_items` (actualmente solo el RPC inserta — ahora el admin necesita CRUD directo desde el panel).

---

### 2. Helper de cálculo `src/lib/bookingPricing.ts`

Función pura que toma `{items, discount, extra_fees, subtotal_override, total_override}` y devuelve:
```
{
  items: [{ auto_subtotal, discount_amount, final_subtotal }],
  auto_subtotal,           // suma de items con pricing progresivo
  items_discount_total,
  global_discount_amount,
  extra_fees_total,
  effective_subtotal,      // subtotal_override ?? auto_subtotal - descuentos
  total,                   // total_override ?? effective_subtotal + fees
}
```
Reutiliza la lógica progresiva 6% de `src/lib/rental.ts`.

---

### 3. UI Admin — refactor `AdminBookings.tsx`

**Lista (tabs):** ampliar tabs a los 10 estados nuevos + filtro/badge de `payment_status`.

**Editor de pedido (Dialog grande):**

```text
┌──────────────────────────────────────────────────┐
│ LR-260518-abc123              [Status ▾] [Pay ▾] │
├──────────────────────────────────────────────────┤
│ Cliente: nombre · email                          │
│ Fechas:  [start] → [end]                         │
├──────────────────────────────────────────────────┤
│ PRODUCTOS                            [+ Añadir]  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Producto ▾  Variante ▾  Qty  Days  €/día  ✕ │ │
│ │ Subtotal auto: 120€  Descuento: [10%]  →108€ │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ DESCUENTO GLOBAL: [○ none ○ fixed ○ %] [value]   │
│ FEES EXTRA:                          [+ Añadir]  │
│   Transporte           50€                    ✕  │
├──────────────────────────────────────────────────┤
│ RESUMEN FINANCIERO                               │
│   Subtotal automático        540€                │
│   Descuentos por línea       -54€                │
│   Descuento global           -49€                │
│   Fees extra                 +50€                │
│   ─────────────────────                          │
│   Total calculado            487€                │
│   [☐ Override total]        [        ] €         │
│   TOTAL FINAL                487€                │
│   Fianza                     200€                │
├──────────────────────────────────────────────────┤
│ NOTAS GENERALES (visibles internamente)          │
│ NOTAS INTERNAS (operativas)                      │
└──────────────────────────────────────────────────┘
                              [Cancelar] [Guardar]
```

**Selector de productos:** búsqueda por nombre con `products` publicados; al elegir, carga sus `product_variants` para el dropdown de variante.

**Recalculo en vivo:** cada cambio invoca `computeBookingPricing()` y refleja los totales sin guardar hasta pulsar Guardar.

**Audit log:** al guardar, diff vs estado original → insertar fila en `booking_audit_log` (cambios de status, payment_status, items añadidos/eliminados, totales). Mostrar timeline expandible al final del dialog.

**Acciones rápidas en la lista:** mantener el botón "avanzar al siguiente estado" pero adaptado al nuevo enum.

---

### 4. i18n

Añadir keys en `es/ca/en/fr`:
- `bookings.status.*` (los 10 nuevos)
- `bookings.payment.*` (5 estados)
- `bookings.editor.*` (productos, descuentos, fees, override, resumen, audit)

---

### 5. Lo que NO cambia

- Pricing progresivo 6% (`src/lib/rental.ts`) — base
- Checkout público `/checkout` y RPC `submit_checkout_request` / `create_booking_with_items`
- Fórmula automática de subtotales
- Stock disponible (`available_stock`)
- Super Store, productos, variantes

---

### Archivos

**Nuevos:**
- `supabase/migrations/<ts>_booking_editor.sql`
- `src/lib/bookingPricing.ts`
- `src/components/admin/BookingEditor.tsx` (Dialog grande, extraído del current inline)
- `src/components/admin/BookingItemRow.tsx`
- `src/components/admin/BookingAuditLog.tsx`

**Modificados:**
- `src/pages/admin/AdminBookings.tsx` (tabs + lista + abrir editor)
- `src/i18n/locales/{es,ca,en,fr}.json`
- `src/integrations/supabase/types.ts` (auto-regenerado)

---

### Confirma para proceder

¿Procedo con esta arquitectura? Dos puntos abiertos:

1. **Estados existentes:** propongo mantener los actuales en DB y añadir los nuevos al enum (compatible con pedidos en curso). ¿OK o prefieres renombrarlos?
2. **Audit log:** versión mínima (action + changes JSON) en esta iteración. ¿Suficiente o quieres ya un timeline visual rico?
