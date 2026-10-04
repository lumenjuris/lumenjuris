import { fetchProxy } from "./fetchProxy";
import { throwIfQuotaExceeded } from "./featureQuota";

export interface ContractSummary {
  idSummary: number;
  identification: Record<string, any>;
  resume_executif: string;
  parties: string[] | string;
  dates?: Record<string, any>;
  objet: string;
  obligations: Record<string, any> | string[];
  conditions_financieres: Record<string, any> | string;
  resiliation?: Record<string, any> | string;
  responsabilite: Record<string, any> | string;
  clauses_particulieres?: string[];
  delais_importants: string[];
  annexes: string[];
  points_attention: string[];
  niveau_risque?: {
    niveau?: string;
    justification?: string;
  };
  duree?: string | null;
}

export interface ContractSummuryList {
  idSummary: number;
  fileName: string,
  createdAt: Date,
  objet: string,
  niveau_risque: {
    niveau?: string;
    justification?: string;
  };
}

export type ClauseItem = {
  type?: string;
  presente?: boolean,
  resume? : string | null;
  [key: string]: any;
}

export async function summarizeContract(
  content: string, fileName: string, selectedLlm: string = "gpt-4o-mini"
): Promise<ContractSummary> {
  const res = await fetchProxy("/api/summarize-contract", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, fileName, selectedLlm }),
  });
  await throwIfQuotaExceeded(res, "comprendreContrat");
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const data = await res.json() as { success: boolean; data: ContractSummary };
  return data.data;
}

export async function deleteSummarizeContract(idSummary: number) {
  const response = await fetchProxy(`/api/delete-summarize-contract/delete?idSummary=${idSummary}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok ) throw new Error(`Erreur ${response.status}`);

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Echec de la suppression");
  }
}


