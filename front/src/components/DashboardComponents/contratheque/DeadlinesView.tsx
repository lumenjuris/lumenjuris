import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock, RefreshCw, ShieldAlert, Loader2, AlertCircle, CalendarDays, List as ListIcon, CalendarPlus,
} from "lucide-react";
import { CalendarMonth } from "./CalendarMonth";
import { contractApi } from "./api";
import {
  DEADLINE_LABEL, DEADLINE_COLOR, severityOf, SEVERITY_STYLE, fmtDate, daysUntil,
} from "./types";
import type { DeadlineEvent } from "./types";

/** Génère un fichier .ics et le télécharge pour Outlook / Apple Calendar. */
function downloadIcs(event: DeadlineEvent) {
  const d = new Date(event.date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  const uid = `${event.contractId}-${event.type}@lumenjuris`;
  const summary = `[LumenJuris] ${DEADLINE_LABEL[event.type]} — ${event.contractTitle}`;
  const description = event.counterpartyName ? `Cocontractant : ${event.counterpartyName}` : "";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LumenJuris//FR",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${fmt(d)}`,
    `DTEND;VALUE=DATE:${fmt(d)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `echeance-${event.contractId}.ics`; a.click();
  URL.revokeObjectURL(url);
}

/** Ouvre Google Calendar pré-rempli. */
function openGoogleCalendar(event: DeadlineEvent) {
  const d = new Date(event.date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  const title = encodeURIComponent(`[LumenJuris] ${DEADLINE_LABEL[event.type]} — ${event.contractTitle}`);
  const details = encodeURIComponent(event.counterpartyName ? `Cocontractant : ${event.counterpartyName}` : "");
  const dateStr = fmt(d);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

interface Props {
  onOpen: (id: string) => void;
  refreshKey?: number;
}

/** Vue "Échéances" : alertes de renouvellement + suivi + calendrier. */
export function DeadlinesView({ onOpen, refreshKey }: Props) {
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "calendar">("calendar");

  useEffect(() => {
    setLoading(true); setError("");
    // Horizon large (3 ans) pour que les échéances lointaines apparaissent
    // aussi quand on navigue dans les mois futurs du calendrier.
    contractApi.deadlines(365 * 3)
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur réseau"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Compteurs d'alertes
  const counts = useMemo(() => {
    let notice30 = 0, chatel = 0, end90 = 0, overdue = 0;
    for (const e of events) {
      const d = daysUntil(e.date) ?? 999;
      if (d < 0) overdue++;
      if (e.type === "NOTICE_DEADLINE" && d >= 0 && d <= 30) notice30++;
      if (e.type === "CHATEL_INFO" && d >= -30) chatel++;
      if (e.type === "END_DATE" && d >= 0 && d <= 90) end90++;
    }
    return { notice30, chatel, end90, overdue };
  }, [events]);

  return (
    <div className="space-y-5">
      {/* Cartes d'alerte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertCard label="Préavis sous 30 j" value={counts.notice30} icon={AlarmClock} color="#f59e0b" loading={loading} />
        <AlertCard label="Alertes Chatel B2C" value={counts.chatel} icon={ShieldAlert} color="#7c3aed" loading={loading} />
        <AlertCard label="Échéances sous 90 j" value={counts.end90} icon={RefreshCw} color="#2563eb" loading={loading} />
        <AlertCard label="En retard" value={counts.overdue} icon={AlertCircle} color="#ef4444" loading={loading} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Bascule liste / calendrier */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{events.length} échéance{events.length > 1 ? "s" : ""} sur 3 ans</p>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
          <ModeBtn active={mode === "list"} onClick={() => setMode("list")} icon={ListIcon}>Liste</ModeBtn>
          <ModeBtn active={mode === "calendar"} onClick={() => setMode("calendar")} icon={CalendarDays}>Calendrier</ModeBtn>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : mode === "calendar" ? (
        <CalendarMonth events={events} onSelectContract={onOpen} />
      ) : (
        <DeadlineList events={events} onOpen={onOpen} />
      )}
    </div>
  );
}

function DeadlineList({ events, onOpen }: { events: DeadlineEvent[]; onOpen: (id: string) => void }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center bg-white rounded-2xl border border-gray-200">
        <CalendarDays className="w-8 h-8 text-gray-300" />
        <p className="text-sm font-semibold text-gray-700">Aucune échéance à venir</p>
        <p className="text-xs text-gray-400">Les contrats sans date de fin n'apparaissent pas ici.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {events.map((e, i) => {
        const days = daysUntil(e.date) ?? 0;
        const sev = SEVERITY_STYLE[severityOf(days)];
        return (
          <div key={i} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/60 transition-colors">
            <button onClick={() => onOpen(e.contractId)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DEADLINE_COLOR[e.type] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{e.contractTitle}</span>
                  {e.isB2C && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">B2C</span>}
                </div>
                <p className="text-[11px] text-gray-400">
                  <span style={{ color: DEADLINE_COLOR[e.type] }} className="font-semibold">{DEADLINE_LABEL[e.type]}</span>
                  {e.counterpartyName ? ` · ${e.counterpartyName}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0 mr-2">
                <p className="text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtDate(e.date)}</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: sev.bg, color: sev.fg }}>
                  {days < 0 ? `${sev.label} · J${days}` : `J-${days}`}
                </span>
              </div>
            </button>
            {/* Boutons export agenda */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => downloadIcs(e)}
                title="Ajouter à Outlook / Apple Calendar (.ics)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#354F99] hover:bg-gray-100 transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openGoogleCalendar(e)}
                title="Ajouter à Google Calendar"
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#EA4335] hover:bg-gray-100 transition-colors text-[10px] font-bold"
              >
                G
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string; value: number; icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold mt-1" style={{ color: value > 0 ? color : "#111827" }}>
          {loading ? <span className="text-gray-300">—</span> : value}
        </p>
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "1A" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
        active ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}
