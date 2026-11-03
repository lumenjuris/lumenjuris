/**
 * Lecture du contenu d'un contrat produit par l'éditeur du front (JSON TipTap).
 *
 * Sert à générer les livrables d'un achat unitaire (PDF, Word, fiche de synthèse)
 * côté serveur. Même règles de lecture que le front
 * (front/src/components/DashboardComponents/cdd/smart/contractExport.ts).
 */

/** Nœud du document TipTap (sortie de `editor.getJSON()`). */
export type ContractNode = {
    type: string;
    attrs?: Record<string, unknown>;
    text?: string;
    content?: ContractNode[];
};

/** Bloc du contrat prêt à mettre en page. */
export type ContractBlock = {
    kind: "title" | "heading" | "paragraph";
    text: string;
};

/** Champ rempli dans l'éditeur (ex : « Nom du salarié » → « Jean Dupont »). */
export type ContractField = {
    label: string;
    value: string;
};

/** Vérifie que la valeur reçue ressemble à un document TipTap. */
export function isContractNode(value: unknown): value is ContractNode {
    return typeof value === "object"
        && value !== null
        && typeof (value as ContractNode).type === "string"
        && (
            (value as ContractNode).content === undefined
            || Array.isArray((value as ContractNode).content)
        );
}

/** Texte d'un bloc, avec la valeur saisie à la place de chaque champ (« … » si vide). */
function inlineText(nodes?: ContractNode[]): string {
    if (!nodes) return "";
    return nodes
        .map((node) =>
            node.type === "text" ? node.text ?? ""
            : node.type === "hardBreak" ? "\n"
            : node.type === "variable" ? (String(node.attrs?.value || "") || "…")
            : inlineText(node.content),
        )
        .join("");
}

/** Blocs du contrat dans l'ordre : titre principal, titres d'articles, paragraphes. */
export function readContractBlocks(document: ContractNode): ContractBlock[] {
    const blocks: ContractBlock[] = [];
    for (const node of document.content ?? []) {
        const text = inlineText(node.content);
        if (!text.trim()) continue;
        if (node.type === "heading") {
            // Niveau 2 = titre du contrat, niveau 3 = titre d'article (convention de l'éditeur)
            blocks.push({ kind: node.attrs?.level === 2 ? "title" : "heading", text });
        } else {
            blocks.push({ kind: "paragraph", text });
        }
    }
    return blocks;
}

/** Champs remplis du contrat, sans doublon (un même champ peut apparaître plusieurs fois). */
export function readContractFields(document: ContractNode): ContractField[] {
    const fieldsByName = new Map<string, ContractField>();

    const visit = (nodes?: ContractNode[]) => {
        for (const node of nodes ?? []) {
            if (node.type === "variable") {
                const name = String(node.attrs?.name ?? "");
                const value = String(node.attrs?.value ?? "").trim();
                if (name && value && !fieldsByName.has(name)) {
                    fieldsByName.set(name, { label: String(node.attrs?.label || name), value });
                }
            }
            visit(node.content);
        }
    };
    visit(document.content);

    return [...fieldsByName.values()];
}

/**
 * Document minimal à partir du texte brut d'un contrat (paragraphes séparés par
 * une ligne vide), tel qu'enregistré en contrathèque. Sert quand le contenu de
 * l'éditeur n'a pas été transmis : le texte est complet mais les titres ne sont
 * plus distingués des paragraphes.
 */
export function documentFromPlainText(text: string): ContractNode {
    return {
        type: "doc",
        content: text
            .split(/\n\s*\n/)
            .filter((paragraph) => paragraph.trim())
            .map((paragraph) => ({ type: "paragraph", content: [{ type: "text", text: paragraph }] })),
    };
}
