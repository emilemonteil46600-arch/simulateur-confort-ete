# Cahier des charges — Simulateur de confort d'été (outil phare)

> **06/11/2026 : le simulateur a son propre site** (projet `simulateur-confort-ete`), séparé de la boîte à outils.
> Les mentions « carte sur l'accueil » et `outils/confort-ete/` ci-dessous valent pour ce site.

Rédigé le 02/11/2026 avec Émile (dans la boîte à outils thermique). À lire **en entier** avant toute ligne de code, avec `CLAUDE.md`
(dont toutes les règles s'appliquent : 3 onglets, aucun chiffre sans source, (H), JS pur, tests, français).

---

## 0. Pourquoi cet outil, et la règle n° 1

Émile fait ses études détaillées dans **Pléiades (STD)**. Ce simulateur ne cherche pas à le remplacer.
Il doit :
- **aller vite** : tester 10 variantes en 5 minutes avant de modéliser, ou répondre à un client en réunion ;
- **faire comprendre** : *pourquoi* il fait chaud, et quel levier pèse le plus ;
- **réunir tous les indicateurs de confort connus** dans une seule analyse, avec un score global et des préconisations ;
- devenir à terme **l'outil phare d'Émile** : utilisé dans ses audits et montrable (LinkedIn, CV, master).

**Règle n° 1 : Émile doit comprendre chaque étape.** On construit **étape par étape** (§ 9).
À la fin de chaque étape, tu **t'arrêtes**, tu écris une fiche de compréhension, et tu **attends son accord**
avant de passer à la suivante. Aucune formule « magique » : chaque calcul a sa norme, son exemple refait
à la main et ses limites (H).

---

## 1. Périmètre

| Choix | Valeurs |
|---|---|
| **Échelle** | **Pièce** (une zone, typiquement la plus défavorable : sous toiture, façade ouest…) ou **Bâtiment** (V1 : une zone moyennée ; multizone en V2 (H)) |
| **Usage** | **Logement** (occupation 24 h/24, nuit = sommeil) ou **Tertiaire** : bureaux, enseignement, petite enfance, salle polyvalente / ERP (scénarios d'occupation propres à chaque usage) |
| **Mode** | **Évolution libre** (sans climatisation) en V1. Option climatisation → besoins de froid en V2 |
| **Période** | Été (1er juin → 30 septembre) par défaut ; année complète possible |

---

## 2. Entrées (chacune avec valeur par défaut, source, statut exemple / validé)

Chaque entrée non saisie prend une **valeur par défaut** selon l'usage et l'époque, affichée avec son origine
(saisie / par défaut) et prise en compte dans un **indicateur de fiabilité**.

**Site et météo**
- Commune → zone climatique RE2020 (H1a … H3), altitude.
- Fichier météo horaire (§ 4). Scénarios : année type, **canicule**, **climat 2050** (V2).

**Géométrie**
- Surface, hauteur sous plafond, volume.
- Par orientation (N, NE, E, SE, S, SO, O, NO) : surface de mur et surface vitrée.
- Toiture (type et surface), plancher bas (terre-plein, vide sanitaire, local non chauffé), parois **mitoyennes / adiabatiques**.
- Mode pièce : position (sous toiture, étage intermédiaire, RDC).

**Parois, couche par couche** (le cœur de l'outil)
- Bibliothèque de matériaux : λ, ρ, c avec sources (NF EN ISO 10456, règles Th-U) — modifiable dans Données.
- Mur porteur : béton, parpaing, brique (pleine, creuse, monomur), pierre, ossature bois…
- Isolant : type, épaisseur, **position ITI / ITE / répartie**.
- Revêtements intérieurs, **couleur extérieure** (coefficient d'absorption α).
- Toiture (combles perdus, rampants, terrasse), plancher bas, **planchers intermédiaires et refends** (masse intérieure accessible).

**Vitrages et protections solaires**
- Surface par orientation, Uw, **facteur solaire g**, part vitrée, masques proches (débord, loggia, joues) et lointains (simplifiés (H)).
- Protections : BSO, volet roulant, store extérieur / intérieur, brise-soleil fixe → facteur de réduction **Fc / g tot**
  (NF EN ISO 52022-1, à vérifier) ; gestion manuelle, automatique (seuil d'ensoleillement), horaires.

**Ventilation et air**
- Débit hygiénique, type (simple flux, double flux avec ou sans bypass), infiltrations (perméabilité Q4Pa ou n50).
- **Free cooling / surventilation nocturne** : débit, plage horaire, condition « T ext < T int ».
- Ouverture des fenêtres (simple ou traversante) (H).
- **Brasseur d'air** : présence, vitesse d'air (m/s) → effet sur le PMV et sur les seuils du confort adaptatif.

**Apports internes et occupants**
- Occupants : nombre, activité (met), vêtements (clo).
- Équipements : PC, écrans, imprimantes (W par poste ou W/m²), **éclairage** (W/m²).
- Scénarios horaires par usage (sources à citer : RE2020 / Th-BCE, NF EN 16798-1, ISO 18523 (H)).

---

## 3. Moteur de calcul

**A. Parois (étape 1)**
- U (NF EN ISO 6946), capacité thermique surfacique.
- **Déphasage, amortissement, admittance** (NF EN ISO 13786, matrices de transfert).
- **Classe d'inertie** du local / bâtiment (règles Th-I ; capacité Cm de l'ISO 13790).
- Schéma de la paroi, et courbe de l'onde de température dehors / dedans sur 24 h.

**B. Modèle horaire V1 (étape 3)**
- Méthode horaire simplifiée **5R1C** (NF EN ISO 13790:2008 annexe C, reprise dans NF EN ISO 52016-1 (H : vérifier)).
- Rayonnement solaire sur chaque façade calculé à partir du direct et du diffus du fichier météo (modèle isotrope en V1 (H)).
- Sorties horaires : température d'air, **température radiante moyenne**, **température opérative**.

**C. Modèle V2 (étape 8)**
- Chaque paroi calculée **couche par couche** (différences finies) → température de surface intérieure réelle
  et déphasage « visible » heure par heure. Multizone (H).
- Calcul lourd → Web Worker si besoin.

---

## 4. Météo

- Fichiers horaires (température, humidité, rayonnement direct / diffus, vent).
- Sources possibles (H, licences à vérifier) : PVGIS TMY (Commission européenne), climate.onebuilding.org (EPW), fichiers météo RE2020.
- Règle du `CLAUDE.md` : le calcul doit marcher **sans réseau** (file://). On embarque donc quelques villes en fichiers
  `.js` (au minimum Perpignan, Pau, Bayonne, Toulouse, Bordeaux, Marseille, Paris). Le téléchargement d'une
  autre commune (PVGIS) reste optionnel et demande Internet.
- Canicule : une année réelle (2003, 2019 ou 2022 selon les données dispo) ; climat 2050 en V2 (H : méthode de morphing).

---

## 5. Indicateurs (tous, chacun expliqué dans la Méthode)

| Indicateur | Référence | Ce qu'il dit |
|---|---|---|
| Température opérative max / moyenne en occupation | — | Le pic et le niveau général |
| Heures d'occupation au-dessus de 26 / 27 / 28 °C | Usage courant (H) | La durée de l'inconfort |
| **Degrés-heures (DH)** | Méthode RE2020 (seuil adaptatif 26–28 °C, repères 350 / 1 250 °C·h — à vérifier) | Durée × intensité, référence réglementaire |
| **Confort adaptatif** | NF EN 16798-1 (T ext moyenne glissante, catégories I / II / III) | % d'heures dans chaque catégorie ; adapté aux bâtiments sans clim |
| **PMV / PPD** | NF EN ISO 7730 (Fanger) ; effet de la vitesse d'air (SET, ASHRAE 55) (H) | Sensation thermique et % d'insatisfaits |
| **Diagramme de Givoni** | Diagramme de l'air humide + zones de stratégies | Quelle stratégie marche ici : inertie, ventilation nocturne, brasseur, évaporation |
| Nuits chaudes | T opérative > 26 °C la nuit (logement) (H) | Qualité du sommeil |
| **Score global / 100** | Combinaison **transparente** des indicateurs normalisés, pondérations modifiables dans Données | Une note lisible, **toujours** affichée avec sa décomposition |
| Fiabilité | Part des entrées par défaut | À quel point on peut se fier au résultat |

**Critère d'Émile (V2, plus tard)** : la structure doit permettre d'ajouter un indicateur maison sans tout recasser.

**Graphiques (SVG faits main, sans bibliothèque)** : semaine la plus chaude (T ext, T air, T opérative),
histogramme des heures, nuage du confort adaptatif, **diagramme de Givoni**, graphe « ce qui pèse le plus » (tornade).

---

## 6. Préconisations automatiques

- **Analyse de sensibilité** : l'outil teste chaque levier un par un, à partir de ce qui a été saisi :
  protections extérieures, g du vitrage, surventilation nocturne, brasseur d'air, isolation de la toiture,
  couleur claire, masse intérieure accessible, réduction des apports internes, ITI → ITE…
- Pour chaque levier : gain sur le score, sur les DH et sur les heures > 28 °C → **classement**.
- **Bouquets** : les gains ne s'additionnent pas, on les calcule dans l'ordre, levier après levier.
- Lien avec le chiffrage (ratios BAO) en option : coût et **€ par point de score gagné**.
- Les préconisations n'apparaissent que si elles ont du sens par rapport aux entrées (pas de « posez des BSO » s'il y en a déjà).

---

## 7. Validation (ce qui rend l'outil crédible)

1. **Tests unitaires sur les exemples des normes** : ISO 13786 (déphasage, amortissement), ISO 7730 (tableaux PMV / PPD),
   EN 16798-1 (bornes adaptatives), ISO 6946 (U).
2. **Cas tests internationaux en évolution libre** : ANSI/ASHRAE 140 (BESTEST 600FF / 900FF) (H : vérifier
   la disponibilité des résultats de référence). On doit tomber dans les plages des logiciels de référence.
3. **Comparaison avec Pléiades** sur les ~21 variantes du travail de fin de BUT d'Émile (maison individuelle) :
   même **classement** des variantes (corrélation de rang) et écarts sur les DH, expliqués dans la Méthode.
   Émile fournira ses résultats. Ils restent **dans son navigateur ou en local**, jamais dans le dépôt public, sauf accord explicite.

---

## 8. Interface

- Onglets **Calcul · Méthode · Données**, comme les autres outils. Plus **Comparer** si nécessaire (variantes côte à côte).
- Saisie progressive : d'abord l'essentiel (usage, échelle, commune, surface, vitrages, protections, isolation),
  puis un « mode expert » repliable (couches détaillées, scénarios horaires, vitesse d'air…).
- Variantes enregistrées, export Word (fiche pour les rapports d'audit), CSV et sauvegarde JSON.
- Nouvelles clés `bao.confort.*`, **à ajouter à `BAO.CLES_DONNEES`**.
- Carte de l'outil sur l'accueil.
- Pas de défilement horizontal à 390 px, clair et sombre.

---

## 9. Découpage en étapes — avec un point de contrôle à chaque fois

**Une étape = une PR.** À la fin de chaque étape, tu :
1. écris `docs/confort-ete/etape-N.md`, une **fiche de compréhension** en français simple : ce qu'on calcule, pourquoi,
   la formule, la norme, **un exemple refait à la main**, les pièges, les limites (H) ;
2. poses **3 questions** à Émile pour vérifier qu'il a compris (réponses dans un bloc replié) ;
3. **t'arrêtes et attends** qu'Émile valide avant l'étape suivante.

| Étape | Contenu | Validation |
|---|---|---|
| **0** | Lire `CLAUDE.md` et ce cahier. Proposer un plan détaillé, les choix techniques et **toutes tes questions en un seul message** | Accord d'Émile |
| **1** | Bibliothèque de matériaux + **parois couche par couche** : U, masse, déphasage, amortissement, classe d'inertie, schéma, onde de température | Exemples ISO 13786 / 6946 |
| **2** | Météo embarquée + soleil sur chaque façade + apports solaires (vitrages, protections, masques) + apports internes et scénarios | Recalcul à la main d'une heure type |
| **3** | Moteur **5R1C** en évolution libre, températures horaires air / radiante / opérative | BESTEST 600FF / 900FF (H) |
| **4** | **Indicateurs** : heures, DH, adaptatif, PMV / PPD, Givoni, nuits chaudes, **score / 100**, fiabilité, graphiques | Exemples des normes |
| **5** | **Préconisations** : sensibilité, classement, bouquets, lien avec le chiffrage | Cohérence physique (chaque levier va dans le bon sens) |
| **6** | Modes pièce / bâtiment, logement / tertiaire complets, variantes, fiche Word | Test navigateur complet |
| **7** | **Validation Pléiades** avec les variantes du BUT d'Émile | Classement + écarts expliqués |
| **8** (V2) | Parois en différences finies, multizone, climat 2050, critère maison, climatisation | À définir |

---

## 10. Rappels importants

- Toutes les règles du `CLAUDE.md` s'appliquent (JS pur, `calcul.js` lisible sans interface, tests Node, (H), sources).
- **Le calcul doit se lire comme un cours** : fonctions courtes, noms en français, formules en commentaire.
- Aucune donnée d'Argetec ni de client dans le dépôt.
- Quand une valeur de norme n'est pas vérifiable, marque-la **(H)** et signale-la à Émile. Ne l'invente jamais.
- Mets à jour le tableau « État » du `CLAUDE.md` à la fin de chaque étape.
