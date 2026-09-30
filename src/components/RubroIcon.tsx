"use client";

import React from "react";
import {
  BookOpen,
  Cow,
  DeviceMobile,
  FilmSlate,
  ForkKnife,
  GasPump,
  Hammer,
  Package,
  PawPrint,
  Pill,
  ShoppingBag,
  ShoppingCart,
  TShirt,
  type Icon,
  type IconWeight,
} from "@phosphor-icons/react";
import { RubroId } from "@/data/schema";

/** Ícono uniforme (Phosphor) para cada rubro, en lugar de los emojis de rubros.json. */
const ICONOS: Record<RubroId, Icon> = {
  supermercado: ShoppingCart,
  combustible: GasPump,
  carniceria: Cow,
  farmacia: Pill,
  gastronomia: ForkKnife,
  indumentaria: TShirt,
  libreria: BookOpen,
  hogar: Hammer,
  mayorista: Package,
  mascotas: PawPrint,
  tecnologia: DeviceMobile,
  entretenimiento: FilmSlate,
  otros: ShoppingBag,
};

/** Los rubros del día a día: van siempre visibles; el resto está en "Más". */
export const RUBROS_FRECUENTES: RubroId[] = ["supermercado", "gastronomia", "combustible"];

/** Nombres cortos para los botones del celular, donde no entra "Supermercados". */
export const RUBRO_CORTO: Record<RubroId, string> = {
  supermercado: "Súper",
  gastronomia: "Comida",
  combustible: "Nafta",
  farmacia: "Farmacia",
  carniceria: "Carnes",
  indumentaria: "Ropa",
  libreria: "Librería",
  hogar: "Hogar",
  mayorista: "Mayorista",
  mascotas: "Mascotas",
  tecnologia: "Tecno",
  entretenimiento: "Ocio",
  otros: "Otros",
};

interface RubroIconProps {
  rubro: RubroId;
  size?: number;
  weight?: IconWeight;
  className?: string;
}

export const RubroIcon: React.FC<RubroIconProps> = ({ rubro, size = 20, weight = "regular", className }) => {
  const Componente = ICONOS[rubro] ?? ShoppingBag;
  return <Componente size={size} weight={weight} className={className} aria-hidden="true" />;
};
