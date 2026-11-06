# Étape 1 bis — La maison en 3D : fiche de compréhension

> But de l'étape : passer d'une paroi à **une maison entière**, visible en 3D, décrite en quelques clics
> (volume, toiture, orientation, fenêtres, parois). On en tire déjà ce qui se calcule sans météo :
> surfaces, **déperditions H** et **inertie de toute la maison**. La météo, le soleil et la note de confort
> arrivent aux étapes 2 à 4.

Où le voir : https://emilemonteil46600-arch.github.io/simulateur-confort-ete/ › onglet **Projet**.
L'atelier parois de l'étape 1 est dans l'onglet **Atelier parois** (mode expert).

---

## 1. Ce qu'on calcule, et pourquoi

| Grandeur | Formule | Pourquoi |
|---|---|---|
| Hauteur des murs | Hm = n × he | n niveaux de hauteur d'étage he |
| Façades | A, C : L × Hm ; B, D : l × Hm (+ pignon si combles aménagés) | La surface de chaque orientation, pour le soleil (étape 2) |
| Faîtage | h = (côté court / 2) × tan α | La forme de la toiture |
| Rampants | L × l / cos α | Combles aménagés : on isole la pente |
| Volume | L × l × Hm (+ combles aménagés) | Pour le renouvellement d'air (étape 3) |
| Déperditions | H = Σ U × A | Combien de watts traversent l'enveloppe pour 1 °C d'écart |
| Inertie | Cm = Σ κ × A | La masse utile de toute la maison, capacité du modèle 5R1C (étape 3) |

## 2. La physique, en 4 idées

1. **L'azimut** dit vers où regarde une façade : N = 0°, E = 90°, S = 180°, O = 270°. C'est lui qui pilotera le soleil reçu par chaque façade à l'étape 2.
2. **Un pan incliné est plus grand que sa projection** : surface = surface au sol / cos α (le côté « en pente » vaut le côté au sol divisé par cos α). Vrai pour 2 pans comme pour 4 pans, dès que tous les pans ont la même pente.
3. **Combles perdus ou aménagés, ce n'est pas la même enveloppe.** Perdus : on isole le plafond (L × l), et le grenier et les pignons sont dehors thermiquement. Aménagés : on isole les rampants, les pignons deviennent des murs et le volume chauffé gagne les combles.
4. **H = Σ U·A additionne des « débits de chaleur par degré ».** Unités : W/(m²·K) × m² = W/K. L'été, ce même H laisse **entrer** la chaleur quand il fait plus chaud dehors. Mais le soleil à travers les fenêtres pèse souvent plus : ce sera l'étape 2.

## 3. Exemple refait à la main : la maison d'exemple

Plain-pied 10 × 8 m, he = 2,7 m, 2 pans à 35°, combles perdus, façade A plein Sud.
Fenêtres 6 m² (S), 3 m² (O), 1,5 m² (N), 2,5 m² (E), Uw = 1,4. Murs parpaing + ITI, plafond BA13 + laine 30 cm, dallage isolé, cloisons BA13 (ratio 1,0).

```
Faîtage     h = 4 × tan 35° = 4 × 0,700 = 2,80 m      (pignons hors enveloppe : combles perdus)
Façades     27 + 21,6 + 27 + 21,6 = 97,2 m²   −  13 m² de fenêtres  =  84,2 m² de murs opaques
Fenêtres    13 / 80 = 16 % de la surface de plancher
Plafond     10 × 8 = 80 m²         (si combles aménagés : 80 / cos 35° = 97,7 m²)
Volume      80 × 2,7 = 216 m³

H = 0,3026 × 84,2 + 1,4 × 13 + 0,1132 × 80 + 0,3297 × 80
  = 25,48 + 18,20 + 9,06 + 26,38 = 79,1 W/K          (≈ 1,0 W/K par m²)

Cm = 14,27 × 84,2 + 13,83 × 80 + 63,45 × 80 + (12,06 + 12,06) × 80
   = 1 202 + 1 106 + 5 076 + 1 930 = 9 314 kJ/K   →  116 kJ/(m²·K)  →  « Légère »
```

Lecture : la seule vraie masse est le dallage. Les murs en ITI et les cloisons en plaques de plâtre sont légers. Essaie « Parpaing + ITE » dans la saisie (6. Murs et planchers) : la classe monte.

## 4. La maquette 3D, sans bibliothèque

- Chaque face = un polygone de points 3D (x Est, y Nord, z haut).
- Caméra : azimut θ, hauteur φ → 3 vecteurs : vers la caméra c, droite de l'écran r, haut de l'écran h.
- Un point P s'affiche en (P·r ; −P·h) : c'est une **projection orthogonale** par produits scalaires.
- Une face est visible si sa normale regarde la caméra (n·c > 0). La maison est convexe, donc cela suffit.
- Un test vérifie que la caméra est « directe » (r × h = c). Sans ce test, la vue peut sortir **en miroir** : c'est une erreur que j'ai faite et corrigée pendant l'étape.

