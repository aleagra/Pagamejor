import { Promocion, TipoTope } from "@/data/schema";
import { GroupedBankPromo, PromoVariante } from "@/logic/types";

const fmtDiaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
const fmtMes = new Intl.DateTimeFormat("es-AR", { month: "long" });

/** "martes 29 de septiembre". */
export function fechaTexto(d: Date): string {
  return `${fmtDiaSemana.format(d)} ${d.getDate()} de ${fmtMes.format(d)}`;
}

/** "martes". */
export function nombreDiaSemana(d: Date): string {
  return fmtDiaSemana.format(d);
}

export function formatMoneda(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return "";
  return `$${monto.toLocaleString("es-AR")}`;
}

const PERIODO_TOPE: Record<Exclude<TipoTope, "sin_tope">, string> = {
  por_compra: "por compra",
  por_dia: "por día",
  por_semana: "por semana",
  por_mes: "por mes",
};

/** "Sin tope" o "Tope $5.000 por semana". */
export function formatTope(tipoTope: TipoTope, montoTope: number | null): string {
  if (tipoTope === "sin_tope") return "Sin tope";
  const periodo = PERIODO_TOPE[tipoTope];
  return `Tope ${formatMoneda(montoTope)}${periodo ? ` ${periodo}` : ""}`;
}

const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";

/**
 * Algunas fuentes guardan en localesAdheridos la frase promocional en vez del comercio
 * ("Aprovechá 20% de reintegro en Jumbo pagando con…"). Para mostrar, se extrae el nombre ("Jumbo").
 * Si el texto no tiene un porcentaje, se deja tal cual.
 */
