# Configuración de Google OAuth — The Vision Scope

Este documento explica paso a paso cómo activar el login con Google en la aplicación.
El código ya está preparado; solo necesitas configurar las credenciales.

---

## Paso 1: Crear proyecto en Google Cloud Console

1. Ve a https://console.cloud.google.com
2. Haz click en el selector de proyectos (arriba a la izquierda) → "Nuevo proyecto"
3. Nombre: `The Vision Scope` → Crear
4. En el menú lateral: **APIs y servicios → Pantalla de consentimiento OAuth**
5. Selecciona **Externo** → Crear
6. Rellena: nombre de la app (`The Vision Scope`), email de soporte, email del desarrollador → Guardar

---

## Paso 2: Crear credenciales OAuth 2.0

1. En el menú lateral: **APIs y servicios → Credenciales**
2. Click en **+ Crear credenciales → ID de cliente OAuth 2.0**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `TVS Web Client`
5. En **Orígenes de JavaScript autorizados**, agrega:
   - `http://localhost:5173` (desarrollo local)
   - `https://[tu-dominio-de-produccion].com` (producción — reemplaza cuando lo tengas)
6. En **URIs de redireccionamiento autorizados**, agrega los mismos dominios
7. Click **Crear**
8. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`)

---

## Paso 3: Configurar variable de entorno en Lovable

1. En Lovable, ve a tu proyecto → **Settings → Environment Variables**
2. Agrega:
   - Key: `VITE_GOOGLE_CLIENT_ID`
   - Value: el ID de cliente que copiaste en el paso anterior
3. Guarda y redespliega

---

## Paso 4: Activar Google Provider en Supabase

1. Ve a tu proyecto de Supabase → **Authentication → Providers**
2. Busca **Google** y actívalo
3. Pega el **Client ID** y el **Client Secret** (también disponible en Google Cloud Console)
4. En **Authorized redirect URIs**, copia la URL que Supabase te muestra y agrégala en Google Cloud Console

---

## Paso 5: Verificar que funciona

1. Abre la app en desarrollo (`npm run dev` o desde Lovable)
2. Ve al Checkout → haz click en **Continuar con Google**
3. Deberías ver el popup de selección de cuenta de Google
4. Tras autorizar, el formulario de checkout se pre-rellena automáticamente con tu nombre y email

---

## Notas

- El código del cliente está en `src/lib/googleAuth.ts`
- El contexto de autenticación está en `src/contexts/AuthContext.tsx`
- El botón de Google en el checkout está en `src/pages/Checkout.tsx` (función `handleGoogleLogin`)
- Una vez `VITE_GOOGLE_CLIENT_ID` está configurado, el stub se reemplazará con la llamada real al SDK
