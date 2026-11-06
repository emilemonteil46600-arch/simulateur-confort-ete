# Étape 0 — Plan et décisions (06/11/2026)

## Le projet en 5 lignes

1. Un simulateur **rapide** du confort d'été, pour une **pièce** ou un **bâtiment** (une zone), en **logement** ou en **tertiaire**, sans climatisation. Il vient en complément de Pléiades, il ne le remplace pas.
2. Il part des **parois couche par couche** (U, inertie, déphasage), puis calcule heure par heure, sur une **météo embarquée**, les températures d'air, radiante et opérative (modèle **5R1C**).
3. Il réunit **tous les indicateurs** : heures > 26/28 °C, DH « façon RE2020 », adaptatif EN 16798-1, PMV/PPD, Givoni, nuits chaudes, avec un **score sur 100 toujours décomposé** et une **fiabilité**.
4. Il teste **chaque levier un par un**, puis en bouquets calculés dans l'ordre, pour dire **ce qui pèse le plus**.
5. Il est validé par les exemples des normes, par BESTEST et par les variantes Pléiades d'Émile. Chaque étape fait l'objet d'une PR et d'une fiche de compréhension, et j'attends l'accord d'Émile avant la suivante.

## Plan des étapes

| Étape | Contenu | Validation |
|---|---|---|
| 1 | Matériaux, parois couche par couche : U, masse, déphasage, amortissement, admittance, κ, classe d'inertie, schéma, onde sur 24 h | Différences finies (méthode indépendante), exemple à la main, limites physiques |
| 2 | Météo embarquée, soleil sur chaque façade, apports solaires (g, Fc, masques), apports internes et scénarios | Une heure type recalculée à la main |
| 3 | Moteur 5R1C en évolution libre : T air, T radiante, T opérative | BESTEST 600FF / 900FF (plages publiées (H)), bilan d'énergie nul |
| 4 | Indicateurs, score sur 100, fiabilité, graphiques | Tableaux ISO 7730, bornes EN 16798-1 |
| 5 | Préconisations : sensibilité, classement, bouquets, lien avec le chiffrage | Chaque levier va dans le bon sens |
| 6 | Outil complet : modes pièce / bâtiment, logement / tertiaire, variantes, Comparer, fiche Word | Test navigateur complet |
| 7 | Validation Pléiades (variantes du BUT, gardées en local) | Classement + écarts expliqués |

## Décisions d'Émile (réponses du 06/11/2026)

| Question | Décision |
|---|---|
| Accès aux normes | **Mis de côté.** On s'appuie sur des sources publiques et sur la physique ; toute valeur de norme non vérifiée est marquée **(H)**. On remplacera par le texte des normes quand il sera disponible. |
| Organisation du calcul | **Plusieurs fichiers lisibles comme des chapitres** (`calcul-parois.js`, `calcul-soleil.js`, `calcul-5r1c.js`…), `calcul.js` sert de sommaire. |
| Exigence de compréhension | **Tout comprendre, au niveau physique** : origine de chaque formule, phénomène, gradient, équations aux dimensions. L'onglet Méthode est écrit comme un cours. Viser **le plus complet possible**. |
| Météo | Laissée à mon choix : PVGIS (Commission européenne), 7 villes du cahier, du 1er mai au 30 septembre (mai sert à la mise en régime), canicule 2019 et/ou 2022 selon la disponibilité. Licence et accès à vérifier à l'étape 2 (H). |
| Classe d'inertie | Celle de NF EN ISO 13790 (Cm, Am), calculée par les κ des parois (le modèle 5R1C l'utilise). Les règles Th-I ne sont pas reprises tant qu'elles ne sont pas vérifiées (H). |
| BESTEST | Plages de résultats publiées dans des rapports publics (H), faute d'accès à ASHRAE 140. |
| Score, données Pléiades | À décider aux étapes 4 et 7. |
| Site | **Un site à part** (choix d'Émile du 06/11/2026) : projet `simulateur-confort-ete`, même style que la boîte à outils, code commun copié. La boîte à outils garde une carte qui pointe vers lui. |
| Relecture | Émile fait relire chaque étape par un autre modèle (Gemini) ; Claude revérifie à chaque étape. |
