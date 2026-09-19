import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { encryptionExtension } from "./encryptionExtension.js";




const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: parseInt(process.env.DATABASE_PORT!),
  connectionLimit: 5,
});



// Toutes les requêtes passent par l'extension de chiffrement (voir encryptionExtension.ts).
export const prisma = new PrismaClient({ adapter }).$extends(encryptionExtension)

/**
 * Type du client `tx` reçu dans `prisma.$transaction(async (tx) => …)`.
 * À utiliser à la place de `Prisma.TransactionClient`, qui ne connaît pas
 * l'extension de chiffrement.
 */
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
