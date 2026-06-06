




export function StatiqueContract() {



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