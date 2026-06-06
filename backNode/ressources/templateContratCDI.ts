/**
* Template de base d'un contrat CDI.
* Tous les champs dynamiques sont remplacés par des placeholders {{VARIABLE}}.
*
*
*{{ETABLISSEMENT_NAME}}
*{{ETABLISSEMENT_ADRESS}}
*
*{{EMBAUCHE_DATE_START}}
*
*{{DELAY_PERIODE_ESSAIS}}
*{{MAX_DELAY_PERIODE_ESSAIS}}
*
*{{NUMBER_HOUR_WEEK}}
*/


type enterpriseDTO = {
    RAISON_SOCIAL: string
    ADRESS_ENTERPRISE: string
    URSAAF_SIREN: string
}

type signataireDTO = {
    SIGNATAIRE_FIRSTNAME: string
    SIGNATAIRE_LASTNAME: string
    SIGNATAIRE_FUNCTION: string
}

type salarieDTO = {
    SALARIE_FIRSTNAME: string
    SALARIE_LASTNAME: string
    SALARIE_ADRESS: string
    SALARIE_FUNCTION: string
}

type prevoyanceDTO = {
    HAS_PREVOYSANCE: boolean
    PREVOYANCE_NAME: string | null
    PREVOYANCE_ADRESS: string | null
}

type rgpdDTO = {
    ENABLE_RGPD: boolean
    RGPD_CONTACT_NAME: string
    RGPD_CONTACT_EMAIL: string
    RGPD_CONTACT_ADRESS: string | null
}

type institutionDTO = {
    INSTITUTION_ADRESS: string
    INSTITUTION_NAME: string
}

type perdiodeEssaisDTO = {
    DELAY_PERIODE_ESSAIS: string
    DELAY_MAX_PERIODE_ESSAIS: string
}


export const templateContratCDI = (
    enterpriseData: enterpriseDTO,
    insitutionData: institutionDTO,
    signataireData: signataireDTO,
    salarieData: salarieDTO,
    prevoyanceData: prevoyanceDTO,
    rgpd: rgpdDTO,
    periodeEssais: perdiodeEssaisDTO,
    conventionCollectiveName: string,
    embaucheDateStart: string,
    numberHoursWeek: string | number,
    signatureLocalisation: string,
) => {

    const date = new Date()
    const today = date.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    })

    return `
CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE (CDI)

Entre les soussignés :

La société ${enterpriseData.RAISON_SOCIAL},
située à ${enterpriseData.ADRESS_ENTERPRISE},
immatriculée à l’Urssaf/MSA sous le numéro ${enterpriseData.ADRESS_ENTERPRISE},

représentée par ${signataireData.SIGNATAIRE_FIRSTNAME + " " + signataireData.SIGNATAIRE_LASTNAME},
agissant en qualité de ${signataireData.SIGNATAIRE_FUNCTION},

ci-après dénommée « l’entreprise »,

D’une part,

ET

${salarieData.SALARIE_FIRSTNAME + " " + salarieData.SALARIE_LASTNAME},
demeurant à ${salarieData.SALARIE_ADRESS},

ci-après dénommé(e) « le salarié »,

D’autre part,

Il a été convenu ce qui suit :



ARTICLE 1 — OBJET DU CONTRAT\n\n

Le salarié est recruté par l’entreprise en qualité de ${salarieData.SALARIE_FUNCTION},
au coefficient hiérarchique « coefficient »
ou selon la classification « classification »
de la convention collective : ${conventionCollectiveName}




ARTICLE 2 — LIEU DE TRAVAIL\n\n
Le salarié exercera ses fonctions au sein de l’établissement :
${insitutionData.INSTITUTION_NAME}

situé à l’adresse suivante :

${insitutionData.INSTITUTION_ADRESS}

En fonction des nécessités de service, le salarié pourra être amené à effectuer des déplacements professionnels.





ARTICLE 3 — DATE D’EMBAUCHE\n\n


Le présent contrat prend effet à compter du :
${embaucheDateStart}

Le contrat est conclu pour une durée indéterminée.






ARTICLE 4 — PÉRIODE D’ESSAI\n\n

Le présent contrat prévoit une période d’essai de :
${periodeEssais.DELAY_PERIODE_ESSAIS}

Cette période pourra être renouvelée, avec l’accord du salarié,
dans la limite maximale de :
${periodeEssais.DELAY_MAX_PERIODE_ESSAIS}

Il pourra être mis fin à la période d’essai conformément aux dispositions légales et conventionnelles applicables.







ARTICLE 5 — DURÉE DU TRAVAIL\n\n


Le salarié exercera ses fonctions dans le cadre d’un contrat à temps complet.

Il est soumis à l’horaire collectif applicable au sein de l’entreprise.

La durée hebdomadaire de travail est fixée à :

${numberHoursWeek} heures.





ARTICLE 6 — RÉMUNÉRATION\n\n

En contrepartie de son travail, le salarié percevra une rémunération brute
« mensuelle / annuelle » de :

« rémunération en euros »

correspondant au salaire de base ainsi qu’au taux horaire applicable.

Le cas échéant, pourront s’ajouter :
- des primes,
- des avantages en nature,
- une rémunération variable,
conformément aux dispositions internes applicables dans l’entreprise.







ARTICLE 7 — CONGÉS PAYÉS\n\n


Le salarié bénéficiera des congés payés dans les conditions prévues
par les dispositions légales et conventionnelles en vigueur.






${prevoyanceData.HAS_PREVOYSANCE
            ? `
