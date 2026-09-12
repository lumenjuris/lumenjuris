import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";
import { formatDate } from "../../utils/format/formatDate";
import {
  BANNER_MESSAGE_TYPES,
  BannerApiResponse,
  BannerMessage,
  BannerMessageType,
  BannerStatus,
  getBannerStatus,
} from "../../types/messageBanner";

/** Valeurs du formulaire : les dates restent au format `yyyy-mm-dd` des `<input type="date">`. */
interface BannerFormValues {
  messageType: BannerMessageType;
  title: string;
  content: string;
  /** Vide = pas de bouton « En savoir plus » sur le bandeau. */
  link: string;
  startAt: string;
  endAt: string;
}


const EMPTY_FORM: BannerFormValues = {
  messageType: "information",
  title: "",
  content: "",
  link: "",
  startAt: new Date().toISOString().split("T")[0],
  endAt: "",
};

const STATUS_STYLE: Record<BannerStatus, { label: string; className: string }> = {
  actif: { label: "Actif", className: "bg-green-100 text-green-700" },
  programme: { label: "Programmé", className: "bg-blue-100 text-blue-700" },
  expire: { label: "Expiré", className: "bg-gray-100 text-gray-600" },
};

/** Libellé lisible d'une catégorie, avec repli sur la valeur brute. */
function getTypeLabel(messageType: BannerMessageType): string {
  return BANNER_MESSAGE_TYPES.find((type) => type.value === messageType)?.label ?? messageType;
}

/** Retourne le premier problème bloquant du formulaire, ou `null` si tout est bon. */
function getFormError(form: BannerFormValues): string | null {
  if (!form.title.trim()) return "Le titre est obligatoire.";
  if (!form.content.trim()) return "Le message est obligatoire.";
  if (!form.startAt) return "La date de début est obligatoire.";
  if (!form.endAt) return "La date de fin est obligatoire.";
  if (new Date(form.endAt) < new Date(form.startAt)) {
    return "La date de fin doit être postérieure à la date de début.";
  }
  return null;
}

/**
 * Onglet « Message Banner » du monitoring : création et consultation des
 * messages affichés dans le bandeau d'accueil (`InfoBanner`).
 */
