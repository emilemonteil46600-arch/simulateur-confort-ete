# Étape 3 — Le modèle horaire 5R1C : la température dedans (fiche de compréhension)

> But de l'étape : à partir de la chaleur qui entre heure par heure (étape 2), des parois (étapes 1 et 1 bis)
> et de l'air renouvelé, calculer **la température qu'il fait dedans**, heure par heure, quand rien ne chauffe
> ni ne climatise (« évolution libre ») : température de l'air, des surfaces, de la masse, et **température opérative**,
> celle qu'on ressent. Ce sont ces 3 672 températures d'été que l'étape 4 jugera (heures > 28 °C, degrés-heures, note).

Où le voir : onglet **Projet**.
- Saisie, étape **7. L'air** : VMC (vol/h), perméabilité n50 (→ infiltrations n50/20), fenêtres ouvertes la nuit
  (débit, plage horaire, seuil, écart avec dehors).
- Sous la maquette : 4 tuiles (pic opératif, moyenne juin → septembre, constante de temps, nuits fenêtres ouvertes),
  puis la carte « **La température dedans, heure par heure** » : la semaine la plus chaude (dehors, air, opérative),
  « **Et si la maison était… 2 × / 4 × plus lourde ?** », le **labo des réservoirs** à l'heure affichée, et
  « **L'heure affichée calculée pas à pas** ».
- Sur la maquette : la pastille « dedans 27,8 °C », les vitres colorées du bleu (frais) au rouge (chaud) ; dans la barre
  jour · heure : 🏠 la température opérative, et « fenêtres ouvertes » les nuits où la règle les ouvre.
- À droite : carte « **Températures d'été** » (pic, air / surfaces / masse à cet instant, répartition des heures par 2 °C).
- Onglet Données : les constantes du chapitre 3 et les réglages d'air par défaut.

---

## 1. L'idée : la maison est un circuit électrique

| Thermique | Électrique | Unité |
|---|---|---|
| Température θ | Potentiel (volts) | °C |
| Flux de chaleur Φ | Courant (ampères) | W |
| Conductance H = « watts par degré d'écart » | 1 / résistance | W/K |
| Capacité Cm = « joules pour monter de 1 °C » | Condensateur | J/K |

Le modèle **5R1C** (NF EN ISO 13790:2008, annexe C ; repris comme méthode simplifiée dans la NF EN ISO 52016-1 (H))
ramène toute la maison à **5 conductances et 1 capacité**, avec **3 températures inconnues** :

```
                θe (dehors)                      θsup = θe (air soufflé)
                 │        │                             │
             Htr,em     Htr,w                          Hve
                 │        │                             │
  Cm ── θm ──Htr,ms── θs ──────────Htr,is─────────── θair
      (masse)       (surfaces)                        (air)
        ↑ Φm           ↑ Φst                            ↑ Φia
```

| Conductance | Ce que c'est | Formule | Maison d'exemple |
|---|---|---|---|
| **Hve** | l'air renouvelé (VMC + infiltrations + fenêtres la nuit) | ρ·c·n·V = 1 200/3 600 × n × V | 0,7 vol/h × 216 m³ → **50,4 W/K** (266 W/K fenêtres ouvertes) |
| **Htr,w** | les vitres (sans masse) | Σ Uw·Aw | **18,2 W/K** |
| **Htr,op** | les parois opaques, coupées en deux… | Σ U·A (murs, toit, plancher bas) | 60,9 W/K |
| **Htr,ms** | … côté masse ↔ surfaces | 9,1 W/(m²·K) × Am | **2 089 W/K** |
| **Htr,em** | … côté masse ↔ dehors | 1/(1/Htr,op − 1/Htr,ms) | **62,7 W/K** |
| **Htr,is** | surfaces ↔ air | 3,45 W/(m²·K) × Atot, Atot = 4,5 × Af | **1 242 W/K** |
| **Cm**, Am | la masse et sa surface (chapitre 1 bis) | Σ κ·A ; Cm²/Σ κ²A | **9,31 MJ/K**, 229,6 m² |

