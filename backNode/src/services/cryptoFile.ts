import crypto from "crypto"

/**
 * Chiffrement AES-256-GCM de fichiers binaires (PDF de contrats).
 *
 * Même clé que le chiffrement JSON (`CONTRACT_ENCRYPTION_KEY`, 64 hex). Le format
 * sur disque est : [12 octets IV][16 octets tag][ciphertext]. On stocke ainsi le
 * binaire chiffré tel quel sur le filesystem (jamais le PDF en clair) — exigence
 * RGPD "PDF chiffré sur filesystem".
 */
const ALGO = "aes-256-gcm"

function getKey(): Buffer {
    const hex = process.env.CONTRACT_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) throw new Error("CONTRACT_ENCRYPTION_KEY must be a 64-char hex string")
    return Buffer.from(hex, "hex")
}

/** Chiffre un buffer → buffer [IV(12)][tag(16)][ciphertext]. */
export function encryptBuffer(plain: Buffer): Buffer {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
    const enc = Buffer.concat([cipher.update(plain), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, enc])
}

/** Déchiffre un buffer produit par `encryptBuffer`. */
export function decryptBuffer(stored: Buffer): Buffer {
    const iv = stored.subarray(0, 12)
    const tag = stored.subarray(12, 28)
    const ct = stored.subarray(28)
    const dec = crypto.createDecipheriv(ALGO, getKey(), iv)
    dec.setAuthTag(tag)
    return Buffer.concat([dec.update(ct), dec.final()])
}
