// Booking communication templates (manual-first email system).
// Generates subject + body text for each communication type per language.

export type CommType =
  | "auto_received"
  | "availability_confirmed"
  | "preparation"
  | "processed"
  | "completed"
  | "cancelled"
  | "custom";

export const COMM_TYPES: { value: CommType; label: string }[] = [
  { value: "availability_confirmed", label: "Confirmar disponibilidad" },
  { value: "preparation", label: "Pedido en preparación" },
  { value: "processed", label: "Pedido procesado" },
  { value: "completed", label: "Pedido finalizado" },
  { value: "cancelled", label: "Pedido cancelado" },
  { value: "custom", label: "Email personalizado" },
];

export type CommContext = {
  reference: string;
  customerName: string;
  startDate: string;
  endDate: string;
  itemsText: string;
  total: string;
  contactEmail: string;
  whatsappUrl: string;
};

type Lang = "es" | "ca" | "en" | "fr";

const T: Record<CommType, Record<Lang, { subject: string; body: (c: CommContext) => string }>> = {
  auto_received: {
    es: {
      subject: "Hemos recibido tu reserva {ref}",
      body: (c) => `Hola ${c.customerName},

Hemos recibido tu solicitud de reserva ${c.reference}.

Fechas: ${c.startDate} → ${c.endDate}
Productos:
${c.itemsText}
Total estimado: ${c.total}

Tu reserva será revisada manualmente por nuestro equipo. Te confirmaremos la disponibilidad lo antes posible.

Para cualquier consulta:
WhatsApp: ${c.whatsappUrl}
Email: ${c.contactEmail}

Gracias por confiar en nosotros.`,
    },
    ca: {
      subject: "Hem rebut la teva reserva {ref}",
      body: (c) => `Hola ${c.customerName},

Hem rebut la teva sol·licitud de reserva ${c.reference}.

Dates: ${c.startDate} → ${c.endDate}
Productes:
${c.itemsText}
Total estimat: ${c.total}

La teva reserva serà revisada manualment pel nostre equip.

WhatsApp: ${c.whatsappUrl}
Email: ${c.contactEmail}`,
    },
    en: {
      subject: "We received your booking {ref}",
      body: (c) => `Hi ${c.customerName},

We received your booking request ${c.reference}.

Dates: ${c.startDate} → ${c.endDate}
Items:
${c.itemsText}
Estimated total: ${c.total}

Your booking will be reviewed manually by our team. We will confirm availability shortly.

WhatsApp: ${c.whatsappUrl}
Email: ${c.contactEmail}`,
    },
    fr: {
      subject: "Nous avons reçu votre réservation {ref}",
      body: (c) => `Bonjour ${c.customerName},

Nous avons reçu votre demande de réservation ${c.reference}.

Dates : ${c.startDate} → ${c.endDate}
Produits :
${c.itemsText}
Total estimé : ${c.total}

WhatsApp : ${c.whatsappUrl}
Email : ${c.contactEmail}`,
    },
  },
  availability_confirmed: {
    es: {
      subject: "Disponibilidad confirmada — Reserva {ref}",
      body: (c) => `Hola ${c.customerName},

Confirmamos la disponibilidad de tu reserva ${c.reference} para las fechas ${c.startDate} → ${c.endDate}.

${c.itemsText}

Pronto te enviaremos los detalles de recogida.

WhatsApp: ${c.whatsappUrl}`,
    },
    ca: { subject: "Disponibilitat confirmada — Reserva {ref}", body: (c) => `Confirmem la disponibilitat de ${c.reference}. ${c.startDate} → ${c.endDate}.` },
    en: { subject: "Availability confirmed — Booking {ref}", body: (c) => `Hi ${c.customerName}, your booking ${c.reference} is confirmed for ${c.startDate} → ${c.endDate}.` },
    fr: { subject: "Disponibilité confirmée — Réservation {ref}", body: (c) => `Bonjour, votre réservation ${c.reference} est confirmée du ${c.startDate} au ${c.endDate}.` },
  },
  preparation: {
    es: {
      subject: "Tu pedido está en preparación — {ref}",
      body: (c) => `Hola ${c.customerName},

Estamos preparando tu pedido ${c.reference} para las fechas ${c.startDate} → ${c.endDate}.

${c.itemsText}

Te avisaremos cuando esté listo para recoger.`,
    },
    ca: { subject: "El teu comanda en preparació — {ref}", body: (c) => `Estem preparant ${c.reference}.` },
    en: { subject: "Your order is being prepared — {ref}", body: (c) => `Hi ${c.customerName}, we are preparing ${c.reference}.` },
    fr: { subject: "Votre commande est en préparation — {ref}", body: (c) => `Nous préparons votre commande ${c.reference}.` },
  },
  processed: {
    es: {
      subject: "Pedido procesado — {ref}",
      body: (c) => `Hola ${c.customerName},

Tu pedido ${c.reference} ha sido procesado y está listo para recoger.

WhatsApp: ${c.whatsappUrl}`,
    },
    ca: { subject: "Comanda processada — {ref}", body: (c) => `La teva comanda ${c.reference} està llesta.` },
    en: { subject: "Order processed — {ref}", body: (c) => `Hi ${c.customerName}, your order ${c.reference} is ready.` },
    fr: { subject: "Commande traitée — {ref}", body: (c) => `Votre commande ${c.reference} est prête.` },
  },
  completed: {
    es: {
      subject: "Reserva finalizada — {ref}",
      body: (c) => `Hola ${c.customerName},

Tu reserva ${c.reference} ha finalizado. Gracias por confiar en nosotros.

Esperamos verte pronto.`,
    },
    ca: { subject: "Reserva finalitzada — {ref}", body: (c) => `Reserva ${c.reference} finalitzada. Gràcies!` },
    en: { subject: "Booking completed — {ref}", body: (c) => `Hi ${c.customerName}, booking ${c.reference} is completed. Thank you!` },
    fr: { subject: "Réservation terminée — {ref}", body: (c) => `Votre réservation ${c.reference} est terminée. Merci !` },
  },
  cancelled: {
    es: {
      subject: "Reserva cancelada — {ref}",
      body: (c) => `Hola ${c.customerName},

Te confirmamos la cancelación de tu reserva ${c.reference}.

Si tienes cualquier duda, contáctanos por WhatsApp: ${c.whatsappUrl}`,
    },
    ca: { subject: "Reserva cancel·lada — {ref}", body: (c) => `Reserva ${c.reference} cancel·lada.` },
    en: { subject: "Booking cancelled — {ref}", body: (c) => `Hi ${c.customerName}, booking ${c.reference} has been cancelled.` },
    fr: { subject: "Réservation annulée — {ref}", body: (c) => `Votre réservation ${c.reference} a été annulée.` },
  },
  custom: {
    es: { subject: "Sobre tu reserva {ref}", body: (c) => `Hola ${c.customerName},\n\n` },
    ca: { subject: "Sobre la teva reserva {ref}", body: (c) => `Hola ${c.customerName},\n\n` },
    en: { subject: "About your booking {ref}", body: (c) => `Hi ${c.customerName},\n\n` },
    fr: { subject: "À propos de votre réservation {ref}", body: (c) => `Bonjour ${c.customerName},\n\n` },
  },
};

export const renderTemplate = (
  type: CommType,
  lang: string,
  ctx: CommContext,
): { subject: string; body: string } => {
  const l = (["es", "ca", "en", "fr"].includes(lang) ? lang : "es") as Lang;
  const tpl = T[type][l];
  return {
    subject: tpl.subject.replace("{ref}", ctx.reference),
    body: tpl.body(ctx),
  };
};