Les coefficients 3,45 ; 9,1 ; 4,5 et le partage 0,3 / 0,7 de l'opérative sont ceux de l'annexe C **(H : à vérifier dans le texte)**.

## 2. Où va la chaleur qui entre ?

Une lampe ou un corps chauffe moitié l'air (convection), moitié les murs (rayonnement). Le soleil traverse la vitre et
tape le sol : il ne chauffe pas l'air.

```
Φia = 0,5 Φint                                             → l'air
Φm  = (Am / Atot) × (0,5 Φint + Φsol)                       → la masse (part des surfaces lourdes)
Φst = (1 − Am/Atot − Htr,w / (9,1 Atot)) × (0,5 Φint + Φsol) → les surfaces légères
```

Maison d'exemple : Am/Atot = 229,6/360 = 0,64 → les deux tiers du soleil vont droit dans la masse.

## 3. Le pas de temps (Crank-Nicolson)

À chaque heure, on écrit **ce qui arrive à un nœud en repart** (air, surfaces : pas de capacité) **ou s'y stocke** (masse) :

```
Air       Htr,is (θs − θair) + Hve (θe − θair) + Φia = 0
Surfaces  Htr,ms (θm − θs) + Htr,is (θair − θs) + Htr,w (θe − θs) + Φst = 0
Masse     Cm dθm/dt = Φm + Htr,em (θe,op − θm) + Htr,ms (θs − θm)        [J/K × K/s = W]
```

La masse est prise à sa **température moyenne sur l'heure** : stable et exact à l'ordre 2 même avec un pas d'une heure.
On ramène tout ce qui est « à droite » de la masse à une seule conductance :

```
H1 = 1/(1/Hve + 1/Htr,is)     H2 = H1 + Htr,w     H3 = 1/(1/H2 + 1/Htr,ms)
Φmtot = Φm + Htr,em θe,op + H3 [Φst + Htr,w θe + H1 (θe + Φia/Hve)] / H2
θm,t = [θm,t−1 (Cm/3600 − ½(H3 + Htr,em)) + Φmtot] / [Cm/3600 + ½(H3 + Htr,em)]
θm = (θm,t + θm,t−1)/2 → θs → θair → θop = 0,3 θair + 0,7 θs
```

Cm/3600 est en Wh/K : une « conductance par heure », comparable aux H.

## 4. Exemple refait à la main : une heure

Maison de test : Af 100 m², V 250 m³, Cm 10 MJ/K, Am 250 m², vitres 21 W/K, murs 30 + toit 15 + sol 30 W/K, 0,7 vol/h.
Dehors 30 °C, masse à 24 °C l'heure d'avant, Φint 500 W, Φsol 1 500 W.

```
Htr,is = 3,45 × 450 = 1 552,5   Htr,ms = 9,1 × 250 = 2 275   Htr,em = 1/(1/75 − 1/2 275) = 77,557   Hve = 0,7 × 250/3 = 58,333
H1 = 56,221   H2 = 77,221   H3 = 74,686
Φia = 250   Φm = 250/450 × 1 750 = 972,2   Φst = (1 − 0,5556 − 21/4 095) × 1 750 = 768,8
Φmtot = 972,2 + 77,557 × 30 + 74,686 × 3 326,4 / 77,221 = 6 516,1 W
θm,t = (24 × (2 777,78 − 76,12) + 6 516,1) / (2 777,78 + 76,12) = 25,003 °C ; moyenne 24,501
θs = 25,111 °C   θair = 25,443 °C   θop = 25,21 °C
Bilan : 2 000 (apports) + 266 (air) + 103 (vitres) + 426 (opaques) ≈ 2 786 stockés + 9 renvoyés par les vitres ✔
```

## 5. L'air, le sol, la mise en régime (H)

