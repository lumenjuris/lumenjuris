# TEST AVANT LA BETA

**Commencé le 26/08/26**

**FAIT Remettre le bouton Word, le bloquer en Freemium et mettre en hover Nécéssite un plan supérieur (Diminué le gap dans la modal).**
**Changer juste avec l'envoi URL pour le partage de doc dans l'analyse des risques**
**Dans la monitoring importer le détail d'activité des utilisateurs qui se trouve Activité sur Utilisateurs** 

## 1. Création de compte 
  ### 1.1 Formulaire d'inscription
    Observation : OK

  ### 1.2 Via Google
    Observation : OK

## 2. Générateur de contrat
 ### 2.1 Créer de zéro
    Observation: Longue durée pour la création d'un contrat.

### 2.2 Importer un modèle
    Observation: Longue durée pour la génération du contrat.
                 Le contenu du pdf ajouté peut n'avoir aucune relation avec le droit et il fera tout de même un modèle réutilisable.
                 Sur la page d'un modèle de contrat, les paranthèses et l'icone de liste à côté du bouton gras et itallique ne fonctionne pas.

### 2.3 Bibliothèques de modèles de contrat
    Observation: L'historique des contrats crées regroupent les contrats avec localStorage
   **Demander si changer le localStorage**
   **Il s'agit pas de contrat en BDD mais d'un localStorage. A changer ?**

## 3. Contrathèque 
  ### 3.1 Importer un contrat
    Observation : Lorsque l'on importe un document vide, un message d'erreur s'affiche (Unexpected token "I", "Internal S"... is not valid JSON),
    changer pour un message générique
  **FAIT**

  ### 3.2 Télécharger le contrat
    Observation: Sur le pdf lorsque l'utilisateur est en Betatesteur, le filigrane LumenJuris est présent sur le contrat.
                    Après test le filigrane ne s'affiche plus peu importe le plan. (Déclenchement: Peut-être le fait de changer les plans de l'utilisateur ?)
**FAIT : Si le temps aller voir**

  ### 3.3 Négocier
    Observation: OK

  ### 3.4 Supprimer
    Observation: OK

  ### 3.5 Exporter
    Observation: OK

  ### 3.6 Echéances
    Observation: OK


## 4. Négociation
  ### 4.1 Ajout via la contrathèque
    Observation: OK

  ### 4.2 Annotations
    Observation : OK

  ### 4.3 Participants & partage du lien
    Observation :
        1. Se situe à la fin de la page, les clients peuvent se demander comment faire pour partager le lien pour négocier. Il serait mieux qu'il soit situé en haut pour être visible directement et ne pas provoquer de confusion.

        2. Dans ajouter un participant, lorsque l'on ajoute un participant cela n'envoie pas de mail (est-ce voulu ? Cela peut être confus pour l'utilisateur sachant que lors du partage de lien cela envoie bien le mail avec le lien mais on ne peut pas choisir si il s'agit d'un Interne ou Externe et si il peut Commenter...)

  ### 4.4 Versions & comparaison
    Observation: Même remarque que pour les participants & partage de lien, cela serait mieux de le remonter pour qu'il soit directement visible par l'utilisateur. 

  ### 4.5 Nouveau Round 
    Observation : OK

  ### 4.6 Vers la signature
    Observation : OK

  ### 4.7 Choix de la version
    Observation : OK

  ### 4.8 Abandonner
    Observation : OK


## 5. Signature
  ### 5.1 Ajout des blocs de signature
    Observation : OK

  ### 5.2 Envoi du mail avec le contrat
    Observation : OK

  ### 5.3 Signature du 1er parti
    Observation :  OK

  ### 5.4 Signature du 2nd parti
    Observation : OK

  ### 5.5 Mail de confirmation de signature par les 2 partis
    Observation : OK

  ### 5.6 Ajout d'un nouveau contrat à signer
    Observation : OK


## 6. Analyse des risques

  ### 6.1 Importer un contrat
    Observation : OK

  ### 6.2 Risques détectés
    Observation : OK

  ### 6.3 Clauses suggérées
    Observation : OK

  ### 6.4 Relancer 
    Observation : OK

  ### 6.5 Partager
    Observation : Au clic, aucun indicateur visuel que le lien est dans le presse papier, de plus lorsque l'on colle le lien, on ne peut pas être redirigé vers le contrat (Erreur 431)

**En dernier: Commenter le bouton, puis implémenter l'autre version Partager qui fonctionne**


  ### 6.6 Export Word
    Observation : OK

  ### 6.7 Ajouter à la contrathèque
    Observation : OK

  ### 6.8 Réinitialiser tout
    Observation : OK


## 7. Bibliothèques de clause
  ### 7.1 Ajout d'une nouvelle clause
    Observation : OK

  ### 7.2 Modification / Edition d'une clause
    Observation : OK

  ### 7.3 Suppression d'une clause
    Observation : OK


## 8. Comprendre ses contrats
  ### 8.1 Analysez un contrat
    Observation : OK
