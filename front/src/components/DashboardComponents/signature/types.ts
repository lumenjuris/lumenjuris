// Types partagés pour le module de e-signature

export type SignerRole = "self" | "counterparty";

export interface Signer {
  role: SignerRole;
  name: string;
  email: string;
  color: string;       // couleur d'identification (Tailwind base, ex: "indigo")
  hex: string;         // valeur hex correspondante pour styles inline
}

export type FieldType = "signature" | "initial" | "date";

export interface Field {
  id: string;
  type: FieldType;
  signer: SignerRole;
  page: number;        // index 0-based
  // Coordonnées en pourcentage de la page (résiste au zoom/redimensionnement)
  xPct: number;        // 0..1
  yPct: number;        // 0..1
  widthPct: number;
  heightPct: number;
  // Champ rempli (signature/paraphe → dataUrl ; date → ISO string)
  value?: string;
  // Si true → ce champ est dupliqué sur toutes les pages (paraphes)
  replicateAllPages?: boolean;
}

export type WizardStep = "prepare" | "place" | "sign";

export interface CapturedSignature {
  // Réutilisée automatiquement pour tous les champs du même signataire
  type: "drawn" | "typed";
  dataUrl: string;     // image PNG en base64 data URL
  text?: string;       // si typed : le texte original
  font?: string;       // si typed : la police choisie
}

export const SIGNERS_DEFAULT: Signer[] = [
  { role: "self",         name: "Vous",          email: "",  color: "indigo",   hex: "#4f46e5" },
  { role: "counterparty", name: "Cocontractant", email: "",  color: "emerald",  hex: "#10b981" },
];
