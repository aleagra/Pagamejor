import { Promocion, RubroId } from "@/data/schema";
import {
  RecommendationResult,
  UpcomingPromo,
  GroupedBankPromo,
  PromoVariante,
  PromoNivelDescuento,
} from "./types";
import { puedePagar, type RecursoPago } from "./formasPago";
import { compararGrupos, compararPromos, maxPorcentajeGeneral, mejorPorDia } from "./orden";

const NOMBRES_DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado"
];

/**
 * Convierte un objeto Date a formato ISO local 'YYYY-MM-DD'
 */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Genera una etiqueta clara para distinguir las variantes de una misma entidad
 * (por ejemplo: "Con NFC (Visa Crédito)", "Con Dinero en cuenta / QR", "En COTO", "En Jumbo")
 */
function getVarianteLabel(promo: Promocion, allInBank: Promocion[]): string {
  const isNfc = /nfc|contactless/i.test(promo.medioPagoDetalle + " " + promo.condicionUso + " " + promo.id);
  const isCuenta = /dinero en cuenta/i.test(promo.medioPagoDetalle + " " + promo.condicionUso + " " + promo.id);
  const local = promo.localesAdheridos?.trim();

  // Si dentro del mismo banco hay variantes del mismo comercio pero distinto medio de pago (ej. Toledo NFC vs Toledo Cuenta)
  const hasSameLocalDifferentMedium = allInBank.some(
    (other) =>
      other.id !== promo.id &&
      other.localesAdheridos === promo.localesAdheridos &&
      (/nfc/i.test(other.id) !== isNfc)
  );

  if (hasSameLocalDifferentMedium) {
    if (isNfc) return (local ? `${local} - ` : "") + "Con NFC (Visa Crédito)";
    if (isCuenta) return (local ? `${local} - ` : "") + "Con Dinero en cuenta / QR";
  }

  if (local && local !== "Comercios adheridos") {
    if (isNfc) return `${local} (con NFC)`;
    if (isCuenta) return `${local} (con Dinero en cuenta)`;
    return local;
  }

  if (isNfc) return "Con tecnología NFC (Contactless)";
  if (isCuenta) return "Con Dinero en cuenta";
  return promo.medioPagoDetalle || "Pago con QR / Tarjeta";
}

/**
 * Agrupa las opciones de una entidad por porcentaje de descuento para evitar repetición
 */
function buildNivelesDescuento(variantes: PromoVariante[]): PromoNivelDescuento[] {
  const byPct = new Map<number, PromoVariante[]>();
  for (const v of variantes) {
    const list = byPct.get(v.porcentajeDescuento) || [];
    list.push(v);
    byPct.set(v.porcentajeDescuento, list);
  }

  const niveles: PromoNivelDescuento[] = [];
  const pcts = [...byPct.keys()].sort((a, b) => b - a);

  for (const pct of pcts) {
    const items = byPct.get(pct) || [];
    const hasSinTope = items.some((i) => i.tipoTope === "sin_tope");
    const maxTope = hasSinTope ? null : Math.max(...items.map((i) => i.montoTope || 0));

    const localesList = items
      .map((i) => {
        const loc = i.localesAdheridos?.trim();
        const topeStr = i.tipoTope === "sin_tope"
          ? "sin tope"
          : `tope $${(i.montoTope || 0).toLocaleString("es-AR")}`;
        return loc ? `${loc} (${topeStr})` : topeStr;
      })
      .filter(Boolean);

    const mediosList = [...new Set(items.map((i) => i.medioPagoDetalle).filter(Boolean))];

    niveles.push({
      porcentaje: pct,
      hasSinTope,
      maxTope,
      items,
      localesResumen: localesList.join(", "),
      mediosResumen: mediosList.join(" · "),
    });
  }

  return niveles;
}

/**
 * Motor determinístico de recomendación de PagaMejor.
 * Cruza los medios de pago de la billetera del usuario con las promociones vigentes.
 *
 * REGLA INQUEBRANTABLE: Jamás retorna una promoción de un banco que el usuario no tenga.
 *
 * `recursos`: con qué puede pagar la persona (celular con NFC, app, tarjeta). Las promos que piden algo que no
 * tiene no se recomiendan; solo se cuentan en `ocultasPorFormaPago`. En null (no respondió) no se oculta nada.
 */
