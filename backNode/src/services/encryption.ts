import crypto from "crypto"

/**
 * Module UNIQUE de chiffrement de l'application (AES-256-GCM).
 *
 * Deux usages :
 *   1. Les champs sensibles en base → `encryptValue` / `decryptValue`.
 *      Ils sont appelés automatiquement par l'extension Prisma
 *      (voir prisma/encryptionExtension.ts) : les services n'ont rien à faire.
 *   2. Les PDF de contrats sur le disque → `encryptBuffer` / `decryptBuffer`.
 *
 * Clé : variable d'environnement `CONTRACT_ENCRYPTION_KEY` (64 caractères hex = 32 octets).
 * Pour en générer une :
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * ⚠️ Perdre cette clé = perdre toutes les données chiffrées. La sauvegarder hors du serveur.
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // taille recommandée pour GCM
const AUTH_TAG_LENGTH = 16

/**
 * Version de la clé utilisée pour chiffrer. Elle est écrite dans chaque valeur
 * chiffrée : le jour où l'on change de clé, on ajoute "v2" ici et on saura
 * toujours quelle clé a servi pour chaque ligne.
 */
const CURRENT_KEY_VERSION = "v1"

/** Préfixe de toute valeur chiffrée stockée en base : "enc:v1:..." */
const ENCRYPTED_PREFIX = "enc:"

function getKey(keyVersion: string): Buffer {
    if (keyVersion !== "v1") {
        throw new Error(`Version de clé de chiffrement inconnue : ${keyVersion}`)
    }
    const hex = process.env.CONTRACT_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) {
        throw new Error("CONTRACT_ENCRYPTION_KEY doit être une chaîne hexadécimale de 64 caractères")
    }
    return Buffer.from(hex, "hex")
}

// ─── Champs en base ──────────────────────────────────────────────────────────

/**
 * Chiffre n'importe quelle valeur (texte, objet, tableau…).
 * La valeur est d'abord convertie en JSON : ainsi un texte redevient un texte
 * et un objet redevient un objet au déchiffrement.
 *
 * Format produit : "enc:v1:<iv>:<tag>:<données>" (chaque partie en base64).
 */
export function encryptValue(value: unknown): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(CURRENT_KEY_VERSION), iv)
    const plaintext = JSON.stringify(value)
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const authTag = cipher.getAuthTag()

    return [
        "enc",
        CURRENT_KEY_VERSION,
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted.toString("base64"),
    ].join(":")
}

/** Déchiffre une valeur produite par `encryptValue`. */
export function decryptValue(stored: string): unknown {
    if (!isEncryptedValue(stored)) {
        throw new Error("Valeur non chiffrée trouvée dans un champ censé être chiffré")
    }
    const [, keyVersion, ivBase64, authTagBase64, dataBase64] = stored.split(":")

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(keyVersion), Buffer.from(ivBase64, "base64"))
    decipher.setAuthTag(Buffer.from(authTagBase64, "base64"))
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataBase64, "base64")),
        decipher.final(),
    ])
    return JSON.parse(decrypted.toString("utf8"))
}

export function isEncryptedValue(value: unknown): value is string {
    return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX)
}

// ─── Jetons secrets (liens, codes) ───────────────────────────────────────────

/**
 * Empreinte SHA-256 d'un jeton secret (lien de vérification, lien invité, code 2FA…).
 *
 * On stocke l'empreinte en base, jamais le jeton : quelqu'un qui lit la base ne
 * peut pas s'en servir. Pour retrouver une ligne à partir du jeton reçu dans
 * l'URL, on recalcule l'empreinte : `where: { tokenHash: hashToken(token) }`.
 *
 * Contrairement au chiffrement, c'est à sens unique : on ne peut pas retrouver
 * le jeton à partir de l'empreinte.
 */
export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex")
}

// ─── Fichiers (PDF) ──────────────────────────────────────────────────────────

/**
 * Chiffre un fichier binaire.
 * Format sur disque : [version de clé (2 octets)][IV (12)][tag (16)][données chiffrées].
 */
export function encryptBuffer(plain: Buffer): Buffer {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(CURRENT_KEY_VERSION), iv)
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
    const authTag = cipher.getAuthTag()
    const keyVersion = Buffer.from(CURRENT_KEY_VERSION, "ascii")
    return Buffer.concat([keyVersion, iv, authTag, encrypted])
}

/** Déchiffre un fichier produit par `encryptBuffer`. */
export function decryptBuffer(stored: Buffer): Buffer {
    const keyVersion = stored.subarray(0, 2).toString("ascii")
    const ivEnd = 2 + IV_LENGTH
    const authTagEnd = ivEnd + AUTH_TAG_LENGTH
    const iv = stored.subarray(2, ivEnd)
    const authTag = stored.subarray(ivEnd, authTagEnd)
    const encrypted = stored.subarray(authTagEnd)

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(keyVersion), iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
}
