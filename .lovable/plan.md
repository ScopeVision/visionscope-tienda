
# Gestión de productos en el panel admin

Objetivo: que puedas crear, editar, publicar/ocultar y borrar productos del Rental House desde `/admin/products`, con subida de imágenes y soporte multiidioma.

## 1. Rediseño de `AdminProducts.tsx`

- Añadir botón **"Nuevo producto"** arriba a la derecha que abre un `Dialog` con el formulario.
- En cada fila de la tabla, añadir acciones:
  - **Editar** (abre el mismo Dialog precargado).
  - **Publicar/Ocultar** (toggle rápido sobre `published`).
  - **Eliminar** (con `AlertDialog` de confirmación).
- Buscador por nombre y filtro por categoría arriba de la tabla.

## 2. Nuevo componente `ProductForm.tsx`

Formulario con `react-hook-form` + `zod` para validación, organizado en pestañas (`Tabs`):

- **General**
  - Slug (auto-generado desde `name_es`, editable, único)
  - Categoría (`Select` desde `categories`)
  - Tags (multi-select desde `tags` — controla los filtros de Formato y Uso del Rental House)
  - Stock, precio/día, precio/semana (opcional), fianza
  - Switch `published`
- **Contenido ES / CA / EN / FR**
  - `name_*` (ES obligatorio, resto opcional)
  - `description_*` (`Textarea`)
- **Imágenes**
  - Drag & drop / selector múltiple
  - Preview en grid con botón borrar y reordenar (drag)
  - Sube al bucket `product-images` y guarda las URLs públicas en `products.images[]`

## 3. Subida de imágenes a Storage

- Bucket `product-images` ya existe y es público.
- Path por producto: `products/{productId}/{timestamp}-{filename}`.
- Validar tipo (jpg/png/webp) y tamaño (máx 5 MB).
- Al borrar una imagen del formulario, borrar también el archivo del bucket.
- Necesitaré añadir **políticas RLS de Storage** para permitir que solo usuarios admin suban/borren.

## 4. Mutaciones con React Query

- `useMutation` para crear / actualizar / borrar / toggle publicado.
- Invalida `["admin-products"]` y `["products"]` (catálogo público) tras cada cambio.
- Toasts de éxito/error con `sonner`.

## 5. Gestión de tags y categorías (mejora menor)

Ya existen `/admin/categories` y `/admin/tags`, pero conviene que el `ProductForm` permita **crear un tag nuevo "al vuelo"** desde el multi-select (útil cuando añades un producto y necesitas un tag de formato/uso que aún no existe).

## 6. Migración SQL necesaria

Solo políticas de Storage para el bucket `product-images`:

```sql
-- Admins pueden subir, actualizar y borrar imágenes
CREATE POLICY "Admins upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));
```

(El bucket ya es público, así que cualquiera puede leer las imágenes — correcto para un catálogo.)

## 7. Archivos que se crearán o modificarán

- **Modificar:** `src/pages/admin/AdminProducts.tsx`
- **Crear:** `src/components/admin/ProductForm.tsx`
- **Crear:** `src/components/admin/ImageUploader.tsx`
- **Crear:** `src/lib/slugify.ts` (helper para auto-generar slugs)
- **Crear:** migración SQL para las políticas de Storage
- **Modificar:** `src/i18n/locales/{es,ca,en,fr}.json` (nuevas claves: campos del formulario, mensajes de validación, toasts)

## Fuera de alcance (lo dejo para iteraciones siguientes si lo pides)

- Importación CSV masiva de productos
- Historial de cambios / versionado
- Duplicar producto
- Edición inline en la tabla

---

**Requisito previo para usarlo:** necesitas estar logueado como admin. Si aún no tienes usuario admin, dime y te indico cómo crear el primero (registro en `/admin/login` + asignación manual del rol en `user_roles`).
