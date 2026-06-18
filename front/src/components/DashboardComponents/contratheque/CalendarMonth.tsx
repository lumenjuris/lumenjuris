import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { DEADLINE_COLOR, DEADLINE_SHORT, DEADLINE_LABEL } from "./types";
import type { DeadlineEvent } from "./types";

function downloadIcs(event: DeadlineEvent) {
  const d = new Date(event.date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  const uid = `${event.contractId}-${event.type}@lumenjuris`;
  const summary = `[LumenJuris] ${DEADLINE_LABEL[event.type]} — ${event.contractTitle}`;
  const description = event.counterpartyName ? `Cocontractant : ${event.counterpartyName}` : "";
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LumenJuris//FR","BEGIN:VEVENT",
    `UID:${uid}`,`DTSTART;VALUE=DATE:${fmt(d)}`,`DTEND;VALUE=DATE:${fmt(d)}`,
    `SUMMARY:${summary}`,`DESCRIPTION:${description}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `echeance-${event.contractId}.ics`; a.click();
  URL.revokeObjectURL(url);
}

function openGoogleCalendar(event: DeadlineEvent) {
  const d = new Date(event.date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  const title = encodeURIComponent(`[LumenJuris] ${DEADLINE_LABEL[event.type]} — ${event.contractTitle}`);
  const details = encodeURIComponent(event.counterpartyName ? `Cocontractant : ${event.counterpartyName}` : "");
  const dateStr = fmt(d);
  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`, "_blank", "noopener,noreferrer");
}

interface Props {
  events: DeadlineEvent[];
  onSelectContract: (id: string) => void;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** Clé jour "AAAA-MM-JJ" en heure LOCALE (évite le décalage UTC de toISOString). */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Vue calendrier mensuelle des échéances. */
export function CalendarMonth({ events, onSelectContract }: Props) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Regroupe les événements par jour (clé locale yyyy-mm-dd)
  const byDay = useMemo(() => {
    const m = new Map<string, DeadlineEvent[]>();
    for (const e of events) {
      const key = dateKey(new Date(e.date));
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = dateKey(new Date());

  // Construit la grille : commence au lundi de la semaine du 1er
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // lundi = 0
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {/* En-tête navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">{MONTHS[month]} {year}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            Aujourd'hui
          </button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center py-1">{w}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === month;
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={`min-h-[58px] rounded-lg border p-1 text-left transition-colors ${
                isSelected ? "border-[#354F99] bg-[#354F99]/5"
                : inMonth ? "border-gray-100 hover:bg-gray-50" : "border-transparent bg-gray-50/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold ${isToday ? "text-white bg-[#354F99] w-5 h-5 rounded-full flex items-center justify-center" : inMonth ? "text-gray-700" : "text-gray-300"}`}>
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {dayEvents.slice(0, 2).map((e, j) => (
                  <span key={j} className="text-[8px] font-bold px-1 py-0.5 rounded truncate" style={{ backgroundColor: DEADLINE_COLOR[e.type] + "22", color: DEADLINE_COLOR[e.type] }}>
                    {DEADLINE_SHORT[e.type]}
                  </span>
                ))}
                {dayEvents.length > 2 && <span className="text-[8px] text-gray-400 px-1">+{dayEvents.length - 2}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {(() => {
              const [y, m, dd] = selectedDay.split("-").map(Number);
              return new Date(y, m - 1, dd).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            })()}
          </p>
          {selectedEvents.length === 0 && <p className="text-xs text-gray-300 italic">Aucune échéance ce jour.</p>}
          {selectedEvents.map((e, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-50">
              <button onClick={() => onSelectContract(e.contractId)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEADLINE_COLOR[e.type] }} />
                <span className="text-xs font-medium text-gray-700 truncate flex-1">{e.contractTitle}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: DEADLINE_COLOR[e.type] + "22", color: DEADLINE_COLOR[e.type] }}>
                  {DEADLINE_SHORT[e.type]}
                </span>
              </button>
              <button onClick={() => downloadIcs(e)} title="Outlook / .ics" className="p-1 rounded text-gray-300 hover:text-[#354F99] hover:bg-gray-100 shrink-0">
                <CalendarPlus className="w-3 h-3" />
              </button>
              <button onClick={() => openGoogleCalendar(e)} title="Google Calendar" className="p-1 rounded text-gray-300 hover:text-[#EA4335] hover:bg-gray-100 shrink-0 text-[9px] font-bold">
                G
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        {(["END_DATE", "NOTICE_DEADLINE", "CHATEL_INFO"] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-[9px] text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DEADLINE_COLOR[t] }} />
            {DEADLINE_SHORT[t]}
          </span>
        ))}
      </div>
    </div>
  );
}
