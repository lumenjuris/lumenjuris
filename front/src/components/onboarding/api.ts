/**
 * Onboarding — appels au proxy : réponses du formulaire et rattachement de la
 * structure. Chaque appel réussi met le store utilisateur à jour.
 */
import { useUserStore } from "../../store/userStore";
import type { CompanyResult } from "../../types/companySearch";
import type { OnboardingData, OnboardingPatch } from "../../types/onboarding";
import type { UserData } from "../../types/userData";
import { mapCompanyToEnterprise } from "../../utils/companyLookup";
import { fetchProxy } from "../../utils/fetchProxy";

export const GENERIC_SAVE_ERROR = "L'enregistrement a échoué. Vérifiez votre connexion puis réessayez.";

/** Enregistre une étape (ou la fin / le refus) et met le store à jour. */
export async function patchOnboarding(patch: OnboardingPatch): Promise<OnboardingData> {
  const response = await fetchProxy("/api/user-metadata", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message || GENERIC_SAVE_ERROR);
  }

  const onboarding = payload.data as OnboardingData;
  useUserStore.getState().setOnboarding(onboarding);
  return onboarding;
}

/** Efface les réponses (banc d'essai uniquement pour l'instant). */
export async function deleteOnboardingAnswers(): Promise<void> {
  const response = await fetchProxy("/api/user-metadata", {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.success && payload.data) {
    useUserStore.getState().setOnboarding(payload.data as OnboardingData);
  }
}

/**
 * Rattache l'entreprise choisie au compte.
 *
 * On passe d'abord par l'aperçu INSEE du serveur (il ajoute les conventions
 * collectives déduites du code NAF) ; s'il est indisponible, on enregistre les
 * données publiques déjà reçues par la recherche.
 */
export async function saveEnterpriseFromCompany(company: CompanyResult): Promise<void> {
  const fallback = mapCompanyToEnterprise(company);
  let enterprise: Record<string, unknown> = {
    name: fallback.name,
    siren: fallback.siren,
    codeNaf: fallback.codeNaf,
    intituleNaf: fallback.intituleNaf,
    statusJuridiqueCode: fallback.statusJuridiqueCode,
    statusJuridique: fallback.statusJuridique,
    address: fallback.address?.address ?? "",
    codePostal: fallback.address?.codePostal ?? "",
    pays: fallback.address?.pays ?? "France",
  };

  if (fallback.siren) {
    try {
      const preview = await fetchProxy(`/api/enterprise/insee/${encodeURIComponent(fallback.siren)}`, {
        credentials: "include",
      });
      const previewPayload = await preview.json().catch(() => null);
      if (preview.ok && previewPayload?.success && previewPayload.data) {
        const data = previewPayload.data;
        enterprise = {
          name: data.name ?? fallback.name,
          siren: data.siren ?? fallback.siren,
          codeNaf: data.codeNaf ?? fallback.codeNaf,
          intituleNaf: data.intituleNaf ?? fallback.intituleNaf,
          statusJuridiqueCode: data.statusJuridiqueCode ?? fallback.statusJuridiqueCode,
          statusJuridique: data.statusJuridique ?? fallback.statusJuridique,
          address: data.address?.address ?? fallback.address?.address ?? "",
          codePostal: data.address?.codePostal ?? fallback.address?.codePostal ?? "",
          pays: data.address?.pays ?? fallback.address?.pays ?? "France",
          idccSelections: data.idccSelections,
          selectedIdccKey: data.selectedIdccKey,
        };
      }
    } catch {
      // Aperçu indisponible : on garde les données de la recherche.
    }
  }

  const response = await fetchProxy("/api/enterprise", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enterprise),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Impossible d'enregistrer votre structure.");
  }

  // On range la fiche dans le store sans relancer `fetchUser` : celui-ci repasse
  // par l'état « chargement », ce qui démonterait la page (et ce formulaire).
  if (payload.data) {
    useUserStore.setState((state) =>
      state.userData
        ? { userData: { ...state.userData, enterprise: payload.data as UserData["enterprise"] } }
        : state,
    );
  }
}
