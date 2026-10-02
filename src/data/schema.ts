export type RubroId =
  | "supermercado"
  | "combustible"
  | "carniceria"
  | "farmacia"
  | "gastronomia"
  | "indumentaria"
  | "libreria"
  | "hogar"
  | "mascotas"
  | "entretenimiento"
  | "mayorista"
  | "tecnologia"
  | "transporte"
  | "otros";

export type TipoTope =
  | "sin_tope"
  | "por_compra"
  | "por_dia"
  | "por_semana"
  | "por_mes";

export type TipoMedioRequerido =
  | "debito"
  | "credito"
  | "cuenta"
  | "cualquiera";

export interface BancoBilletera {
  id: string;
  nombre: string;
  tipo: "banco" | "billetera";
  colorPrimario: string;
  colorTexto: string;
  adheridoAModo?: boolean; // Sus tarjetas se pueden vincular a MODO: habilitan las promos generales de MODO
  nota?: string; // Aclaración breve que se muestra al elegir el medio (ej: MODO requiere vincular una tarjeta)
  siglas: string;
}

export interface Rubro {
  id: RubroId;
  nombre: string;
  icono: string;
  descripcion: string;
  esDestacado?: boolean; // True si se muestra en los 6-7 principales de la grilla
}

/**
 * Nivel de cuenta/cliente con su propio beneficio (ej: Patagonia Clásica/Plus/Singular,
 * Supervielle Clásico/Identité). Se usa cuando el porcentaje depende del nivel del cliente.
 */
export interface NivelDescuento {
  nivel: string; // ej: "Clásica", "Plus", "Singular", "Identité"
  porcentaje: number; // ej: 20 para 20%
  montoTope?: number | null; // solo si el tope difiere por nivel; si no, aplica el de la promo
}

/**
 * Nivel de cuenta/cliente con su propio beneficio (ej: Patagonia Clásica/Plus/Singular,
 * Supervielle Clásico/Identité). Se usa cuando el porcentaje depende del nivel del cliente.
 */
export interface NivelDescuento {
  nivel: string; // ej: "Clásica", "Plus", "Singular", "Identité"
  porcentaje: number; // ej: 20 para 20%
  montoTope?: number | null; // solo si el tope difiere por nivel; si no, aplica el de la promo
}

export interface Promocion {
  // Identificación única
  id: string;

  // Entidad financiera
  bancoBilleteraId: string;
  bancoBilleteraNombre: string;

  // Clasificación del medio de pago
  tipoMedioRequerido: TipoMedioRequerido;
  medioPagoDetalle: string;

  // Rubro
  rubro: RubroId;

  // Solo en lugares puntuales (ferias identificadas, universidades, localidades): se muestra, pero nunca
  // queda como "la mejor opción" por encima de una promo que sirve en cualquier lado
  alcanceLimitado?: boolean;

  // Días válidos (0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado)
  diasSemana: number[];
  diasTexto: string;

  // Rango de fechas ISO (YYYY-MM-DD)
  vigenciaDesde: string;
  vigenciaHasta: string;

  // Porcentaje de reintegro/descuento (ej: 20 para 20%).
  // Si la promo tiene `niveles`, este valor es el PISO garantizado (el menor de los niveles),
  // para no prometerle al usuario más de lo que sabemos que obtiene.
  porcentajeDescuento: number;

  // Porcentaje por nivel de cuenta/cliente. Opcional: solo bancos con escalas (Patagonia, Supervielle).
  niveles?: NivelDescuento[];

  // Topes
  tipoTope: TipoTope;
  montoTope: number | null; // en ARS, null si sin_tope

  // Cuántas veces se puede usar por persona en toda la vigencia ("Limitado a 1 uso", "Máximo 2 vouchers").
  // Sin el campo: la fuente no limita los usos (o dice "Usos ilimitados")
  limiteUsos?: number;

  // Requisitos de ticket
  minimoCompra: number | null; // en ARS, null si no hay mínimo
  montoGastoOptimo: number | null; // Gasto ideal para aprovechar el tope al 100%

  // Instrucciones de uso para el usuario
  condicionUso: string;
  localesAdheridos: string;
  aclaraciones: string;

  // Auditoría
  fuenteUrl: string;
  fuenteId?: string; // Fuente que mantiene esta promo (ver scripts/monitors/sources.json)
  ultimaVerificacion?: string; // YYYY-MM-DD de la última vez que se contrastó contra la fuente
  activo: boolean;
}
