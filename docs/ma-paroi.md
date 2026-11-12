# Ma paroi — une paroi seule dans la vraie météo (fiche de compréhension)

> Demande d'Émile (12/11/2026) : « un onglet simple, mur extérieur, toiture ou plancher, je mets mes matériaux,
> j'ai le schéma animé, et je vois s'il y a du confort d'été ou pas, avec de vraies conditions extérieures ».
> Ce n'est pas une étape du cahier des charges : c'est un **mode simple** de l'atelier, construit avec les chapitres 1 ter
> (labo), 2 (météo, soleil) et 3 (sol sous la dalle).

Où le voir : onglet **Ma paroi** (entre Projet et Atelier parois).
- Trois cartes : **Mur extérieur · Toiture · Plancher bas**. Elles changent la nature de la paroi (sens du flux, résistances
  superficielles, ce que voit la face extérieure) sans toucher aux couches. « Partir d'un modèle » remplace les couches.
- **Le labo** (déplacé ici, le même qu'avant) : glisser des matériaux, déplacer, poubelle, horloge, ▶. Nouveau scénario
  **☀ Vraie météo** (par défaut) : ville PVGIS, début (semaine la plus chaude, 21 juin, 21 juillet, 15 août), nombre de
  jours, orientation de la façade ou du pan, pente, couleur (α). Pièce libre par défaut (air neuf = l'air dehors).
- La carte **Confort d'été de cette paroi** : le verdict, six repères (H), « pour faire mieux », et ce que le labo a vu.
- La même paroi est dans l'**Atelier parois** (mode expert) : tableau des couches, matrices, inertie du local.

---

## 1. Ce que voit la face extérieure : la température sol-air

Dans le labo « vraie météo », la paroi ne voit pas l'air dehors mais une température fictive qui lui donne le même flux
que l'air + le soleil absorbé − le rayonnement vers le ciel froid (formule de l'apport opaque de l'étape 2, divisée par U·A) :

```
θsa = T + α × Rse × I − Fciel × Rse × hr × Δθer          [°C] + [m²·K/W] × [W/m²] = °C
Mur moyen (α 0,6), 500 W/m², air 30 °C : 30 + 0,6 × 0,04 × 500 − 0,5 × 0,04 × 4,5 × 11 = 30 + 12,0 − 1,0 = 41,0 °C
Tuile sombre (α 0,8), 900 W/m², toit à 35° : 30 + 28,8 − 1,8 = 57,0 °C
La nuit, sans soleil : θsa = T − 1 °C (mur) : le ciel refroidit la paroi
```

- Mur : I sur la façade verticale d'azimut choisi (direct + diffus + réfléchi, étape 2).
- Toiture : I sur le pan de pente et d'azimut choisis ; Fciel = (1 + cos β)/2.
- **Plancher bas** : pas de soleil ; la face extérieure est le **sol sous la dalle** (étape 3, (H)) : moyenne annuelle
  de l'air, saisons amorties de moitié et retardées d'un mois. Toulouse : 12,7 à 13,1 °C en juin.
- Heure légale ; 4 jours de préchauffage avant la période affichée ; l'air neuf de la pièce libre est **l'air réel**,
  pas le sol-air (sinon la pièce respirerait 50 °C).

## 2. Les repères (H) : lire une paroi d'un coup d'œil

| Repère | Bon | Moyen | D'où ça vient |
|---|---|---|---|
| Déphasage Δt | ≥ 10 h | ≥ 6 h | Le pic de 15 h arrive après 1 h : on ventile. Guides bioclimatiques, Th-I (H) |
| Amortissement f | ≤ 0,10 | ≤ 0,30 | Ce qui reste de l'onde d'une paroi « sans masse » de même U (H) |
| κ1 côté pièce | ≥ 50 kJ/(m²·K) | ≥ 20 | La paroi encaisse la journée. ISO 13786, classes courantes (H) |
| U | ≤ 0,25 (toiture 0,15) | ≤ 0,5 (0,3) | Ordres de grandeur RE2020 / rénovation (H) |
| Face intérieure − air | ≤ 1 °C | ≤ 3 °C | Ce qu'on ressent par rayonnement. Labo vraie météo (H) |
| Flux de pointe | ≤ 5 W/m² | ≤ 15 W/m² | La chaleur qui entre au pire moment. Labo vraie météo (H) |

Verdict : 2 points par repère bon, 1 par moyen ; **bon** ≥ 75 %, **faible** < 40 % (H). Les seuils sont dans
Données et `ConfortParois.REPERES_CONFORT`. **Ce ne sont pas des exigences de norme** : la note de la maison (étape 4)
sera fixée avec Émile.

## 3. Ce que donnent les modèles (Toulouse, semaine la plus chaude, façade Ouest moyenne)

| Paroi | Δt | f | κ1 | U | Verdict |
|---|---|---|---|---|---|
| Béton 18 + ITE PSE 14 | 7,7 h | 0,18 | 76 | 0,25 | moyen (κ1, U presque bon) |
| Parpaing 20 + ITI laine 10 | — | — | 14 | 0,30 | faible côté pièce : la laine coupe la masse |
| Plafond BA13 + laine 30 (toiture) | 3,1 h | 0,90 | 14 | 0,11 | moyen : U et flux de pointe bons (3,6 W/m²), mais aucune masse (Δt, f, κ1 rouges) |

## 4. Pièges

- **Déphasage observé ≠ déphasage des matrices** : les matrices supposent une sinusoïde de 24 h ; la vraie météo a un pic
  solaire étroit (façade Ouest : 17 h) et des jours chauds de suite. Le labo affiche les deux.
- **Une toiture très isolée n'est que « moyenne »** : U excellent et flux de pointe faible, mais sans masse côté pièce le peu
  qui passe passe vite (f ≈ 0,9, Δt 3 h) et la paroi n'encaisse rien de la pièce. Le remède : masse côté pièce (fibre de bois
  dense, plaques lourdes) ou couverture ventilée et claire.
- **Le plancher bas est presque toujours « bon » l'été** : son extérieur est un sol à 13 °C. C'est la paroi qui rafraîchit.
- **Ce n'est pas le confort de la maison** : une seule paroi échange, les autres sont supposées parfaites (H). Le confort
  de la maison entière, c'est l'onglet Projet (5R1C).

## 5. Limites (H)

- Seuils des repères : ordres de grandeur, à discuter et à ajuster avec Émile.
- Sol-air avec Rse = 0,04 fixe ; pas de masques ; combles perdus : le plafond « voit » le sol-air du toit comme s'il était
  dehors (en vrai un comble tampon, étape 8).
- Pièce libre simplifiée (chapitre 1 ter) : volume, surface de paroi, air neuf, mobilier.

---

## 3 questions pour vérifier que tu as compris

**1.** Un mur Ouest clair (α 0,4) reçoit 554 W/m² à 16 h par 32 °C d'air. Quelle température sol-air voit-il ?
Et le même mur peint en sombre (α 0,8) ?

<details><summary>Réponse</summary>

θsa = 32 + 0,4 × 0,04 × 554 − 0,5 × 0,04 × 4,5 × 11 = 32 + 8,9 − 1,0 = **39,9 °C**. En sombre : 32 + 17,7 − 1,0 = **48,7 °C**.
La couleur ajoute ici 9 °C sur la face extérieure : c'est ce que la paroi doit ensuite amortir.

</details>

**2.** Le plafond BA13 + 30 cm de laine a U = 0,11 (excellent) et pourtant le verdict n'est que « moyen ». Pourquoi, et
qu'est-ce qui change si on pose 5 cm de fibre de bois dense sous le BA13 ?

<details><summary>Réponse</summary>

Trois repères sur six regardent la **masse**, pas l'isolation : Δt = 3 h, f = 0,9, κ1 = 14 kJ/(m²·K), tous rouges ; U et
le flux de pointe sont bons, d'où « moyenne ». La laine freine la chaleur en moyenne (U) mais ne la retarde ni ne l'écrase :
ce qui passe arrive en 3 h, presque sans amortissement, au moment le plus chaud, et la paroi n'encaisse rien de la pièce. La fibre de bois dense (ρ ≈ 160 kg/m³, c ≈ 2 100) côté pièce monte κ1 et le déphasage de plusieurs
heures ; la face intérieure chauffe moins l'après-midi.

</details>

**3.** Pourquoi la pièce libre du labo doit-elle respirer l'air réel et non la température sol-air que voit la paroi ?

<details><summary>Réponse</summary>

Le sol-air est une température **fictive** qui résume, pour la surface opaque, l'effet de l'air + du soleil absorbé.
L'air qui entre par les fenêtres ou la VMC, lui, est à la température réelle de l'air (25 à 35 °C), pas à 50 °C.
Sans cette distinction, la pièce « respirerait du soleil » et monterait à plus de 40 °C : le test le vérifie.

</details>
