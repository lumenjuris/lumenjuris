import MainHeader from "../components/MainHeader/MainHeader"
import { useEffect, useState, useCallback } from "react";
import { useUserStore } from "../store/userStore";

import { fetchProxy } from "../utils/fetchProxy";
import { extractDocumentContent } from "../utils/documentExtractor";
import { TextInputZone } from "../components/ContractAnalysis/TextInputZone";
import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import { CONTRACT_GENERATING_TABS } from "../config/paramSettings";

const step = [
    { id: 1, label: "Votre société" },
    { id: 2, label: "Partie adverse" },
    { id: 3, label: "Projet" },
    { id: 4, label: "Délais" },
    { id: 5, label: "Pénalité" },
];


type Steps = {
    currentStep: number;
    totalSteps: number
}
function StepIndicator({ currentStep, totalSteps }: Steps) {
    console.log(totalSteps)
    return (
        <div className="flex items-center justify-between gap-0 mb-10">
            {step.map((step, i) => (
                <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${currentStep > step.id
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : currentStep === step.id
                                    ? "bg-white border-indigo-600 text-indigo-600"
                                    : "bg-white border-gray-300 text-gray-400"
                                }`}
                        >
                            {currentStep > step.id ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : step.id}
                        </div>
                        <span className={`mt-1 text-xs font-medium whitespace-nowrap transition-colors duration-300 ${currentStep >= step.id ? "text-indigo-600" : "text-gray-400"
                            }`}>{step.label}</span>
                    </div>
                    {i < totalSteps - 1 && (
                        <div className={`w-12 h-0.5 mb-5 mx-1 transition-all duration-500 ${currentStep > step.id ? "bg-indigo-600" : "bg-gray-200"
                            }`} />
                    )}
                </div>
            ))}
        </div>
    );
}



type Field = {
    label: string;
    name: string;
    value: string;
    onChange?: (name: string, value: string) => void;
    placeholder?: string
}
function FormField({ label, name, value, onChange, placeholder = "" }: Field) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={name} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {label}
            </label>
            <input
                type="text"
                id={name}
                name={name}
                value={value ?? ""}
                onChange={onChange ? (e) => onChange(name, e.target.value) : undefined}
                placeholder={placeholder ?? "—"}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                readOnly={!onChange}
            />
        </div>
    );
}

export function GenerationContract() {
    const contractAvailible = ["CDI", "CDD", "NDA"];

    const userStored = useUserStore();
    const enterpriseStored = userStored.userData?.enterprise;
    const userDataStored = userStored.userData?.profile
    console.log(userDataStored)



    const [form, setForm] = useState(false);
    const [renderSection, setRenderSection] = useState<"static" | "import" | "ia">("static")
    const [contractType, setContractType] = useState("");
    const [currentStep, setCurrentStep] = useState(1);

    const [isProcessing, setIsProcessing] = useState(false)

    const [formData, setFormData] = useState({
        partie_1_capital: "",
        partie_1_ville: "",
        partie_1_rcs_ville: "",
        partie_1_representant: "",
        partie_1_qualite: "",

        partie_2_nom: "",
        partie_2_forme_juridique: "",
        partie_2_capital: "",
        partie_2_code_postal: "",
        partie_2_ville: "",
        partie_2_rcs_ville: "",
        partie_2_siren: "",
        partie_2_representant: "",
        partie_2_qualite: "",

        description_projet: "",

        delai_confirmation_orale: "",
        delai_notification_confidentialite: "",
        delai_restitution: "",
        duree_accord: "",
        duree_obligations_post_accord: "",

        montant_penalite: "",
    });

    const handleChangeInputValue = (name: string | number, value: string | number) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const createContract = () => {
        console.log("contract created", formData);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep((s) => s - 1);
        else { setForm(false); setCurrentStep(1); }
    };

    const handleReturnContractChoice = () => setForm(false)

    const handleNext = () => {
        if (currentStep < step.length) setCurrentStep((s) => s + 1);
    };

    const [currentCredit, setCurrentCredit] = useState<number | null>(null)

    useEffect(() => {
        fetchProxy("/api/billing/subscription", {
            method: "GET",
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data?.credits) {
                    const { creditIncluded = 0, creditAdded = 0 } = data.data.credits;
                    setCurrentCredit(creditIncluded + creditAdded);
                } else {
                    setCurrentCredit(null);
                }
                console.log(currentCredit)
            })
            .catch(() => setCurrentCredit(null));
    }, [])



    const handleFileUpload = useCallback(
        async (file: File) => {
            console.log(file)
            //Récupérer le document et extraire son texte
            const contentFile = await extractDocumentContent(file)
            console.log(contentFile)
            const { text } = contentFile
            console.log(text)

            //Envoyer le texte à l'analyse ia pour savoi quelles sont les éléments qui dynamique du contrat pour en faire un template
            const resOpenai = await fetchProxy("/openai-chat", {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({
                    messages: "Quels sont les éléments liées aux parties qui pourraient être non statique sur plusieurs contrat de ce type",
                    model: "gpt-4o",
                    temperature: 0.2,
                    max_tokens: 1000,
                    response_format: 'json'
                })
            })
            const data = await resOpenai.json()
            console.log(data)
            //

            setIsProcessing(false)
        },
        [isProcessing],
    );












    // --- Contract selection screen ---
    if (!form) {
        return (
            <div className="">
                <MainHeader />

                <aside className="w-fit">
                    <li>
                        <button onClick={() => setRenderSection("static")}>Generation statique</button>
                    </li>
                    <li>
                        <button onClick={() => setRenderSection("import")}>Generation via import</button>
                    </li>
                    <li>
                        <button onClick={() => setRenderSection("ia")}>Generation IA</button>
                    </li>
                </aside>



                {renderSection == "static" && (
                    <div className="min-h-full min-w-full bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
                        <div className="w-full max-w-md">
                            <h1 className="text-3xl font-bold text-gray-900 mb-1">Générer un contrat</h1>
                            <p className="text-gray-500 mb-8 text-sm">Choisissez le type de contrat à créer.</p>
                            <div className="flex flex-col gap-3">
                                {contractAvailible.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => { setForm(true); setContractType(c); setCurrentStep(1); }}
                                        className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:shadow-md active:scale-[0.99]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
                                                {c}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-gray-800">{
                                                    c === "CDI" ? "Contrat à Durée Indéterminée" :
                                                        c === "CDD" ? "Contrat à Durée Déterminée" :
                                                            "Accord de Confidentialité"
                                                }</p>
                                                <p className="text-xs text-gray-400">{
                                                    c === "CDI" ? "Embauche permanente" :
                                                        c === "CDD" ? "Mission temporaire" :
                                                            "Non-Disclosure Agreement"
                                                }</p>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Zone input file*/}

                {renderSection == "import" && (
                    <>
                        <TextInputZone
                            onFileUpload={(e) => {
                                setIsProcessing(true)
                                handleFileUpload(e)
                            }}
                            onTextSubmit={(e) => console.log(e)}
                            isProcessing={false}
                            analyseCredit={1000/* currentCredit */}
                        />
                    </>
                )}

                {renderSection == "ia" && (
                    <>
                        <div>
                            <h2>Générez vous contrat à partir d'ia</h2>

                        </div>
                    </>
                )

                }
            </div>
        )
    }













    // --- NDA multi-step form ---
    return (
        <>
            <MainHeader />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
                <div className="w-full max-w-xl">

                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={handleReturnContractChoice}
                            className="flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-4"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>


                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{contractType}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Formulaire de contrat</h1>
                    </div>


                    {/* Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                        {/* Step indicator */}
                        <StepIndicator currentStep={currentStep} totalSteps={step.length} />

                        <h2 className="text-lg font-bold text-gray-800 mb-6">{step[currentStep - 1].label}</h2>

                        {/* Step 1 — Votre société */}
                        {currentStep === 1 && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Nom" name="partie_1_nom" value={enterpriseStored?.name ?? ""} placeholder="Désignation entreprise" />
                                <FormField label="Forme juridique" name="partie_1_forme_juridique" value={enterpriseStored?.statusJuridique ?? ""} />
                                <FormField label="Capital (€)" name="partie_1_capital" value={formData.partie_1_capital} onChange={handleChangeInputValue} placeholder="Ex : 10 000" />
                                <FormField label="Code postal" name="partie_1_code_postal" value={enterpriseStored?.address?.codePostal ?? ""} />
                                <FormField label="Ville" name="partie_1_ville" value={formData.partie_1_ville} onChange={handleChangeInputValue} placeholder="Paris" />
                                <FormField label="Ville RCS" name="partie_1_rcs_ville" value={formData.partie_1_rcs_ville} onChange={handleChangeInputValue} placeholder="Paris" />
                                <FormField label="SIREN" name="partie_1_siren" value={enterpriseStored?.siren ?? ""} placeholder="" />
                                <FormField label="Représentant" name="partie_1_representant" value={formData.partie_1_representant} onChange={handleChangeInputValue} placeholder="Prénom Nom" />
                                <FormField label="Qualité" name="partie_1_qualite" value={formData.partie_1_qualite} onChange={handleChangeInputValue} placeholder="Gérant, PDG…" />
                                <FormField label="Désignation" name="partie_1_designation" value="Partie divulgatrice" placeholder="" />
                            </div>
                        )}

                        {/* Step 2 — Partie adverse */}
                        {currentStep === 2 && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Nom" name="partie_2_nom" value={formData.partie_2_nom} onChange={handleChangeInputValue} />
                                <FormField label="Forme juridique" name="partie_2_forme_juridique" value={formData.partie_2_forme_juridique} onChange={handleChangeInputValue} />
                                <FormField label="Capital (€)" name="partie_2_capital" value={formData.partie_2_capital} onChange={handleChangeInputValue} />
                                <FormField label="Code postal" name="partie_2_code_postal" value={formData.partie_2_code_postal} onChange={handleChangeInputValue} />
                                <FormField label="Ville" name="partie_2_ville" value={formData.partie_2_ville} onChange={handleChangeInputValue} />
                                <FormField label="Ville RCS" name="partie_2_rcs_ville" value={formData.partie_2_rcs_ville} onChange={handleChangeInputValue} />
                                <FormField label="SIREN" name="partie_2_siren" value={formData.partie_2_siren} onChange={handleChangeInputValue} />
                                <FormField label="Représentant" name="partie_2_representant" value={formData.partie_2_representant} onChange={handleChangeInputValue} />
                                <FormField label="Qualité" name="partie_2_qualite" value={formData.partie_2_qualite} onChange={handleChangeInputValue} />
                                <FormField label="Désignation" name="partie_2_designation" value="Partie réceptrice" />
                            </div>
                        )}

                        {/* Step 3 — Projet */}
                        {currentStep === 3 && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="description_projet" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Description du projet
                                    </label>
                                    <textarea
                                        id="description_projet"
                                        name="description_projet"
                                        rows={6}
                                        value={formData.description_projet}
                                        onChange={(e) => handleChangeInputValue("description_projet", e.target.value)}
                                        placeholder="Décrivez le projet ou la collaboration concernée par cet accord…"
                                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4 — Délais */}
                        {currentStep === 4 && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Délai confirmation orale (jours)" name="delai_confirmation_orale" value={formData.delai_confirmation_orale} onChange={handleChangeInputValue} placeholder="Ex : 5" />
                                <FormField label="Délai notification confidentialité (jours)" name="delai_notification_confidentialite" value={formData.delai_notification_confidentialite} onChange={handleChangeInputValue} placeholder="Ex : 15" />
                                <FormField label="Délai restitution (jours)" name="delai_restitution" value={formData.delai_restitution} onChange={handleChangeInputValue} placeholder="Ex : 30" />
                                <FormField label="Durée de l'accord (mois/ans)" name="duree_accord" value={formData.duree_accord} onChange={handleChangeInputValue} placeholder="Ex : 2 ans" />
                                <div className="col-span-2">
                                    <FormField label="Durée obligations post-accord" name="duree_obligations_post_accord" value={formData.duree_obligations_post_accord} onChange={handleChangeInputValue} placeholder="Ex : 1 an" />
                                </div>
                            </div>
                        )}

                        {/* Step 5 — Pénalité */}
                        {currentStep === 5 && (
                            <div className="flex flex-col gap-4">
                                <FormField label="Montant de la pénalité (€)" name="montant_penalite" value={formData.montant_penalite} onChange={handleChangeInputValue} placeholder="Ex : 50 000" />
                                <p className="text-xs text-gray-400 mt-1">Ce montant sera appliqué en cas de violation de l'accord de confidentialité.</p>
                            </div>
                        )}

                        {/* Navigation buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                            <button
                                onClick={handleBack}
                                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 active:scale-95"
                            >
                                ← Précédent
                            </button>

                            {currentStep < step.length ? (
                                <button
                                    onClick={handleNext}
                                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                                >
                                    Suivant →
                                </button>
                            ) : (
                                <button
                                    onClick={createContract}
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                                >
                                    ✓ Valider et générer
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress text */}
                    <p className="text-center text-xs text-gray-400 mt-4">
                        Étape {currentStep} sur {step.length}
                    </p>
                </div>
            </div>
        </>
    );
}