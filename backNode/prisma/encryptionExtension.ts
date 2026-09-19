import { Prisma } from "@prisma/client"
import { ENCRYPTED_FIELDS } from "./encryptedFields.js"
import { encryptValue, decryptValue } from "../src/services/encryption.js"

/**
 * Extension Prisma de chiffrement automatique des champs sensibles.
 *
 * Branchée une seule fois dans singletonPrisma.ts, elle intercepte TOUTES les
 * requêtes Prisma de l'application :
 *   - à l'écriture (create, update, upsert, createMany… y compris les écritures
 *     imbriquées comme `contract.create({ data: { versions: { create: … } } })`),
 *     elle chiffre les champs listés dans encryptedFields.ts ;
 *   - à la lecture, elle déchiffre ces champs dans le résultat, y compris dans
 *     les relations chargées avec `include` ;
 *   - si un `where` ou un `orderBy` porte sur un champ chiffré, elle lève une
 *     erreur explicite (sinon la requête renverrait silencieusement 0 résultat).
 *
 * Les services manipulent donc toujours des valeurs en clair : ils ne voient
 * jamais le texte chiffré.
 */

// ─── Carte du schéma, construite à partir du schéma Prisma (dmmf) ───────────

/** Pour chaque modèle, ses relations : { Contract: { versions: "ContractVersion", … } } */
const RELATIONS_BY_MODEL: Record<string, Record<string, string>> = {}

/** Pour chaque modèle, le type de chaque champ scalaire : { Contract: { title: "String", … } } */
const FIELD_TYPES_BY_MODEL: Record<string, Record<string, string>> = {}

for (const model of Prisma.dmmf.datamodel.models) {
    RELATIONS_BY_MODEL[model.name] = {}
    FIELD_TYPES_BY_MODEL[model.name] = {}
    for (const field of model.fields) {
        if (field.kind === "object") {
            RELATIONS_BY_MODEL[model.name][field.name] = field.type
        } else {
            FIELD_TYPES_BY_MODEL[model.name][field.name] = field.type
        }
    }
}

// Vérification au démarrage : une faute de frappe dans encryptedFields.ts
// laisserait un champ en clair sans que personne ne s'en rende compte.
for (const [modelName, fieldNames] of Object.entries(ENCRYPTED_FIELDS)) {
    for (const fieldName of fieldNames) {
        const fieldType = FIELD_TYPES_BY_MODEL[modelName]?.[fieldName]
        if (fieldType !== "String" && fieldType !== "Json") {
            throw new Error(
                `encryptedFields.ts : ${modelName}.${fieldName} n'existe pas ou n'est pas de type String/Json`,
            )
        }
    }
}

// ─── Petits utilitaires ──────────────────────────────────────────────────────

function isEncryptedField(modelName: string, fieldName: string): boolean {
    return ENCRYPTED_FIELDS[modelName]?.includes(fieldName) ?? false
}

function getRelationTarget(modelName: string, fieldName: string): string | undefined {
    return RELATIONS_BY_MODEL[modelName]?.[fieldName]
}

/** Vrai pour un objet littéral `{ … }` (et faux pour Date, Decimal, Buffer, tableaux…). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
}

/** Valeurs "vides" qu'on ne chiffre pas (null, undefined, et les null spéciaux des champs Json). */
function isEmptyValue(value: unknown): boolean {
    return (
        value === null ||
        value === undefined ||
        value === Prisma.JsonNull ||
        value === Prisma.DbNull ||
        value === Prisma.AnyNull
    )
}

// ─── Écriture : chiffrement ──────────────────────────────────────────────────

/** Chiffre la valeur d'un champ, en gérant la forme `{ set: valeur }` des update. */
function encryptFieldValue(modelName: string, fieldName: string, value: unknown): unknown {
    if (isEmptyValue(value)) return value

    const isStringField = FIELD_TYPES_BY_MODEL[modelName][fieldName] === "String"
    if (isStringField && isPlainObject(value) && "set" in value) {
        return { set: isEmptyValue(value.set) ? value.set : encryptValue(value.set) }
    }
    return encryptValue(value)
}

/**
 * Chiffre les champs sensibles d'un objet `data` (ou d'un tableau d'objets
 * `data`), et descend dans les écritures imbriquées sur les relations.
 */
function encryptWriteData(modelName: string, data: unknown): unknown {
    if (Array.isArray(data)) {
        return data.map((item) => encryptWriteData(modelName, item))
    }
    if (!isPlainObject(data)) return data

    const encryptedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
        const relationTarget = getRelationTarget(modelName, key)
        if (isEncryptedField(modelName, key)) {
            encryptedData[key] = encryptFieldValue(modelName, key, value)
        } else if (relationTarget) {
            encryptedData[key] = encryptNestedWrite(relationTarget, value)
        } else {
            encryptedData[key] = value
        }
    }
    return encryptedData
}

/**
 * Un `update` imbriqué peut s'écrire `{ where, data }` ou directement avec les
 * champs (relation 1-1). On gère les deux formes.
 */
