"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { BancoBilletera } from "@/data/schema";
import { Sheet } from "@/components/Sheet";
import { BankBadge } from "@/components/BankBadge";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  bancos: BancoBilletera[];
  /** Ids con al menos una promo activa. Los demás se muestran deshabilitados ("En verificación"). */
  bankIdsDisponibles: string[];
  selectedBankIds: string[];
  onSave: (newSelectedIds: string[]) => void;
  isInitialOnboarding?: boolean;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  bancos,
  bankIdsDisponibles,
  selectedBankIds,
  onSave,
  isInitialOnboarding = false,
}) => {
  const disponibles = new Set(bankIdsDisponibles);
  const soloDisponibles = (ids: string[]) => ids.filter((id) => disponibles.has(id));
  const [currentSelection, setCurrentSelection] = useState<string[]>(soloDisponibles(selectedBankIds));
  const [busqueda, setBusqueda] = useState("");
  // Grupos cerrados por la persona (arrancan todos abiertos)
  const [colapsados, setColapsados] = useState<string[]>([]);

  useEffect(() => {
    setCurrentSelection(soloDisponibles(selectedBankIds));
    setBusqueda("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankIds, isOpen]);

  const toggleBank = (id: string) => {
    setCurrentSelection((sel) => (sel.includes(id) ? sel.filter((b) => b !== id) : [...sel, id]));
  };

  const handleSave = () => {
    onSave(currentSelection);
    onClose();
  };

  // Primero los que se pueden elegir; los "En verificación" al final de cada grupo
  const ordenar = (lista: BancoBilletera[]) =>
    [...lista].sort((a, b) => Number(disponibles.has(b.id)) - Number(disponibles.has(a.id)));
  const termino = busqueda.trim().toLowerCase();
  const coincide = (b: BancoBilletera) => !termino || b.nombre.toLowerCase().includes(termino);
  // Las billeteras virtuales primero: son lo más usado para pagar
  const grupos = [
    { id: "billeteras", titulo: "Billeteras virtuales", todos: ordenar(bancos.filter((b) => b.tipo !== "banco")) },
    { id: "bancos", titulo: "Bancos", todos: ordenar(bancos.filter((b) => b.tipo === "banco")) },
  ]
    .map((g) => ({ ...g, items: g.todos.filter(coincide) }))
    .filter((g) => g.items.length > 0);
  const elegidos = currentSelection.length;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!isInitialOnboarding}
      title={isInitialOnboarding ? "Te damos la bienvenida" : "Mi billetera"}
      description="Marcá los bancos y billeteras que tenés. Solo vas a ver promociones de los que elijas acá."
      toolbar={
        // Fijo arriba: buscador y cuántos hay elegidos, siempre a la vista
        <div className="flex items-center gap-2.5">
          <label className="relative flex-1 flex items-center">
            <span className="sr-only">Buscar banco o billetera</span>
            <MagnifyingGlass className="absolute left-4 text-ink-3" size={20} aria-hidden="true" />
            <input
              type="search"
              className="w-full min-h-12 pl-11 pr-4 bg-fill rounded-2xl text-[17px] text-ink placeholder:text-ink-3 focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition-colors duration-200"
              placeholder="Buscar (ej. Galicia, Ualá…)"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <span
            className="shrink-0 min-h-12 px-3.5 inline-flex items-center gap-1.5 rounded-2xl bg-accent-soft text-base font-semibold text-accent-strong tabular-nums"
            aria-live="polite"
          >
            <Check size={16} weight="bold" aria-hidden="true" />
            {elegidos} {elegidos === 1 ? "elegido" : "elegidos"}
          </span>
        </div>
      }
      footer={
        <button
          type="button"
          className="w-full min-h-14 px-6 rounded-full bg-ink text-white text-lg font-semibold hover:bg-[#2a2d31] active:scale-[0.98] transition-[background-color,transform] duration-200"
          onClick={handleSave}
        >
          {elegidos === 0
            ? "Guardar sin medios de pago"
            : `Guardar ${elegidos} ${elegidos === 1 ? "medio de pago" : "medios de pago"}`}
        </button>
      }
    >
      {grupos.length === 0 && (
        <p className="text-center text-ink-3 py-10 text-lg">No encontramos &quot;{busqueda}&quot;.</p>
      )}
      {grupos.map((grupo) => {
        // Mientras se busca, los grupos con coincidencias se muestran abiertos
        const abierto = termino !== "" || !colapsados.includes(grupo.id);
        const elegidosGrupo = grupo.todos.filter((b) => currentSelection.includes(b.id)).length;
        const disponiblesGrupo = grupo.todos.filter((b) => disponibles.has(b.id)).length;
        const listaId = `wallet-${grupo.id}`;
        return (
          <section key={grupo.id} className="mt-4 first:mt-0">
            <button
              type="button"
              onClick={() =>
                setColapsados((c) => (c.includes(grupo.id) ? c.filter((x) => x !== grupo.id) : [...c, grupo.id]))
              }
              aria-expanded={abierto}
              aria-controls={listaId}
              disabled={termino !== ""}
              className="w-full min-h-12 flex items-center gap-2 px-2 mb-1 text-left rounded-xl hover:bg-fill/50 transition-colors duration-200 disabled:hover:bg-transparent"
            >
              <span className="flex-1 text-[17px] font-semibold text-ink">{grupo.titulo}</span>
              <span className="text-base text-ink-3 tabular-nums">
                {elegidosGrupo} de {disponiblesGrupo} elegidos
              </span>
              {termino === "" && (
                <CaretDown
                  size={18}
                  weight="bold"
                  className={`shrink-0 text-ink-3 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              )}
            </button>
            {abierto && (
              <ul id={listaId} className="bg-canvas rounded-3xl overflow-hidden list-none">
                {grupo.items.map((banco, idx) => {
                  const isDisponible = disponibles.has(banco.id);
                  const isSelected = isDisponible && currentSelection.includes(banco.id);
                  return (
                    <li key={banco.id} className="relative">
                      {idx > 0 && <div className="absolute top-0 right-0 left-[76px] h-px bg-hairline" aria-hidden="true" />}
                      <motion.button
                        type="button"
                        disabled={!isDisponible}
                        whileTap={isDisponible ? { scale: 0.98 } : undefined}
                        onClick={() => toggleBank(banco.id)}
                        aria-pressed={isSelected}
                        className={`w-full flex items-center gap-4 pl-4 pr-4 py-3 min-h-[68px] text-left transition-colors duration-200 ${
                          isDisponible ? "hover:bg-fill/60 active:bg-fill" : "cursor-not-allowed"
                        }`}
                      >
                        <span className={isDisponible ? "" : "opacity-45"}>
                          <BankBadge banco={banco} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={`block text-[17px] font-semibold leading-snug ${isDisponible ? "text-ink" : "text-ink-3"}`}
                          >
                            {banco.nombre}
                          </span>
                          {!isDisponible ? (
                            <span className="block text-base text-ink-3">En verificación</span>
                          ) : (
                            banco.nota && <span className="block text-base leading-snug text-ink-3">{banco.nota}</span>
                          )}
                        </span>
                        {isDisponible && (
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                              isSelected ? "bg-accent text-white" : "border-2 border-fill-strong bg-surface"
                            }`}
                            aria-hidden="true"
                          >
                            <AnimatePresence initial={false}>
                              {isSelected && (
                                <motion.span
                                  initial={{ scale: 0, rotate: -30 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                                  transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                                  className="flex"
                                >
                                  <Check size={17} weight="bold" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                        )}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </Sheet>
  );
};
