import { useEffect, useRef, useState } from "react";
import type {
  ApiResponse,
  EnterpriseSettings,
  InseePreviewResponse,
} from "../types/paramSettings";
import {
  cloneEnterpriseSettings,
  createEmptyEnterpriseSettings,
  hasEnterpriseDisplayData,
  normalizeEnterpriseSettings,
} from "../utils/param/paramSettings";

import { fetchProxy } from "../utils/fetchProxy";


export function useEnterpriseSettings(
  initialSettings: EnterpriseSettings = createEmptyEnterpriseSettings(),
) {
  const [enterpriseSettings, setEnterpriseSettings] =
    useState<EnterpriseSettings>(() =>
      normalizeEnterpriseSettings(initialSettings),
    );
  const [enterpriseDraft, setEnterpriseDraft] = useState<EnterpriseSettings>(
    () => normalizeEnterpriseSettings(initialSettings),
  );
  const [isEditingEnterprise, setIsEditingEnterprise] = useState(false);
  const [inseeLookupSiren, setInseeLookupSiren] = useState("");
  const [isPrefillingFromSiren, setIsPrefillingFromSiren] = useState(false);
  const [inseePrefillError, setInseePrefillError] = useState<string | null>(
    null,
  );

  const inseePrefillAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      inseePrefillAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeEnterpriseSettings(initialSettings);

    setEnterpriseSettings(normalized);

    if (!isEditingEnterprise) {
      setEnterpriseDraft(normalized);
    }
  }, [initialSettings, isEditingEnterprise]);

  const handleEditEnterprise = () => {
    setEnterpriseDraft(cloneEnterpriseSettings(enterpriseSettings));
    setInseeLookupSiren("");
    setInseePrefillError(null);
    setIsEditingEnterprise(true);
  };

  const handleCancelEnterpriseEdit = () => {
    inseePrefillAbortRef.current?.abort();
    inseePrefillAbortRef.current = null;
    setIsPrefillingFromSiren(false);
    setEnterpriseDraft(cloneEnterpriseSettings(enterpriseSettings));
    setInseeLookupSiren("");
    setInseePrefillError(null);
    setIsEditingEnterprise(false);
  };

  const handleSaveEnterpriseEdit = async () => {
    const response = await fetchProxy("/api/enterprise", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: enterpriseDraft.name,
        siren: enterpriseDraft.siren,
        codeNaf: enterpriseDraft.codeNaf,
        intituleNaf: enterpriseDraft.intituleNaf,
        statusJuridiqueCode: enterpriseDraft.statusJuridiqueCode,
        statusJuridique: enterpriseDraft.statusJuridique,
        address: enterpriseDraft.address?.address ?? "",
        codePostal: enterpriseDraft.address?.codePostal ?? "",
        pays: enterpriseDraft.address?.pays ?? "",
        idccSelections: enterpriseDraft.idccSelections,
        selectedIdccKey: enterpriseDraft.selectedIdccKey,
      }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<EnterpriseSettings> | null;

    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.message ||
          "Impossible d'enregistrer les informations de l'entreprise.",
      );
    }

    const nextEnterpriseSettings = normalizeEnterpriseSettings(
      payload.data ?? enterpriseDraft,
    );

    setEnterpriseSettings(nextEnterpriseSettings);
    setEnterpriseDraft(nextEnterpriseSettings);
    setInseeLookupSiren("");
    setInseePrefillError(null);
    setIsEditingEnterprise(false);
  };

  const handleEnterpriseFieldChange = (
    field: Exclude<keyof EnterpriseSettings, "address" | "idccSelections">,
    value: string,
  ) => {
    setEnterpriseDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEnterpriseAddressFieldChange = (
    field: keyof NonNullable<EnterpriseSettings["address"]>,
    value: string,
  ) => {
    setEnterpriseDraft((current) => ({
      ...current,
      address: {
        address: current.address?.address ?? "",
        codePostal: current.address?.codePostal ?? "",
        pays: current.address?.pays ?? "",
        [field]: value,
      },
    }));
  };

  const handleInseeLookupSirenChange = (value: string) => {
    setInseeLookupSiren(value);
    setInseePrefillError(null);
  };

  const normalizedLookupSiren = inseeLookupSiren.replace(/\D/g, "");
  const shouldShowInseePrefill =
    isEditingEnterprise || !hasEnterpriseDisplayData(enterpriseSettings);
  const canTriggerInseePrefill = normalizedLookupSiren.length === 9;

  const handlePrefillFromSiren = async () => {
    if (!canTriggerInseePrefill) {
      setInseePrefillError("Le SIREN doit contenir exactement 9 chiffres.");
      return;
    }

    const abortController = new AbortController();

    try {
      inseePrefillAbortRef.current?.abort();
      inseePrefillAbortRef.current = abortController;

      setIsPrefillingFromSiren(true);
      setInseePrefillError(null);
      setIsEditingEnterprise(true);
      setEnterpriseDraft(cloneEnterpriseSettings(enterpriseSettings));

      const response = await fetchProxy(
        `/api/insee/${encodeURIComponent(normalizedLookupSiren)}`,
        {
          credentials: "include",
          signal: abortController.signal,
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as InseePreviewResponse | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setInseePrefillError(
          payload?.message ||
            "Impossible de récupérer les données publiques de l'entreprise.",
        );
        return;
      }

      setEnterpriseDraft((current) => ({
        ...current,
        siren: payload.data?.siren ?? current.siren,
        codeNaf: payload.data?.codeNaf ?? null,
        intituleNaf: payload.data?.intituleNaf ?? null,
        name: payload.data?.name ?? null,
        statusJuridiqueCode: payload.data?.statusJuridiqueCode ?? null,
        statusJuridique: payload.data?.statusJuridique ?? null,
        address: payload.data?.address ? { ...payload.data.address } : null,
        idccSelections:
          payload.data?.idccSelections?.map((selection) => ({
            ...selection,
          })) ?? current.idccSelections,
        selectedIdccKey: payload.data?.selectedIdccKey ?? null,
      }));
      setInseeLookupSiren(payload.data?.siren ?? normalizedLookupSiren);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setInseePrefillError(
        error instanceof Error
          ? error.message
          : "Impossible de récupérer les données publiques de l'entreprise.",
      );
    } finally {
      if (inseePrefillAbortRef.current === abortController) {
        inseePrefillAbortRef.current = null;
        setIsPrefillingFromSiren(false);
      }
    }
  };

  return {
    enterpriseSettings,
    enterpriseDraft,
    isEditingEnterprise,
    inseeLookupSiren,
    isPrefillingFromSiren,
    inseePrefillError,
    shouldShowInseePrefill,
    canTriggerInseePrefill,
    handleEditEnterprise,
    handleCancelEnterpriseEdit,
    handleSaveEnterpriseEdit,
    handleEnterpriseFieldChange,
    handleEnterpriseAddressFieldChange,
    handleInseeLookupSirenChange,
    handlePrefillFromSiren,
  };
}
