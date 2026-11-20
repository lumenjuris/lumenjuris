import { Button } from "@base-ui/react";
import { useState } from "react"
import { X } from "lucide-react"
interface DescriptionSub {
    accueil: string;
    contratheque: string;
    generateurContractScratch: string;
    generateurContractModel: string;
    negocitation: string;
    signature: string;
    bibliothequeClause: string;
    playbook: string;
    analyseClassique: string;
    analysePlaybook: string;
    chat: string;
}

const textDescription = (c: DescriptionToolName): string => {

    const text: DescriptionSub = {
        accueil: "Dans l'accueil vous retrouverez un apercu complet de votre compte",
        contratheque: "Rassemblez tout vos contrats dans la contrathèque, vous retrouvez un suivis complet de vos contrats et leurs échéances",
        generateurContractScratch: "Générez un contrat facilement, décrivez le type de contrat et repondez aux questions pour ",
        generateurContractModel: "Importez un contrat et à partir de celcui-ci transformez le en modèle réutilisable",
        negocitation: "Bonjour négociation",
        signature: "Bonjour signature",
        bibliothequeClause: "Bonjour biblio clauses",
        playbook: "Bonjour playbook",
        analyseClassique: "Bonjour analyzer for4",
        analysePlaybook: "Bonjour analyzer via playbook",
        chat: "Bonjour chat juridique",
    }

    return text[c]
}


type DescriptionToolName = "accueil"
    | "contratheque"
    | "generateurContractScratch"
    | "generateurContractModel"
    | "negocitation"
    | "signature"
    | "bibliothequeClause"
    | "playbook"
    | "analyseClassique"
    | "analysePlaybook"
    | "chat"


export const OnboardingTooltip = ({ activeDescription = "contratheque" }: { activeDescription: DescriptionToolName }) => {


    const currentText = textDescription(activeDescription)
    const [displayed, setDisplayed] = useState<boolean>(true)

    return displayed && (
        <div className="border-2 border-blue-200 rounded-xl p-2 bg-white w-[300px] absolute translate-y-[-48px] translate-x-[230px]" >

            <span>
                {currentText}
            </span>

            <Button
                onClick={() => setDisplayed(false)}
                className="absolute top-1 right-1"
            >
                <X />
            </Button>

            {/* Flèche */}
            <div className="absolute top-4 -left-[10px] w-0 h-0
                border-y-[8px] border-y-transparent
                border-r-[10px] border-r-blue-200"
            />

            {/* Cache la moitié intérieure de la bordure */}
            <div className="absolute top-4 -left-[7px] w-0 h-0
                border-y-[7px] border-y-transparent
                border-r-[9px] border-r-white"
            />
        </div >
    )
}
