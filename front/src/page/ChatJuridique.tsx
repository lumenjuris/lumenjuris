import { useState, useRef } from "react";
import { MessageSquare, Send, Download, Clock } from "lucide-react";

type Message = { role: "user" | "bot"; text: string; sources?: string[] };

const history = [
  { id: 1, title: "Licenciement faute grave",       time: "Aujourd'hui", active: true  },
  { id: 2, title: "Durée période d'essai cadre",    time: "Hier",        active: false },
  { id: 3, title: "Obligation de reclassement",     time: "26 fév.",     active: false },
  { id: 4, title: "Rupture conventionnelle col...", time: "24 fév.",     active: false },
];

export function ChatJuridique() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeId, setActiveId] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0 overflow-hidden rounded-xl border border-gray-200 shadow-sm">

      {/* Liste des conversations */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex-col hidden md:flex">
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Historique</p>
        </div>
        <ul className="flex-1 overflow-auto px-3 py-3 space-y-1">
          {history.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => setActiveId(h.id)}
                className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${
                  activeId === h.id ? "bg-[#354F99]/10 border border-[#354F99]/20" : "hover:bg-gray-50"
                }`}
              >
                <p className={`text-sm font-medium truncate ${activeId === h.id ? "text-[#354F99]" : "text-gray-700"}`}>
                  {h.title}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-[11px] text-gray-400">{h.time}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header de conversation */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#354F99]" />
            <span className="text-sm font-semibold text-gray-900">Chat juridique RH</span>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
            <Download className="h-3.5 w-3.5" />
            Exporter PDF
          </button>
        </div>

        {/* Messages ou écran d'accueil */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6">
            <div className="w-full max-w-2xl flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#354F99]/10 border border-[#354F99]/20">
                  <MessageSquare className="h-6 w-6 text-[#354F99]" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Un doute juridique ?</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Posez vos questions sur le droit du travail, les contrats RH ou la jurisprudence française.
                </p>
              </div>
              <div className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:border-[#354F99] transition-colors">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  placeholder="Posez votre question..."
                  className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                  autoFocus
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#354F99] text-white hover:bg-[#2d4387] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Réponses basées sur le Code du travail et la jurisprudence française
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-8 py-8 space-y-8 bg-gray-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <div className="max-w-[70%] bg-gray-900 text-white text-sm rounded-2xl px-5 py-3.5 leading-relaxed">
                      {m.text}
                    </div>
                  ) : (
                    <div className="max-w-[80%] space-y-3">
                      <div className="bg-white border border-gray-200 text-sm text-gray-800 rounded-2xl px-6 py-5 shadow-sm leading-relaxed">
                        {m.text}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {m.sources.map((s, j) => (
                            <span key={j} className="inline-flex items-center gap-1 text-[11px] text-[#354F99] bg-[#354F99]/10 border border-[#354F99]/20 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Champ de saisie */}
            <div className="px-6 py-4 bg-white border-t border-gray-200 shrink-0">
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-[#354F99] transition-colors">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  placeholder="Posez votre question..."
                  className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#354F99] text-white hover:bg-[#2d4387] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                Réponses basées sur le Code du travail et la jurisprudence française
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

