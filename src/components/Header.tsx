"use client";

import React from "react";
import { Wallet } from "lucide-react";

interface HeaderProps {
  walletCount: number;
  onOpenWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({ walletCount, onOpenWallet }) => {
  return (
    <header className="flex flex-col gap-4 pb-6 border-b border-border-subtle mb-6">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-forest tracking-tight">
            PagaMejor
          </span>
          <span className="text-sm font-semibold text-text-muted bg-surface-elevated px-2 py-0.5 rounded">
            pagamejor.ar
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenWallet}
          className="inline-flex items-center gap-2 min-h-[48px] px-4 py-2 bg-surface border-2 border-border-strong rounded-full text-base font-bold text-text-main shadow-sm hover:bg-surface-elevated transition-colors"
          aria-label={`Ver y editar Mi Billetera. Tenés ${walletCount} bancos seleccionados.`}
        >
          <Wallet size={20} strokeWidth={2.2} />
          <span>Mi Billetera</span>
          {walletCount > 0 && (
            <span className="bg-forest text-white rounded-full px-2 py-0.5 text-sm font-bold">
              {walletCount}
            </span>
          )}
        </button>
      </div>

      <p className="text-lg text-text-secondary leading-snug">
        Elegí el rubro de tu compra para ver con qué tarjeta o billetera te conviene pagar hoy.
      </p>
    </header>
  );
};
