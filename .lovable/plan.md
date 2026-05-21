# Unificar sistema de imágenes (crop / focal point / zoom)

## Diagnóstico

Todas las vistas ya usan `SmartImage`, pero el render no es consistente porque:

1. **`tailwind-merge` elimina `object-cover`** cuando un consumidor pasa otra utilidad `object-*`. `SuperStore` pasa `object-contain`, lo que anula el cover y, por tanto, el `objectPosition` (focal point) deja de tener efecto visible.
2. **El `transform: scale()` del zoom va en el `<img>` con `style` inline**. Eso entra en conflicto con clases como `group-hover:scale-105` (en `ProductCard`), que quedan anuladas por el estilo inline. Resultado: en cards con zoom configurado el hover se pierde, y la composición zoom + hover no es idéntica entre vistas.
3. **El preview del admin aplica `transform-origin` al `<img>` igual que el frontend, pero el frontend no envuelve la imagen** (`wrap=false` por defecto). Si el contenedor padre no tiene `overflow-hidden`, el zoom “sangra” fuera del marco — algunas vistas lo tienen, otras no.
4. **`Projects.tsx` usa aspect ratios distintos** (3/4, 16/10, 4/3). El usuario pide no tocar aspect ratios de cards, así que se respeta; sólo se garantiza que el render interno aplique el focal point igual.

## Cambios

### 1. `SmartImage` — un solo modelo de render

- Aplicar siempre `overflow-hidden` envolviendo el `<img>` en un wrapper interno (sin cambiar la geometría externa: el wrapper toma `w-full h-full absolute inset-0`).
- Mover el `transform: scale(zoom)` y el `transform-origin` al `<img>`, pero usando una clase utilitaria propia que NO colisione con `scale-*` de Tailwind (aplicar como `style` SOLO cuando hay zoom != 1, y exponer un wrapper aparte para efectos hover).
- Reservar el `<img>` para zoom guardado + focal point. Cualquier efecto `hover:scale-*` se aplica en el **wrapper** vía nueva prop `hoverZoomClassName`.
- Normalizar las clases del `<img>` para que `object-cover` no pueda ser sobreescrito accidentalmente: usar `!object-cover` (importante) o aplicar el cover vía `style={{ objectFit: "cover" }}` para blindarlo de `twMerge`.
- Eliminar la prop `wrap` (queda redundante; siempre envolvemos).

### 2. Consumidores — quitar overrides que rompen el sistema

- `ProductCard` (grid): mover `group-hover:scale-105` a la nueva prop `hoverZoomClassName` del wrapper, en vez de pasarlo en `className` del `<img>`.
- `SuperStore`: eliminar `object-contain` del `<SmartImage>` para no anular el cover/focal point. Si se quiere preservar producto completo sin recorte, hacerlo a nivel de configuración por imagen (zoom 1 + focal centrado ya lo hace).
- `RentalHouse`, `CategorySlider`, `HeroSlider`, `Projects`, `ProjectDetail`, `ProductDetail` (principal + thumbnails): revisar y usar la API unificada (`hoverZoomClassName` donde aplique).

### 3. Admin preview = frontend

- En `ImageFramingEditor` reusar `SmartImage` (con `objectPosition` y `scale` derivados del estado en edición vía un setting “virtual”) en lugar de duplicar el render manual. Así el preview del admin pinta exactamente como las cards/sliders/detalle.
- Mantener el drag-to-pan y el grid de tercios encima del `SmartImage`.

### 4. Sin cambios

- Tabla `image_settings` y `useImageSettings` se mantienen.
- Aspect ratios de cada vista NO se modifican (cuadrado en cards/RentalHouse/SuperStore, 4/3 en CategorySlider, mixto en Projects, etc.).
- No se toca lógica de catálogo, carrito, edge functions ni RLS.

## Resultado esperado

- Una imagen configurada en admin se ve idéntica en home, catálogo, página individual, related, sliders y Super Store.
- Cero recortes “automáticos” no controlados; el `objectPosition` y el `scale` guardados siempre ganan.
- Efectos hover (zoom on hover) siguen funcionando porque viven en el wrapper, no en el `<img>`.
- El preview del admin es exactamente lo que se renderiza en producción.
