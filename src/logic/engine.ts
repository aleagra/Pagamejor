import { Promocion, RubroId } from "@/data/schema";
import {
  RecommendationResult,
  UpcomingPromo,
  GroupedBankPromo,
  PromoVariante,
  PromoNivelDescuento,
} from "./types";

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
 */
export function findBestPromos(
  userBankIds: string[],
  rubro: RubroId,
  targetDate: Date = new Date(),
  allPromos: Promocion[]
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
    };
  }

  const userBankSet = new Set(userBankIds);

  // 2. Filtro estricto: Solo promociones activas, dentro de fecha de vigencia, del rubro,
  //    y pertenecientes a bancos en la billetera del usuario.
  const promosDelUsuarioEnRubro = allPromos.filter((promo) => {
    if (!promo.activo) return false;
    if (promo.rubro !== rubro) return false;
    if (!userBankSet.has(promo.bancoBilleteraId)) return false;
    if (fechaIso < promo.vigenciaDesde || fechaIso > promo.vigenciaHasta) return false;
    return true;
  });

  // 3. Promociones aplicables para el DÍA DE HOY
  const promosDeHoy = promosDelUsuarioEnRubro.filter((promo) =>
    promo.diasSemana.includes(diaSemana)
  );

  // 4. Ordenamiento determinístico individual:
  // - Mayor porcentaje de descuento
  // - En caso de empate, mayor monto de tope (sin tope se considera tope infinito)
  // - En caso de empate, menor monto mínimo de compra
  const sortedHoy = [...promosDeHoy].sort((a, b) => {
    if (b.porcentajeDescuento !== a.porcentajeDescuento) {
      return b.porcentajeDescuento - a.porcentajeDescuento;
    }

    const topeA = a.tipoTope === "sin_tope" ? Infinity : (a.montoTope ?? 0);
    const topeB = b.tipoTope === "sin_tope" ? Infinity : (b.montoTope ?? 0);
    if (topeB !== topeA) {
      return topeB - topeA;
    }

    const minA = a.minimoCompra ?? 0;
    const minB = b.minimoCompra ?? 0;
    return minA - minB;
  });

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
    const maxPorcentaje = Math.max(...promosList.map((p) => p.porcentajeDescuento));

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

  // Ordenamos los grupos según la mejor opción que ofrece cada banco
  groupedPromos.sort((a, b) => {
    if (b.bestPromo.porcentajeDescuento !== a.bestPromo.porcentajeDescuento) {
      return b.bestPromo.porcentajeDescuento - a.bestPromo.porcentajeDescuento;
    }
    const topeA = a.bestPromo.tipoTope === "sin_tope" ? Infinity : (a.bestPromo.montoTope ?? 0);
    const topeB = b.bestPromo.tipoTope === "sin_tope" ? Infinity : (b.bestPromo.montoTope ?? 0);
    if (topeB !== topeA) {
      return topeB - topeA;
    }
    const minA = a.bestPromo.minimoCompra ?? 0;
    const minB = b.bestPromo.minimoCompra ?? 0;
    return minA - minB;
  });

  // 6. Si no hay promociones hoy, buscamos qué días sus tarjetas sí tienen beneficios en este rubro
  const upcomingPromos: UpcomingPromo[] = [];
  if (sortedHoy.length === 0) {
    for (let offset = 1; offset <= 6; offset++) {
      const targetDay = (diaSemana + offset) % 7;
      const promosEseDia = promosDelUsuarioEnRubro.filter((p) =>
        p.diasSemana.includes(targetDay)
      );
      if (promosEseDia.length > 0) {
        const mejorPromoEseDia = [...promosEseDia].sort(
          (a, b) => b.porcentajeDescuento - a.porcentajeDescuento
        )[0];

        upcomingPromos.push({
          diaSemana: targetDay,
          diaTexto: NOMBRES_DIAS[targetDay],
          promo: mejorPromoEseDia,
        });
      }
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
  };
}
