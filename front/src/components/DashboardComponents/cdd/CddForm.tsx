// Formulaire CDD (générateur). Conformité art. L1242-1 et s. du Code du travail.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import {
  ArrowLeft, ArrowRight, Check, Download, FileSignature,
  MessagesSquare, AlertTriangle,
} from "lucide-react";
import { useUserStore } from "../../../store/userStore";
import { CompanySearchField } from "../../common/CompanySearchField";
import { mapCompanyToContractParty } from "../../../utils/companyLookup";
import type { CompanyResult } from "../../../types/companySearch";
import {
  CAS_RECOURS_OPTIONS,
  type CddFields,
  computeEssaiMax,
  createEmptyCddFields,
  getMissingMandatory,
} from "./cddModel";
import {
  buildCddContract,
  formatDateFr,
  type CddDocument,
} from "./buildCddContract";

const STEPS = [
  "Employeur",
  "Salarié",
  "Motif & poste",
  "Durée & terme",
  "Rémunération",
  "Convention & clauses",
  "Aperçu & génération",
];

// ─── Petits champs réutilisables ──────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10";

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type} value={value} placeholder={placeholder || "—"}
        onChange={(e) => onChange(e.target.value)} className={inputCls}
      />
    </label>
  );
}

function Area({
  label, value, onChange, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <textarea
        rows={3} value={value} placeholder={placeholder || "—"}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-none`}
      />
    </label>
  );
}

function CheckRow({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-[#354F99] focus:ring-[#354F99]"
      />
      {label}
    </label>
  );
}

// ─── Aperçu PDF (export) ──────────────────────────────────────────────────────

function exportPdf(doc: CddDocument) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };
  const block = (text: string, bold: boolean, size: number, gap = 6) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    for (const para of text.split("\n")) {
      const lines = pdf.splitTextToSize(para || " ", maxW) as string[];
      for (const line of lines) {
        ensure(size + 2);
        pdf.text(line, margin, y);
        y += size + 2;
      }
    }
    y += gap;
  };

  block(doc.title, true, 15, 12);
  block(doc.preamble, false, 10.5, 12);
  for (const art of doc.articles) {
    block(art.heading, true, 11.5, 3);
    block(art.body, false, 10.5, 10);
  }
  pdf.save("CDD.pdf");
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CddForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const enterprise = useUserStore((s) => s.userData?.enterprise);

  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<CddFields>(() => createEmptyCddFields());

  const set = <K extends keyof CddFields>(key: K, value: CddFields[K]) =>
    setFields((p) => ({ ...p, [key]: value }));

  // Pré-remplissage de l'employeur depuis l'entreprise enregistrée (une fois).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !enterprise) return;
    seededRef.current = true;
    setFields((p) => ({
      ...p,
      emp_denomination: p.emp_denomination || (enterprise.name ?? ""),
      emp_forme_juridique:
        p.emp_forme_juridique || (enterprise.statusJuridique ?? ""),
      emp_siren: p.emp_siren || (enterprise.siren ?? ""),
      emp_adresse: p.emp_adresse || (enterprise.address?.address ?? ""),
      emp_code_postal: p.emp_code_postal || (enterprise.address?.codePostal ?? ""),
      emp_code_naf: p.emp_code_naf || (enterprise.codeNaf ?? ""),
    }));
  }, [enterprise]);

  const applyCompany = (result: CompanyResult, siret?: string) => {
    const p = mapCompanyToContractParty(result, siret);
    setFields((prev) => ({
      ...prev,
      emp_denomination: p.nom ?? prev.emp_denomination,
      emp_forme_juridique: p.forme_juridique ?? prev.emp_forme_juridique,
      emp_siren: p.siren ?? prev.emp_siren,
      emp_code_postal: p.code_postal ?? prev.emp_code_postal,
      emp_ville: p.ville ?? prev.emp_ville,
      emp_representant: p.representant ?? prev.emp_representant,
      emp_qualite: p.qualite ?? prev.emp_qualite,
    }));
  };

  const essai = useMemo(
    () =>
      fields.terme_type === "precis"
        ? computeEssaiMax(fields.date_debut, fields.date_fin)
        : null,
    [fields.terme_type, fields.date_debut, fields.date_fin],
  );

  const missing = useMemo(() => getMissingMandatory(fields), [fields]);
  const doc = useMemo(() => buildCddContract(fields), [fields]);

  const last = STEPS.length - 1;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => (step > 0 ? setStep((s) => s - 1) : onBack())}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#354F99]"
      >
        <ArrowLeft className="h-4 w-4" /> {step > 0 ? "Précédent" : "Retour aux modèles"}
      </button>

      <div className="mb-6 flex items-center gap-2">
        <span className="rounded-full bg-[#354F99]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#354F99]">
          CDD
        </span>
        <span className="text-sm text-gray-500">
          Contrat à durée déterminée — conforme aux art. L1242-1 et s.
        </span>
      </div>

      {/* Fil d'étapes */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              i === step
                ? "bg-[#354F99] text-white"
                : i < step
                  ? "bg-[#354F99]/10 text-[#354F99]"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-bold text-gray-800">
          {STEPS[step]}
        </h2>

        {/* 1 — Employeur */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
              <CompanySearchField onSelect={applyCompany} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dénomination" value={fields.emp_denomination} onChange={(v) => set("emp_denomination", v)} required />
              <Field label="Forme juridique" value={fields.emp_forme_juridique} onChange={(v) => set("emp_forme_juridique", v)} placeholder="SAS, SARL…" />
              <Field label="SIREN" value={fields.emp_siren} onChange={(v) => set("emp_siren", v)} />
              <Field label="Code NAF" value={fields.emp_code_naf} onChange={(v) => set("emp_code_naf", v)} />
              <Field label="Adresse" value={fields.emp_adresse} onChange={(v) => set("emp_adresse", v)} />
              <Field label="Code postal" value={fields.emp_code_postal} onChange={(v) => set("emp_code_postal", v)} />
              <Field label="Ville" value={fields.emp_ville} onChange={(v) => set("emp_ville", v)} />
              <Field label="N° URSSAF (facultatif)" value={fields.emp_urssaf} onChange={(v) => set("emp_urssaf", v)} />
              <Field label="Représentant" value={fields.emp_representant} onChange={(v) => set("emp_representant", v)} placeholder="Prénom Nom" />
              <Field label="Qualité du représentant" value={fields.emp_qualite} onChange={(v) => set("emp_qualite", v)} placeholder="Gérant, DRH…" />
            </div>
          </div>
        )}

        {/* 2 — Salarié */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Civilité" value={fields.sal_civilite} onChange={(v) => set("sal_civilite", v)} placeholder="M., Mme" />
            <div />
            <Field label="Prénom" value={fields.sal_prenom} onChange={(v) => set("sal_prenom", v)} />
            <Field label="Nom" value={fields.sal_nom} onChange={(v) => set("sal_nom", v)} required />
            <Field label="Adresse" value={fields.sal_adresse} onChange={(v) => set("sal_adresse", v)} />
            <Field label="Code postal" value={fields.sal_code_postal} onChange={(v) => set("sal_code_postal", v)} />
            <Field label="Ville" value={fields.sal_ville} onChange={(v) => set("sal_ville", v)} />
            <Field label="Nationalité" value={fields.sal_nationalite} onChange={(v) => set("sal_nationalite", v)} />
            <Field label="Date de naissance" type="date" value={fields.sal_date_naissance} onChange={(v) => set("sal_date_naissance", v)} />
            <Field label="Lieu de naissance" value={fields.sal_lieu_naissance} onChange={(v) => set("sal_lieu_naissance", v)} />
            <Field label="N° de sécurité sociale (facultatif)" value={fields.sal_secu} onChange={(v) => set("sal_secu", v)} />
          </div>
        )}

        {/* 3 — Motif & poste */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Cas de recours *</span>
              <select
                value={fields.cas_recours}
                onChange={(e) => set("cas_recours", e.target.value as CddFields["cas_recours"])}
                className={inputCls}
              >
                {CAS_RECOURS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <Area label="Description précise du motif" value={fields.motif_detail} onChange={(v) => set("motif_detail", v)} placeholder="Circonstances précises justifiant le recours au CDD" required />
            {fields.cas_recours === "remplacement" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Salarié remplacé" value={fields.remplace_nom} onChange={(v) => set("remplace_nom", v)} required />
                <Field label="Qualification du remplacé" value={fields.remplace_qualification} onChange={(v) => set("remplace_qualification", v)} required />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Intitulé du poste" value={fields.poste_intitule} onChange={(v) => set("poste_intitule", v)} required />
              <Field label="Qualification professionnelle" value={fields.poste_qualification} onChange={(v) => set("poste_qualification", v)} required />
              <Field label="Classification / coefficient" value={fields.poste_classification} onChange={(v) => set("poste_classification", v)} />
              <Field label="Lieu de travail" value={fields.lieu_travail} onChange={(v) => set("lieu_travail", v)} />
            </div>
          </div>
        )}

        {/* 4 — Durée & terme */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Type de terme *</span>
              <select
                value={fields.terme_type}
                onChange={(e) => set("terme_type", e.target.value as CddFields["terme_type"])}
                className={inputCls}
              >
                <option value="precis">Terme précis (date de fin connue)</option>
                <option value="imprecis">Terme imprécis (durée minimale)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date de début" type="date" value={fields.date_debut} onChange={(v) => set("date_debut", v)} required />
              {fields.terme_type === "precis" ? (
                <Field label="Date de fin" type="date" value={fields.date_fin} onChange={(v) => set("date_fin", v)} required />
              ) : (
                <Field label="Durée minimale" value={fields.duree_minimale} onChange={(v) => set("duree_minimale", v)} placeholder="Ex. 3 mois" required />
              )}
            </div>
            {fields.terme_type === "precis" && (
              <CheckRow label="Clause de renouvellement" checked={fields.renouvelable} onChange={(v) => set("renouvelable", v)} />
            )}
            {fields.terme_type === "precis" && fields.renouvelable && (
              <Area label="Conditions de renouvellement" value={fields.renouvellement_conditions} onChange={(v) => set("renouvellement_conditions", v)} />
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Période d'essai" value={fields.periode_essai} onChange={(v) => set("periode_essai", v)} placeholder="Ex. 14 jours" />
              </div>
              {essai && (
                <button
                  type="button"
                  onClick={() => set("periode_essai", `${essai.days} jours ouvrés`)}
                  className="mb-0.5 rounded-lg border border-[#354F99]/30 bg-[#354F99]/5 px-3 py-2 text-xs font-medium text-[#354F99] hover:bg-[#354F99]/10"
                >
                  Appliquer le max légal : {essai.label}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 5 — Rémunération & temps */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rémunération brute" value={fields.remuneration_brut_mensuel} onChange={(v) => set("remuneration_brut_mensuel", v)} placeholder="2 500" required />
              <Field label="Périodicité" value={fields.remuneration_periodicite} onChange={(v) => set("remuneration_periodicite", v)} placeholder="mensuelle" />
            </div>
            <Area label="Primes, accessoires et avantages" value={fields.primes_avantages} onChange={(v) => set("primes_avantages", v)} placeholder="13e mois, tickets restaurant, prime d'ancienneté…" />
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Temps de travail</span>
                <select
                  value={fields.temps}
                  onChange={(e) => set("temps", e.target.value as CddFields["temps"])}
                  className={inputCls}
                >
                  <option value="plein">Temps plein</option>
                  <option value="partiel">Temps partiel</option>
                </select>
              </label>
              <Field label="Durée hebdomadaire (h)" value={fields.duree_hebdo} onChange={(v) => set("duree_hebdo", v)} placeholder="35" />
            </div>
            {fields.temps === "partiel" && (
              <Area label="Répartition des horaires" value={fields.repartition_horaire} onChange={(v) => set("repartition_horaire", v)} placeholder="Lundi au vendredi, 9h–13h" />
            )}
          </div>
        )}

        {/* 6 — Convention & clauses */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <Field label="Convention collective applicable" value={fields.convention_collective} onChange={(v) => set("convention_collective", v)} placeholder="Ex. Syntec (IDCC 1486)" required />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Caisse de retraite complémentaire" value={fields.caisse_retraite} onChange={(v) => set("caisse_retraite", v)} required />
              <Field label="Organisme de prévoyance" value={fields.organisme_prevoyance} onChange={(v) => set("organisme_prevoyance", v)} required />
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Clauses & indemnités</p>
              <div className="flex flex-col gap-2">
                <CheckRow label="Indemnité de fin de contrat — précarité 10 % (art. L1243-8)" checked={fields.indemnite_precarite} onChange={(v) => set("indemnite_precarite", v)} />
                <CheckRow label="Clause de confidentialité" checked={fields.clause_confidentialite} onChange={(v) => set("clause_confidentialite", v)} />
                <CheckRow label="Clause de non-concurrence" checked={fields.clause_non_concurrence} onChange={(v) => set("clause_non_concurrence", v)} />
                <CheckRow label="Clause de mobilité" checked={fields.clause_mobilite} onChange={(v) => set("clause_mobilite", v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Lieu de signature" value={fields.lieu_signature} onChange={(v) => set("lieu_signature", v)} />
              <Field label="Date de signature" type="date" value={fields.date_signature} onChange={(v) => set("date_signature", v)} />
            </div>
          </div>
        )}

        {/* 7 — Aperçu & génération */}
        {step === last && (
          <div className="flex flex-col gap-5">
            {missing.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {missing.length} mention(s) obligatoire(s) manquante(s)
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Risque de requalification en CDI (art. L1242-12). À compléter :
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {missing.map((m) => (
                    <li key={m} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                <Check className="h-4 w-4" /> Toutes les mentions obligatoires sont renseignées.
              </div>
            )}

            {/* Aperçu type A4 */}
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-200 bg-white p-8 shadow-inner">
              <h1 className="text-center text-lg font-bold tracking-wide text-gray-900">{doc.title}</h1>
              <p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed text-gray-700">{doc.preamble}</p>
              {doc.articles.map((a) => (
                <div key={a.heading} className="mt-4">
                  <h3 className="text-[13px] font-bold text-gray-900">{a.heading}</h3>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-700">{a.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportPdf(doc)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#354F99] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2d5a]"
              >
                <Download className="h-4 w-4" /> Télécharger le PDF
              </button>
              <button
                onClick={() => navigate("/signature")}
                className="inline-flex items-center gap-2 rounded-xl border border-[#354F99]/30 bg-white px-5 py-2.5 text-sm font-semibold text-[#354F99] transition hover:bg-[#354F99]/5"
              >
                <FileSignature className="h-4 w-4" /> Envoyer pour signature
              </button>
              <button
                onClick={() => navigate("/contratheque")}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                <MessagesSquare className="h-4 w-4" /> Négocier avant signature
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Document généré à titre indicatif. Date de signature :{" "}
              {fields.date_signature ? formatDateFr(fields.date_signature) : "—"}.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between border-t border-gray-100 pt-6">
          <button
            onClick={() => (step > 0 ? setStep((s) => s - 1) : onBack())}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            ← {step > 0 ? "Précédent" : "Retour"}
          </button>
          {step < last ? (
            <button
              onClick={() => setStep((s) => Math.min(s + 1, last))}
              className="inline-flex items-center gap-1 rounded-xl bg-[#354F99] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2d5a]"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs text-gray-400">Étape finale</span>
          )}
        </div>
      </div>
    </div>
  );
}
