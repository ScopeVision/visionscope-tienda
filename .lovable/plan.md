# Sistema de Ajuste Manual de Imágenes

## Concepto

En lugar de modificar archivos, guardamos **metadatos de encuadre** por cada imagen (focal point X/Y + zoom) y los aplicamos en frontend vía `object-position` y `transform: scale()`. La imagen original nunca se toca.

Cada imagen puede tener **dos ajustes**: uno para **desktop** y otro para **mobile**.

## 1. Modelo de datos

Nueva tabla `image_settings` (clave = URL de la imagen):

```
image_settings
  url            text PRIMARY KEY
  focal_x        numeric  (0–100, default 50)
  focal_y        numeric  (0–100, default 50)
  zoom           numeric  (1.0–3.0, default 1.0)
  focal_x_mobile numeric  (nullable; si null usa desktop)
  focal_y_mobile numeric
  zoom_mobile    numeric
  updated_at     timestamptz
```

- RLS: lectura pública, escritura solo admin.
- Clave por URL: funciona con cualquier imagen del proyecto (productos, hero, categorías, proyectos, store, blog) sin tocar sus tablas.

## 2. Componente frontend: `<SmartImage />`

Reemplaza los `<img>` actuales en las superficies que listas:
- Catálogo Rental (`ProductCard`)
- Producto individual (`ProductDetail`)
- Categorías (`CategorySlider`, `RentalHouse`)
- Hero (`HeroSlider`)
- Proyectos (`Projects`, `ProjectDetail`)
- Super Store (`SuperStore`)

Comportamiento:
- Lee `image_settings` (cacheado en React Query, un único fetch global).
- Aplica `style={{ objectPosition: \`${x}% ${y}%\`, transform: \`scale(${zoom})\` }}`.
- Selecciona desktop/mobile según `useIsMobile()`.
- Sin ajuste guardado → comportamiento actual (centrado, sin zoom).

## 3. Editor en admin

Nuevo componente `ImageFramingEditor` (dialog):
- Lanzado desde `ImageUploader` con un botón "Ajustar encuadre" en cada miniatura.
- Layout: dos previews lado a lado (Desktop 4:3 / Mobile 4:5) mostrando la imagen con los ajustes en vivo.
- Controles simples:
  - **Click/drag sobre la preview** = mover focal point
  - **Slider de zoom** (1× – 3×)
  - Toggle "usar mismos ajustes en móvil" (default ON)
  - Botón "Reset"
- Guardar → upsert en `image_settings`.

## 4. Integración en `ImageUploader`

Cada miniatura del uploader gana un botón "Encuadre" junto a "Hacer portada" / "Eliminar". Se usa tal cual desde `ProductForm`, `AdminHero`, `AdminProjects`, `AdminCategories`, `AdminStoreProducts`, `AdminBlog` (todos ya usan `ImageUploader` o `SiteImageUploader`).

## 5. Archivos

**Nuevos**
- `supabase/migrations/…_image_settings.sql`
- `src/components/SmartImage.tsx`
- `src/components/admin/ImageFramingEditor.tsx`
- `src/hooks/useImageSettings.ts` (fetch + cache global)

**Modificados**
- `src/components/admin/ImageUploader.tsx` — botón "Encuadre" por miniatura
- `src/components/admin/SiteImageUploader.tsx` — idem
- `src/components/catalog/ProductCard.tsx` — `<img>` → `<SmartImage>`
- `src/pages/ProductDetail.tsx`
- `src/components/home/HeroSlider.tsx`
- `src/components/home/CategorySlider.tsx`
- `src/pages/RentalHouse.tsx`
- `src/pages/Projects.tsx`, `src/pages/ProjectDetail.tsx`
- `src/pages/SuperStore.tsx`
- i18n (4 idiomas) — claves del editor

## 6. Lo que NO cambia

- Las imágenes originales en Storage no se modifican.
- Sin ajuste = render igual que hoy.
- El `ImageUploader` sigue funcionando exactamente igual para subir/borrar/portada.

## Notas técnicas

- `object-position` requiere `object-fit: cover` (ya lo usamos en todas las cards).
- El zoom se hace con `transform: scale()` sobre la `<img>`, dentro de un contenedor `overflow-hidden`.
- Drag del focal point: handler `onPointerDown/Move` sobre la preview, calcula `%` relativo al rect.
