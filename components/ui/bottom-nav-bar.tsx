"use client";

import { motion } from "framer-motion";
import { Home, LibraryBig, Stethoscope, ClipboardCheck, UserRound, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type BottomNavItem = { id: string; label: string; icon: LucideIcon };

// Navegação real do SemioLab (mesmos 5 itens/ícones já usados no resto do
// app) — os itens de exemplo do componente original (Portfolio,
// Transactions...) eram de um app financeiro e não se aplicam aqui.
export const SEMIOLAB_NAV_ITEMS: BottomNavItem[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "study", label: "Ensino", icon: LibraryBig },
  { id: "patient", label: "Paciente", icon: Stethoscope },
  { id: "quiz", label: "Quiz", icon: ClipboardCheck },
  { id: "profile", label: "Perfil", icon: UserRound },
];

const MOBILE_LABEL_WIDTH = 72;

type BottomNavBarProps = {
  className?: string;
  items?: BottomNavItem[];
  /** Id do item ativo — controlado por quem usa o componente (nunca
   * estado interno fictício), para refletir a navegação real do app. */
  activeId?: string;
  onSelect?: (id: string) => void;
  stickyBottom?: boolean;
};

export function BottomNavBar({
  className,
  items = SEMIOLAB_NAV_ITEMS,
  activeId,
  onSelect,
  stickyBottom = false,
}: BottomNavBarProps) {
  const resolvedActiveId = activeId ?? items[0]?.id;

  return (
    <motion.nav
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      role="navigation"
      aria-label="Navegação principal"
      className={cn(
        "bg-[var(--surface)] border border-[var(--line)] rounded-full flex items-center p-2 shadow-xl space-x-1 min-w-[320px] max-w-[95vw] h-[52px]",
        stickyBottom && "fixed inset-x-0 bottom-4 mx-auto z-20 w-fit",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = resolvedActiveId === item.id;

        return (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex items-center gap-0 px-3 py-2 rounded-full transition-colors duration-200 relative h-10 min-w-[44px] min-h-[40px] max-h-[44px]",
              isActive
                ? "bg-[var(--mint)]/10 text-[var(--mint)] gap-2"
                : "bg-transparent text-[var(--muted)] hover:bg-white/5",
              "focus:outline-none focus-visible:ring-0",
            )}
            onClick={() => onSelect?.(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            type="button"
          >
            <Icon size={22} strokeWidth={2} aria-hidden className="transition-colors duration-200" />

            <motion.div
              initial={false}
              animate={{
                width: isActive ? `${MOBILE_LABEL_WIDTH}px` : "0px",
                opacity: isActive ? 1 : 0,
                marginLeft: isActive ? "8px" : "0px",
              }}
              transition={{
                width: { type: "spring", stiffness: 350, damping: 32 },
                opacity: { duration: 0.19 },
                marginLeft: { duration: 0.19 },
              }}
              className="overflow-hidden flex items-center max-w-[72px]"
            >
              <span
                className={cn(
                  "font-medium text-xs whitespace-nowrap select-none transition-opacity duration-200 overflow-hidden text-ellipsis text-[clamp(0.625rem,0.5263rem+0.5263vw,1rem)] leading-[1.9]",
                  isActive ? "text-[var(--mint)]" : "opacity-0",
                )}
                title={item.label}
              >
                {item.label}
              </span>
            </motion.div>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}

export default BottomNavBar;