## 5. Comment on sait que c'est juste

- Tests Node : l'exemple ci-dessus au centième près ; rampants = L·l / cos α ; pignons comptés seulement si les combles sont aménagés ; volume des combles 2 et 4 pans (un 4 pans sur un carré redonne la pyramide s²·h/3) ; somme des parts de H = 100 % ; caméra orthonormée et directe ; surface des fenêtres dessinées = surface saisie.
- Test navigateur : la maquette se dessine, un clic sur une façade la sélectionne dans la maquette et dans la saisie, 2 niveaux donnent 160 m², les combles aménagés font basculer la toiture en rampants.

## 6. Pièges

- **Longueur et largeur** : la longueur porte les façades A et C, et le faîtage d'un toit 2 pans la suit.
- **Combles perdus** : les pignons sont dessinés mais **pas comptés** dans les murs (ils sont au-dessus de l'isolant).
- **Surface vitrée** : c'est la surface de **fenêtres** (Uw porte sur la fenêtre entière), pas seulement la surface de verre.
- **H n'est pas la note d'été.** Une maison très isolée mais très vitrée à l'Ouest peut avoir un H faible et être une étuve.

## 7. Limites (H)

- **(H)** Volume rectangulaire seulement (pas de L, de U ni de décrochés) ; une seule zone.
- **(H)** Dimensions extérieures = intérieures : l'épaisseur des murs est négligée dans les surfaces.
- **(H)** Pas de ponts thermiques ni de renouvellement d'air dans H ; plancher bas calculé comme une paroi sur l'extérieur (effet du sol, NF EN ISO 13370, non modélisé).
- **(H)** Cloisons estimées par un ratio de 1,0 m²/m² de plancher : à mesurer sur le plan.
- **(H)** Les protections solaires sont dessinées mais **pas encore calculées** (facteur Fc à l'étape 2).
- **(H)** Valeurs des fenêtres (Uw, g) : exemples à remplacer par les fiches produits.

## 8. Décisions d'Émile pour la suite (07/11/2026)

| Sujet | Décision |
|---|---|
| 3D | Faite main, en SVG, sans bibliothèque |
| Forme | Volume rectangulaire + toit plat / 2 pans / 4 pans |
| Style | « Logiciel pro » clair : saisie à gauche, maison au centre, résultat à droite |
| Note de confort | Chaque indicateur noté sur 10 par un barème **continu** (droite entre deux bornes), pondéré par un coefficient, puis moyenne pondérée. Barèmes et coefficients à fixer ensemble à l'étape 4 |

---

## 3 questions pour vérifier que tu as compris

**Q1.** Même maison 10 × 8 m, toit 2 pans à 30°. Quelle surface faut-il isoler si les combles sont **perdus** ? S'ils sont **aménagés** ? Pourquoi ça change ?

<details><summary>Réponse</summary>

Perdus : on isole le plafond, **80 m²** (10 × 8).
Aménagés : on isole les rampants, 80 / cos 30° = 80 / 0,866 = **92,4 m²**. En plus, les pignons (8 × h / 2 chacun, avec h = 4 × tan 30° = 2,31 m, soit 9,2 m²) deviennent des murs à isoler.
La pente « allonge » la surface : chaque pan est plus grand que sa projection au sol.
</details>

**Q2.** Dans la maison d'exemple, les fenêtres font 13 m² et les murs 84 m², mais les fenêtres pèsent 18,2 W/K contre 25,5 W/K pour les murs. Pourquoi 13 m² pèsent-ils presque autant que 84 m² ?

<details><summary>Réponse</summary>

Parce que H = U × A : Uw = 1,4 contre U = 0,30 pour le mur, soit une fenêtre environ **4,6 fois plus déperditive** au m². 13 × 1,4 = 18,2 W/K ; 84,2 × 0,30 = 25,5 W/K. L'été, c'est encore plus marqué, car la fenêtre laisse aussi entrer le **soleil** (facteur g, étape 2).
</details>

**Q3.** La maison d'exemple est classée « Légère ». Cite deux changements qui feraient monter la classe, et explique pourquoi avec κ.

<details><summary>Réponse</summary>

Cm = Σ κ × A. Il faut que l'air de la maison « touche » de la masse :
- passer les murs de l'**ITI à l'ITE** : κ1 du mur passe d'environ 14 à 60-75 kJ/(m²·K), sur 84 m² ;
- remplacer les cloisons légères par des **cloisons lourdes** (brique, béton), ou ajouter un **plancher béton** à l'étage.
Augmenter l'isolant du plafond ne change presque rien : l'isolant n'a pas de masse.
</details>