function encryptNestedUpdate(modelName: string, update: unknown): unknown {
    if (Array.isArray(update)) {
        return update.map((item) => encryptNestedUpdate(modelName, item))
    }
    if (isPlainObject(update) && "data" in update) {
        return { ...update, data: encryptWriteData(modelName, update.data) }
    }
    return encryptWriteData(modelName, update)
}

/**
 * Écriture imbriquée sur une relation, par exemple :
 *   versions: { create: [...], update: { where, data }, upsert: {...} }
 */
function encryptNestedWrite(targetModel: string, operations: unknown): unknown {
    if (!isPlainObject(operations)) return operations

    const result: Record<string, unknown> = { ...operations }

    if ("create" in result) {
        result.create = encryptWriteData(targetModel, result.create)
    }
    if ("createMany" in result && isPlainObject(result.createMany)) {
        result.createMany = {
            ...result.createMany,
            data: encryptWriteData(targetModel, result.createMany.data),
        }
    }
    if ("update" in result) {
        result.update = encryptNestedUpdate(targetModel, result.update)
    }
    if ("updateMany" in result) {
        result.updateMany = encryptNestedUpdate(targetModel, result.updateMany)
    }
    for (const operation of ["upsert", "connectOrCreate"]) {
        if (!(operation in result)) continue
        const items = Array.isArray(result[operation]) ? (result[operation] as unknown[]) : [result[operation]]
        const encryptedItems = items.map((item) => {
            if (!isPlainObject(item)) return item
            return {
                ...item,
                ...("create" in item ? { create: encryptWriteData(targetModel, item.create) } : {}),
                ...("update" in item ? { update: encryptWriteData(targetModel, item.update) } : {}),
            }
        })
        result[operation] = Array.isArray(result[operation]) ? encryptedItems : encryptedItems[0]
    }
    return result
}

// ─── Garde-fous : pas de filtre ni de tri sur un champ chiffré ───────────────

function throwEncryptedFieldError(modelName: string, fieldName: string, usage: string): never {
    throw new Error(
        `Impossible d'utiliser ${modelName}.${fieldName} dans un ${usage} : ce champ est chiffré en base. ` +
            `Charger les lignes puis filtrer/trier en mémoire.`,
    )
}

function checkWhere(modelName: string, where: unknown): void {
    if (Array.isArray(where)) {
        where.forEach((condition) => checkWhere(modelName, condition))
        return
    }
    if (!isPlainObject(where)) return

    for (const [key, value] of Object.entries(where)) {
        // Tester la présence d'une valeur (`champ: null`) reste possible.
        if (isEncryptedField(modelName, key) && value !== null) {
            throwEncryptedFieldError(modelName, key, "where")
        }
        if (key === "AND" || key === "OR" || key === "NOT") {
            checkWhere(modelName, value)
        }
    }
}

function checkOrderBy(modelName: string, orderBy: unknown): void {
    const orderByList = Array.isArray(orderBy) ? orderBy : [orderBy]
    for (const item of orderByList) {
        if (!isPlainObject(item)) continue
        for (const key of Object.keys(item)) {
            if (isEncryptedField(modelName, key)) {
                throwEncryptedFieldError(modelName, key, "orderBy")
            }
        }
    }
}

// ─── Lecture : déchiffrement ─────────────────────────────────────────────────

/**
 * Déchiffre les champs sensibles d'un résultat Prisma (objet ou tableau),
 * en descendant dans les relations chargées par `include` / `select`.
 * Le résultat est modifié sur place.
 */
function decryptResult(modelName: string, result: unknown): unknown {
    if (Array.isArray(result)) {
        result.forEach((item) => decryptResult(modelName, item))
        return result
    }
    if (!isPlainObject(result)) return result

    for (const [key, value] of Object.entries(result)) {
        const relationTarget = getRelationTarget(modelName, key)
        if (isEncryptedField(modelName, key)) {
            if (value !== null && value !== undefined) {
                result[key] = decryptValue(value as string)
            }
        } else if (relationTarget) {
            decryptResult(relationTarget, value)
        }
    }
    return result
}

// ─── L'extension ─────────────────────────────────────────────────────────────

/** Opérations qui renvoient des lignes du modèle (donc à déchiffrer). */
const OPERATIONS_RETURNING_ROWS = [
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "create",
    "createManyAndReturn",
    "update",
    "updateManyAndReturn",
    "upsert",
    "delete",
]

export const encryptionExtension = Prisma.defineExtension({
    name: "encryption",
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const queryArgs: Record<string, unknown> = { ...(args as Record<string, unknown>) }

                checkWhere(model, queryArgs.where)
                checkOrderBy(model, queryArgs.orderBy)

                if ("data" in queryArgs) {
                    queryArgs.data = encryptWriteData(model, queryArgs.data)
                }
                if (operation === "upsert") {
                    queryArgs.create = encryptWriteData(model, queryArgs.create)
                    queryArgs.update = encryptWriteData(model, queryArgs.update)
                }

                const result = await query(queryArgs)

                if (OPERATIONS_RETURNING_ROWS.includes(operation)) {
                    return decryptResult(model, result)
                }
                return result
            },
        },
    },
})
