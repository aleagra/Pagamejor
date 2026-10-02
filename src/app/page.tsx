"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import bancosData from "@/data/bancos.json";
import rubrosData from "@/data/rubros.json";
import promosData from "@/data/promos.json";
import { BancoBilletera, Rubro, RubroId, Promocion } from "@/data/schema";
import { findBestPromos } from "@/logic/engine";
import {
  getStoredWallet,
  saveStoredWallet,
  hasConfiguredWallet,
  getStoredRecursos,
  saveStoredRecursos,
} from "@/logic/walletStorage";
import { RECURSOS_POR_DEFECTO, type RecursoPago } from "@/logic/formasPago";
import { Header } from "@/components/Header";
import { Navbar, CONTENEDOR } from "@/components/Navbar";
import { WalletModal } from "@/components/WalletModal";
import { RubroTabs } from "@/components/RubroTabs";
import { RubrosModal } from "@/components/RubrosModal";
import { OtroDiaSheet } from "@/components/OtroDiaSheet";
import { PromoResultCard } from "@/components/PromoResultCard";
import { AlternativePromosList } from "@/components/AlternativePromosList";
import { PromoDetail } from "@/components/PromoDetail";
import { EmptyState } from "@/components/EmptyState";
import { Sheet } from "@/components/Sheet";
import { BankBadge } from "@/components/BankBadge";
import { AvisoComoPago } from "@/components/ComoPago";
import { TourDetalles, tourDetallesVisto, type PasoTour } from "@/components/TourDetalles";
import { useModoLiviano } from "@/components/MotionProvider";
import { fechaTexto, maxPorcentajeDetalle, nombreDiaSemana } from "@/components/format";
import { ArrowsClockwise, CalendarBlank, DeviceMobile, ShieldCheck, Wallet, type Icon } from "@phosphor-icons/react";

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-10-01" → "01/10" (el año se sobreentiende: la revisión es mensual). */
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function DatoPie({ icono: Icono, titulo, children }: { icono: Icon; titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="w-10 h-10 rounded-full bg-white/10 text-pie-acento flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <Icono size={20} weight="bold" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-white">{titulo}</span>
        {/* En el celular solo el título: el pie no tiene que ocupar una pantalla */}
        <span className="hidden sm:block leading-snug">{children}</span>
      </span>
    </li>
  );
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function HomePage() {
  const bancos = bancosData as BancoBilletera[];
  const rubros = rubrosData as Rubro[];
  const promos = promosData as Promocion[];

  // Diccionarios para rápido acceso por ID
  const bancosMap = useMemo(() => Object.fromEntries(bancos.map((b) => [b.id, b])), [bancos]);
  const promosById = useMemo(() => Object.fromEntries(promos.map((p) => [p.id, p])), [promos]);

  // Solo se pueden elegir los medios con al menos una promo activa (verificada); el resto figura "En verificación"
  // Última vez que se contrastaron las promos con las fuentes oficiales (se muestra en el pie)
  const ultimaVerificacion = useMemo(() => {
    const fechas = promos.map((p) => p.ultimaVerificacion).filter((f): f is string => !!f);
    return fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : null;
  }, [promos]);

  // En "Más" solo se ofrecen rubros con al menos una promo activa: nada de categorías vacías. Si el mes que
  // viene aparece una promo de un rubro hoy vacío, el rubro vuelve a aparecer solo
  const rubrosConPromos = useMemo(() => {
    const conPromos = new Set(promos.filter((p) => p.activo).map((p) => p.rubro));
    return rubros.filter((r) => conPromos.has(r.id));
  }, [rubros, promos]);

  const bankIdsDisponibles = useMemo(() => {
    return Array.from(new Set(promos.filter((p) => p.activo).map((p) => p.bancoBilleteraId)));
  }, [promos]);

  // Estados de la app
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  // Con qué puede pagar (NFC, app, tarjeta). null = todavía no respondió: se asume app y tarjeta
  const [recursosGuardados, setRecursosGuardados] = useState<RecursoPago[] | null>(null);
  const recursos = recursosGuardados ?? RECURSOS_POR_DEFECTO;
  const [selectedRubro, setSelectedRubro] = useState<RubroId>("supermercado");
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isRubrosModalOpen, setIsRubrosModalOpen] = useState(false);
  const [isOtroDiaOpen, setIsOtroDiaOpen] = useState(false);
  const [isInitialOnboarding, setIsInitialOnboarding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // "Hoy" se fija en el cliente (la zona horaria del servidor puede ser otra) y se renueva al volver a la app
  const [today, setToday] = useState<Date | null>(null);
  // Días hacia adelante desde hoy (0 = hoy). Se cambia solo desde la vista "Ver otro día"
  const [dayOffset, setDayOffset] = useState(0);

  // Banco con el desglose abierto: sube en una hoja en el celular y aparece en una ventana centrada en escritorio,
  // así la grilla de resultados no se desarma ni se estira
  const [detalleId, setDetalleId] = useState<string | null>(null);

  // Tutorial de la primera vez: señala "Ver todos los detalles" (donde están todos los lugares con descuento) y,
  // ya en el desglose, pide abrir una opción para ver su detalle completo
  const [tourPaso, setTourPaso] = useState<PasoTour | null>(null);

  const { liviano } = useModoLiviano();

  // Carga inicial segura en cliente
  useEffect(() => {
    const hasConfig = hasConfiguredWallet();
    setSelectedBankIds(getStoredWallet());
    setRecursosGuardados(getStoredRecursos());
    setToday(new Date());

    if (!hasConfig) {
      setIsInitialOnboarding(true);
      setIsWalletModalOpen(true);
    }
    setIsLoaded(true);

    const handleWalletUpdated = () => {
      setSelectedBankIds(getStoredWallet());
      setRecursosGuardados(getStoredRecursos());
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date();
      setToday((prev) => (prev && mismoDia(prev, now) ? prev : now));
    };
    window.addEventListener("pagamejor_wallet_updated", handleWalletUpdated);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagamejor_wallet_updated", handleWalletUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleSaveWallet = (newBankIds: string[], nuevosRecursos: RecursoPago[]) => {
    setSelectedBankIds(newBankIds);
    setRecursosGuardados(nuevosRecursos);
    saveStoredWallet(newBankIds);
    saveStoredRecursos(nuevosRecursos);
    setIsInitialOnboarding(false);
  };

  const guardarRecursos = (nuevos: RecursoPago[]) => {
    setRecursosGuardados(nuevos);
    saveStoredRecursos(nuevos);
  };

  const openWallet = () => {
    setIsInitialOnboarding(false);
    setIsWalletModalOpen(true);
  };

  const targetDate = useMemo(() => {
    if (!today) return null;
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    return d;
  }, [today, dayOffset]);

  // Solo cuenta lo que la persona eligió: MODO aparece únicamente si lo tildó. Las promos de un banco que se
  // pagan con MODO siguen bajo ese banco, marcadas "QR MODO". Y solo las que puede pagar (NFC, app, tarjeta).
  const recommendation = useMemo(() => {
    if (!targetDate) return null;
    return findBestPromos(selectedBankIds, selectedRubro, targetDate, promos, recursos);
  }, [selectedBankIds, selectedRubro, targetDate, promos, recursos]);

  // Si todavía no dijo cómo paga y hoy hay algo mejor con NFC, se le pregunta ahí mismo
  const ocultas = recommendation?.ocultasPorFormaPago;
  const mostrarAvisoNfc =
    recursosGuardados === null &&
    !!ocultas?.maxPorcentaje &&
    ocultas.maxPorcentaje > (recommendation?.bestGroup?.maxPorcentaje ?? 0);
  const avisoNfc = mostrarAvisoNfc && ocultas?.maxPorcentaje && (
    <AvisoComoPago
      maxPorcentaje={ocultas.maxPorcentaje}
      cantidad={ocultas.cantidad}
      faltaNfc
      onTengoNfc={() => guardarRecursos([...RECURSOS_POR_DEFECTO, "nfc"])}
      onCambiar={() => guardarRecursos(RECURSOS_POR_DEFECTO)}
    />
  );

  const rubroActual = rubros.find((r) => r.id === selectedRubro) || rubros[0];

  const grupoEnDetalle = useMemo(() => {
    if (!detalleId || !recommendation?.bestGroup) return null;
    return (
      [recommendation.bestGroup, ...recommendation.alternativeGroups].find((g) => g.bancoBilleteraId === detalleId) ??
      null
    );
  }, [detalleId, recommendation]);

  // Al cambiar rubro, día o billetera, se cierra el desglose abierto
  useEffect(() => {
    setDetalleId(null);
  }, [selectedRubro, dayOffset, selectedBankIds]);

  // Si se cierra el desglose en el paso 2 del tutorial (Escape), el tutorial termina con él
  useEffect(() => {
    if (detalleId === null) setTourPaso((p) => (p === "opcion" ? null : p));
  }, [detalleId]);

  // El tutorial aparece una sola vez, cuando ya se ven los resultados, la mejor opción tiene más de una opción y
  // no hay otra ventana abierta. Espera a que terminen las entradas para no tapar la animación
  const hayVentanaAbierta = isWalletModalOpen || isRubrosModalOpen || isOtroDiaOpen || detalleId !== null;
  const mejorConVarias = (recommendation?.bestGroup?.totalOpciones ?? 0) > 1;
  useEffect(() => {
    if (!isLoaded || !mejorConVarias || hayVentanaAbierta || tourDetallesVisto()) return;
    const t = window.setTimeout(() => setTourPaso("detalles"), 1400);
    return () => window.clearTimeout(t);
  }, [isLoaded, mejorConVarias, hayVentanaAbierta]);

  // Textos según el día elegido: "hoy", "mañana" o "el jueves"
  const nombreDia = targetDate ? nombreDiaSemana(targetDate) : "";
  const cuando = dayOffset === 0 ? "hoy" : dayOffset === 1 ? "mañana" : `el ${nombreDia}`;
  const eyebrow = targetDate
    ? dayOffset === 0
      ? `Hoy, ${fechaTexto(targetDate)}`
      : capitalizar(fechaTexto(targetDate))
    : " ";

  // Con animaciones, cambiar rubro o día vuelve a montar los resultados para repetir las entradas.
  // En modo liviano no hay entradas: React solo actualiza lo que cambió (mucho menos trabajo en equipos lentos).
  const resultKey = liviano ? "resultados" : `${selectedRubro}-${dayOffset}`;

  return (
    <>
      <Navbar
        walletCount={selectedBankIds.length}
        onOpenWallet={openWallet}
        rubros={
          <RubroTabs
            variante="barra"
            rubros={rubros}
            selectedRubro={selectedRubro}
            onSelectRubro={setSelectedRubro}
            onOpenAllRubros={() => setIsRubrosModalOpen(true)}
          />
        }
      />

      {/* Un único scroll de página: la mejor opción arriba y el resto en grilla */}
      <div className={`${CONTENEDOR} flex-1 flex flex-col pt-4 sm:pt-10 bajo:pt-5 pb-16`}>
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-3">
            <Header
              eyebrow={eyebrow}
              title={`¿Con qué pago ${cuando}?`}
              onCambiarDia={today ? () => setIsOtroDiaOpen(true) : undefined}
            />

            {/* Otro día: vista aparte, fuera del flujo principal (la pantalla muestra hoy) */}
            {today && (
              <div className="flex flex-wrap items-center gap-2">
                {dayOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setDayOffset(0)}
                    className="inline-flex items-center min-h-12 px-4 rounded-full text-base font-semibold text-ink hover:bg-fill transition-colors duration-200"
                  >
                    Volver a hoy
                  </button>
                )}
                {/* En el celular se elige el día tocando la fecha (ver Header) */}
                <button
                  type="button"
                  onClick={() => setIsOtroDiaOpen(true)}
                  className="hidden sm:inline-flex items-center gap-2 min-h-12 px-4 rounded-full bg-surface text-base font-semibold text-ink shadow-[0_0_0_1px_var(--color-hairline),0_4px_12px_rgb(19_21_23/0.05)] hover:shadow-[0_0_0_1px_var(--color-fill-strong),0_6px_16px_rgb(19_21_23/0.08)] transition-shadow duration-200"
                >
                  <CalendarBlank size={19} weight="bold" aria-hidden="true" />
                  Ver otro día
                </button>
              </div>
            )}
          </div>

          <section className="md:hidden" aria-labelledby="rubro-title">
            <h2 id="rubro-title" className="text-base font-medium text-ink-3 mb-2">
              ¿Qué vas a comprar?
            </h2>
            <RubroTabs
              variante="pagina"
              rubros={rubros}
              selectedRubro={selectedRubro}
              onSelectRubro={setSelectedRubro}
              onOpenAllRubros={() => setIsRubrosModalOpen(true)}
            />
          </section>
        </div>

        <main className="flex-1 mt-5 sm:mt-7 bajo:mt-5">
          <section aria-live="polite" aria-label="Resultados">
            {!isLoaded || !recommendation ? null : selectedBankIds.length === 0 ? (
              <motion.div
                className="tarjeta rounded-[28px] p-7 sm:p-8 max-w-2xl"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              >
                <span
                  className="aro w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-5"
                  aria-hidden="true"
                >
                  <Wallet size={26} />
                </span>
                <h2 className="display text-[24px] sm:text-[26px] font-semibold leading-tight text-ink mb-2">
                  Tu billetera está vacía
                </h2>
                <p className="text-[17px] leading-relaxed text-ink-2 mb-6">
                  Elegí qué tarjetas o billeteras virtuales tenés para ver las promociones que podés aprovechar.
                </p>
                <button
                  type="button"
                  className="w-full sm:w-auto min-h-14 px-8 rounded-full bg-action text-white text-lg font-semibold hover:bg-action-strong active:scale-[0.98] transition-[background-color,transform] duration-200"
                  onClick={() => {
                    setIsInitialOnboarding(true);
                    setIsWalletModalOpen(true);
                  }}
                >
                  Armar mi billetera
                </button>
              </motion.div>
            ) : (
              <motion.div key={resultKey}>
                {recommendation.bestGroup ? (
                  <>
                    <PromoResultCard
                      group={recommendation.bestGroup}
                      banco={bancosMap[recommendation.bestGroup.bancoBilleteraId]}
                      etiqueta={`Tu mejor opción ${cuando}`}
                      alternativas={recommendation.alternativeGroups}
                      onAbrir={() => setDetalleId(recommendation.bestGroup!.bancoBilleteraId)}
                    />
                    {avisoNfc}
                    <AlternativePromosList
                      groups={recommendation.alternativeGroups}
                      mejor={recommendation.bestGroup}
                      bancosMap={bancosMap}
                      onAbrir={setDetalleId}
                    />
                  </>
                ) : (
                  <>
                    {avisoNfc && <div className="-mt-4 mb-6">{avisoNfc}</div>}
                    <EmptyState
                      rubroNombre={rubroActual.nombre}
                      cuando={capitalizar(cuando)}
                      upcomingPromos={recommendation.upcomingPromos}
                      bancosMap={bancosMap}
                      onOpenWallet={openWallet}
                      onSelectDay={(dia) => today && setDayOffset((dia - today.getDay() + 7) % 7)}
                    />
                  </>
                )}
              </motion.div>
            )}
          </section>
        </main>
      </div>

      {/*
       * Pie: franja de ancho completo en tinta casi negra, así se ve dónde termina la página. La marca y tres
       * datos que dan confianza. Las animaciones se deciden solas (modo liviano automático).
       * Aparece junto con los resultados (si se mostrara antes, se vería arriba con la página todavía vacía y
       * después saltaría hacia abajo). Sin retardo: las entradas de las tarjetas usan transform, así que el pie ya
       * queda en su lugar definitivo desde el primer cuadro.
       */}
      {isLoaded && (
        <motion.footer
          className="bg-pie text-base text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className={`${CONTENEDOR} py-10 grid gap-8 tab:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}>
            <div>
              <p className="display text-[20px] font-bold tracking-[-0.04em] text-white">
                Paga<span className="text-pie-acento">Mejor</span>
              </p>
              <p className="mt-1 max-w-xs leading-snug">
                Descuentos bancarios claros para pagar mejor en Mar del Plata.
              </p>
            </div>
            <ul className="grid sm:grid-cols-3 gap-3 sm:gap-5 list-none">
              <DatoPie icono={ShieldCheck} titulo="Sin registro">
                No pedimos ni guardamos datos personales.
              </DatoPie>
              <DatoPie icono={DeviceMobile} titulo="En tu dispositivo">
                Tu billetera y el cálculo quedan en este equipo.
              </DatoPie>
              <DatoPie
              icono={ArrowsClockwise}
              titulo={
                ultimaVerificacion ? (
                  <>
                    <span className="sm:hidden">Revisadas el {fechaCorta(ultimaVerificacion)}</span>
                    <span className="hidden sm:inline">Promos verificadas</span>
                  </>
                ) : (
                  "Promos verificadas"
                )
              }
            >
                {ultimaVerificacion
                  ? `Revisadas en las fuentes oficiales el ${fechaCorta(ultimaVerificacion)}.`
                  : "Revisadas en las fuentes oficiales de cada banco."}
              </DatoPie>
            </ul>
            <p className="tab:col-span-2 pt-5 border-t border-white/10 leading-snug">
              Los reintegros los acredita cada banco o billetera según sus bases. Revisá las condiciones antes de pagar.
            </p>
          </div>
        </motion.footer>
      )}

      {/* Desglose de un banco: hoja desde abajo en el celular, ventana centrada en escritorio */}
      <Sheet
        isOpen={!!grupoEnDetalle}
        onClose={() => setDetalleId(null)}
        ancho="amplio"
        title={
          grupoEnDetalle && (
            <span className="flex items-center gap-3">
              <BankBadge banco={bancosMap[grupoEnDetalle.bancoBilleteraId]} aro />
              <span className="min-w-0">{grupoEnDetalle.bancoBilleteraNombre}</span>
            </span>
          )
        }
        description={
          grupoEnDetalle &&
          `${grupoEnDetalle.niveles.length > 1 ? "Hasta " : ""}${maxPorcentajeDetalle(grupoEnDetalle)}% de reintegro · ${grupoEnDetalle.diasTexto}`
        }
      >
        {grupoEnDetalle && (
          <PromoDetail
            key={`${grupoEnDetalle.bancoBilleteraId}-${selectedRubro}-${dayOffset}`}
            group={grupoEnDetalle}
            banco={bancosMap[grupoEnDetalle.bancoBilleteraId]}
            promosById={promosById}
            withHeader={false}
          />
        )}
      </Sheet>

      {recommendation?.bestGroup && (
        <TourDetalles
          paso={tourPaso}
          banco={recommendation.bestGroup.bancoBilleteraNombre}
          opciones={recommendation.bestGroup.totalOpciones}
          onVer={() => {
            setTourPaso("opcion");
            setDetalleId(recommendation.bestGroup!.bancoBilleteraId);
          }}
          onCerrar={() => setTourPaso(null)}
        />
      )}

      {today && (
        <OtroDiaSheet
          isOpen={isOtroDiaOpen}
          onClose={() => setIsOtroDiaOpen(false)}
          today={today}
          offset={dayOffset}
          onChange={setDayOffset}
        />
      )}

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        bancos={bancos}
        bankIdsDisponibles={bankIdsDisponibles}
        selectedBankIds={selectedBankIds}
        recursos={recursos}
        onSave={handleSaveWallet}
        isInitialOnboarding={isInitialOnboarding}
      />

      <RubrosModal
        isOpen={isRubrosModalOpen}
        onClose={() => setIsRubrosModalOpen(false)}
        rubros={rubrosConPromos}
        selectedRubro={selectedRubro}
        onSelectRubro={setSelectedRubro}
      />
    </>
  );
}