ARTICLE 8 — PROTECTION SOCIALE ET PRÉVOYANCE \n\n

Le salarié sera affilié aux organismes de retraite complémentaire
et de protection sociale applicables au sein de l’entreprise.

Le régime de prévoyance est assuré par :
${prevoyanceData.PREVOYANCE_NAME}

Adresse :
${prevoyanceData.PREVOYANCE_ADRESS}`
            : " "}




ARTICLE 9 — CONVENTION COLLECTIVE\n\n


Le présent contrat est soumis à la convention collective suivante :

${conventionCollectiveName}





${rgpd.ENABLE_RGPD ? `
    ARTICLE 10 — PROTECTION DES DONNÉES PERSONNELLES (RGPD)\n\n

Dans le cadre de l’exécution du présent contrat de travail,
l’entreprise est amenée à collecter et traiter des données personnelles
concernant le salarié.

Ces traitements sont réalisés conformément aux dispositions du
Règlement Général sur la Protection des Données (RGPD)
et à la législation française applicable en matière de protection des données.

Les données collectées ont pour finalité notamment :
- la gestion administrative du personnel ;
- la gestion de la paie ;
- le suivi de la relation de travail ;
- l’exécution des obligations légales et réglementaires de l’employeur.

Les données personnelles du salarié sont accessibles uniquement
aux personnes habilitées dans le cadre de leurs fonctions,
ainsi qu’aux organismes légalement autorisés.

Les données sont conservées pendant la durée strictement nécessaire
à l’exécution du contrat de travail et au respect des obligations légales.

Le salarié dispose :
- d’un droit d’accès ;
- d’un droit de rectification ;
- d’un droit d’effacement ;
- d’un droit à la limitation du traitement ;
- d’un droit d’opposition ;
- ainsi que d’un droit à la portabilité de ses données,
dans les conditions prévues par la réglementation applicable.

Le salarié peut exercer ses droits en contactant :\n
${rgpd.RGPD_CONTACT_NAME}

à l’adresse suivante :\n
${rgpd.RGPD_CONTACT_EMAIL}

${rgpd.RGPD_CONTACT_ADRESS ? `ou par courrier à : \n ${rgpd.RGPD_CONTACT_ADRESS}` : " "}

Le salarié dispose également du droit d’introduire une réclamation
auprès de la Commission Nationale de l’Informatique et des Libertés (CNIL).` : " "}




--------------------------------------------------
SIGNATURES
--------------------------------------------------


Fait à ${signatureLocalisation},
le ${today},

En deux exemplaires originaux,
dont un remis au salarié.

Pour l’entreprise

Nom :
représentée par ${signataireData.SIGNATAIRE_FIRSTNAME + " " + signataireData.SIGNATAIRE_LASTNAME},

Fonction :
${signataireData.SIGNATAIRE_FUNCTION}

Signature :

Le salarié

Nom :
${salarieData.SALARIE_FIRSTNAME + " " + salarieData.SALARIE_LASTNAME},

Signature :`
}