export function findBestPromos(
  userBankIds: string[],
  rubro: RubroId,
  targetDate: Date = new Date(),
  allPromos: Promocion[],
  recursos: RecursoPago[] | null = null
): RecommendationResult {
  const diaSemana = targetDate.getDay();
  const nombreDia = NOMBRES_DIAS[diaSemana];
  const fechaIso = toIsoDate(targetDate);

  // 1. Caso: El usuario no seleccionó ningún medio de pago aún
  if (!userBankIds || userBankIds.length === 0) {
    return {
      status: "no_wallet",
      rubro,
      diaSemana,
      nombreDia,
      bestPromo: null,
      alternativePromos: [],
      bestGroup: null,
      alternativeGroups: [],
      upcomingPromos: [],
      totalPromosDisponibles: 0,
      ocultasPorFormaPago: { cantidad: 0, maxPorcentaje: null },
    };
  }

  const userBankSet = new Set(userBankIds);

  // 2. Filtro estricto: Solo promociones activas, dentro de fecha de vigencia, del rubro,
  //    y pertenecientes a bancos en la billetera del usuario.
  const promosEnRubro = allPromos.filter((promo) => {
    if (!promo.activo) return false;
    if (promo.rubro !== rubro) return false;
    if (!userBankSet.has(promo.bancoBilleteraId)) return false;
    if (fechaIso < promo.vigenciaDesde || fechaIso > promo.vigenciaHasta) return false;
    return true;
  });

  // 2b. Solo las que puede pagar con lo que tiene (NFC, app, tarjeta). Las de hoy que quedan afuera se cuentan
  //     para avisarle, sin mostrarlas como recomendación.
  const promosDelUsuarioEnRubro = promosEnRubro.filter((promo) => puedePagar(promo, recursos));
  const ocultasHoy = promosEnRubro.filter(
    (promo) => promo.diasSemana.includes(diaSemana) && !puedePagar(promo, recursos)
  );

  // 3. Promociones aplicables para el DÍA DE HOY
  const promosDeHoy = promosDelUsuarioEnRubro.filter((promo) =>
    promo.diasSemana.includes(diaSemana)
  );

  // 4. Ordenamiento determinístico individual (ver orden.ts):
  // - Mayor porcentaje de descuento
  // - Mayor tope llevado a un mes (sin tope = infinito; $6.000 por semana le gana a $10.000 por mes)
  // - Menor compra mínima
  // - Empate real: nombre del medio e id, para que el orden sea siempre el mismo
  const sortedHoy = [...promosDeHoy].sort(compararPromos);

  // 5. Agrupación por entidad/tarjeta (para englobar todas las opciones del mismo banco)
  const promosByBank = new Map<string, Promocion[]>();
  for (const promo of sortedHoy) {
    const list = promosByBank.get(promo.bancoBilleteraId) || [];
    list.push(promo);
    promosByBank.set(promo.bancoBilleteraId, list);
  }

  const groupedPromos: GroupedBankPromo[] = [];
  for (const [bankId, promosList] of promosByBank.entries()) {
    const bestInBank = promosList[0];
    // "Hasta X%" con lo que sirve en cualquier lado; una feria puntual al 40% no infla el número del banco
    const maxPorcentaje = maxPorcentajeGeneral(promosList);

    const variantes: PromoVariante[] = promosList.map((p) => ({
      id: p.id,
      etiquetaModalidad: getVarianteLabel(p, promosList),
      porcentajeDescuento: p.porcentajeDescuento,
      tipoTope: p.tipoTope,
      montoTope: p.montoTope,
      montoGastoOptimo: p.montoGastoOptimo,
      minimoCompra: p.minimoCompra,
      medioPagoDetalle: p.medioPagoDetalle,
      localesAdheridos: p.localesAdheridos,
      condicionUso: p.condicionUso,
      aclaraciones: p.aclaraciones,
      fuenteUrl: p.fuenteUrl,
    }));

    const niveles = buildNivelesDescuento(variantes);

    groupedPromos.push({
      bancoBilleteraId: bankId,
      bancoBilleteraNombre: bestInBank.bancoBilleteraNombre,
      rubro,
      diasTexto: bestInBank.diasTexto,
      maxPorcentaje,
      bestPromo: bestInBank,
      variantes,
      niveles,
      totalOpciones: promosList.length,
    });
  }

  // Ordenamos los grupos según la mejor opción que ofrece cada banco; si empatan, el que tiene más opciones
  // ese día y después el nombre (siempre el mismo orden)
  groupedPromos.sort(compararGrupos);

  // 6. Si no hay promociones hoy, buscamos qué días sus tarjetas sí tienen beneficios en este rubro. La vigencia
  //    se mira en la fecha de cada día: una promo que vence hoy no se ofrece para el jueves
  const upcomingPromos: UpcomingPromo[] = [];
  if (sortedHoy.length === 0) {
    const sinMirarVigencia = allPromos.filter(
      (p) => p.activo && p.rubro === rubro && userBankSet.has(p.bancoBilleteraId) && puedePagar(p, recursos),
    );
    for (const { diaSemana: dia, promo } of mejorPorDia(sinMirarVigencia, targetDate)) {
      upcomingPromos.push({ diaSemana: dia, diaTexto: NOMBRES_DIAS[dia], promo });
    }
  }

  const bestPromo = sortedHoy.length > 0 ? sortedHoy[0] : null;
  const alternativePromos = sortedHoy.length > 1 ? sortedHoy.slice(1) : [];
  const bestGroup = groupedPromos.length > 0 ? groupedPromos[0] : null;
  const alternativeGroups = groupedPromos.length > 1 ? groupedPromos.slice(1) : [];

  return {
    status: bestPromo ? "ok" : "no_promos_today",
    rubro,
    diaSemana,
    nombreDia,
    bestPromo,
    alternativePromos,
    bestGroup,
    alternativeGroups,
    upcomingPromos,
    totalPromosDisponibles: sortedHoy.length,
    ocultasPorFormaPago: {
      cantidad: ocultasHoy.length,
      maxPorcentaje: ocultasHoy.length > 0 ? Math.max(...ocultasHoy.map((p) => p.porcentajeDescuento)) : null,
    },
  };
}
