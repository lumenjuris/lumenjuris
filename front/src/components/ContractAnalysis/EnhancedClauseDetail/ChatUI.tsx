import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../../store/chatStore';
import { Send, MessageSquare, AlertTriangle, HelpCircle } from 'lucide-react';
import { type OpenAIModelId } from '../../../utils/aiClient';

interface ClauseAIModelOption {
  value: OpenAIModelId;
  label: string;
}

interface ChatUIProps {
  clauseAiModel: OpenAIModelId;
  clauseAiModelOptions: ClauseAIModelOption[];
  onClauseAiModelChange: (model: OpenAIModelId) => void;
}

/**
 * Composant réutilisable pour l'interface du chat juridique.
 * Il se connecte au `useChatStore` pour gérer son état.
 */
export const ChatUI: React.FC<ChatUIProps> = ({
  clauseAiModel,
  clauseAiModelOptions,
  onClauseAiModelChange,
}) => {
  // Connexion au store Zustand
  const { messages, isSending, sendMessage, contextClause } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggestions de questions
  const SUGGESTIONS = [
    'Quels sont les principaux risques de cette clause ?',
    'Cette clause est-elle conforme à la loi ?',
    'Comment pourrais-je la renégocier ?',
    'Propose une alternative plus équilibrée.',
  ];

  // Fait défiler la vue vers le dernier message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input, clauseAiModel);
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion, clauseAiModel);
  };

  if (!contextClause) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 p-4 text-center">
        <MessageSquare size={40} className="mb-4" />
        <h4 className="font-semibold">Aucune clause sélectionnée</h4>
        <p className="text-sm">Cliquez sur une clause dans le document pour démarrer l'assistance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header + suggestions compact */}
      <div className="px-4 pt-2 pb-1 bg-white flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-slate-600" />
            <div className="leading-tight">
              <h4 className="text-sm font-semibold text-slate-800">Questions</h4>
              <p className="text-[11px] text-slate-500">Analyse contextualisée</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Modèle
            <select
              value={clauseAiModel}
              onChange={(event) => onClauseAiModelChange(event.target.value as OpenAIModelId)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {clauseAiModelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1 -mx-1">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSuggestionClick(q)}
                className="mx-1 px-2 py-1 text-[11px] text-slate-600 border border-slate-300 rounded-full hover:bg-slate-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/60">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                {msg.role === 'error' ? <AlertTriangle size={18} className="text-red-500" /> : <MessageSquare size={18} className="text-slate-600" />}
              </div>
            )}
            <div
              className={`max-w-[80%] p-3 rounded-lg text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-slate-800 text-white rounded-br-none'
                : msg.role === 'assistant'
                  ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
                  : 'bg-red-100 text-red-800 border border-red-200 rounded-bl-none'
                }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
            </div>
            <div className="max-w-[80%] p-3 rounded-lg bg-white text-slate-500 border border-slate-200 rounded-bl-none text-sm">
              L'assistant est en train d'écrire...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div className="bg-white px-4 pb-3 pt-2">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez votre question sur la clause..."
            className="w-full pl-4 pr-10 py-2 border rounded-full focus:outline-none focus:ring-1 focus:ring-slate-600 text-sm placeholder:text-slate-400"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatUI;
