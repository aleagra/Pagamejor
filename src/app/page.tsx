"use client";

import React, { useState, useEffect, useMemo } from "react";
import bancosData from "@/data/bancos.json";
import rubrosData from "@/data/rubros.json";
import promosData from "@/data/promos.json";
import { BancoBilletera, Rubro, RubroId, Promocion } from "@/data/schema";
import { findBestPromos } from "@/logic/engine";
import { getStoredWallet, saveStoredWallet, hasConfiguredWallet } from "@/logic/walletStorage";
import { Header } from "@/components/Header";
import { WalletModal } from "@/components/WalletModal";
import { RubroSelector } from "@/components/RubroSelector";
import { RubrosModal } from "@/components/RubrosModal";
import { PlanModal } from "@/components/PlanModal";
import { PromoResultCard } from "@/components/PromoResultCard";
import { AlternativePromosList } from "@/components/AlternativePromosList";
import { EmptyState } from "@/components/EmptyState";
import { Calendar } from "lucide-react";

export default function HomePage() {
  const bancos = bancosData as BancoBilletera[];
  const rubros = rubrosData as Rubro[];
  const promos = promosData as Promocion[];

  // Diccionario de bancos para rápido acceso por ID
  const bancosMap = useMemo(() => {
    return Object.fromEntries(bancos.map((b) => [b.id, b]));
  }, [bancos]);

  // Solo se pueden elegir los medios con al menos una promo activa (verificada); el resto figura "En verificación"
  const bankIdsDisponibles = useMemo(() => {
    return Array.from(new Set(promos.filter((p) => p.activo).map((p) => p.bancoBilleteraId)));
  }, [promos]);

  // Estados de la app
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedRubro, setSelectedRubro] = useState<RubroId>("supermercado");
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isRubrosModalOpen, setIsRubrosModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isInitialOnboarding, setIsInitialOnboarding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Selector de día secundario (null = Hoy)
  const [simulatedDay, setSimulatedDay] = useState<number | null>(null);

  // Carga inicial segura en cliente
  useEffect(() => {
    const hasConfig = hasConfiguredWallet();
    const stored = getStoredWallet();
    setSelectedBankIds(stored);

    if (!hasConfig) {
      setIsInitialOnboarding(true);
      setIsWalletModalOpen(true);
    }
    setIsLoaded(true);

    const handleWalletUpdated = () => {
      setSelectedBankIds(getStoredWallet());
    };
    window.addEventListener("pagamejor_wallet_updated", handleWalletUpdated);
    return () => {
      window.removeEventListener("pagamejor_wallet_updated", handleWalletUpdated);
    };
  }, []);

  const handleSaveWallet = (newBankIds: string[]) => {
    setSelectedBankIds(newBankIds);
    saveStoredWallet(newBankIds);
    setIsInitialOnboarding(false);
  };

  const targetDate = useMemo(() => {
    const now = new Date();
    if (simulatedDay === null) return now;

    const currentDay = now.getDay();
    const diff = simulatedDay - currentDay;
    const simulatedDate = new Date(now);
    simulatedDate.setDate(now.getDate() + diff);
    return simulatedDate;
  }, [simulatedDay]);

  // Las promos "generales" de MODO (cualquier banco adherido) valen para quien tenga la tarjeta de un banco
  // adherido, aunque no haya tildado MODO. Las promos exclusivas de un banco siguen bajo ese banco.
  const walletEfectiva = useMemo(() => {
    const tieneAdherido = selectedBankIds.some((id) => bancosMap[id]?.adheridoAModo);
    return tieneAdherido && !selectedBankIds.includes("modo") ? [...selectedBankIds, "modo"] : selectedBankIds;
  }, [selectedBankIds, bancosMap]);

  const recommendation = useMemo(() => {
    return findBestPromos(walletEfectiva, selectedRubro, targetDate, promos);
  }, [walletEfectiva, selectedRubro, targetDate, promos]);

  const rubroActual = rubros.find((r) => r.id === selectedRubro) || rubros[0];

  // Fecha fija y limpia en español (ej: "Martes 22 de septiembre")
  const fechaFormateada = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const formatted = formatter.format(targetDate);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [targetDate]);

  return (
    <>
      <Header
        walletCount={selectedBankIds.length}
        onOpenWallet={() => {
          setIsInitialOnboarding(false);
          setIsWalletModalOpen(true);
        }}
      />

      <main className="flex-1">
        {/* Selector de Rubros con botón para ver catálogo completo */}
        <RubroSelector
          rubros={rubros}
          selectedRubro={selectedRubro}
          onSelectRubro={setSelectedRubro}
          onOpenAllRubros={() => setIsRubrosModalOpen(true)}
        />

        {/* Barra fija con la fecha de hoy y acceso secundario para planificar */}
        <section
          className="bg-surface border border-border-subtle rounded-xl p-3.5 sm:px-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 shadow-xs"
          aria-label="Fecha de consulta"
        >
          <div className="flex items-center gap-2.5 text-base sm:text-lg text-text-main">
            <span className="w-2.5 h-2.5 rounded-full bg-forest shrink-0" aria-hidden="true" />
            <span>
              {simulatedDay === null ? "Promociones para hoy, " : "Consultando para el "}
              <strong className="text-text-main">{fechaFormateada}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {simulatedDay !== null && (
              <button
                type="button"
                className="text-xs font-bold bg-surface-elevated text-text-secondary px-2.5 py-1 rounded-md border border-border-subtle hover:bg-surface-active"
                onClick={() => setSimulatedDay(null)}
              >
                Volver a Hoy
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-forest hover:underline"
              onClick={() => setIsPlanModalOpen(true)}
            >
              <Calendar size={16} />
              <span>{simulatedDay === null ? "¿Querés ver otro día?" : "Cambiar día"}</span>
            </button>
          </div>
        </section>

        {/* Zona de Resultados con soporte responsive para Desktop (lado a lado) */}
        <section aria-live="polite">
          {!isLoaded ? null : selectedBankIds.length === 0 ? (
            <div className="bg-surface border-2 border-terracotta-border rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto shadow-xs">
              <h2 className="text-xl sm:text-2xl font-extrabold text-text-main mb-2">
                Tu billetera aún no tiene medios de pago
              </h2>
              <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-5">
                Seleccioná qué tarjetas o billeteras virtuales tenés para ver las promociones que podés aprovechar hoy.
              </p>
              <button
                type="button"
                className="min-h-[56px] px-8 py-3 bg-forest text-white rounded-xl text-lg font-bold shadow-sm hover:opacity-95 transition-opacity"
                onClick={() => {
                  setIsInitialOnboarding(true);
                  setIsWalletModalOpen(true);
                }}
              >
                Configurar Mi Billetera ahora
              </button>
            </div>
          ) : recommendation.bestGroup ? (
            recommendation.alternativeGroups.length > 0 ? (
              /* En Desktop (lg), mostramos card ganadora a la izquierda y alternativas a la derecha */
              <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
                <div className="lg:col-span-7">
                  <PromoResultCard
                    group={recommendation.bestGroup}
                    banco={bancosMap[recommendation.bestGroup.bancoBilleteraId]}
                  />
                </div>
                <div className="lg:col-span-5">
                  <AlternativePromosList
                    groups={recommendation.alternativeGroups}
                    bancosMap={bancosMap}
                  />
                </div>
              </div>
            ) : (
              /* Si es la única entidad, centramos la card ganadora con ancho moderado */
              <div className="max-w-2xl mx-auto">
                <PromoResultCard
                  group={recommendation.bestGroup}
                  banco={bancosMap[recommendation.bestGroup.bancoBilleteraId]}
                />
              </div>
            )
          ) : (
            <div className="max-w-2xl mx-auto">
              <EmptyState
                rubroNombre={rubroActual.nombre}
                nombreDia={recommendation.nombreDia}
                upcomingPromos={recommendation.upcomingPromos}
                onOpenWallet={() => setIsWalletModalOpen(true)}
              />
            </div>
          )}
        </section>
      </main>

      <footer className="mt-12 pt-6 border-t border-border-subtle text-center text-sm text-text-muted flex flex-col gap-1">
        <p>PagaMejor.ar — Información bancaria clara para maximizar tus ahorros cotidianos en Argentina.</p>
        <p>Los datos se procesan 100% en tu dispositivo. No guardamos tus datos personales ni requiere registro.</p>
      </footer>

      {/* Modales */}
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

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        selectedDay={simulatedDay}
        onSelectDay={setSimulatedDay}
      />
    </>
  );
}
