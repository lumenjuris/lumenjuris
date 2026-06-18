import { STATUS_LABEL, STATUS_STYLE } from "./types";
import type { ContractStatus } from "./types";

/** Badge coloré du statut d'un contrat. */
export function StatusBadge({ status }: { status: ContractStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-chip text-[10px] font-semibold whitespace-nowrap tracking-wide"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
