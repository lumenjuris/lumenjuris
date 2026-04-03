import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";

export type AlertVariant = "error" | "success" | "info";

export interface AlertBannerProps {
  variant: AlertVariant;
  title: string;
  detail?: string;
  duration?: number;
  accent?: boolean;
  onClose: () => void;
}

const VARIANT_CONFIG = {
  error: {
    container: "bg-red-50 border-red-200 text-red-800",
    accentBorder: "border-l-red-500",
    bar: "bg-red-400",
    close: "text-red-400 hover:text-red-600",
    Icon: AlertTriangle,
    iconClass: "text-red-500",
  },
  success: {
    container: "bg-green-50 border-green-200 text-green-800",
    accentBorder: "border-l-green-500",
    bar: "bg-green-400",
    close: "text-green-400 hover:text-green-600",
    Icon: CheckCircle,
    iconClass: "text-green-500",
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800",
    accentBorder: "border-l-blue-500",
    bar: "bg-blue-400",
    close: "text-blue-400 hover:text-blue-600",
    Icon: Info,
    iconClass: "text-blue-500",
  },
} as const;

export function AlertBanner({ variant, title, detail, duration = 5000, accent = false, onClose }: AlertBannerProps) {
  const [progress, setProgress] = useState(100);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        onCloseRef.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  const cfg = VARIANT_CONFIG[variant];

  return (
    <div className={`relative rounded-lg border overflow-hidden ${cfg.container} ${accent ? `border-l-4 ${cfg.accentBorder}` : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <cfg.Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.iconClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {detail && <p className="text-xs mt-0.5 opacity-75 leading-snug">{detail}</p>}
        </div>
        <button onClick={onClose} className={`shrink-0 transition-colors ${cfg.close}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 bg-black/10">
        <div className={`h-full ${cfg.bar}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
