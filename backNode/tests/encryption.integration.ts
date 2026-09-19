/**
 * Test du chiffrement des champs sensibles en base.
 *
 * Vérifie :
 *   1. le module encryption.ts (aller-retour, IV aléatoire, falsification détectée) ;
 *   2. l'extension Prisma sur une vraie base : ce qui est STOCKÉ est chiffré
 *      (lu en SQL brut, sans l'extension) et ce que Prisma RENVOIE est en clair,
 *      y compris dans les écritures imbriquées et les `include` ;
 *   3. le garde-fou : un `where` / `orderBy` sur un champ chiffré lève une erreur.
 *
 * Prérequis : base migrée avec le schéma à jour (le test crée son propre utilisateur).
 * Lancement : npm run test:encryption  (depuis backNode/)
 * Auto-nettoyant : supprime les données de test à la fin.
 */
import "dotenv/config"
import assert from "node:assert/strict"
import crypto from "crypto"
import { prisma } from "../prisma/singletonPrisma.js"
import { encryptValue, decryptValue, encryptBuffer, decryptBuffer, hashToken } from "../src/services/encryption.js"

let passed = 0
async function check(name: string, fn: () => Promise<void> | void) {
    try {
        await fn()
        passed++
        console.log(`  ✓ ${name}`)
    } catch (e) {
        console.error(`  ✗ ${name}`)
        console.error("    ", e instanceof Error ? e.message : e)
        process.exitCode = 1
    }
}

const SECRET_TITLE = "Contrat secret Société Dupont"
const SECRET_OCR = "Article 1 — Le prestataire s'engage à une confidentialité absolue."

