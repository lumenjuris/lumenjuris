export interface UserData {
  billing: {
    stripeCustomerId: number | null;
  };
  enterprise: null | {
    idEnterprise: number | null;
    siren: string | null;
    codeNaf: string | null;
    intituleNaf: string | null;
    name: string | null;
    statusJuridiqueCode: string | null;
    statusJuridique: string | null;
    address: {
      address: string | null;
      codePostal: string | null;
      pays: string;
    } | null;
    idccSelections: {
      key: string;
      name: string;
      idccCode: string | null;
      source: "naf" | "custom";
    };
    selectedIdccKey: string | null;
    selectedIdcc: null | {
      key: string;
      name: string;
      idccCode: string | null;
      source: "naf" | "custom";
    };
  };
  profile: {
    email: string;
    nom: string;
    prenom?: string;
    role: "USER" | "ADMIN" | "JURISTE" | "LECTEUR";
    isVerified: boolean;
    twoFactorEnabled?: boolean;
  };
  provider:
    | {}
    | {
        provider: string;
        avatarUrl: string | null;
        googleConnectionPanelMode?: "google_only" | "google_with_password";
      };
}
