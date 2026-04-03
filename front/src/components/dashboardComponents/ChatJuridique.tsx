import { useState, useRef, useCallback, useEffect } from "react";
import { MessageSquare, Send, Download, Clock, Plus, Trash2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "bot" | "error"; text: string };
type Conversation = { id: string; title: string; createdAt: string; messages: Message[] };

const LS_KEY = "chatjuridique_conversations";

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(convs));
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Hier";
  return `Il y a ${d} j`;
}

export function ChatJuridique() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(() => loadConversations()[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  const createConversation = useCallback(() => {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: "Nouvelle conversation",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;

    let convId = activeId;

    // Crée la conversation si vide
    if (!convId) {
      const conv: Conversation = {
        id: crypto.randomUUID(),
        title: text.slice(0, 40),
        createdAt: new Date().toISOString(),
        messages: [],
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
    }

    const userMsg: Message = { role: "user", text };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
              messages: [...c.messages, userMsg],
            }
          : c
      )
    );
    setInput("");
    setIsSending(true);

    // Ajout du contexte et de l'historique des messages précédents
    const previousMessages = conversations.find((c) => c.id === convId)?.messages ?? [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: "Tu es un assistant juridique spécialisé en droit du travail français. Réponds avec précision en citant les articles du Code du travail pertinents.",
          history: previousMessages
            .filter((m) => m.role === "user" || m.role === "bot")
            .map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
        }),
      });

      if (!res.ok) {
        let detail = `Erreur HTTP ${res.status}`;
        try { detail = (await res.json()).detail ?? detail; } catch {}
        throw new Error(detail);
      }

      const data = await res.json();
      const botMsg: Message = { role: "bot", text: data.response };
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, messages: [...c.messages, botMsg] } : c)
      );
    } catch (err) {
      const errMsg: Message = {
        role: "error",
        text: err instanceof Error ? err.message : "Une erreur est survenue.",
      };
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, messages: [...c.messages, errMsg] } : c)
      );
    } finally {
      setIsSending(false);
    }
  }, [activeId, isSending]);

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0 overflow-hidden rounded-xl border border-gray-200 shadow-sm">

      {/* liste des conversations */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex-col hidden md:flex">
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Historique</p>
          <button
            onClick={createConversation}
            title="Nouvelle conversation"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-lumenjuris text-white hover:bg-lumenjuris-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-xs text-gray-400 text-center">Aucune conversation.<br />Cliquez sur + pour commencer.</p>
          </div>
        ) : (
          <ul className="flex-1 overflow-auto px-3 py-3 space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => setActiveId(conv.id)}
                  className={`group w-full text-left px-3 py-3 rounded-xl transition-colors flex items-start justify-between gap-2 ${
                    activeId === conv.id ? "bg-lumenjuris/10 border border-lumenjuris/20" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${activeId === conv.id ? "text-lumenjuris" : "text-gray-700"}`}>
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="text-[11px] text-gray-400">{relativeTime(conv.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    title="Supprimer"
                    className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-red-500 transition-all shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-lumenjuris" />
            <span className="text-sm font-semibold text-gray-900">
              {activeConv?.title ?? "Chat juridique RH"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createConversation}
              className="md:hidden flex items-center gap-1.5 text-xs text-white bg-lumenjuris border border-lumenjuris rounded-lg px-3 py-1.5 hover:bg-lumenjuris-dark transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </button>
            <button className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Exporter PDF
            </button>
          </div>
        </div>

        {/* Messages ou écran d'accueil */}
        {!activeConv || activeConv.messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6">
            <div className="w-full max-w-2xl flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lumenjuris/10 border border-lumenjuris/20">
                  <MessageSquare className="h-6 w-6 text-lumenjuris" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Un doute juridique ?</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Posez vos questions sur le droit du travail, les contrats RH ou la jurisprudence française.
                </p>
              </div>
              <div className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:border-lumenjuris transition-colors">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  placeholder="Posez votre question..."
                  className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                  autoFocus
                  disabled={isSending}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isSending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-lumenjuris text-white hover:bg-lumenjuris-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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
              {activeConv.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <div className="max-w-[70%] bg-gray-900 text-white text-sm rounded-2xl px-5 py-3.5 leading-relaxed">
                      {m.text}
                    </div>
                  ) : m.role === "error" ? (
                    <div className="max-w-[80%] bg-red-50 border border-red-200 text-sm text-red-700 rounded-2xl px-6 py-5 shadow-sm leading-relaxed">
                      {m.text}
                    </div>
                  ) : (
                    <div className="max-w-[80%] bg-white border border-gray-200 text-sm text-gray-800 rounded-2xl px-6 py-5 shadow-sm leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_strong]:font-semibold [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-lumenjuris [&_a]:underline">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin text-lumenjuris" />
                    Réponse en attente…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 shrink-0">
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 focus-within:border-lumenjuris transition-colors">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  placeholder="Posez votre question..."
                  className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                  disabled={isSending}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isSending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-lumenjuris text-white hover:bg-lumenjuris-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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

