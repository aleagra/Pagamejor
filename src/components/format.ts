import { Promocion, TipoTope } from "@/data/schema";
import { GroupedBankPromo, PromoVariante } from "@/logic/types";
import { formasDePago, type FormaDePago } from "@/logic/formasPago";
import { compararBeneficio, topeMensual } from "@/logic/orden";

export type { FormaDePago };

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

/** Comercios de la variante: uno, o todos los de una opción que junta promos iguales en distintos comercios. */
export function comerciosVariante(v: PromoVariante): string[] {
  if (v.comercios?.length) return v.comercios.map(limpiarComercio);
  const local = v.localesAdheridos?.trim();
  return [local ? limpiarComercio(local) : v.etiquetaModalidad];
}

/** Nombre de la variante: el comercio, o "AMULETTO, M JEANS, Express y 30 más" si junta varios. */
export function nombreVariante(v: PromoVariante): string {
  const nombres = comerciosVariante(v);
  return nombres.length > 1 ? listarNombres(nombres, 3) : nombres[0];
}

/** Primer tramo del nombre de un comercio: hasta la primera coma, paréntesis o guion. */
export function nombreCorto(nombre: string): string {
  return nombre.split(/,|\s\(|\s-\s/)[0].trim();
}

/** "Toledo", "Toledo y Coto", "Toledo, Coto y 3 más". */
function listarNombres(nombres: string[], maxNombres: number): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  const visibles = nombres.slice(0, maxNombres);
  const resto = nombres.length - visibles.length;
  return resto > 0 ? `${visibles.join(", ")} y ${resto} más` : `${visibles.slice(0, -1).join(", ")} y ${visibles.at(-1)}`;
}

/**
 * "1 opción", "3 opciones" o, si las opciones juntan varios comercios, "13 lugares" (Banco Provincia: una sola
 * opción del 10% en 13 marcas de indumentaria).
 */
export function cantidadOpciones(variantes: PromoVariante[]): string {
  const lugares = new Set(variantes.flatMap((v) => comerciosVariante(v))).size;
  if (lugares > variantes.length) return `${lugares} lugares`;
  return variantes.length === 1 ? "1 opción" : `${variantes.length} opciones`;
}

/** "Toledo", "Toledo y Coto", "Toledo, Coto y 3 más" con todos los comercios de las variantes. */
export function resumenComercios(variantes: PromoVariante[], maxNombres = 2): string {
  // En el resumen va el nombre corto ("Comercios de cercanía, almacenes y…" -> "Comercios de cercanía"); el
  // detalle muestra el completo
  const nombres = [...new Set(variantes.flatMap((v) => comerciosVariante(v).map(nombreCorto)).filter(Boolean))];
  return listarNombres(nombres, maxNombres);
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
  // Las formas las clasifica la lógica: es la misma regla que usa el motor para "¿Cómo podés pagar?"
  const formas = formasDePago(medioPagoDetalle, condicionUso);

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

/** Cómo se compara un banco con el primero de la lista que da su mismo porcentaje. */
export interface ComparacionMismoPorcentaje {
  /** "igual": mismo %, tope y mínimo (un empate). "menor-tope": mismo % con menos tope al mes. "mayor-minimo": pide más compra mínima. */
  tipo: "igual" | "menor-tope" | "mayor-minimo";
}

/**
 * Explica por qué un banco quedó detrás de otro con el mismo porcentaje ("Mismo 30% y mismo tope",
 * "Mismo 15%, menor tope"). `ordenados` es la lista del motor: la mejor opción y después las demás.
 * Solo compara: el orden lo decide el motor (ver src/logic/orden.ts).
 */
export function comparacionMismoPorcentaje(
  g: GroupedBankPromo,
  ordenados: GroupedBankPromo[],
): ComparacionMismoPorcentaje | null {
  const lider = ordenados.find((o) => o.maxPorcentaje === g.maxPorcentaje);
  if (!lider || lider.bancoBilleteraId === g.bancoBilleteraId) return null;
  const a = g.bestPromo;
  const b = lider.bestPromo;
  if (compararBeneficio(a, b) === 0) return { tipo: "igual" };
  if (topeMensual(a) < topeMensual(b)) return { tipo: "menor-tope" };
  if ((a.minimoCompra ?? 0) > (b.minimoCompra ?? 0)) return { tipo: "mayor-minimo" };
  return null;
}

/** "hasta X%" solo si hay más de un porcentaje entre las promos que cuentan para el número del banco. */
export function hayVariosPorcentajes(g: GroupedBankPromo): boolean {
  return g.niveles.filter((n) => n.porcentaje <= g.maxPorcentaje).length > 1;
}

/** El porcentaje más alto del desglose completo (incluye promos de alcance limitado), para el detalle. */
export function maxPorcentajeDetalle(g: GroupedBankPromo): number {
  return Math.max(...g.niveles.map((n) => n.porcentaje));
}
