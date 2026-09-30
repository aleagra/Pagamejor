"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Wallet } from "@phosphor-icons/react";
import { getLenis } from "@/components/MotionProvider";

/** Ancho del contenido, compartido con la página para que la barra quede alineada. */
export const CONTENEDOR = "w-full max-w-6xl xl:max-w-7xl mx-auto px-5 sm:px-8 lg:px-10";

interface NavbarProps {
  walletCount: number;
  onOpenWallet: () => void;
  /** Selector de rubros para el centro de la barra (solo se muestra en escritorio). */
  rubros?: React.ReactNode;
}

function volverArriba() {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0);
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Barra fija de vidrio: marca, rubros (escritorio) y acceso a Mi billetera. */
export const Navbar: React.FC<NavbarProps> = ({ walletCount, onOpenWallet, rubros }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      aria-label="Principal"
      className={`vidrio sticky top-0 z-40 transition-[box-shadow] duration-300 ${scrolled ? "vidrio-activo" : ""}`}
    >
      {/* Barra de ancho completo con efecto vidrio (liquid glass): translúcida, desenfocada y con reflejo */}
      <div className={CONTENEDOR}>
        <div className="h-16 lg:h-[72px] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={volverArriba}
            className="display text-[22px] font-extrabold tracking-[-0.03em] text-ink min-h-12 -ml-1 px-1 rounded-lg"
            aria-label="PagaMejor, volver arriba"
          >
            Paga<span className="text-accent">Mejor</span>
          </button>

          {/* Escritorio: el selector de rubros vive en la barra, siempre a mano */}
          {rubros && <div className="hidden lg:block">{rubros}</div>}

          <motion.button
            type="button"
            onClick={onOpenWallet}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 whitespace-nowrap min-h-12 pl-4 pr-2 rounded-full bg-white/70 liviano:bg-surface text-[17px] font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_0_0_1px_rgb(19_21_23/0.07),0_2px_8px_rgb(19_21_23/0.06)] hover:bg-white transition-colors duration-200"
            aria-label={`Mi billetera: ${walletCount} ${walletCount === 1 ? "medio de pago" : "medios de pago"}. Tocar para editar.`}
          >
            <Wallet size={20} aria-hidden="true" />
            <span>Mi billetera</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={walletCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-full bg-ink text-base font-semibold tabular-nums text-white"
              >
                {walletCount}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
};
