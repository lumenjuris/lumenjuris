import { motion } from "framer-motion";
import { Building2, Check, Loader2, Search } from "lucide-react";

import { useCompanyLookup } from "../../../hooks/useCompanyLookup";
import type { CompanyResult } from "../../../types/companySearch";
import { formatCompanyOption } from "../../../utils/companyLookup";
import { cn } from "../../../utils/shadcnUtils/cn";
import { Input } from "../../ui/Input";
import { FOCUS_RING, revealItem, revealList } from "../animations";
import { EASE_OUT } from "../constants";
import { StepHeading } from "../ui";
import type { OnboardingFormState } from "../useOnboardingForm";

/** Étape 4 — structure de l'utilisateur, recherchée par nom ou SIRET. */
export function StepEnterprise({ form }: { form: OnboardingFormState }) {
  const lookup = useCompanyLookup();
  const { company, noEnterprise } = form.answers;
  const selected = company ? formatCompanyOption(company) : null;

  const selectCompany = (result: CompanyResult) => {
    form.update({ company: result, noEnterprise: false });
    lookup.setQuery("");
  };

  return (
    <>
      <StepHeading
        title="Pour quelle structure travaillez-vous ?"
        subtitle="Recherchez-la par son nom ou son SIRET : ses informations pré-rempliront vos contrats."
      />

      {selected ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="flex items-center gap-3 rounded-xl border border-brand bg-brand-light/70 px-3.5 py-3 shadow-[0_0_0_1px_#2C3A5E]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{selected.title}</span>
            <span className="block truncate text-[12px] text-ink-muted">{selected.subtitle}</span>
          </span>
          <button
            type="button"
            onClick={() => form.update({ company: null })}
            className={cn("rounded-lg px-2 py-1 text-[12.5px] font-semibold text-brand hover:bg-white", FOCUS_RING)}
          >
            Modifier
          </button>
        </motion.div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              autoFocus
              type="search"
              aria-label="Nom ou SIRET de votre structure"
              placeholder="Nom de la structure ou SIRET"
              value={lookup.query}
              disabled={noEnterprise}
              onChange={(event) => lookup.setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9 pr-9"
            />
            {lookup.status === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-subtle" />
            )}
          </div>

          <div className="mt-2 min-h-[20px]" aria-live="polite">
            {lookup.status === "success" && (
              <motion.ul
                variants={revealList}
                initial="hidden"
                animate="visible"
                className="flex max-h-[216px] flex-col overflow-y-auto rounded-xl border border-line"
              >
                {lookup.results.slice(0, 6).map((result, index) => {
                  const option = formatCompanyOption(result);
                  return (
                    <motion.li key={result.siren ?? index} variants={revealItem} className="border-b border-line-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => selectCompany(result)}
                        className="flex w-full flex-col px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                      >
                        <span className="truncate text-[13.5px] font-semibold text-ink">{option.title}</span>
                        <span className="truncate text-[12px] text-ink-muted">{option.subtitle}</span>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
            {lookup.status === "empty" && (
              <p className="text-[12.5px] text-ink-muted">Aucune structure trouvée. Vérifiez l'orthographe ou saisissez le SIRET.</p>
            )}
            {lookup.status === "error" && (
              <p className="text-[12.5px] text-danger">
                La recherche est momentanément indisponible. Vous pourrez renseigner votre structure plus tard dans Mon compte.
              </p>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={noEnterprise}
        onClick={() => {
          form.update({ noEnterprise: !noEnterprise, company: null });
          lookup.setQuery("");
        }}
        className={cn("mt-4 flex items-center gap-2.5 rounded-lg py-1 pr-2 text-[13px] text-ink-secondary", FOCUS_RING)}
      >
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors duration-200",
            noEnterprise ? "border-brand bg-brand text-white" : "border-line-emphasis bg-white",
          )}
        >
          {noEnterprise && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        Je n'exerce pas au sein d'une structure
      </button>
    </>
  );
}
