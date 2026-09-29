"use client";

import React, { useState } from "react";
import { X, Search, Check } from "lucide-react";
import { Rubro, RubroId } from "@/data/schema";

interface RubrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  rubros: Rubro[];
  selectedRubro: RubroId;
  onSelectRubro: (rubroId: RubroId) => void;
}

export const RubrosModal: React.FC<RubrosModalProps> = ({
  isOpen,
  onClose,
  rubros,
  selectedRubro,
  onSelectRubro,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredRubros = rubros.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.nombre.toLowerCase().includes(term) ||
      r.descripcion.toLowerCase().includes(term)
    );
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubros-modal-title"
    >
      <div className="bg-surface rounded-2xl w-full max-w-[620px] max-h-[90vh] shadow-2xl border border-border-strong overflow-hidden flex flex-col">
        {/* Encabezado */}
        <div className="p-6 pb-4 border-b border-border-subtle flex justify-between items-start gap-4">
          <div>
            <h2 id="rubros-modal-title" className="text-2xl font-extrabold text-text-main mb-1">
              Todos los rubros de compra
            </h2>
            <p className="text-sm sm:text-base text-text-secondary">
              Elegí en qué comercio vas a gastar para ver tu mejor tarjeta hoy.
            </p>
          </div>
          <button
            type="button"
            className="min-w-[44px] min-h-[44px] bg-surface-elevated border border-border-subtle rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-active transition-colors shrink-0"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X size={24} />
          </button>
        </div>

        {/* Buscador */}
        <div className="p-4 sm:px-6 border-b border-border-subtle bg-surface-elevated">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-text-muted" size={20} />
            <input
              type="text"
              className="w-full min-h-[50px] pl-11 pr-4 bg-surface border-2 border-border-strong rounded-xl text-base font-semibold text-text-main placeholder:text-text-muted focus:border-forest focus:outline-none"
              placeholder="Buscar rubro (ej. librería, mayorista, hogar...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Lista de rubros */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-2.5 max-h-[55vh]">
          {filteredRubros.length === 0 ? (
            <p className="text-center text-text-muted py-8 text-base">
              No se encontraron rubros con &quot;{searchTerm}&quot;.
            </p>
          ) : (
            filteredRubros.map((r) => {
              const isSelected = r.id === selectedRubro;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`flex items-center justify-between p-4 min-h-[64px] rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-forest bg-forest-bg"
                      : "border-border-subtle bg-surface hover:bg-surface-elevated hover:border-border-strong"
                  }`}
                  onClick={() => {
                    onSelectRubro(r.id);
                    onClose();
                  }}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                      {r.icono}
                    </span>
                    <div>
                      <div className="text-base sm:text-lg font-bold text-text-main">
                        {r.nombre}
                      </div>
                      <div className="text-xs sm:text-sm text-text-secondary line-clamp-1">
                        {r.descripcion}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-7 h-7 rounded-full bg-forest text-white flex items-center justify-center shrink-0">
                      <Check size={18} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Pie */}
        <div className="p-4 sm:px-6 border-t border-border-subtle bg-surface-elevated flex justify-end">
          <button
            type="button"
            className="min-h-[46px] px-6 py-2 bg-surface border-2 border-border-strong rounded-xl text-base font-bold text-text-main hover:bg-surface-active"
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
