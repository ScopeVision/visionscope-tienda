import { format } from "date-fns";

/**
 * Convierte un Date a fecha de calendario "YYYY-MM-DD" en la zona horaria
 * LOCAL del navegador.
 *
 * NUNCA uses date.toISOString().slice(0,10) para esto: convierte a UTC y
 * en España (UTC+1/+2) devuelve el día anterior. Las fechas de alquiler son
 * fechas de calendario, no instantes en el tiempo.
 */
export function toDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
