import { Promocion, RubroId, TipoTope } from "@/data/schema";

export interface UserWallet {
  selectedBankIds: string[];
  lastUpdated?: string;
}

export interface UpcomingPromo {
  diaSemana: number;
  diaTexto: string;
  promo: Promocion;
}

export type RecommendationStatus = 
  | "ok" 
  | "no_wallet" 
  | "no_promos_today";

export interface PromoVariante {
  id: string;
  etiquetaModalidad: string; // ej: "Con NFC (Contactless)", "Con Dinero en Cuenta / QR", "COTO", "Jumbo"
  porcentajeDescuento: number;
  tipoTope: TipoTope;
  montoTope: number | null;
  montoGastoOptimo: number | null;
  minimoCompra: number | null;
  medioPagoDetalle: string;
  localesAdheridos: string;
  condicionUso: string;
  aclaraciones: string;
  fuenteUrl: string;
}

export interface PromoNivelDescuento {
  porcentaje: number;
  hasSinTope: boolean;
  maxTope: number | null;
  items: PromoVariante[];
  localesResumen: string; // ej: "COTO (sin tope), Jumbo, ChangoMás, Lácteos El Milagro"
  mediosResumen: string; // ej: "Tarjetas vía QR MODO" o "NFC (Visa Crédito)"
}

export interface GroupedBankPromo {
  bancoBilleteraId: string;
  bancoBilleteraNombre: string;
  rubro: RubroId;
  diasTexto: string;
  maxPorcentaje: number;
  bestPromo: Promocion;
  variantes: PromoVariante[];
  niveles: PromoNivelDescuento[];
  totalOpciones: number;
}

export interface RecommendationResult {
  status: RecommendationStatus;
  rubro: RubroId;
  diaSemana: number;
  nombreDia: string;
  bestPromo: Promocion | null;
  alternativePromos: Promocion[];
  bestGroup: GroupedBankPromo | null;
  alternativeGroups: GroupedBankPromo[];
  upcomingPromos: UpcomingPromo[];
  totalPromosDisponibles: number;
}