- **VMC** 0,5 vol/h (H), **infiltrations** = n50/20 (règle de Sherman (H)), n50 = 4 pour l'exemple → 0,7 vol/h en tout.
- **Fenêtres ouvertes la nuit** (H) : + 3 vol/h de 22 h à 7 h, seulement si la maison dépassait 24 °C l'heure d'avant
  et si dehors est plus frais d'au moins 2 °C. Choix « Fermées / Entrouvertes 1 / Ouvertes 3 / Traversantes 8 vol/h ».
- **Sol sous la dalle** (H, inspiré de la NF EN ISO 13370) : moyenne annuelle de l'air + ½ × l'écart de la moyenne
  mensuelle, un mois plus tôt. Toulouse en juillet : 17 °C. Le plancher bas « voit » ce sol, le reste des parois voit l'air.
- **Mise en régime** : le calcul part du 1er mai avec la masse à la température extérieure ; τ ≈ 20 h ≪ 31 jours,
  donc juin → septembre ne dépend plus du départ (vérifié : θ initiale 35 °C → même résultat au 1er juin à 10⁻⁶ près).

## 6. Ce que donne la maison d'exemple (Toulouse, juin → septembre)

| Variante | Pic opératif | Moyenne | Heures > 28 °C |
|---|---|---|---|
| Volets + fenêtres ouvertes la nuit (3 vol/h) | **33,3 °C** | **24,8 °C** | ≈ 330 h |
| Volets, fenêtres fermées la nuit | 34,6 °C | 26,1 °C | ≈ 780 h |
| « 4 × plus lourde » (Cm × 4, bouton) | 30,3 °C | 24,9 °C | — |
| Dehors | 38,8 °C | 21,9 °C | — |

Ce qu'on apprend : la maison est plus chaude que dehors en moyenne (apports + isolation) ; **ouvrir la nuit** gagne
1,3 °C sur le pic et sur la moyenne ; **l'inertie écrête le pic mais ne baisse pas la moyenne** (il faut évacuer) ;
le pic arrive après plusieurs jours chauds (la masse se charge).

## 7. Comment on sait que c'est juste

1. **Bilan d'énergie** nul à chaque heure (< 10⁻⁶ W) sur un été complet avec surventilation.
2. **Régime permanent** : entrées constantes → solution exacte du circuit (3 équations, élimination de Gauss) ; θe + Φ/H à 0,6 °C.
3. **Échelon** : exponentielle exacte de constante de temps (Cm/3600)/(Htr,em + H3), rapport horaire (1 − a)/(1 + a) à 10⁻⁹.
4. **Exemples à la main** (§ 4 et § 6) refaits par `tests/confort-5r1c.test.js`.
5. **BESTEST 600FF / 900FF** (ANSI/ASHRAE 140, évolution libre) recalculés avec les chapitres 1, 2 et 3 et
   **l'année type PVGIS de Denver** (la météo officielle DRYCOLD n'est pas publique → **indicatif (H)**) :

   | Cas | Max air | Min air | Moyenne | Plages publiées (H : de mémoire, à vérifier) |
   |---|---|---|---|---|
   | 600FF (légère) | 66 °C | −18 °C | 25,6 °C | 64,9 à 75,1 / −18,8 à −15,6 / 24,2 à 27,4 ✔ |
   | 900FF (lourde) | 48 °C | −7 °C | 25,7 °C | 41,8 à 46,4 / −6,4 à −1,6 / 24,5 à 27,5 : moyenne ✔, extrêmes ≈ 1,5 °C trop marqués |

   Un seul nœud de masse exagère un peu les extrêmes de la maison lourde : attendu, et la météo diffère.
6. **Sens physiques** : lourde ⇒ extrêmes écrasés ; sans volets ⇒ + 2 °C de pic ; nuit ouverte ⇒ plus frais.

## 8. Pièges

