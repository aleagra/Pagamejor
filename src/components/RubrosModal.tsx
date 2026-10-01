"use client";

import React, { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
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
            className="w-full min-h-12 pl-11 pr-4 bg-fill rounded-2xl text-[17px] text-ink placeholder:text-ink-3 focus:bg-surface focus:ring-2 focus:ring-action outline-none transition-colors duration-200"
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
        // Grilla de 2 columnas con el ícono arriba y el nombre abajo: los 12 rubros entran sin bajar
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 list-none">
          {filteredRubros.map((r) => {
            const isSelected = r.id === selectedRubro;
            return (
              <li key={r.id} className="flex">
                <button
                  type="button"
                  className={`w-full flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[76px] rounded-2xl text-center transition-colors duration-200 ${
                    isSelected ? "bg-action text-white" : "bg-canvas text-ink hover:bg-fill active:bg-fill"
                  }`}
                  onClick={() => {
                    onSelectRubro(r.id);
                    onClose();
                  }}
                  aria-pressed={isSelected}
                  title={r.descripcion}
                >
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-white/15 text-white" : "bg-surface text-ink-2"
                    }`}
                    aria-hidden="true"
                  >
                    <RubroIcon rubro={r.id} size={20} weight={isSelected ? "fill" : "regular"} />
                  </span>
                  <span className="max-w-full text-base font-semibold leading-tight [overflow-wrap:anywhere]">{r.nombre}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
};
