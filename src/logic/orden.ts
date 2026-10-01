// Sin dependencias (solo tipos): los tests lo importan directo con Node.

/** Lo mínimo de una promo que hace falta para ordenarla. */
export interface PromoOrdenable {
  id: string;
  bancoBilleteraNombre: string;
  porcentajeDescuento: number;
  tipoTope: "sin_tope" | "por_compra" | "por_dia" | "por_semana" | "por_mes";
  montoTope: number | null;
  minimoCompra: number | null;
  /** Solo en lugares puntuales (ferias identificadas, universidades): va después de las de alcance general. */
  alcanceLimitado?: boolean;
}

/** Veces que se puede usar el tope en un mes, para comparar topes de distinto período. */
const USOS_POR_MES: Record<PromoOrdenable["tipoTope"], number> = {
  sin_tope: Infinity,
  por_dia: 30,
  por_semana: 4,
  por_mes: 1,
  // No sabemos cuántas compras permite: se toma una sola, para no prometer de más
  por_compra: 1,
};

/**
 * Reintegro máximo que se puede cobrar en un mes con esa promo. Así $6.000 por semana ($24.000 al mes)
 * queda por encima de $10.000 por mes, en vez de compararse los números sueltos.
 */
export function topeMensual(p: Pick<PromoOrdenable, "tipoTope" | "montoTope">): number {
  if (p.tipoTope === "sin_tope") return Infinity;
  return (p.montoTope ?? 0) * USOS_POR_MES[p.tipoTope];
}

/**
 * Qué promo conviene más, en este orden: alcance general antes que limitado (el 20% en cualquier almacén le
 * gana al 40% en una feria puntual), mayor porcentaje, mayor tope al mes, menor compra mínima.
 * Devuelve 0 si son igual de convenientes (un empate real).
 */
export function compararBeneficio(a: PromoOrdenable, b: PromoOrdenable): number {
  const limitadaA = a.alcanceLimitado ? 1 : 0;
  const limitadaB = b.alcanceLimitado ? 1 : 0;
  if (limitadaA !== limitadaB) return limitadaA - limitadaB;
  if (b.porcentajeDescuento !== a.porcentajeDescuento) return b.porcentajeDescuento - a.porcentajeDescuento;
  const topeA = topeMensual(a);
  const topeB = topeMensual(b);
  if (topeB !== topeA) return topeB > topeA ? 1 : -1;
  return (a.minimoCompra ?? 0) - (b.minimoCompra ?? 0);
}

/** Orden total y estable entre promos: beneficio y, si empatan, nombre del medio y id (siempre el mismo resultado). */
export function compararPromos(a: PromoOrdenable, b: PromoOrdenable): number {
  return (
    compararBeneficio(a, b) ||
    a.bancoBilleteraNombre.localeCompare(b.bancoBilleteraNombre, "es") ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Orden entre bancos: el beneficio de su mejor promo; si empatan, el que tiene más opciones ese día (más lugares
 * donde usarlo) y después el nombre.
 */
export function compararGrupos(
  a: { bestPromo: PromoOrdenable; totalOpciones: number; bancoBilleteraNombre: string },
  b: { bestPromo: PromoOrdenable; totalOpciones: number; bancoBilleteraNombre: string },
): number {
  return (
    compararBeneficio(a.bestPromo, b.bestPromo) ||
    b.totalOpciones - a.totalOpciones ||
    a.bancoBilleteraNombre.localeCompare(b.bancoBilleteraNombre, "es")
  );
}

/** "2026-10-01" en hora local (no UTC: a la noche toISOString ya da el día siguiente). */
export function fechaIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Porcentaje que se muestra como "hasta X%" de un banco: el mayor entre sus promos de alcance general. Las de
 * alcance limitado (una feria puntual al 40%) solo cuentan si el banco no tiene ninguna otra ese día.
 */
export function maxPorcentajeGeneral(
  promos: Pick<PromoOrdenable, "porcentajeDescuento" | "alcanceLimitado">[],
): number {
  const generales = promos.filter((p) => !p.alcanceLimitado);
  return Math.max(...(generales.length ? generales : promos).map((p) => p.porcentajeDescuento));
}

/**
 * Para "Otros días sí tenés descuento": la mejor promo de cada uno de los próximos `dias` días, mirando la
 * vigencia en la fecha de ESE día (una promo que vence hoy no puede aparecer para el jueves).
 */
export function mejorPorDia<
  T extends PromoOrdenable & { diasSemana: number[]; vigenciaDesde: string; vigenciaHasta: string },
>(promos: T[], desde: Date, dias = 6): { diaSemana: number; promo: T }[] {
  const resultado: { diaSemana: number; promo: T }[] = [];
  for (let offset = 1; offset <= dias; offset++) {
    const fecha = new Date(desde);
    fecha.setDate(desde.getDate() + offset);
    const iso = fechaIsoLocal(fecha);
    const dia = fecha.getDay();
    const candidatas = promos.filter(
      (p) => p.diasSemana.includes(dia) && iso >= p.vigenciaDesde && iso <= p.vigenciaHasta,
    );
    if (candidatas.length) resultado.push({ diaSemana: dia, promo: [...candidatas].sort(compararPromos)[0] });
  }
  return resultado;
}
