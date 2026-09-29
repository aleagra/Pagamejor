"use client";

import React, { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { BancoBilletera } from "@/data/schema";

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

  useEffect(() => {
    setCurrentSelection(soloDisponibles(selectedBankIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankIds, isOpen]);

  if (!isOpen) return null;

  const toggleBank = (id: string) => {
    if (currentSelection.includes(id)) {
      setCurrentSelection(currentSelection.filter((b) => b !== id));
    } else {
      setCurrentSelection([...currentSelection, id]);
    }
  };

  const handleSave = () => {
    onSave(currentSelection);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
    >
      <div className="bg-surface rounded-2xl w-full max-w-[720px] max-h-[90vh] flex flex-col shadow-2xl border border-border-strong overflow-hidden">
        {/* Encabezado del modal */}
        <div className="p-6 pb-4 border-b border-border-subtle flex justify-between items-start gap-4">
          <div>
            <h2 id="wallet-title" className="text-2xl font-extrabold text-text-main mb-1">
              {isInitialOnboarding ? "¡Bienvenido a PagaMejor!" : "Mi Billetera"}
            </h2>
            <p className="text-base text-text-secondary leading-relaxed">
              Marcá los bancos y billeteras virtuales que tenés. Solo te mostraremos promociones de los que elijas acá.
            </p>
          </div>
          {!isInitialOnboarding && (
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] bg-surface-elevated border border-border-subtle rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-active transition-colors"
              onClick={onClose}
              aria-label="Cerrar ventana"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Lista de Bancos: 1 columna en móvil, 2 columnas en Tablet/Desktop */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[58vh]">
          {bancos.map((banco) => {
            const isDisponible = disponibles.has(banco.id);
            const isSelected = isDisponible && currentSelection.includes(banco.id);
            return (
              <button
                key={banco.id}
                type="button"
                disabled={!isDisponible}
                className={`flex items-center justify-between p-3.5 sm:px-4 min-h-[64px] rounded-xl border-2 text-left transition-all ${
                  !isDisponible
                    ? "border-border-subtle bg-surface-elevated opacity-50 cursor-not-allowed"
                    : isSelected
                    ? "border-forest bg-forest-bg shadow-xs"
                    : "border-border-subtle bg-surface hover:bg-surface-elevated hover:border-border-strong"
                }`}
                onClick={() => isDisponible && toggleBank(banco.id)}
                aria-pressed={isSelected}
                aria-disabled={!isDisponible}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-xs font-black tracking-tighter shrink-0 shadow-xs"
                    style={{
                      backgroundColor: banco.colorPrimario,
                      color: banco.colorTexto,
                    }}
                  >
                    {banco.siglas}
                  </div>
                  <div>
                    <div className="text-base font-bold text-text-main leading-tight">
                      {banco.nombre}
                    </div>
                    <div className="text-xs text-text-muted capitalize">
                      {banco.tipo === "banco" ? "Banco" : "Billetera Virtual"}
                      {!isDisponible && " · En verificación"}
                    </div>
                    {banco.nota && isDisponible && (
                      <div className="text-xs sm:text-sm text-terracotta font-semibold leading-snug mt-1">
                        {banco.nota}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ml-2 ${
                    isSelected
                      ? "border-forest bg-forest text-white"
                      : "border-border-strong bg-white"
                  }`}
                >
                  {isSelected && <Check size={18} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Pie del modal */}
        <div className="p-4 sm:p-6 border-t border-border-subtle bg-surface-elevated flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm text-text-muted text-center sm:text-left m-0 order-2 sm:order-1">
            Podés modificar tu billetera en cualquier momento tocando &quot;Mi Billetera&quot; arriba.
          </p>
          <button
            type="button"
            className="min-h-[56px] w-full sm:w-auto px-8 bg-forest text-white rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity order-1 sm:order-2 shrink-0"
            onClick={handleSave}
          >
            <span>
              {currentSelection.length === 0
                ? "Guardar sin medios"
                : `Guardar (${currentSelection.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
