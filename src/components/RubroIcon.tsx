"use client";

import React from "react";
import {
  BookOpen,
  Bus,
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
  transporte: Bus,
  otros: ShoppingBag,
};

/**
 * Los tres rubros siempre visibles (el resto está en "Más"). Elegidos con los datos de septiembre 2026: son los
 * que tienen promos en más bancos y billeteras (súper 79 promos en 12 medios, gastronomía 20 en 9, farmacia 18
 * en 7; combustible queda cuarto con 8 en 6) y farmacia es de uso frecuente para el público mayor.
 */
export const RUBROS_FRECUENTES: RubroId[] = ["supermercado", "gastronomia", "farmacia"];

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
  transporte: "Transporte",
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
