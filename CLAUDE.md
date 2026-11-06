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

## La vision d'Émile (07/11/2026) : surpuissant, très visuel, compris

- N'importe qui peut demander à une IA « ma maison a-t-elle un bon confort d'été ? » et recevoir une réponse
  approximative. Ce site doit faire **ce qu'un chatbot ne peut pas faire** : un vrai calcul physique heure par heure,
  validé, reproductible, chiffré, comparable entre variantes, et montré de façon **très visuelle et très propre**.
- **Pas d'IA intégrée.** La puissance vient de la physique, de la validation et de la transparence.
- Les leviers qui le distinguent : simulation horaire sur une vraie météo (8 760 h), soleil et ombres sur la maquette 3D,
  tous les indicateurs reconnus en même temps, note multicritère dont on voit chaque point, comparaison instantanée
  de variantes, analyse de sensibilité (« ce qui fait gagner le plus »), validation publiée (BESTEST, Pléiades),
  et le détail de chaque calcul à un clic.
- Le public visé n'est pas « le pélo qui pose une question » : c'est l'**ingénieur** (Émile, ses clients, un jury, LinkedIn).
- Toujours aussi important : **Émile comprend tout**. Plus tard : un document de synthèse complet (formules, processus,
  sources, choix) qu'il pourra faire expliquer dans une autre conversation. Les fiches `docs/etape-*.md` en sont la base :
  les garder complètes et à jour.

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
    calcul-batiment.js        ch. 1 bis : la maison — orientation, surfaces, volume, H = Σ U·A, inertie (fait)
    calcul-transitoire.js     ch. 1 ter : le labo — différences finies, schéma implicite, pièce libre (fait)
    calcul-soleil.js          ch. 2 : météo, soleil, apports (étape 2)
    calcul-5r1c.js            ch. 3 : modèle horaire (étape 3) …
  affichage/                  projet.js (onglet Projet : saisie simple + résultat, AUCUN calcul),
                              maison3d.js (maquette 3D SVG faite main : projection orthogonale, faces visibles n·c > 0),
                              interface.js (onglet Atelier parois, AUCUN calcul), schemas.js et graphiques.js (SVG),
                              labo.js (labo animé de l'atelier : mur en coupe, glisser-déposer, horloge ; AUCUN calcul),
                              exercices.js (Teste-toi ; la bonne réponse vient TOUJOURS de calcul/), site.css (style du site)
  donnees/                    données PUBLIQUES d'exemple (confort-materiaux.js, confort-projet.js : maison d'exemple,
                              usages, fenêtres Uw/g, protections ; lexique.js ; météo à venir)
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
- Clés (ne **jamais** les renommer sans migration) : `bao.confort.projet.v1` (la maison), `bao.confort.paroi.v1`, `bao.confort.parois.v1`,
  `bao.confort.local.v1`, `bao.confort.materiaux.v1`, `bao.confort.reglages.v1` (onde + types de fenêtres ; l'atelier et
  le projet y écrivent chacun leur partie : toujours relire avant d'écrire) ; `bao.confort.onglet` (affichage).
  Toute nouvelle clé de données va dans `BAO.CLES_DONNEES` (vérifié par `tests/commun.test.js`).
- Sauvegarde complète et restauration : onglet Données › « Mes données ».

## Vérifications avant de publier

1. `node --test` (les mêmes tests tournent sur GitHub à chaque PR). Exemples vérifiés :
   - béton 20 cm seul (Rsi 0,13, Rse 0,04) → U = **3,892**, δ = 0,1658 m, ξ = 1,206, |Y12| = **2,185**, Δt = **5,09 h**,
     f = 0,56, κ1 ≈ **85,4 kJ/(m²·K)** ;
   - béton 20 + laine 12 : ITE κ1 85 / ITI 14 kJ/(m²·K), même U ≈ 0,27 ;
   - matrices de transfert = différences finies à moins de 0,5 % (en pratique < 0,1 %) ;
   - local d'exemple 20 m² → Cm = 4,11 MJ/K, Am = 54,7 m², 205,7 kJ/(m²·K) → classe « Moyenne » ;
   - maison d'exemple 10 × 8, plain-pied, 2 pans 35°, combles perdus, A au Sud : h = 2,80 m, murs opaques 84,2 m²,
     fenêtres 13 m² (16 %), H = 25,48 + 18,20 + 9,06 + 26,38 = **79,1 W/K**, Cm = **9 314 kJ/K** → 116 kJ/(m²·K) « Légère » ;
     combles aménagés → rampants 80 / cos 35° = 97,7 m² ;
   - labo (différences finies, 5 mm, Δt 60 s, implicite) : retrouve |Y12| et Δt des matrices à < 1 % ; coup de chaud long →
     q = U × ΔT ; énergie conservée à 1e-9 ; béton 18 + PSE 14, 20 → 35 °C, pièce libre 50 m³ 0,5 vol/h :
     ITE 27,8 °C après 72 h (mi-chemin en 20,5 h) / ITI 35,0 °C (2 h) ; t ≈ e²/a : béton 20 cm ≈ 11 h ;
   - maquette 3D : caméra orthonormée et directe (r × h = c), Est à droite vu depuis le Sud (pas de miroir) ;
   - Teste-toi : 40 tirages par exercice.
2. `node tests/navigateur.js` : aucune erreur console, 390 px clair / sombre, exemples à l'écran, sauvegarde / restauration.
3. **Changer le numéro de version `?v=AAAAMMJJ`** de TOUS les scripts et feuilles de style dans `index.html` à chaque
   mise en ligne (un test vérifie qu'ils ont tous le même). Sinon le navigateur garde d'anciens fichiers en mémoire
   et la page reste vide (bug du 07/11/2026).
4. Si un exemple de Méthode change : mettre à jour **en même temps** la Méthode, le test, la fiche et ce fichier.

## Sessions et contexte (expliqué à Émile le 07/11/2026)

- Une conversation a une mémoire limitée (le « contexte ») ; quand elle se remplit, elle est résumée automatiquement.
  **Rien n'est perdu** : tout ce qui compte est dans le dépôt (code, ce fichier, `docs/etape-*.md`).
- Bonne pratique : **une nouvelle conversation par étape** (ou par gros chantier). Elle relit ce fichier au démarrage.
  En fin d'étape, toujours mettre à jour le tableau « État » ci-dessous et la fiche de l'étape.

## Comment travailler avec Émile

- Il dicte souvent à la voix : fautes et mots coupés, à interpréter sans le faire remarquer.
- Réponses courtes, directes, visuelles (tableaux). Toutes les questions dans un seul message, avec des options.
- Lui expliquer le **pourquoi** des formules.

## Interface (décisions d'Émile du 07/11/2026)

- Il trouvait la première version « moche » : il veut du **visuel**. Style « logiciel pro » clair : onglet **Projet** =
  saisie en 6 étapes à gauche, **maison en 3D** au centre (tourne à la souris, clic sur une façade / le toit),
  résultat à droite. L'atelier parois = onglet **expert**. Toujours garder le détail des calculs accessible.
- **Note de confort** (étape 4) : chaque indicateur (Givoni, DH, heures > 28 °C, adaptatif, PMV/PPD, nuits chaudes…)
  noté **sur 10** par un barème **continu** (droite entre bornes), × un **coefficient**, moyenne pondérée → note /10.
  Barèmes et coefficients fixés AVEC Émile, modifiables dans Données, note toujours affichée avec son détail.
- Il aime avoir **deux modes** : le global (projet, confort de la maison) et des **mini-simulations de test** très visuelles
  pour comprendre (le labo de l'atelier). Continuer dans cet esprit : chaque notion importante peut avoir son « labo ».
- Ordre : 1 bis (maison 3D) → 1 ter (labo animé) → 2 (météo + soleil sur la maquette) → 3 (5R1C) → 4 (indicateurs + note) → 5…7.

## État au 07/11/2026

| Étape | État |
|---|---|
| 0. Plan | Fait (`docs/etape-0.md`). |
| 1. Parois | **Fait, en attente de l'accord d'Émile.** 23 matériaux et 13 parois d'exemple, U, masse, δ, matrices ISO 13786 → \|Y12\|, f, Δt, Y11, κ1, κ2, coupe SVG avec l'onde, journée chaude (2 graphiques), « Retourner la paroi », parois enregistrées et comparées, inertie du local (Cm, Am, classe ISO 13790 (H)), Méthode-cours en 15 sections, 5 exercices, 26 mots de lexique. Validé par différences finies. |
| 1 bis. Maison 3D | **Fait, en attente de l'accord d'Émile** (il a reporté les 3 questions de l'étape 1). Refonte visuelle, onglet Projet (saisie 6 étapes, maquette 3D faite main, rose des fenêtres, H par poste, inertie de la maison, détail des calculs), 2 exercices, 2 mots de lexique, Méthode § 14 à 18. Fiche `docs/etape-1bis.md`. |
| 1 ter. Labo animé | **Fait, en attente de l'accord d'Émile** (demande du 07/11/2026 : « voir la température avancer dans le mur, puis dans la pièce »). Labo dans l'atelier (refait plus visuel le 07/11 : textures de matériaux, dégradé thermique, particules de flux, soleil / lune, horloge dans l'image, matériaux à glisser dans le mur, réglages repliés) : palette de couches, glisser-déposer, mur en coupe coloré par la température + courbe θ(x) + flèche de flux, horloge, coup de chaud / journées d'été, pièce climatisée / libre, graphique avec curseur, contrôle d'énergie. Méthode § 19, 1 exercice, 2 mots de lexique. Fiche `docs/etape-1ter.md`. |
| 2 à 7 | À faire, dans l'ordre du cahier des charges. Choix météo (étape 0) : PVGIS, 7 villes, 1er mai → 30 sept., canicule 2019 / 2022 si disponible, licence à vérifier (H). |
