# Finance Core Fix + Operational Control Layer

Completar el sistema financiero existente sin romper la lógica actual. Añadir Owner Registry, splits totalmente editables, entries por pedido (no agregados), overrides manuales, audit log y mejoras de transición/concesión.

Antes de aclarar ambigüedades críticas hago **2 preguntas bloqueantes** al final.

---

## 1. Base de datos (migración)

### Nueva tabla `finance_owners`
- `name`, `type` enum (`socio` | `external` | `concession` | `company`)
- `default_company_pct` numeric (override por defecto)
- `contact_email`, `contact_phone`, `notes`
- `active` boolean, `sort_order`

Migración: por cada `finance_partners` existente crear un `finance_owners` tipo `socio` y guardar el link.

### `finance_assets` — cambios
- Añadir `owner_id` → `finance_owners.id` (mantener `owner_label` legacy como fallback de display)
- Añadir `target_recovery_value` numeric (para transición)
- Añadir `concession_rules` jsonb (reglas libres para concesión: revenue_share variable por temporada, mínimos, etc.)

### `finance_entries` — cambios
- Añadir `booking_item_id` uuid nullable → ahora **una entry por línea de pedido** (no por pedido entero)
- Añadir `owner_id`, `applied_company_pct` numeric (split realmente aplicado)
- Añadir `is_manual_override` boolean, `override_reason` text
- Añadir `status` enum (`active` | `reversed` | `void`)

### `finance_payouts` — cambios
- Añadir `owner_id`, `applied_pct`
- Añadir `is_manual_override` boolean

### `finance_partners` — cambios
- `profit_share_pct` ya editable; añadir tabla `finance_partner_share_history`
  (`partner_id`, `pct`, `effective_from`, `effective_to`, `note`) para historial.

### Settings globales
- Nueva singleton `finance_settings`: `default_split_company_pct` (ej. 30), `default_currency`, notas.

### Audit log
- Reutilizar `booking_audit_log` extendiéndolo: añadir columna `entity_type` text y `entity_id` uuid (nullable). Trigger en `finance_entries`, `finance_payouts`, `finance_assets`, `finance_owners`, `finance_partners` que registra UPDATE/DELETE con diff jsonb.

### Trigger `handle_booking_payment_change` — corrección
Reescribir para:
- Recorrer **booking_items uno por uno**
- Para cada item: crear UNA `finance_entries` con `booking_item_id`, `owner_id` resuelto desde asset, `applied_company_pct` real
- Crear un `finance_payouts` por entry (si payout > 0)
- Fallback: si producto no tiene asset → usar `finance_settings.default_split_company_pct`
- Refund: invertir entry por entry, no en bloque

---

## 2. Admin UI — `/admin/finance` (nuevos tabs)

Ampliar `AdminFinance.tsx` con tabs:

1. **Dashboard** (ya existe) — añadir cards: assets en transición con barra de progreso (recovered / target), beneficio distribuible.
2. **Entries** — convertir en **ledger operativo**:
   - Filtros: origin_system, owner, asset, mes, status
   - Cada fila: order_id (link), fecha, cliente, items, gross, company, payout, split aplicado, owner, status, badge override
   - Click → drawer editable: cambiar `applied_company_pct`, `company_amount`, `payout_amount`, `owner_id`, notas; marca `is_manual_override=true` y registra en audit log
3. **Owners** (NUEVO) — CRUD completo de `finance_owners`: tipo, default %, contacto, notas, listado de assets asignados, toggle activo.
4. **Assets** — refactor: selector de owner desde registry, edición de `revenue_model`, `custom_company_pct`, `target_recovery_value`, `concession_rules` (JSON editor simple).
5. **Partners & Debt** — añadir editor de `profit_share_pct` por socio + historial; mantener panel de deuda y repayments.
6. **Payouts** — lista filtrable por owner, editable (monto, %), "Marcar pagado".
7. **Settings** (NUEVO) — `default_split_company_pct` global, `cash_reserve_target`.
8. **Cash / Expenses** — mantener.

Cada edición manual → llama RPC que escribe en `booking_audit_log` con `entity_type`, diff antes/después.

---

## 3. Frontend técnico

- `src/pages/admin/finance/*` split por tab (Dashboard, Entries, Owners, Assets, Partners, Payouts, Expenses, Cash, Settings) montados en `AdminFinance.tsx`
- Drawer reutilizable `EntryEditor.tsx` con override + reason
- Hook `useAuditLog(entityType, entityId)` para mostrar historial en cada drawer
- Componente `TransitionProgress` para assets (barra recovered/target con sugerencia "marcar transferido")

---

## 4. Fuera de scope

- No tocamos checkout, pricing, store público, variantes, inventario
- No conectamos pasarela de pago real
- No multi-moneda
- No envíos de email a owners (solo registro)

---

## 5. Preguntas bloqueantes (necesito respuesta antes de migrar)

**A. Migración de datos existentes.** Hay 3 `finance_partners` seed (Socio A/B/C) y posiblemente entries ya generadas por bookings paid. ¿Cómo proceder?
   - Opción 1: crear `finance_owners` automáticamente desde los 3 partners (recomendado) y dejar entries históricas intactas con `owner_id = NULL`.
   - Opción 2: backfill completo intentando inferir owner de cada entry desde el asset.
   - Opción 3: borrar entries históricas (solo si son de prueba).

**B. Granularidad de entry.** Un pedido con 3 items distintos pasaría a generar **3 entries separadas** (una por línea). ¿Confirmas? Alternativa: 1 entry por (booking, owner) — agrupando items del mismo dueño.

Cuando respondas estas dos, ejecuto la migración completa + UI en un solo paso.
