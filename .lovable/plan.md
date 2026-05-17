
# Sistema de atributos profesionales para catálogo

Ampliar la base de datos técnica de productos con atributos profesionales de equipamiento cinematográfico (especialmente ópticas y cámaras), y exponerlos como filtros en el catálogo.

## 1. Migración DB — nuevas columnas en `products`

Añadir columnas opcionales (nullable) a `products`:

- `mount_extra` ya no hace falta — ampliamos las opciones existentes de `mount`.
- `coverage` text — Full Frame / Super 35 / VistaVision / Large Format / APS-C / MFT / 16mm / Super 16 / 35mm / 65mm / IMAX 70mm / Anamorphic FF / Anamorphic S35 / 8mm / Super 8.
- `series` text — serie/familia óptica (Master Prime, Supreme Prime, Signature Prime, Ultra Prime, etc.) — texto libre.
- `year` int — año del modelo.
- `is_anamorphic` boolean default false.
- `is_vintage` boolean default false.
- `is_rehoused` boolean default false.

(No tocamos `format`, `sensor_type`, `lens_type`, `brand` — ya existen y se mantienen.)

Sin cambios en RLS.

## 2. Catálogo de monturas y formatos (`src/lib/rentalFilters.ts`)

Ampliar `CAMERA_MOUNTS` y `LENS_MOUNTS` a la lista solicitada:

```
Arri PL, Arri LPL, Arri Standard, Arri Bayonet,
Canon EF, Canon RF, Canon FD,
Sony E,
Nikon F, Nikon Z,
Leica M, Leica R, Leica L,
Panavision PV, B4, C-Mount, OCT-19, M42, MFT, L39/LTM
```

Añadir nuevo array `COVERAGE_FORMATS` con los formatos digitales + film + anamórficos solicitados.

Ampliar `BRANDS` con: Zeiss, Cooke, Angénieux, Leica, Nikon, Sigma, Tokina, Schneider, Laowa, DZOFilm, Atlas, Tribe7, Vantage.

Añadir `LENS_SERIES` (texto libre por ahora, no opciones cerradas).

## 3. Ampliar `CATEGORY_FILTERS`

- `cameras`: añadir filtro `coverage` (multi).
- `lenses`: reemplazar `format` por `coverage`; añadir filtros boolean `anamorphic`, `vintage`, `rehoused` (chips toggle); añadir filtro `series` (texto libre/búsqueda) — opcional, si añade complejidad lo dejamos solo en specs.

El componente `RentalHouse.tsx` debe interpretar los nuevos booleans (se renderizan como toggles, no select).

## 4. `ProductForm.tsx`

En la pestaña **Specs**:

- Añadir campos: `coverage` (select), `series` (input), `year` (input number), y 3 switches: `is_anamorphic`, `is_vintage`, `is_rehoused`.
- Los switches se muestran siempre que la categoría sea `lenses`.

Actualizar zod schema, defaults, payload del submit.

## 5. `RentalHouse.tsx`

- Soportar filtros boolean (chips toggle "Anamórfica", "Vintage", "Rehoused").
- Soportar nuevo filtro `coverage` (multi-select).
- Construir query Supabase: `.eq('is_anamorphic', true)` cuando esté activo, `.in('coverage', [...])` cuando haya selección.

## 6. i18n

Añadir claves nuevas en `es/ca/en/fr.json`:

- `rental.dyn.coverage`, `rental.dyn.coverage.<value>` (FF, S35, VV, LF, 8mm, S8, 16mm, S16, 35mm, 65mm, IMAX70, AnaFF, AnaS35, APSC, MFT).
- `rental.dyn.anamorphic`, `rental.dyn.vintage`, `rental.dyn.rehoused`, `rental.dyn.series`, `rental.dyn.year`.
- `admin.products.fields.coverage`, `series`, `year`, `anamorphic`, `vintage`, `rehoused`.

## Archivos a crear/modificar

- **Migración SQL** (nuevas columnas en `products`).
- **Modificar:** `src/lib/rentalFilters.ts`, `src/components/admin/ProductForm.tsx`, `src/pages/RentalHouse.tsx`, los 4 ficheros `src/i18n/locales/*.json`.

## Fuera de alcance (para iteraciones siguientes)

- Estado Rental vs Store por producto — actualmente Store y Rental usan tablas separadas (`store_products` vs `products`); no hace falta una columna `status`. Si quieres unificarlo dímelo y lo planteo aparte.
- Filtros booleanos en Super Store (`store_products`) — el módulo Store es independiente y aún muy simple.
- UI de "compare specs" entre productos.
- Búsqueda full-text de series/modelo.

¿Apruebas el plan? Si quieres ajustar algo (p.ej. añadir también el campo `status` Rental/Store en `products` para unificar, o aplicar los mismos filtros a Super Store), dímelo antes de implementar.
