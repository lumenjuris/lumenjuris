/**
 * Onboarding — briques d'interface partagées par les étapes : titres, cartes
 * et pastilles.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";

import { cn } from "../../utils/shadcnUtils/cn";
import { FOCUS_RING, revealItem, revealList } from "./animations";

export function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-[26px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[28px]">
        {title}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{subtitle}</p>
    </div>
  );
}

/** Carte d'outil à cocher. `rank` (1, 2, 3) rappelle l'ordre de sélection. */
export function IntentCard({
  title,
  description,
  icon: Icon,
  rank,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  rank: number | null;
  disabled: boolean;
  onToggle: () => void;
}) {
  const selected = rank !== null;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      variants={revealItem}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200",
        FOCUS_RING,
        selected
          ? "border-brand bg-brand-light/70 shadow-[0_0_0_1px_#2C3A5E]"
          : "border-line bg-white hover:border-brand-muted hover:bg-surface-subtle",
        disabled && "cursor-not-allowed opacity-45 hover:border-line hover:bg-white",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
          selected ? "bg-brand text-white" : "bg-surface-subtle text-brand group-hover:bg-brand-light",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1 pr-5">
        <span className="block text-[13.5px] font-semibold leading-snug text-ink">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{description}</span>
      </span>

      <AnimatePresence>
        {selected && (
          <motion.span
            key="rank"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#BE9243] text-[11px] font-semibold text-white"
            aria-hidden="true"
          >
            {rank}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Pastille à choix unique (profession, volume, équipe). */
export function ChoiceChip({
  label,
  selected,
  onSelect,
  centered = false,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  centered?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      variants={revealItem}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex min-h-[42px] items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-medium leading-snug transition-[border-color,background-color,color] duration-200",
        FOCUS_RING,
        centered ? "justify-center text-center" : "justify-between text-left",
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-white text-ink-secondary hover:border-brand-muted hover:bg-surface-subtle",
      )}
    >
      {label}
      {!centered && (
        <Check
          className={cn(
            "h-4 w-4 shrink-0 transition-[opacity,transform] duration-200",
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          strokeWidth={2.5}
        />
      )}
    </motion.button>
  );
}

/** Groupe de pastilles à choix unique, avec son intitulé. */
export function ChoiceGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { code: string; label: string }[];
  value: string | null;
  onChange: (code: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-semibold text-ink-secondary">{legend}</p>
      <motion.div
        role="radiogroup"
        aria-label={legend}
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {options.map((option) => (
          <ChoiceChip
            key={option.code}
            label={option.label}
            selected={value === option.code}
            onSelect={() => onChange(option.code)}
            centered
          />
        ))}
      </motion.div>
    </div>
  );
}
