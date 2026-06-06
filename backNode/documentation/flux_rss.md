# Veille RSS – Législation de l'emploi

Quelques flux identifiés pour suivre l'évolution du droit du travail.

---


## Legifrss — miroir RSS de Légifrance
https://legifrss.org/latest

Légifrance, le site officiel des textes de loi français, ne propose pas de flux RSS nativement. Legifrss est un outil open source non officiel qui comble ce manque. Il renvoie les mêmes données.

Filtrage par URL. On peut construire exactement le flux dont on a besoin :

```
# Toutes les nouvelles lois
https://legifrss.org/latest?nature=loi

# Lois qui mentionnent "salarié"
https://legifrss.org/latest?nature=loi&q=salarié

# Lois qui mentionnent "emploi"
https://legifrss.org/latest?nature=loi&q=emploi
```

Le paramètre `nature=` accepte aussi `decret`, `ordonnance`, etc. Le paramètre `q=` filtre par mot-clé dans le titre du texte.

---

## Sénat — derniers textes
https://www.senat.fr/rss/textes.rss

Flux officiel du Sénat. Il liste les propositions de loi, projets et rapports au fil de leur dépôt ou adoption. Couvre toutes les matières sans distinction, donc il faut filtrer côté agrégateur avec des mots-clés comme `travail`, `emploi`, `licenciement`, `retraite`, etc.

L'intérêt principal est de repérer les textes en cours d'examen, avant qu'ils ne soient adoptés, utile pour anticiper les évolutions à venir.

---

## Assemblée nationale — documents parlementaires
http://www2.assemblee-nationale.fr/feeds/detail/documents-parlementaires

Même logique que le Sénat, mais pour  l'Assemblée nationale. Volume est plus élevé (projets, propositions, amendements, rapports…). Les deux flux ensemble donnent une vision complète du processus de réforme du droit du travail.

---

## Juricaf — jurisprudence francophone
https://juricaf.org/recherche/+/facet_pays:France?format=rss

Base de jurisprudence gérée par l'association des hautes juridictions de cassation des pays francophones. On affine ses filtres sur le site (pays, juridiction, mots-clés), puis on génère le flux RSS directement depuis le site.


---


## Légavox
https://www.legavox.fr/rss/

Portail juridique communautaire avec un flux dédié au droit du travail. Flux semblant cassé, à surveiller.

---

## Legisocial
https://www.legisocial.fr/

Le seul flux payant de la liste Legisocial est une plateforme spécialisée en droit social : contrats de travail, paie, RH, hygiène et sécurité. Le contenu est rédigé et commenté par des professionnels, c'est ce qui justifie l'abonnement. À voir selon l'usage.

---
