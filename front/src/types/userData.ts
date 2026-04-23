export interface UserDataProfile {
  email: string;
  nom: string;
  prenom?: string;
  role: "USER" | "ADMIN";
  isVerified: boolean;
}
