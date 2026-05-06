import { create } from 'zustand';
import { type OpenAIModelId } from '../utils/aiClient';
import { fetchProxy } from '../utils/fetchProxy';



type Message = {
  role: 'user' | 'assistant' | 'error';
  content: string;
};

type ChatState = {
  messages: Message[];
  isSending: boolean;
  contextClause: { id: string; text: string } | null;
  sendMessage: (message: string, model?: OpenAIModelId) => Promise<void>;
  setContextClause: (clause: { id: string; text: string } | null) => void;
};

/**
 * Store Zustand pour gérer l'état du chat juridique.
 * Centralise la logique pour éviter les conflits entre composants.
 */
export const useChatStore = create<ChatState>((set, get) => ({
  // État initial
  messages: [],
  isSending: false,
  contextClause: null,

  /**
   * Définit la clause de contexte pour le chat et réinitialise la conversation.
   * @param clause - La clause sur laquelle portera la discussion.
   */
  setContextClause: (clause) => {
    set({ 
      contextClause: clause, 
      messages: [], // Réinitialise les messages à chaque changement de clause
      isSending: false 
    });
  },

  /**
   * Envoie un message à l'API OpenAI avec le contexte de la clause.
   * @param message - Le message de l'utilisateur.
   */
  sendMessage: async (message, model = 'gpt-4o') => {
    const { contextClause } = get();
    if (!contextClause) {
      set({
        messages: [
          ...get().messages,
          { role: 'error', content: 'Erreur : Aucune clause sélectionnée pour le contexte.' },
        ],
      });
      return;
    }

    const userMessage: Message = { role: 'user', content: message };
    set({ messages: [...get().messages, userMessage], isSending: true });

    try {
      const response = await fetchProxy('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model,
          context: `Texte de la clause:\n"""${contextClause.text.slice(0, 4000)}"""`,
        }),
      });

      if (!response.ok) {
        let errDetail = `Erreur HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errDetail = errorData.detail || errorData.message || errDetail;
        } catch {}
        throw new Error(errDetail);
      }

      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      set({ messages: [...get().messages, assistantMessage] });
    } catch (error) {
      const errorMessage: Message = {
        role: 'error',
        content: error instanceof Error ? `Échec envoi: ${error.message}` : 'Une erreur inconnue est survenue.',
      };
      set({ messages: [...get().messages, errorMessage] });
    } finally {
      set({ isSending: false });
    }
  },
}));
