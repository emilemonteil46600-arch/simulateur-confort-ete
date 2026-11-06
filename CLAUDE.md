# CLAUDE.md — Simulateur de confort d'été

Ce fichier est lu automatiquement par Claude au début de chaque session sur ce dépôt.

## Le projet

**L'outil phare d'Émile**, apprenti ingénieur thermicien en bureau d'études (audits énergétiques de bâtiments
tertiaires et publics, STD Pléiades, RE2020). Un simulateur de confort d'été **rapide** (tester des variantes
en quelques minutes, comprendre ce qui pèse), en complément de Pléiades, à utiliser en audit et à montrer
(LinkedIn, CV, master). Il doit donc être **sérieux, sourcé et validé**.

- Site en ligne : https://emilemonteil46600-arch.github.io/simulateur-confort-ete/
  (GitHub Pages, branche `main`, dossier racine ; mise à jour 1 à 2 minutes après chaque fusion).
- Né le 02/11/2026 dans la **boîte à outils thermique** (projet `boite-a-outils-thermique`, autres outils d'Émile :
  chiffrage, ponts thermiques, dossier bâtiment). Devenu un **site à part** le 06/11/2026 (choix d'Émile).

**À lire avant tout travail : `docs/CAHIER-DES-CHARGES.md`** (périmètre, entrées, moteur, météo, indicateurs,
préconisations, validation, découpage en 8 étapes).

## RÈGLE N° 1 : Émile doit comprendre chaque étape

- **Une étape = une PR.** À la fin de chaque étape : la fiche `docs/etape-N.md` en français simple (ce qu'on calcule,
  pourquoi, formule, norme, exemple refait à la main, pièges, limites (H)), **3 questions** (réponses repliées),
  puis **on s'arrête et on attend l'accord d'Émile** avant l'étape suivante.
- Émile veut **tout comprendre, au niveau physique** : d'où vient chaque formule, le phénomène, le gradient,
  les équations aux dimensions. L'onglet Méthode est écrit **comme un cours**. Viser le plus complet possible.
- Il fait relire chaque étape par un autre modèle (Gemini) ; Claude revérifie aussi.
- Si une valeur de norme n'est pas vérifiable : la marquer **(H)** et le dire à Émile. **Ne jamais l'inventer.**
  Émile n'a pas accès aux textes des normes pour l'instant : sources publiques + physique + validations croisées.

## Règles de fond

1. **Trois onglets : Calcul · Méthode · Données** (+ « Comparer » plus tard si besoin).
2. **Aucun chiffre sans source** : source, date, statut `exemple` / `valide`. Avertissement tant qu'une valeur est en `exemple`.
3. **Hypothèses marquées (H)**, jamais cachées. **Fourchettes plutôt que fausse précision** ; on arrondit l'affichage, jamais le calcul.

## Règles techniques

- HTML, CSS, JavaScript **purs**. Pas de framework, pas de npm, pas de compilation. Marche en ouvrant `index.html`
  en file:// : données en fichiers `.js` qui remplissent une variable globale, pas de fetch.
- Structure :
  ```
  index.html                  le simulateur (onglets Calcul · Méthode · Données)
  commun/commun.js, style.css COPIE du code commun de la boîte à outils (objet BAO : stockage, sauvegarde complète,
                              nombres FR, onglets, sections repliables, calculs enregistrés, Teste-toi, lexique).
                              Seules différences : BAO.CLES_DONNEES et le texte de la carte « Mes données ».
  calcul/                     LE COURS, en chapitres, fonctions pures commentées en français, module.exports pour Node :
    calcul.js                 le sommaire (ConfortCalcul)
    calcul-parois.js          ch. 1 : U, masse, δ, matrices ISO 13786, κ, inertie du local (fait)
    calcul-soleil.js          ch. 2 : météo, soleil, apports (étape 2)
    calcul-5r1c.js            ch. 3 : modèle horaire (étape 3) …
  affichage/                  interface.js (AUCUN calcul), schemas.js et graphiques.js (SVG, AUCUN calcul),
                              exercices.js (Teste-toi ; la bonne réponse vient TOUJOURS de calcul/)
  donnees/                    données PUBLIQUES d'exemple (confort-materiaux.js, lexique.js, météo à venir)
  docs/                       cahier des charges et fiches d'étape
  tests/*.test.js             node --test ; tests/navigateur.js (Playwright, à la main)
  ```
- Graphiques : SVG faits main, une seule échelle verticale par graphique, couleurs `--gr-1` / `--gr-2`
  (vérifiées daltonisme, clair et sombre), référence en gris pointillé, survol avec bulle.
- Tout en **français** (interface au tutoiement, commentaires, commits). Nombres via `BAO.nombre` / `BAO.lireNombre`.
- Aucune barre de défilement horizontale à 390 px ; thème clair et sombre.

## Données et confidentialité

- Dépôt **public** : jamais de données clients, de vrais prix ni de noms de dossiers d'Argetec. Les résultats Pléiades
  d'Émile (étape 7) restent **en local**, sauf accord explicite.
- Les données d'Émile vivent dans le `localStorage`. Le site est sur la même origine que la boîte à outils
  (emilemonteil46600-arch.github.io) : les deux sites **partagent le même stockage** (utile à l'étape 5 pour lire
  les ratios du chiffrage `bao.chiffrage.biblio.v1`), d'où le préfixe `bao.confort.*`.
- Clés (ne **jamais** les renommer sans migration) : `bao.confort.paroi.v1`, `bao.confort.parois.v1`,
  `bao.confort.local.v1`, `bao.confort.materiaux.v1`, `bao.confort.reglages.v1` ; `bao.confort.onglet` (affichage).
  Toute nouvelle clé de données va dans `BAO.CLES_DONNEES` (vérifié par `tests/commun.test.js`).
- Sauvegarde complète et restauration : onglet Données › « Mes données ».

## Vérifications avant de publier

1. `node --test` (les mêmes tests tournent sur GitHub à chaque PR). Exemples vérifiés :
   - béton 20 cm seul (Rsi 0,13, Rse 0,04) → U = **3,892**, δ = 0,1658 m, ξ = 1,206, |Y12| = **2,185**, Δt = **5,09 h**,
     f = 0,56, κ1 ≈ **85,4 kJ/(m²·K)** ;
   - béton 20 + laine 12 : ITE κ1 85 / ITI 14 kJ/(m²·K), même U ≈ 0,27 ;
   - matrices de transfert = différences finies à moins de 0,5 % (en pratique < 0,1 %) ;
   - local d'exemple 20 m² → Cm = 4,11 MJ/K, Am = 54,7 m², 205,7 kJ/(m²·K) → classe « Moyenne » ;
   - Teste-toi : 40 tirages par exercice.
2. `node tests/navigateur.js` : aucune erreur console, 390 px clair / sombre, exemples à l'écran, sauvegarde / restauration.
3. Si un exemple de Méthode change : mettre à jour **en même temps** la Méthode, le test, la fiche et ce fichier.

## Comment travailler avec Émile

- Il dicte souvent à la voix : fautes et mots coupés, à interpréter sans le faire remarquer.
- Réponses courtes, directes, visuelles (tableaux). Toutes les questions dans un seul message, avec des options.
- Lui expliquer le **pourquoi** des formules.

## État au 06/11/2026

| Étape | État |
|---|---|
| 0. Plan | Fait (`docs/etape-0.md`). |
| 1. Parois | **Fait, en attente de l'accord d'Émile.** 23 matériaux et 13 parois d'exemple, U, masse, δ, matrices ISO 13786 → \|Y12\|, f, Δt, Y11, κ1, κ2, coupe SVG avec l'onde, journée chaude (2 graphiques), « Retourner la paroi », parois enregistrées et comparées, inertie du local (Cm, Am, classe ISO 13790 (H)), Méthode-cours en 15 sections, 5 exercices, 26 mots de lexique. Validé par différences finies. |
| 2 à 7 | À faire, dans l'ordre du cahier des charges. Choix météo (étape 0) : PVGIS, 7 villes, 1er mai → 30 sept., canicule 2019 / 2022 si disponible, licence à vérifier (H). |