export function limpiarComercio(texto: string): string {
  const t = texto.trim();
  if (!/\d+\s*%/.test(t)) return t;
  const s = t
    .split(/(?=Pag[aá]\s|Us[aá]\s|Compr[aá]\s)/)[0]
    .replace(/^aprovech[aá]\s+/i, "")
    .replace(
      /^-?(hasta\s+)?(un\s+)?\d+\s*%\s*(off\s+)?(de\s+(reintegro|descuento|ahorro)\s*)?(adicional\s+)?(los\s+\S+\s+)?(en\s+tus\s+compras\s+)?en\s+/i,
      ""
    )
    .replace(/\s+\d+\s*%.*$/i, "")
    .replace(/\s+(pagando|abonando|con|los|todos|de\s+lunes)\b.*$/i, "")
    .replace(new RegExp(`\\s+(${MESES})\\b.*$`, "i"), "")
    .replace(/[.\s]+$/, "")
    .trim();
  if (!s || /^\d/.test(s)) return t;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nombre corto de un comercio o modalidad de la variante. */
export function nombreVariante(v: PromoVariante): string {
  const local = v.localesAdheridos?.trim();
  return local ? limpiarComercio(local) : v.etiquetaModalidad;
}

/** "Toledo", "Toledo y Coto", "Toledo, Coto y 3 más". */
export function resumenComercios(variantes: PromoVariante[], maxNombres = 2): string {
  const nombres = [...new Set(variantes.map(nombreVariante).filter(Boolean))];
  if (nombres.length <= 1) return nombres[0] ?? "";
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  const visibles = nombres.slice(0, maxNombres);
  const resto = nombres.length - visibles.length;
  return `${visibles.join(", ")} y ${resto} más`;
}

/** Tope del mejor nivel del grupo, para la línea de resumen. */
export function resumenTope(group: GroupedBankPromo): string {
  const nivel = group.niveles[0];
  if (!nivel) return formatTope(group.bestPromo.tipoTope, group.bestPromo.montoTope);
  if (nivel.hasSinTope) return "Sin tope";
  const conMayorTope = nivel.items.find((i) => i.montoTope === nivel.maxTope) ?? nivel.items[0];
  const tope = formatTope(conMayorTope.tipoTope, conMayorTope.montoTope);
  return nivel.items.length > 1 ? tope.replace("Tope", "Tope hasta") : tope;
}

/** True si la promo se cobra pagando con MODO (billetera MODO o promo de un banco vía MODO). */
export function requiereModo(promo: Pick<Promocion, "id" | "bancoBilleteraId" | "medioPagoDetalle">): boolean {
  return promo.bancoBilleteraId === "modo" || promo.id.startsWith("modo-") || /\bMODO\b/.test(promo.medioPagoDetalle);
}

export function varianteRequiereModo(group: GroupedBankPromo, v: PromoVariante): boolean {
  return requiereModo({ id: v.id, bancoBilleteraId: group.bancoBilleteraId, medioPagoDetalle: v.medioPagoDetalle });
}

/** "todas" si cada opción del grupo se paga con MODO, "algunas" si solo parte, "ninguna" si no. */
export function modoEnGrupo(group: GroupedBankPromo): "todas" | "algunas" | "ninguna" {
  const n = group.variantes.filter((v) => varianteRequiereModo(group, v)).length;
  if (n === 0) return "ninguna";
  return n === group.variantes.length ? "todas" : "algunas";
}

export type FormaDePago = "NFC" | "QR MODO" | "QR" | "Clave DNI" | "Transferencia" | "Online" | "Tarjeta";

export interface MetodoPago {
  /** Cómo se paga en la caja, en orden: ej. ["QR", "Clave DNI"]. */
  formas: FormaDePago[];
  /** Con qué dinero: "Crédito", "Débito", "Crédito o débito", "Dinero en cuenta", "Prepaga"… */
  fondos: string | null;
  /** Resumen de una línea: "NFC · Crédito", "QR MODO · Crédito o débito". */
  texto: string;
}

/**
 * Resume el medio de pago de una promo en una línea que se entiende sin abrir el detalle. Es lo que distingue
 * dos opciones del mismo comercio (ej. Toledo con NFC al 20% y con QR al 15%). Sale de medioPagoDetalle,
 * con condicionUso y tipoMedioRequerido como respaldo cuando el texto no alcanza.
 */
export function metodoPago(
  medioPagoDetalle: string,
  condicionUso = "",
  tipo?: "debito" | "credito" | "cuenta" | "cualquiera"
): MetodoPago {
  const m = (medioPagoDetalle || "").toLowerCase();
  const todo = `${m} ${condicionUso.toLowerCase()}`;
  const formas: FormaDePago[] = [];

  if (/tarjeta.*\bo qr\b/.test(m)) formas.push("Tarjeta");
  if (/dinero en cuenta o nfc/.test(m)) formas.push("QR");
  if (/nfc|contactless|sin contacto/.test(m)) formas.push("NFC");
  if (/\bmodo\b/.test(m)) formas.push("QR MODO");
  else if (/\bqr\b/.test(m) && !formas.includes("QR")) formas.push("QR");
  if (/clave dni/.test(m)) formas.push("Clave DNI");
  if (/transferencia/.test(m)) formas.push("Transferencia");
  if (formas.length === 0 && /online|mercado libre|cabify|\bweb\b|checkout/.test(m)) formas.push("Online");
  if (formas.length === 0 && /nfc|contactless/.test(todo)) formas.push("NFC");
  if (formas.length === 0 && /\bqr\b/.test(todo)) formas.push("QR");
  if (formas.length === 0) formas.push("Tarjeta");

  const credito = /cr[eé]dito/.test(m);
  const debito = /d[eé]bito/.test(m);
  let fondos: string | null = null;
  if (/prepaga/.test(m)) fondos = credito ? "Prepaga o crédito" : "Prepaga";
  else if (credito && debito) fondos = "Crédito o débito";
  else if (credito) fondos = "Crédito";
  else if (debito) fondos = "Débito";
  else if (/dinero en cuenta/.test(m)) fondos = "Dinero en cuenta";
  else if (tipo === "credito") fondos = "Crédito";
  else if (tipo === "debito") fondos = "Débito";
  else if (tipo === "cuenta") fondos = "Dinero en cuenta";

  const forma = formas.join(" o ");
  return { formas, fondos, texto: fondos ? `${forma} · ${fondos}` : forma };
}