async function main() {
    console.log("Module encryption.ts\n")

    await check("un texte chiffré puis déchiffré redevient identique", () => {
        assert.equal(decryptValue(encryptValue("Clause é à ç")), "Clause é à ç")
    })
    await check("un objet chiffré puis déchiffré redevient identique", () => {
        const obj = { niveau: "élevé", liste: [1, 2, 3] }
        assert.deepEqual(decryptValue(encryptValue(obj)), obj)
    })
    await check("deux chiffrements du même texte donnent deux résultats différents (IV aléatoire)", () => {
        assert.notEqual(encryptValue("abc"), encryptValue("abc"))
    })
    await check("le format stocké est enc:v1:iv:tag:données", () => {
        assert.match(encryptValue("abc"), /^enc:v1:[^:]+:[^:]+:[^:]+$/)
    })
    await check("une valeur falsifiée est rejetée", () => {
        const parts = encryptValue("montant : 1000 €").split(":")
        parts[4] = Buffer.from("montant : 9999 €").toString("base64")
        assert.throws(() => decryptValue(parts.join(":")))
    })
    await check("un fichier chiffré puis déchiffré redevient identique", () => {
        const pdf = crypto.randomBytes(5000)
        assert.ok(decryptBuffer(encryptBuffer(pdf)).equals(pdf))
    })

    await check("l'empreinte d'un jeton est stable et ne contient pas le jeton", () => {
        const token = crypto.randomBytes(32).toString("hex")
        assert.equal(hashToken(token), hashToken(token))
        assert.notEqual(hashToken(token), token)
        assert.match(hashToken(token), /^[0-9a-f]{64}$/)
    })

    console.log("\nExtension Prisma (base réelle)\n")

    // Utilisateur de test dédié (supprimé à la fin, avec ses contrats en cascade)
    const user = await prisma.user.create({
        data: { email: `test-encryption-${crypto.randomUUID()}@example.test`, nom: "Dupont", prenom: "Élise" },
    })
    const externalId = `test-encryption-${crypto.randomUUID()}`
    let contractId = 0

    try {
        await check("nom / prénom de l'utilisateur chiffrés en base, lus en clair", async () => {
            const rows = await prisma.$queryRaw<Array<{ nom: string; prenom: string; email: string }>>`
                SELECT nom, prenom, email FROM User WHERE idUser = ${user.idUser}`
            assert.ok(rows[0].nom.startsWith("enc:v1:"), "nom non chiffré")
            assert.ok(rows[0].prenom.startsWith("enc:v1:"), "prénom non chiffré")
            assert.ok(rows[0].email.endsWith("@example.test"), "l'email doit rester en clair")
            const reread = await prisma.user.findUniqueOrThrow({ where: { idUser: user.idUser } })
            assert.equal(reread.nom, "Dupont")
            assert.equal(reread.prenom, "Élise")
        })

        await check("jeton de compte : seule l'empreinte est stockée et elle permet de le retrouver", async () => {
            const token = crypto.randomBytes(32).toString("hex")
            await prisma.token.create({
                data: { tokenHash: hashToken(token), type: "verifyAccount", expiresAt: new Date(Date.now() + 60_000), userId: user.idUser },
            })
            const found = await prisma.token.findUnique({ where: { tokenHash: hashToken(token) } })
            assert.ok(found, "jeton introuvable par son empreinte")
            const rows = await prisma.$queryRaw<Array<{ tokenHash: string }>>`
                SELECT tokenHash FROM Token WHERE userId = ${user.idUser}`
            assert.ok(!rows.some((r) => r.tokenHash === token), "le jeton est stocké en clair")
        })

        await check("création d'un contrat avec écritures imbriquées", async () => {
            const contract = await prisma.contract.create({
                data: {
                    externalId,
                    title: SECRET_TITLE,
                    counterpartyName: "Dupont SA",
                    ocrText: SECRET_OCR,
                    userId: user.idUser,
                    metadataFields: { create: [{ fieldKey: "amount", value: "15 000 €" }] },
                    versions: { create: { versionNumber: 1, contentText: SECRET_OCR, note: "v1" } },
                },
            })
            contractId = contract.idContract
            // Le résultat de create est déjà déchiffré
            assert.equal(contract.title, SECRET_TITLE)
        })

        await check("en base (SQL brut), les champs sont chiffrés et le texte clair est absent", async () => {
            const rows = await prisma.$queryRaw<Array<{ title: string; ocrText: string; counterpartyName: string }>>`
                SELECT title, ocrText, counterpartyName FROM Contract WHERE idContract = ${contractId}`
            const row = rows[0]
            for (const stored of [row.title, row.ocrText, row.counterpartyName]) {
                assert.ok(stored.startsWith("enc:v1:"), `valeur non chiffrée : ${stored.slice(0, 40)}`)
            }
            assert.ok(!row.ocrText.includes("confidentialité"))

            const fields = await prisma.$queryRaw<Array<{ value: string }>>`
                SELECT value FROM ContractMetadataField WHERE contractId = ${contractId}`
            assert.ok(fields[0].value.startsWith("enc:v1:"), "métadonnée imbriquée non chiffrée")

            const versions = await prisma.$queryRaw<Array<{ contentText: string }>>`
                SELECT contentText FROM ContractVersion WHERE contractId = ${contractId}`
            assert.ok(versions[0].contentText.startsWith("enc:v1:"), "version imbriquée non chiffrée")
        })

        await check("à la lecture avec include, tout revient en clair", async () => {
            const contract = await prisma.contract.findFirstOrThrow({
                where: { externalId },
                include: { metadataFields: true, versions: true },
            })
            assert.equal(contract.title, SECRET_TITLE)
            assert.equal(contract.ocrText, SECRET_OCR)
            assert.equal(contract.metadataFields[0].value, "15 000 €")
            assert.equal(contract.versions[0].contentText, SECRET_OCR)
        })

        await check("une mise à jour { set } est chiffrée", async () => {
            await prisma.contract.update({ where: { externalId }, data: { title: { set: "Nouveau titre" } } })
            const rows = await prisma.$queryRaw<Array<{ title: string }>>`
                SELECT title FROM Contract WHERE idContract = ${contractId}`
            assert.ok(rows[0].title.startsWith("enc:v1:"))
            const contract = await prisma.contract.findFirstOrThrow({ where: { externalId } })
            assert.equal(contract.title, "Nouveau titre")
        })

        await check("un champ Json (ContractSummary) est chiffré puis relu comme objet", async () => {
            const summary = await prisma.contractSummary.create({
                data: {
                    externalId: `${externalId}-summary`,
                    identification: { parties: ["Dupont SA"] },
                    resume_executif: "Résumé confidentiel",
                    parties: ["Dupont SA", "Martin SARL"],
                    dates: {}, objet: "Prestation", obligations: [], conditions_financieres: {},
                    responsabilite: {}, clauses_particulieres: [], delais_importants: [],
                    annexes: [], resiliation: {}, points_attention: [],
                    userId: user.idUser,
                    contractId,
                },
            })
            const rows = await prisma.$queryRaw<Array<{ parties: string }>>`
                SELECT parties FROM ContractSummary WHERE idSummary = ${summary.idSummary}`
            assert.ok(!rows[0].parties.includes("Dupont"), "le Json est stocké en clair")
            const reread = await prisma.contractSummary.findUniqueOrThrow({ where: { idSummary: summary.idSummary } })
            assert.deepEqual(reread.parties, ["Dupont SA", "Martin SARL"])
            assert.equal(reread.niveau_risque, null)
        })

        await check("un where sur un champ chiffré lève une erreur explicite", async () => {
            await assert.rejects(
                prisma.contract.findMany({ where: { title: { contains: "secret" } } }),
                /chiffré/,
            )
        })

        await check("un orderBy sur un champ chiffré lève une erreur explicite", async () => {
            await assert.rejects(prisma.contract.findMany({ orderBy: { title: "asc" } }), /chiffré/)
        })
    } finally {
        // Nettoyage : supprimer l'utilisateur supprime en cascade ses contrats, synthèses et jetons
        await prisma.user.delete({ where: { idUser: user.idUser } })
        await prisma.$disconnect()
    }

    console.log(`\n${passed} test(s) réussi(s)${process.exitCode ? " — des échecs ci-dessus" : ""}`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