- **Hve pèse autant que les murs** : 0,7 vol/h dans 216 m³ = 50 W/K, contre 61 W/K pour toutes les parois opaques.
- **Cm en J/K, H en W/K** : Cm/3600 (Wh/K) est la seule façon de les comparer. τ = Cm/H est en secondes.
- **Le pic opératif n'est pas le jour le plus chaud dehors** : c'est la fin d'une série de jours chauds.
- **L'opérative suit l'air** dans une maison légère (0,2 °C d'écart) : l'effet « mur frais » n'existe qu'avec de la masse.
- **Ouvrir la nuit ne sert à rien** si dehors n'est pas plus frais (règle de l'écart de 2 °C) ou si la maison n'a pas de masse à refroidir.

## 9. Limites (H)

- Une seule zone, une seule masse : pas de déphasage « visible » des parois (étape 8), pas de pièce sous toit plus chaude.
- Coefficients de l'annexe C (3,45 ; 9,1 ; 4,5 ; 0,3/0,7) non vérifiés dans le texte de la norme.
- Sol, infiltrations n50/20, débits et règle d'ouverture des fenêtres : hypothèses d'exemple.
- Air neuf à la température extérieure : pas de double flux, de puits canadien, de brasseur d'air (vitesse d'air : étape 4).
- Évolution libre seulement (pas de climatisation) ; année type = été normal, pas de canicule (à décider : voir CLAUDE.md).
- BESTEST indicatif (météo PVGIS, plages de mémoire).

---

## 3 questions pour vérifier que tu as compris

**1.** Dans la maison d'exemple, Htr,ms vaut 2 089 W/K et Htr,em 62,7 W/K. Pourquoi un tel écart, et qu'est-ce que
ça veut dire physiquement pour la masse ?

<details><summary>Réponse</summary>

Htr,ms = 9,1 × Am : la masse « touche » les surfaces de la pièce sur 230 m², avec un échange de 9,1 W/(m²·K) :
énorme. Htr,em est ce qui reste de Htr,op = 60,9 W/K une fois Htr,ms retiré en série : presque tout, parce que la
résistance côté pièce est négligeable devant celle des parois isolées.
Physiquement : la masse est **très bien reliée à la pièce et très mal reliée à dehors**. Ce qu'on met dans la pièce
(soleil, occupants) va vite dans la masse ; ce qu'elle a emmagasiné ne ressort vers dehors que lentement (τ = 20 h).
D'où l'intérêt d'ouvrir la nuit : on vide la masse par l'air (Hve × 5), pas par les murs.

</details>

**2.** La maison « 4 × plus lourde » a un pic de 30,3 °C au lieu de 33,3, mais la même moyenne (24,9 contre 24,8 °C).
Explique avec un bilan sur toute la saison.

<details><summary>Réponse</summary>

Sur une saison, la masse finit à peu près comme elle a commencé : le stockage net est nul. Il reste
Σ apports = Σ H × (θdedans − θdehors) : la température moyenne dedans ne dépend que des apports et des conductances,
pas de Cm. L'inertie déplace la chaleur du jour vers la nuit (le pic baisse, le creux monte) mais n'en retire pas.
Pour baisser la moyenne, il faut moins d'apports (protections) ou plus d'évacuation (ventilation, surtout la nuit).

</details>

**3.** Le 17 juin à 21 h, l'air dehors est à 35,6 °C mais le pic de l'été (33,3 °C) tombe ce soir-là alors que
le 38,8 °C de l'année type arrive plus tard. Pourquoi le pic dedans n'est-il pas le jour le plus chaud dehors ?

<details><summary>Réponse</summary>

Parce que la maison a une mémoire de τ ≈ 20 h : sa température dépend des 2 ou 3 jours précédents, pas de l'heure.
Une série de jours chauds avec des nuits tièdes charge la masse jour après jour (la surventilation nocturne n'a pas
assez d'écart pour la vider) : le pic dedans arrive au bout de la série. Un jour isolé à 38,8 °C après des nuits fraîches
fait moins mal qu'un 35 °C au bout de quatre jours. C'est exactement ce que fait une canicule, et pourquoi l'étape 4
regardera des **durées** (degrés-heures), pas seulement un pic.

</details>
