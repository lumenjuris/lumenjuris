import { CheckCircle2 } from "lucide-react";

/*
    Animation décorative : une signature manuscrite se trace sur la ligne "Lu et approuvé",
    puis un tampon "Prêt à signer" apparaît. Tourne en boucle.
    Conçue pour la page signature (pas encore intégrée).
*/
const SIGNATURE_CYCLE_S = 6;
// Tracé de la signature (courbe libre dessinée à la main)
const SIGNATURE_PATH =
  "M4 38 C 14 8, 26 6, 24 30 S 30 52, 42 24 C 48 10, 54 12, 52 30 C 50 44, 60 40, 68 26 " +
  "C 74 16, 80 18, 80 30 C 80 40, 90 38, 98 28 C 104 20, 112 22, 116 30 C 122 40, 140 34, 176 22";

export function SignatureAnimation() {
  return (
    <div aria-hidden="true" className="flex items-end justify-between gap-6 px-1">
      <div className="w-64 max-w-full">
        <svg viewBox="0 0 180 56" className="h-14 w-full overflow-visible">
          <path
            d={SIGNATURE_PATH}
            pathLength={1}
            className="signature-stroke"
            fill="none"
            stroke="#213957"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="mt-1 border-t border-dashed border-ink-placeholder pt-1.5 text-[11px] text-ink-subtle">
          Lu et approuvé
        </div>
      </div>

      <div className="signature-stamp mb-5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success-light px-3 py-1 text-[11px] font-semibold text-success-dark">
        <CheckCircle2 className="h-3.5 w-3.5" /> Prêt à signer
      </div>

      <style>{`
        .signature-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: signature-draw ${SIGNATURE_CYCLE_S}s ease-in-out infinite;
        }
        .signature-stamp {
          opacity: 0;
          animation: signature-stamp ${SIGNATURE_CYCLE_S}s ease-out infinite;
        }

        @keyframes signature-draw {
          0%, 5% { stroke-dashoffset: 1; opacity: 1; }
          45%, 85% { stroke-dashoffset: 0; opacity: 1; }
          95%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes signature-stamp {
          0%, 45% { opacity: 0; transform: scale(1.4) rotate(-6deg); }
          52% { opacity: 1; transform: scale(0.95) rotate(-6deg); }
          56%, 85% { opacity: 1; transform: scale(1) rotate(-6deg); }
          95%, 100% { opacity: 0; transform: scale(1) rotate(-6deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .signature-stroke { animation: none; stroke-dashoffset: 0; }
          .signature-stamp { animation: none; opacity: 1; transform: rotate(-6deg); }
        }
      `}</style>
    </div>
  );
}
