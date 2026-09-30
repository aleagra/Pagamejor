"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import bancosData from "@/data/bancos.json";
import rubrosData from "@/data/rubros.json";
import promosData from "@/data/promos.json";
import { BancoBilletera, Rubro, RubroId, Promocion } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { findBestPromos } from "@/logic/engine";
import { getStoredWallet, saveStoredWallet, hasConfiguredWallet } from "@/logic/walletStorage";
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
import { AnimacionesControl } from "@/components/AnimacionesControl";
import { Sheet } from "@/components/Sheet";
import { BankBadge } from "@/components/BankBadge";
import { useMediaQuery } from "@/components/useMediaQuery";
import { getLenis, useModoLiviano } from "@/components/MotionProvider";
import { fechaTexto, nombreDiaSemana } from "@/components/format";
import { CalendarBlank, Wallet } from "@phosphor-icons/react";

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Alto de la barra fija + aire: lo que queda tapado arriba al llevar algo a la vista. */
const MARGEN_BARRA = 88;

export default function HomePage() {
  const bancos = bancosData as BancoBilletera[];
  const rubros = rubrosData as Rubro[];
  const promos = promosData as Promocion[];

  // Diccionarios para rápido acceso por ID
  const bancosMap = useMemo(() => Object.fromEntries(bancos.map((b) => [b.id, b])), [bancos]);
  const promosById = useMemo(() => Object.fromEntries(promos.map((p) => [p.id, p])), [promos]);

  // Solo se pueden elegir los medios con al menos una promo activa (verificada); el resto figura "En verificación"
  const bankIdsDisponibles = useMemo(() => {
    return Array.from(new Set(promos.filter((p) => p.activo).map((p) => p.bancoBilleteraId)));
  }, [promos]);

  // Estados de la app
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
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

  // Banco con el desglose abierto (uno a la vez: la mejor opción o una fila de la lista). En escritorio se
  // expande en su lugar; en celular sube en una hoja desde abajo, que es más cómodo con el pulgar
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hojaId, setHojaId] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const { liviano } = useModoLiviano();

  // Carga inicial segura en cliente
  useEffect(() => {
    const hasConfig = hasConfiguredWallet();
    setSelectedBankIds(getStoredWallet());
    setToday(new Date());

    if (!hasConfig) {
      setIsInitialOnboarding(true);
      setIsWalletModalOpen(true);
    }
    setIsLoaded(true);

    const handleWalletUpdated = () => setSelectedBankIds(getStoredWallet());
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

  const handleSaveWallet = (newBankIds: string[]) => {
    setSelectedBankIds(newBankIds);
    saveStoredWallet(newBankIds);
    setIsInitialOnboarding(false);
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
  // pagan con MODO siguen bajo ese banco, marcadas "QR MODO".
  const recommendation = useMemo(() => {
    if (!targetDate) return null;
    return findBestPromos(selectedBankIds, selectedRubro, targetDate, promos);
  }, [selectedBankIds, selectedRubro, targetDate, promos]);

  const rubroActual = rubros.find((r) => r.id === selectedRubro) || rubros[0];

  const grupoEnHoja = useMemo(() => {
    if (!hojaId || !recommendation?.bestGroup) return null;
    return (
      [recommendation.bestGroup, ...recommendation.alternativeGroups].find((g) => g.bancoBilleteraId === hojaId) ?? null
    );
  }, [hojaId, recommendation]);

  // Al cambiar rubro, día o billetera, se cierran los desgloses abiertos
  useEffect(() => {
    setExpandedId(null);
    setHojaId(null);
  }, [selectedRubro, dayOffset, selectedBankIds]);

  // Al pasar de celular a escritorio (o al revés) se cierra lo abierto con la otra modalidad
  useEffect(() => {
    if (isDesktop) setHojaId(null);
    else setExpandedId(null);
  }, [isDesktop]);

  /**
   * Abre o cierra el desglose de un banco en su lugar. Si al abrirlo la fila quedó tapada por la barra
   * (por ejemplo porque se cerró otra que estaba arriba), la página la acomoda a la vista. Se mide cuando
   * terminó de cerrarse el desglose anterior, que al achicarse mueve la fila hacia arriba.
   */
  const toggleDetalle = (bankId: string, elemento: HTMLElement | null) => {
    if (!isDesktop) {
      setHojaId(bankId);
      return;
    }
    const abrir = expandedId !== bankId;
    setExpandedId(abrir ? bankId : null);
    if (!abrir || !elemento) return;
    window.setTimeout(
      () => {
        const top = elemento.getBoundingClientRect().top;
        if (top >= MARGEN_BARRA) return;
        const destino = Math.max(0, window.scrollY + top - MARGEN_BARRA);
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(destino, { duration: 0.5 });
        else window.scrollTo({ top: destino, behavior: liviano ? "auto" : "smooth" });
      },
      liviano ? 0 : 560,
    );
  };

  const renderDetalle = (g: GroupedBankPromo) => (
    <PromoDetail group={g} banco={bancosMap[g.bancoBilleteraId]} promosById={promosById} withHeader={false} />
  );

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

      {/* Una sola columna centrada y un único scroll de página */}
      <div className={`${CONTENEDOR} flex-1 flex flex-col pt-5 sm:pt-8 pb-10`}>
        <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col">
          <div className="flex flex-col gap-5">
            <Header eyebrow={eyebrow} title={`¿Con qué pago ${cuando}?`} />

            {/* Otro día: vista aparte, fuera del flujo principal (la pantalla muestra hoy) */}
            {today && (
              <div className="-mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtroDiaOpen(true)}
                  className="inline-flex items-center gap-1.5 min-h-12 px-4 -ml-1 rounded-full text-[17px] font-semibold text-ink hover:bg-fill transition-colors duration-200"
                >
                  <CalendarBlank size={19} weight="bold" aria-hidden="true" />
                  Ver otro día
                </button>
                {dayOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setDayOffset(0)}
                    className="inline-flex items-center min-h-12 px-4 rounded-full bg-fill text-[17px] font-semibold text-ink hover:bg-fill-strong transition-colors duration-200"
                  >
                    Volver a hoy
                  </button>
                )}
              </div>
            )}

            <section className="lg:hidden" aria-labelledby="rubro-title">
              <h2 id="rubro-title" className="text-[17px] font-medium text-ink-3 mb-2">
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

          <main className="flex-1 mt-8">
            <section aria-live="polite" aria-label="Resultados">
              {!isLoaded || !recommendation ? null : selectedBankIds.length === 0 ? (
                <motion.div
                  className="bg-surface rounded-[28px] p-7 sm:p-8 shadow-[var(--shadow-card)]"
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                >
                  <span
                    className="w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-5"
                    aria-hidden="true"
                  >
                    <Wallet size={26} />
                  </span>
                  <h2 className="display text-[26px] sm:text-[28px] font-bold leading-tight text-ink mb-2">
                    Tu billetera está vacía
                  </h2>
                  <p className="text-lg leading-relaxed text-ink-2 mb-6">
                    Elegí qué tarjetas o billeteras virtuales tenés para ver las promociones que podés aprovechar.
                  </p>
                  <button
                    type="button"
                    className="w-full sm:w-auto min-h-14 px-8 rounded-full bg-ink text-white text-lg font-semibold hover:bg-[#2a2d31] active:scale-[0.98] transition-[background-color,transform] duration-200"
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
                        abierto={expandedId === recommendation.bestGroup.bancoBilleteraId}
                        onToggle={() => toggleDetalle(recommendation.bestGroup!.bancoBilleteraId, null)}
                        detalle={renderDetalle(recommendation.bestGroup)}
                        abreHoja={!isDesktop}
                      />
                      <AlternativePromosList
                        groups={recommendation.alternativeGroups}
                        bancosMap={bancosMap}
                        expandedId={expandedId}
                        onToggle={toggleDetalle}
                        renderDetalle={renderDetalle}
                        abreHoja={!isDesktop}
                      />
                    </>
                  ) : (
                    <EmptyState
                      rubroNombre={rubroActual.nombre}
                      cuando={capitalizar(cuando)}
                      upcomingPromos={recommendation.upcomingPromos}
                      bancosMap={bancosMap}
                      onOpenWallet={openWallet}
                      onSelectDay={(dia) => today && setDayOffset((dia - today.getDay() + 7) % 7)}
                    />
                  )}
                </motion.div>
              )}
            </section>
          </main>

          <footer className="mt-16 pt-6 border-t border-hairline text-base text-ink-3 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p>PagaMejor.ar: descuentos bancarios claros para pagar mejor en Mar del Plata.</p>
              <p>Todo se calcula en tu dispositivo. Sin registro y sin guardar datos personales.</p>
            </div>
            <AnimacionesControl />
          </footer>
        </div>
      </div>

      {/* Celular: el desglose de un banco sube en una hoja (en escritorio se expande en su lugar) */}
      <Sheet
        isOpen={!isDesktop && !!grupoEnHoja}
        onClose={() => setHojaId(null)}
        title={
          grupoEnHoja && (
            <span className="flex items-center gap-3">
              <BankBadge banco={bancosMap[grupoEnHoja.bancoBilleteraId]} />
              <span className="min-w-0">{grupoEnHoja.bancoBilleteraNombre}</span>
            </span>
          )
        }
        description={
          grupoEnHoja &&
          `${grupoEnHoja.niveles.length > 1 ? "Hasta " : ""}${grupoEnHoja.maxPorcentaje}% de reintegro · ${grupoEnHoja.diasTexto}`
        }
      >
        {grupoEnHoja && (
          <PromoDetail
            key={`${grupoEnHoja.bancoBilleteraId}-${selectedRubro}-${dayOffset}`}
            group={grupoEnHoja}
            banco={bancosMap[grupoEnHoja.bancoBilleteraId]}
            promosById={promosById}
            withHeader={false}
          />
        )}
      </Sheet>

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
        onSave={handleSaveWallet}
        isInitialOnboarding={isInitialOnboarding}
      />

      <RubrosModal
        isOpen={isRubrosModalOpen}
        onClose={() => setIsRubrosModalOpen(false)}
        rubros={rubros}
        selectedRubro={selectedRubro}
        onSelectRubro={setSelectedRubro}
      />
    </>
  );
}
