import jsPDF from "jspdf";

export type BookingPdfData = {
  reference: string;
  status: string;
  paymentStatus?: string;
  startDate: string;
  endDate: string;
  customer: {
    full_name: string;
    email: string;
    phone?: string;
    company?: string;
    tax_id?: string;
    address_line1?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    days: number;
    price_day: number;
    subtotal: number;
  }>;
  subtotal: number;
  deposit: number;
  total: number;
  contactEmail?: string;
  whatsappUrl?: string;
  brandName?: string;
};

const money = (n: number) => `${n.toFixed(2)} €`;

export const generateBookingPdf = (data: BookingPdfData) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(data.brandName || "Booking", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Reserva ${data.reference}`, w - margin, y, { align: "right" });
  y += 24;

  doc.setDrawColor(200);
  doc.line(margin, y, w - margin, y);
  y += 18;

  // Status
  doc.setFontSize(10);
  doc.text(`Estado: ${data.status}`, margin, y);
  if (data.paymentStatus) doc.text(`Pago: ${data.paymentStatus}`, margin + 200, y);
  doc.text(`Fechas: ${data.startDate} → ${data.endDate}`, w - margin, y, { align: "right" });
  y += 24;

  // Customer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Cliente", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const c = data.customer;
  const lines = [
    c.full_name,
    c.company,
    c.tax_id ? `NIF: ${c.tax_id}` : null,
    c.email,
    c.phone,
    [c.address_line1, c.postal_code, c.city, c.country].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];
  lines.forEach((l) => { doc.text(l, margin, y); y += 13; });
  y += 8;

  // Items table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Productos", margin, y);
  y += 14;
  doc.setFontSize(9);
  doc.text("Producto", margin, y);
  doc.text("Cant.", margin + 280, y);
  doc.text("Días", margin + 330, y);
  doc.text("€/día", margin + 380, y);
  doc.text("Subtotal", w - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  data.items.forEach((it) => {
    if (y > 720) { doc.addPage(); y = margin; }
    const name = doc.splitTextToSize(it.product_name, 260);
    doc.text(name, margin, y);
    doc.text(String(it.quantity), margin + 280, y);
    doc.text(String(it.days), margin + 330, y);
    doc.text(money(it.price_day), margin + 380, y);
    doc.text(money(it.subtotal), w - margin, y, { align: "right" });
    y += 13 * (Array.isArray(name) ? name.length : 1) + 4;
  });

  y += 8;
  doc.setDrawColor(180);
  doc.line(margin, y, w - margin, y);
  y += 16;

  // Totals
  doc.setFontSize(10);
  doc.text("Subtotal", w - margin - 120, y);
  doc.text(money(data.subtotal), w - margin, y, { align: "right" });
  y += 14;
  doc.text("Fianza", w - margin - 120, y);
  doc.text(money(data.deposit), w - margin, y, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", w - margin - 120, y);
  doc.text(money(data.total), w - margin, y, { align: "right" });
  y += 30;

  // Contact
  if (data.contactEmail || data.whatsappUrl) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    if (data.contactEmail) { doc.text(`Contacto: ${data.contactEmail}`, margin, y); y += 12; }
    if (data.whatsappUrl) { doc.text(`WhatsApp: ${data.whatsappUrl}`, margin, y); }
  }

  doc.save(`reserva-${data.reference}.pdf`);
};
