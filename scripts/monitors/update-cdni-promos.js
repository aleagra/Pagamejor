const fs = require('fs');
const path = require('path');

// ⚠️ SCRIPT LEGACY: escribe src/data/promos.json directamente y reemplaza TODAS las promos de Cuenta DNI con
// un catálogo hardcodeado (ya desactualizado). Contradice el protocolo (los monitores nunca modifican promos.json)
// y pisaría la consolidación hecha con `npm run monitor:cuentadni` + `node scripts/data/apply-extract.js cuentadni`.
if (!process.argv.includes('--force-legacy')) {
  console.error('update-cdni-promos.js es un script legacy y quedó deshabilitado.\nUsá: npm run monitor:cuentadni && node scripts/data/apply-extract.js cuentadni\n(Si realmente lo necesitás: agregá --force-legacy).');
  process.exit(1);
}

const promosPath = path.join(__dirname, '../../src/data/promos.json');
const allPromos = JSON.parse(fs.readFileSync(promosPath, 'utf8'));

// Filtramos todas las promociones viejas de Cuenta DNI para reemplazarlas por el catálogo completo oficial auditado
const nonCDNIPromos = allPromos.filter(p => p.bancoBilleteraId !== 'cuenta-dni');

// Catálogo maestro completo de Cuenta DNI derivado de los 24 modales oficiales auditados
const cdniCatalog = [
  // --- LUNES ---
  {
    id: "cdni-super-dia-nfc",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "credito",
    medioPagoDetalle: "Visa Crédito vía NFC en app Cuenta DNI (Android)",
    rubro: "supermercado",
    diasSemana: [1],
    diasTexto: "Lunes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 20,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar de manera presencial en sucursales DIA con tecnología NFC usando Visa Crédito vinculada en Cuenta DNI (disponible en Android).",
    localesAdheridos: "Supermercados DIA",
    aclaraciones: "20% de reintegro sin tope los días lunes. Reintegro reflejado en el resumen siguiente de la tarjeta.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },
  {
    id: "cdni-super-dia-cuenta",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [1],
    diasTexto: "Lunes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar de manera presencial en sucursales DIA con dinero en cuenta mediante Clave DNI o código QR de la app.",
    localesAdheridos: "Supermercados DIA",
    aclaraciones: "10% de ahorro sin tope ni mínimo de compra los días lunes. Reintegro dentro de los 10 días hábiles.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- LUNES Y MARTES: LIBRERÍAS ---
  {
    id: "cdni-librerias-lun-mar",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "libreria",
    diasSemana: [1, 2],
    diasTexto: "Lunes y martes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar en librerías y jugueterías adheridas con dinero en cuenta a través de QR o Clave DNI de la app.",
    localesAdheridos: "Librerías y jugueterías adheridas",
    aclaraciones: "10% de descuento sin tope de reintegro. Acumulable con la promo de comercios de cercanía.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MARTES: TOLEDO ---
  {
    id: "cdni-super-toledo-nfc",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "credito",
    medioPagoDetalle: "Visa Crédito vía NFC en app Cuenta DNI (Android)",
    rubro: "supermercado",
    diasSemana: [2],
    diasTexto: "Martes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 20,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar de manera presencial en Supermercados Toledo y Mini Toledo con tecnología NFC usando Visa Crédito vinculada a la app (Android).",
    localesAdheridos: "Supermercados Toledo y Mini Toledo",
    aclaraciones: "20% de reintegro sin tope los días martes. Reintegro reflejado en el resumen de la tarjeta.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },
  {
    id: "cdni-super-toledo-cuenta",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [2],
    diasTexto: "Martes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 15,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar de manera presencial en Supermercados Toledo y Mini Toledo con dinero en cuenta con Clave DNI o QR.",
    localesAdheridos: "Supermercados Toledo y Mini Toledo",
    aclaraciones: "15% de reintegro sin tope y sin mínimo de compra los días martes. Reintegro en 10 días hábiles.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MARTES Y MIÉRCOLES: SUPERMERCADOS ADHERIDOS ---
  {
    id: "cdni-super-cadenas-mar-mie",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [2, 3],
    diasTexto: "Martes y miércoles",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 15,
    tipoTope: "por_semana",
    montoTope: 6000,
    minimoCompra: 30000,
    montoGastoOptimo: 40000,
    condicionUso: "Pagar con Clave DNI o QR de la app con dinero en cuenta en supermercados adheridos. Aplica con compra mínima de $30.000.",
    localesAdheridos: "Supermercados adheridos participantes",
    aclaraciones: "Tope unificado de $6.000 por semana y por persona. Compra mínima de $30.000. Reintegro dentro de 10 días hábiles.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MIÉRCOLES: CARREFOUR ---
  {
    id: "cdni-super-carrefour-mie",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [3],
    diasTexto: "Miércoles",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: 15000,
    montoGastoOptimo: null,
    condicionUso: "Pagar con Clave DNI o QR de la app con dinero en cuenta en locales Carrefour (Hiper, Market, Express y Maxi). Mínimo de compra $15.000.",
    localesAdheridos: "Carrefour (Hiper, Market, Express, Maxi)",
    aclaraciones: "10% de descuento en línea de caja sin tope. Compra mínima $15.000. Si sos jubilado/a Banco Provincia sumás 5% extra con tope $5.000.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MIÉRCOLES: LA ANÓNIMA ---
  {
    id: "cdni-super-laanonima-mie",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [3],
    diasTexto: "Miércoles",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "por_compra",
    montoTope: 5000,
    minimoCompra: 25000,
    montoGastoOptimo: 50000,
    condicionUso: "Pagar con Clave DNI o QR de la app con dinero en cuenta en locales de La Anónima en ventas iguales o superiores a $25.000.",
    localesAdheridos: "Supermercados La Anónima",
    aclaraciones: "Tope de $5.000 por miércoles. Mínimo de compra $25.000. Jubilados Banco Provincia tienen 5% extra con tope de $5.000.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MIÉRCOLES: JOSIMAR ---
  {
    id: "cdni-super-josimar-mie",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "supermercado",
    diasSemana: [3],
    diasTexto: "Miércoles",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "por_compra",
    montoTope: 6000,
    minimoCompra: null,
    montoGastoOptimo: 60000,
    condicionUso: "Pagar con Clave DNI o QR de la app con dinero en cuenta en comercios de Supermercados Josimar.",
    localesAdheridos: "Supermercados Josimar",
    aclaraciones: "10% de reintegro en el momento con tope de $6.000 por miércoles y por persona.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MIÉRCOLES: SODIMAC (HOGAR) ---
  {
    id: "cdni-hogar-sodimac-mie",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "hogar",
    diasSemana: [3],
    diasTexto: "Miércoles",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar con Pago Clave DNI o QR de la app con dinero en cuenta en todos los locales de Sodimac.",
    localesAdheridos: "Sodimac",
    aclaraciones: "10% de descuento en el momento sin tope de reintegro. Acumula con otras promociones.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- MIÉRCOLES Y JUEVES: FARMACIAS Y PERFUMERÍAS ---
  {
    id: "cdni-farmacia-mie-jue",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "farmacia",
    diasSemana: [3, 4],
    diasTexto: "Miércoles y jueves",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 10,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en farmacias y perfumerías adheridas.",
    localesAdheridos: "Farmacias y perfumerías adheridas",
    aclaraciones: "10% de ahorro sin tope de reintegro. Acumulable con otras promociones del mismo día.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- JUEVES Y VIERNES: MOSTAZA ---
  {
    id: "cdni-gastro-mostaza-nfc",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "credito",
    medioPagoDetalle: "Visa Débito o Crédito vía NFC en app Cuenta DNI (Android)",
    rubro: "gastronomia",
    diasSemana: [4, 5],
    diasTexto: "Jueves y viernes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 30,
    tipoTope: "por_semana",
    montoTope: 15000,
    minimoCompra: null,
    montoGastoOptimo: 50000,
    condicionUso: "Pagar de manera presencial en Mostaza mediante tecnología NFC con tarjeta Visa vinculada a la app (Android).",
    localesAdheridos: "Mostaza",
    aclaraciones: "30% de reintegro con tope semanal de $15.000 por persona. Sin NFC disfrutás de 25% con tope semanal de $8.000 pagando con dinero en cuenta.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- JUEVES: CHANGOMÁS ---
  {
    id: "cdni-super-changomas-jue",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta o NFC en app Cuenta DNI",
    rubro: "supermercado",
    diasSemana: [4],
    diasTexto: "Jueves",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 20,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar de manera presencial en Hiper ChangoMás, ChangoMás y Punto Mayorista con dinero en cuenta o mediante NFC.",
    localesAdheridos: "Hiper ChangoMás, ChangoMás y Punto Mayorista",
    aclaraciones: "20% de reintegro sin tope ni mínimo de compra todos los días jueves.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- JUEVES: COTO ---
  {
    id: "cdni-super-coto-nfc",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "debito",
    medioPagoDetalle: "Visa Débito vía NFC en app Cuenta DNI (Android)",
    rubro: "supermercado",
    diasSemana: [4],
    diasTexto: "Jueves",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 30,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar en tiendas físicas de COTO con Visa Débito vinculada mediante NFC en la app Cuenta DNI (Android). Descuento en línea de caja.",
    localesAdheridos: "Supermercados COTO (CABA y GBA)",
    aclaraciones: "30% de descuento en el momento sin tope de reintegro en tiendas físicas de COTO todos los jueves.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- VIERNES Y SÁBADO: SUPERCOOP ---
  {
    id: "cdni-super-supercoop-vie-sab",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía Pago Clave DNI",
    rubro: "supermercado",
    diasSemana: [5, 6],
    diasTexto: "Viernes y sábado",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 15,
    tipoTope: "sin_tope",
    montoTope: null,
    minimoCompra: null,
    montoGastoOptimo: null,
    condicionUso: "Pagar con la funcionalidad Pago Clave DNI de la app en supermercados Supercoop.",
    localesAdheridos: "Supermercados Supercoop",
    aclaraciones: "15% de ahorro sin tope de reintegro los viernes y sábados.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- SÁBADO Y DOMINGO: GASTRONOMÍA Y YPF FULL ---
  {
    id: "cdni-gastro-finde",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "gastronomia",
    diasSemana: [0, 6],
    diasTexto: "Sábado y domingo",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 25,
    tipoTope: "por_semana",
    montoTope: 8000,
    minimoCompra: null,
    montoGastoOptimo: 32000,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en comercios de gastronomía y tiendas YPF Full adheridas.",
    localesAdheridos: "Restaurantes, bares, heladerías y tiendas YPF Full adheridas",
    aclaraciones: "25% de ahorro con tope semanal de $8.000 por persona los sábados y domingos.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- SÁBADO: PET SHOPS Y VETERINARIAS ---
  {
    id: "cdni-mascotas-sab",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "mascotas",
    diasSemana: [6],
    diasTexto: "Sábado",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 30,
    tipoTope: "por_semana",
    montoTope: 8000,
    minimoCompra: null,
    montoGastoOptimo: 26667,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en veterinarias y pet shops adheridos.",
    localesAdheridos: "Pet shops y veterinarias adheridas",
    aclaraciones: "30% de reintegro con tope de $8.000 por semana y por persona los días sábados.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- SÁBADO: CARNICERÍAS, GRANJAS Y PESCADERÍAS ---
  {
    id: "cdni-carnicerias-sab",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "QR o Clave DNI desde app Cuenta DNI",
    rubro: "carniceria",
    diasSemana: [6],
    diasTexto: "Sábados",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 35,
    tipoTope: "por_semana",
    montoTope: 6000,
    minimoCompra: null,
    montoGastoOptimo: 17140,
    condicionUso: "Pagar mediante código QR o Clave DNI en comercios del rubro carnicería, granja o pescadería adheridos.",
    localesAdheridos: "Carnicerías, granjas y pescaderías adheridas",
    aclaraciones: "Tope semanal de $6.000 por persona los días sábados.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- TODOS LOS DÍAS: COMERCIOS DE BARRIO / CERCANÍA (Lunes a Viernes) ---
  {
    id: "cdni-comercios-cercania",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "otros",
    diasSemana: [1, 2, 3, 4, 5],
    diasTexto: "Lunes a viernes",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 20,
    tipoTope: "por_semana",
    montoTope: 6000,
    minimoCompra: null,
    montoGastoOptimo: 30000,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en comercios de cercanía y almacenes de barrio adheridos.",
    localesAdheridos: "Comercios de cercanía, almacenes y tiendas de barrio adheridas",
    aclaraciones: "20% de ahorro de lunes a viernes con tope semanal de $6.000 por persona. Se excluyen grandes cadenas.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- TODOS LOS DÍAS: FERIAS Y MERCADOS BONAERENSES ---
  {
    id: "cdni-ferias-mercados",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "otros",
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    diasTexto: "Todos los días",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 40,
    tipoTope: "por_semana",
    montoTope: 6000,
    minimoCompra: null,
    montoGastoOptimo: 15000,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en puestos adheridos de Ferias y Mercados Bonaerenses.",
    localesAdheridos: "Ferias y Mercados Bonaerenses identificados",
    aclaraciones: "40% de bonificación todos los días con tope de reintegro unificado de $6.000 por semana y por persona.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- TODOS LOS DÍAS: GARRAFAS ---
  {
    id: "cdni-hogar-garrafas",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "hogar",
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    diasTexto: "Todos los días",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 40,
    tipoTope: "por_mes",
    montoTope: 18000,
    minimoCompra: null,
    montoGastoOptimo: 45000,
    condicionUso: "Pagar compras o recargas de garrafas de gas mediante Pago Clave DNI o QR con dinero en cuenta.",
    localesAdheridos: "Distribuidoras y puntos de venta o entrega de garrafas adheridas",
    aclaraciones: "40% de reintegro con tope unificado de $18.000 por mes y por persona todos los días.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  },

  // --- TODOS LOS DÍAS: COMERCIOS EN UNIVERSIDADES ---
  {
    id: "cdni-universidades",
    bancoBilleteraId: "cuenta-dni",
    bancoBilleteraNombre: "Cuenta DNI",
    tipoMedioRequerido: "cuenta",
    medioPagoDetalle: "Dinero en cuenta vía QR o Clave DNI",
    rubro: "otros",
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    diasTexto: "Todos los días",
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: "2026-12-31",
    porcentajeDescuento: 40,
    tipoTope: "por_semana",
    montoTope: 6000,
    minimoCompra: null,
    montoGastoOptimo: 15000,
    condicionUso: "Pagar con QR o Clave DNI con dinero en cuenta en comercios adheridos dentro de universidades.",
    localesAdheridos: "Buffets, fotocopiadoras y comercios en universidades adheridas",
    aclaraciones: "40% de bonificación todos los días con tope de $6.000 por semana y por persona. Acumulable con otras promos.",
    fuenteUrl: "https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/",
    activo: true
  }
];

// Unir con las promos existentes de los otros bancos
const mergedPromos = [...cdniCatalog, ...nonCDNIPromos];

fs.writeFileSync(promosPath, JSON.stringify(mergedPromos, null, 2), 'utf8');

console.log(`Catálogo maestro actualizado con éxito:`);
console.log(`- Promociones de Cuenta DNI cargadas: ${cdniCatalog.length}`);
console.log(`- Promociones totales en promos.json: ${mergedPromos.length}`);
