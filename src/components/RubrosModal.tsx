"use client";

import React, { useEffect, useState } from "react";
import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import { Rubro, RubroId } from "@/data/schema";
import { Sheet } from "@/components/Sheet";
import { RubroIcon } from "@/components/RubroIcon";

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

  useEffect(() => {
    if (isOpen) setSearchTerm("");
  }, [isOpen]);

  const term = searchTerm.trim().toLowerCase();
  const filteredRubros = rubros.filter(
    (r) => r.nombre.toLowerCase().includes(term) || r.descripcion.toLowerCase().includes(term)
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Todos los rubros"
      cerrarAbajo
      toolbar={
        <label className="relative flex items-center">
          <span className="sr-only">Buscar rubro</span>
          <MagnifyingGlass className="absolute left-4 text-ink-3" size={20} aria-hidden="true" />
          <input
            type="search"
            className="w-full min-h-12 pl-11 pr-4 bg-fill rounded-2xl text-[17px] text-ink placeholder:text-ink-3 focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition-colors duration-200"
            placeholder="Buscar (ej. librería, hogar…)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      }
    >
      {filteredRubros.length === 0 ? (
        <p className="text-center text-ink-3 py-10 text-lg">No encontramos rubros con &quot;{searchTerm}&quot;.</p>
      ) : (
        <ul className="bg-canvas rounded-3xl overflow-hidden list-none">
          {filteredRubros.map((r, idx) => {
            const isSelected = r.id === selectedRubro;
            return (
              <li key={r.id} className="relative">
                {idx > 0 && <div className="absolute top-0 right-0 left-[72px] h-px bg-hairline" aria-hidden="true" />}
                <button
                  type="button"
                  className="w-full flex items-center gap-4 px-4 py-3 min-h-[68px] text-left hover:bg-fill/60 active:bg-fill transition-colors duration-200"
                  onClick={() => {
                    onSelectRubro(r.id);
                    onClose();
                  }}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-accent text-white" : "bg-surface text-ink-2"
                    }`}
                  >
                    <RubroIcon rubro={r.id} size={21} weight={isSelected ? "fill" : "regular"} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-lg font-semibold leading-snug text-ink">{r.nombre}</span>
                    <span className="text-base leading-snug text-ink-3 line-clamp-1">{r.descripcion}</span>
                  </span>
                  {isSelected && <Check size={22} weight="bold" className="shrink-0 text-accent" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
};