export function MessageBanner() {
  const [messages, setMessages] = useState<BannerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<BannerFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /** Id du message en cours de suppression, pour ne bloquer que sa carte. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // --- API ---
  const loadMessages = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchProxy("/api/admin/message-banner", { method: "GET" })
      .then((r) => r.json())
      .then((response: BannerApiResponse) => {
        setMessages(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error("Erreur lors de la récupération des messages du bandeau :\n", err);
        setLoadError("Impossible de charger les messages du bandeau.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handlePostBannerMessage = () => {
    const error = getFormError(form);
    setSuccessMessage(null);
    setFormError(error);
    if (error) return;

    setSubmitting(true);
    fetchProxy("/api/admin/message-banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageType: form.messageType,
        title: form.title.trim(),
        content: form.content.trim(),
        link: form.link.trim() || false,
        // `<input type="date">` renvoie "2026-09-17" : on borne le début au
        // tout début du jour et la fin à la toute fin du jour, pour que la
        // date de fin choisie soit bien incluse dans la diffusion.
        startAt: new Date(`${form.startAt}T00:00:00.000Z`).toISOString(),
        endAt: new Date(`${form.endAt}T23:59:59.999Z`).toISOString(),
      }),
    })
      .then((r) => r.json())
      .then((response: BannerApiResponse) => {
        if (!response.success) {
          setFormError(response.message ?? "La création du message a échoué.");
          return;
        }
        setForm(EMPTY_FORM);
        setSuccessMessage("Message ajouté au bandeau d'accueil.");
        loadMessages();
      })
      .catch((err) => {
        console.error("Erreur lors de la création du message du bandeau :\n", err);
        setFormError("Une erreur est survenue lors de l'envoi du message.");
      })
      .finally(() => setSubmitting(false));
  };

  const handleDeleteBannerMessage = (message: BannerMessage) => {
    if (!window.confirm(`Supprimer définitivement le message « ${message.title} » ?`)) return;

    setDeleteError(null);
    setDeletingId(message.id);
    fetchProxy(`/api/admin/message-banner/${encodeURIComponent(message.id)}`, {
      method: "DELETE",
    })
      .then((r) => r.json())
      .then((response: BannerApiResponse) => {
        if (!response.success) {
          setDeleteError(response.message ?? "La suppression du message a échoué.");
          return;
        }
        // Le backend renvoie la liste restante : on évite un aller-retour de plus.
        setMessages(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error("Erreur lors de la suppression du message du bandeau :\n", err);
        setDeleteError("Une erreur est survenue lors de la suppression du message.");
      })
      .finally(() => setDeletingId(null));
  };

  const wrapperInputStyle = "flex w-full flex-col gap-1";
  const labelStyle = "text-xs font-medium text-gray-600";
  const inputStyle =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="space-y-8">
      {/* Formulaire de création */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Créer un nouveau message</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">
          Le message s'affiche automatiquement dans le bandeau d'accueil entre les deux dates choisies.
        </p>

        <form className="grid gap-4 sm:grid-cols-2">
          <div className={wrapperInputStyle}>
            <label className={labelStyle} htmlFor="messageType">Type de message</label>
            <select
              className={inputStyle}
              name="messageType"
              id="messageType"
              value={form.messageType}
              onChange={(event) =>
                setForm({ ...form, messageType: event.target.value as BannerMessageType })}
            >
              {BANNER_MESSAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className={wrapperInputStyle}>
            <label className={labelStyle} htmlFor="title">Titre</label>
            <input
              className={inputStyle}
              type="text"
              id="title"
              name="title"
              placeholder="Négociation collaborative disponible"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className={`${wrapperInputStyle} sm:col-span-2`}>
            <label className={labelStyle} htmlFor="content">Message</label>
            <textarea
              className={inputStyle}
              name="content"
              id="content"
              rows={3}
              placeholder="Invitez la partie adverse à commenter vos clauses directement dans Lumen Juris."
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
          </div>

          <div className={`${wrapperInputStyle} sm:col-span-2`}>
            <label className={labelStyle} htmlFor="link">
              Lien du bouton « En savoir plus » <span className="text-gray-400">(optionnel)</span>
            </label>
            <input
              className={inputStyle}
              type="text"
              id="link"
              name="link"
              placeholder="liens vers la page d'information"
              value={form.link}
              onChange={(event) => setForm({ ...form, link: event.target.value })}
            />
          </div>

          <div className={wrapperInputStyle}>
            <label className={labelStyle} htmlFor="startAt">Commence le</label>
            <input
              className={inputStyle}
              type="date"
              id="startAt"
              name="startAt"
              value={form.startAt}
              onChange={(event) => setForm({ ...form, startAt: event.target.value })}
            />
          </div>

          <div className={wrapperInputStyle}>
            <label className={labelStyle} htmlFor="endAt">Finit le</label>
            <input
              className={inputStyle}
              type="date"
              id="endAt"
              name="endAt"
              value={form.endAt}
              onChange={(event) => setForm({ ...form, endAt: event.target.value })}
            />
          </div>
        </form>

        {formError && <p className="mt-4 text-sm font-medium text-red-600">{formError}</p>}
        {successMessage && <p className="mt-4 text-sm font-medium text-green-600">{successMessage}</p>}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={submitting}
            className="flex items-center gap-2 rounded-full bg-blue-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            onClick={handlePostBannerMessage}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Ajout en cours…" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Liste des messages existants */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tous les messages</h2>
          <p className="mt-1 text-sm text-gray-500">
            Consultez et gérez les messages actuellement configurés.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des messages…
          </div>
        )}

        {loadError && <p className="text-sm font-medium text-red-600">{loadError}</p>}

        {deleteError && <p className="text-sm font-medium text-red-600">{deleteError}</p>}

        {!loading && !loadError && messages.length === 0 && (
          <p className="text-sm text-gray-500">Aucun message configuré pour le moment.</p>
        )}

        <div className="grid gap-2">
          {messages.map((message) => {
            const status = STATUS_STYLE[getBannerStatus(message)];

            return (
              <div
                key={message.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* En-tête */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{message.title}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {getTypeLabel(message.messageType)}
                    </p>
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                {/* Contenu */}
                <div className="space-y-4 px-5 py-5">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Contenu
                    </p>
                    <p className="text-sm leading-6 text-gray-700">{message.content}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500">Commence le</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {formatDate(message.startAt)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500">Finit le</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {formatDate(message.endAt)}
                      </p>
                    </div>
                  </div>

                  {message.link && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Adresse liée
                      </p>
                      <p className="text-sm text-gray-700">{message.link}</p>
                    </div>
                  )}
                </div>

                {/* Pied de carte */}
                <div className="flex items-center justify-end border-t border-gray-100 bg-gray-50 px-5 py-3">
                  <button
                    type="button"
                    disabled={deletingId === message.id}
                    onClick={() => handleDeleteBannerMessage(message)}
                    className="flex items-center gap-2 text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {deletingId === message.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {deletingId === message.id ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
