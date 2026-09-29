"use client";

import React from "react";
import { X, Calendar } from "lucide-react";

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}

const DIAS = [
  { dia: null, label: "Hoy (Día actual)" },
  { dia: 1, label: "Lunes" },
  { dia: 2, label: "Martes" },
  { dia: 3, label: "Miércoles" },
  { dia: 4, label: "Jueves" },
  { dia: 5, label: "Viernes" },
  { dia: 6, label: "Sábado" },
  { dia: 0, label: "Domingo" },
];

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  selectedDay,
  onSelectDay,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-title"
    >
      <div className="bg-surface rounded-2xl w-full max-w-[480px] shadow-2xl border border-border-strong overflow-hidden flex flex-col">
        <div className="p-6 pb-4 border-b border-border-subtle flex justify-between items-start gap-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="text-forest shrink-0" size={24} />
            <div>
              <h2 id="plan-title" className="text-xl font-extrabold text-text-main">
                Planificar para otro día
              </h2>
              <p className="text-sm text-text-secondary">
                Consultá qué promociones aplican en un día específico de la semana.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="min-w-[44px] min-h-[44px] bg-surface-elevated border border-border-subtle rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-active"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
          {DIAS.map((item) => {
            const isSelected = selectedDay === item.dia;
            return (
              <button
                key={item.dia ?? "hoy"}
                type="button"
                className={`flex items-center justify-between p-4 min-h-[52px] rounded-xl border-2 text-left font-bold transition-colors ${
                  isSelected
                    ? "border-forest bg-forest-bg text-forest"
                    : "border-border-subtle bg-surface hover:bg-surface-elevated text-text-main"
                }`}
                onClick={() => {
                  onSelectDay(item.dia);
                  onClose();
                }}
              >
                <span>{item.label}</span>
                {isSelected && <span className="text-xs bg-forest text-white px-2.5 py-1 rounded-full">Activo</span>}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-border-subtle bg-surface-elevated flex justify-end">
          <button
            type="button"
            className="min-h-[44px] px-5 py-2 bg-surface border-2 border-border-strong rounded-xl text-sm font-bold text-text-main hover:bg-surface-active"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
