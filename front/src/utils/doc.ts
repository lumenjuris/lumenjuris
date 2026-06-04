// src/utils/doc.ts
import toast from "react-hot-toast";

export const copyToClipboard = async (text: string, label = "Texte") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`✅ ${label} copié !`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast.success(`✅ ${label} copié (fallback) !`);
  }
};

export const exportAlt = (alt: any, format: "word" | "pdf") => {
  const content = `
${alt.title}

${alt.clauseText}

Bénéfices : ${alt.benefits}
Réduction de risque : ${alt.riskReduction}
  `;
  if (format === "word") {
    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${alt.title.replace(/[^a-z0-9]/gi, "_")}.doc`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast.success("📄 Word téléchargé");
  } else {
    const w = window.open("", "_blank");
    w?.document.write(`<pre>${content}</pre>`);
    w?.print();
  }
};
