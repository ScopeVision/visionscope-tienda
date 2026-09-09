import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";

const LEGAL_CONTENT: Record<string, { title: string; content: string }> = {
  privacidad: {
    title: "Política de privacidad",
    content: `The Vision Scope (en adelante, "TVS") trata tus datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).

RESPONSABLE DEL TRATAMIENTO
The Vision Scope · thevisionscope.ventas@gmail.com

DATOS QUE RECOGEMOS
En el proceso de reserva recogemos: nombre completo, email, teléfono, dirección fiscal (NIF/CIF, dirección, ciudad, código postal, país) y, si lo consientes, datos para comunicaciones comerciales.

FINALIDAD Y BASE JURÍDICA
• Gestión de reservas y facturación — ejecución de contrato (art. 6.1.b RGPD).
• Comunicaciones comerciales — consentimiento expreso (art. 6.1.a RGPD), revocable en cualquier momento.

CONSERVACIÓN
Los datos de reserva se conservan durante el tiempo exigido por la normativa fiscal y mercantil (mínimo 5 años). Los datos de marketing se eliminan en el momento en que revocas el consentimiento.

DERECHOS
Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, portabilidad y limitación escribiendo a thevisionscope.ventas@gmail.com.

COOKIES
Consulta nuestra Política de cookies.`,
  },
  condiciones: {
    title: "Términos y condiciones",
    content: `CONTRATO DE ALQUILER — THE VISION SCOPE

1. OBJETO
TVS proporciona en alquiler equipos audiovisuales profesionales al cliente (arrendatario) bajo las condiciones que se describen.

2. RESERVA Y CONFIRMACIÓN
La solicitud de reserva no supone compromiso de disponibilidad. TVS revisará manualmente cada solicitud y confirmará disponibilidad en menos de 24 h laborables. El contrato de alquiler se perfecciona únicamente con la confirmación escrita de TVS y el pago de la señal acordada.

3. RESPONSABILIDAD DEL MATERIAL
El cliente es responsable del equipo desde la recogida hasta la devolución. Cualquier daño, pérdida o robo será facturado según el valor de reposición del equipo.

4. FIANZA
TVS podrá exigir una fianza equivalente al valor de reposición o a la fracción que acuerde con el cliente. La fianza se devuelve en un plazo máximo de 7 días hábiles tras la comprobación del material devuelto.

5. CANCELACIONES
Las cancelaciones deberán comunicarse por escrito con un mínimo de 48 h de antelación. TVS se reserva el derecho de aplicar gastos de gestión según el tiempo de preaviso.

6. LEGISLACIÓN APLICABLE
Este contrato se rige por la legislación española. Para cualquier litigio, las partes se someten a los juzgados y tribunales de Barcelona.`,
  },
  cookies: {
    title: "Política de cookies",
    content: `QUÉ SON LAS COOKIES
Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web.

COOKIES QUE UTILIZAMOS
• Cookies técnicas (necesarias): permiten el funcionamiento básico del sitio (sesión, carrito de la compra). No requieren consentimiento.
• Cookies de análisis: en caso de activarse, se utilizarían para medir el uso del sitio de forma anónima. Actualmente no están activas.
• Cookies de marketing: no utilizamos cookies de marketing de terceros.

CÓMO GESTIONAR LAS COOKIES
Puedes configurar tu navegador para rechazar o eliminar cookies en cualquier momento. Ten en cuenta que deshabilitar las cookies técnicas puede afectar al funcionamiento del sitio.

CONTACTO
Para cualquier consulta sobre nuestra política de cookies: thevisionscope.ventas@gmail.com`,
  },
};

const Legal = () => {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? LEGAL_CONTENT[slug] : null;

  if (!page) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-secondary">Página no encontrada.</p>
        <Link to="/" className="text-accent hover:underline mt-4 inline-block">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{page.title} — The Vision Scope</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="container-page py-16 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>
        <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight mb-10">
          {page.title}
        </h1>
        <div className="prose prose-stone max-w-none whitespace-pre-line text-sm leading-relaxed text-foreground/80 space-y-4">
          {page.content}
        </div>
        <p className="mt-12 text-xs text-secondary">
          Última actualización: septiembre 2026
        </p>
      </div>
    </>
  );
};

export default Legal;
