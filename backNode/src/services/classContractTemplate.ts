import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/singletonPrisma.js";

// Le champ `structure` est chiffré/déchiffré automatiquement par l'extension Prisma.

export interface TemplateStructure {
  sections: Array<{
    title: string;
    clauses: Array<{
      id: string;
      title: string;
      content: string;
      variables: string[];
    }>;
  }>;
  detectedVariables: string[];
  /** Libellé et type de chaque variable (renseignés par l'import IA). */
  variableDefs?: Array<{ name: string; label: string; type: string }>;
  rawText?: string;
}

export interface ContractTemplateDTO {
  id: string;
  name: string;
  contractType: string | null;
  sourceFilename: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

function toDTO(t: {
  externalId: string;
  name: string;
  contractType: string | null;
  sourceFilename: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): ContractTemplateDTO {
  return {
    id: t.externalId,
    name: t.name,
    contractType: t.contractType,
    sourceFilename: t.sourceFilename,
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Élément de la liste des modèles : métadonnées + nombre de champs. */
export interface ContractTemplateListItemDTO extends ContractTemplateDTO {
  variableCount: number;
}

/** Nombre de champs (variables) d'un modèle, lu dans sa structure. */
function countTemplateVariables(structure: TemplateStructure): number {
  return structure.detectedVariables?.length ?? 0;
}

export class ContractTemplateService {
  async list(userId: number): Promise<ContractTemplateListItemDTO[]> {
    const rows = await prisma.contractTemplate.findMany({
      where: { userId },
      select: {
        externalId: true,
        name: true,
        contractType: true,
        sourceFilename: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        structure: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...toDTO(row),
      variableCount: countTemplateVariables(row.structure as unknown as TemplateStructure),
    }));
  }

  async get(
    userId: number,
    externalId: string,
  ): Promise<{
    meta: ContractTemplateDTO;
    structure: TemplateStructure;
  } | null> {
    const row = await prisma.contractTemplate.findFirst({
      where: { userId, externalId },
    });
    if (!row) return null;
    const structure = row.structure as unknown as TemplateStructure;
    return { meta: toDTO(row), structure };
  }

  async create(
    userId: number,
    data: {
      name: string;
      contractType?: string;
      sourceFilename?: string;
      sourceFilePath?: string;
      structure: TemplateStructure;
    },
  ): Promise<ContractTemplateDTO> {
    const row = await prisma.contractTemplate.create({
      data: {
        externalId: crypto.randomUUID(),
        name: data.name,
        contractType: data.contractType ?? null,
        sourceFilename: data.sourceFilename ?? null,
        sourceFilePath: data.sourceFilePath ?? null,
        structure: data.structure as unknown as Prisma.InputJsonValue,
        userId,
      },
    });
    return toDTO(row);
  }

  async updateStructure(
    userId: number,
    externalId: string,
    structure: TemplateStructure,
  ): Promise<ContractTemplateDTO | null> {
    const existing = await prisma.contractTemplate.findFirst({
      where: { userId, externalId },
    });
    if (!existing) return null;
    const row = await prisma.contractTemplate.update({
      where: { idTemplate: existing.idTemplate },
      data: {
        structure: structure as unknown as Prisma.InputJsonValue,
        version: existing.version + 1,
      },
    });
    return toDTO(row);
  }

  async delete(userId: number, externalId: string): Promise<void> {
    await prisma.contractTemplate.deleteMany({ where: { userId, externalId } });
  }
}
