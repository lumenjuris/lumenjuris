import { Clock, CheckCircle, Send, FileText, PenTool } from "lucide-react";

const pendingDocs = [
  { name: "CDI – Marie Dupont",         date: "Envoyé le 28 fév. 2026", status: "En attente",           color: "bg-yellow-50 text-yellow-600"  },
  { name: "CDD – Lucas Martin",         date: "Envoyé le 27 fév. 2026", status: "Vu par le signataire", color: "bg-yellow-50 text-yellow-600"    },
  { name: "Avenant – Sophie Leroy",     date: "Envoyé le 25 fév. 2026", status: "En attente",           color: "bg-yellow-50 text-yellow-600"  },
  { name: "CDI – Thomas Bernard",       date: "Envoyé le 24 fév. 2026", status: "Signé partiellement",  color: "bg-yellow-50 text-yellow-600"},
];

export function Signature() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Signature</h1>
        <p className="text-sm text-gray-500 mt-1">Envoyez vos contrats à la signature et suivez leur avancement</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Clock,        label: "En attente",      value: "4",  iconClass: "bg-yellow-50 text-yellow-600" },
          { icon: CheckCircle,  label: "Signés",          value: "28", iconClass: "text-lumenjuris bg-lumenjuris/10" },
          { icon: Send,         label: "Envoyés ce mois", value: "6",  iconClass: "text-gray-400 bg-slate-100" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${k.iconClass} shrink-0`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              <p className="text-sm text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Liste des contrats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Contrats en attente de signature</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {pendingDocs.map((doc, i) => (
            <li key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                <FileText className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{doc.date}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${doc.color}`}>{doc.status}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Faire signer */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm flex flex-col items-center text-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lumenjuris/10">
          <PenTool className="h-6 w-6 text-lumenjuris" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Envoyer un contrat à la signature</p>
          <p className="text-xs text-gray-400 mt-1">Sélectionnez un document généré ou importez-en un</p>
        </div>
        <button className="bg-lumenjuris text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-lumenjuris-dark transition-colors">
          Nouveau envoi
        </button>
      </div>
    </div>
  );
}


