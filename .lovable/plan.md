# Finance Core System V3 — Plan

Sistema financiero interno dentro del admin que centraliza ingresos, splits 70/30, payouts, deuda de socios, caja, beneficio distribuible y gestión de activos. **No es contabilidad legal**, es el cerebro operativo del dinero.

## Alcance de esta entrega

Construir la **base completa** (datos + admin UI + eventos automáticos) sobre la que iterar. No tocamos el flujo público (checkout, store, rental). Solo se enchufa al ciclo `payment_status = 'paid'` y a un futuro estado `refunded`.

---

## 1. Modelo de datos (nuevo schema `finance`)

Tablas nuevas en `public`:

- **`finance_assets`** — inventario financiero de equipos
  - `name`, `origin_type` (`socio` | `concession` | `external` | `company`)
  - `owner_label` (texto libre: "Socio A", "Estudio X")
  - `revenue_model` (`split_70_30` | `company_100` | `custom`)
  - `custom_company_pct` (numeric, solo si custom)
  - `acquisition_value`, `recovered_value` (calculado)
  - `transition_status` (`normal` | `in_transition` | `transferred`)
  - `product_id` / `store_product_id` opcionales (link al catálogo)
  - `notes`, `active`

- **`finance_entries`** — fuente única de verdad del dinero confirmado
  - `origin_system` (`rental` | `store` | `services`)
  - `source_type` (`order_paid` | `refund` | `manual_adjustment` | `expense` | `debt_repayment` | `payout`)
  - `booking_id` / `store_order_id` / `asset_id` (nullable refs)
  - `gross_amount`, `company_amount`, `payout_amount`
  - `currency` = `EUR`
  - `occurred_at`, `created_by`, `notes`
  - `is_reversed` (para refunds)

- **`finance_payouts`** — payouts pendientes/pagados a propietarios de activos
  - `asset_id`, `entry_id`, `amount`, `status` (`pending` | `paid`), `paid_at`, `notes`

- **`finance_partners`** — socios y su deuda interna
  - `name`, `profit_share_pct` (40/40/20), `initial_debt`, `notes`

- **`finance_debt_repayments`** — historial de devoluciones a socios
  - `partner_id`, `amount`, `paid_at`, `notes`

- **`finance_expenses`** — gastos manuales de empresa
  - `category`, `amount`, `occurred_at`, `notes`

- **`finance_cash_reserve`** — config de reserva de caja
  - singleton: `reserved_amount`, `target_amount`

Tablas existentes:

- `bookings` y `store_orders` (si existe; si no, lo dejamos preparado para futuro store checkout) reciben columna `refunded_at` + transición a `payment_status = 'refunded'`.

## 2. Lógica automática (triggers / RPC)

- **`on_booking_paid()`** — trigger AFTER UPDATE en `bookings` cuando `payment_status` pasa a `paid`:
  - itera `booking_items`, resuelve el `asset_id` ligado al `product_id` (si existe), aplica `revenue_model` del asset:
    - `split_70_30` → 30% company / 70% payout (crea `finance_payouts.pending`)
    - `company_100` → 100% company
    - `custom` → según `custom_company_pct`
  - inserta una `finance_entries` (`source_type = order_paid`)
  - si el producto no tiene asset asociado → default `company_100`

- **`on_booking_refunded()`** — invierte la entrada (crea entry negativa, marca payouts pendientes como `cancelled`).

- **RPC `register_debt_repayment(partner_id, amount)`** — inserta repayment + entry tipo `debt_repayment` (descuenta de caja).

- **RPC `register_expense(...)`**, **`register_manual_adjustment(...)`**.

- **`distributable_profit()`** función SQL:
  ```
  ingresos company
    - payouts pagados
    - expenses
    - debt repayments
    - cash reserve target
  = distributable
  ```
  reparte por `profit_share_pct` (40/40/20).

Todo va al `booking_audit_log` existente (extendemos para aceptar `entity_type`).

## 3. Admin UI — nueva sección "Finance"

Nueva ruta `/admin/finance` con sub-tabs:

1. **Dashboard mensual** — usa `MonthNavigator`
   - Cards: Ingresos Rental / Store / Services, Payouts externos, Deuda devuelta, Caja, Beneficio distribuible
   - Tabla de activos en transición (con sugerencia "ya recuperado")
   - Reparto sugerido socios (40/40/20)

2. **Entries** — feed de movimientos con filtros (origen, tipo, mes), edición manual asistida.

3. **Assets** — CRUD de activos, asignación a producto del catálogo (rental o store), edición de modelo (70/30, 100%, custom), gestión de transición (estado + botón "marcar transferido").

4. **Payouts** — lista de payouts pendientes por propietario, botón "Marcar pagado".

5. **Socios & Deuda** — tarjeta por socio con deuda restante (684€ / 1200€ seed), historial de repayments, botón "Registrar devolución".

6. **Gastos** — CRUD simple.

7. **Caja** — input de `target_amount` reserva, lectura de caja real (sum entries).

## 4. Eventos / control manual

- Todos los cálculos automáticos son **editables** desde admin (override por entry, override por payout, override de % en asset).
- Cada edición se audita en `booking_audit_log` con actor + diff.

## 5. Fuera de scope (explícito)

- No tocamos el flujo público (checkout, carrito, store).
- No conectamos pasarela de pago real (`paid` se marca manualmente desde admin, como ya funciona).
- No multi-moneda.
- No contabilidad fiscal / facturación.
- Store orders: si aún no existe tabla, el sistema queda **preparado** (entries soportan `store_order_id` nullable) pero solo Rental enchufa el trigger automático ahora.

## 6. Seed inicial

- 3 `finance_partners`: Socio A (40%, deuda 684€), Socio B (40%, deuda 1200€), Socio C (20%, deuda 0€).
- `finance_cash_reserve` singleton con `target = 0`.
- Activos: vacío (admin los crea o los liga a productos existentes).

## 7. Detalles técnicos (para ti)

```text
bookings.payment_status = 'paid'
        │
        ▼  trigger on_booking_paid
finance_entries (order_paid, company_amount, payout_amount)
        │
        ├──► finance_payouts (pending) por cada item con asset 70/30
        │
        ▼
Dashboard agrega por mes ──► Beneficio distribuible
                                  │
                                  ├─ 40% A   ─┐
                                  ├─ 40% B   ─┼─► visualización, no movimiento automático
                                  └─ 20% C   ─┘
```

- Migración: crear tipos enum, tablas, RLS (solo admin), triggers, RPC, función `distributable_profit()`.
- Frontend: `src/pages/admin/finance/*` (Dashboard, Entries, Assets, Payouts, Partners, Expenses, Cash), entrada en `AdminLayout`.
- Reutilizamos `MonthNavigator`, `MonthlyFinancialSummary` patterns y design tokens existentes.

## Orden de implementación

1. Migración SQL (tablas + triggers + RPC + seed socios).
2. Tipos TS regenerados.
3. Layout admin: nueva entrada "Finanzas" y router.
4. Páginas en este orden: Assets → Partners → Payouts → Expenses → Cash → Entries → Dashboard.
5. QA: marcar un booking como paid en sandbox y verificar entry + payout generados.
