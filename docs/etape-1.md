# Étape 1 — Les parois : fiche de compréhension

> But de l'étape : savoir dire, pour une paroi décrite couche par couche, **ce qu'elle laisse passer** de la chaleur d'une journée d'été, **avec quel retard**, et **ce qu'elle peut stocker** pour la pièce. Puis additionner les parois d'un local pour obtenir sa **capacité Cm**, qui servira au modèle horaire de l'étape 3.

Où le voir : https://emilemonteil46600-arch.github.io/simulateur-confort-ete/ › onglet Calcul (la paroi, la coupe, le calcul pas à pas, la journée chaude, l'inertie du local) et onglet Méthode (le cours complet, sections 1 à 15).

---

## 1. Ce qu'on calcule, et pourquoi

| Grandeur | Unité | Question à laquelle elle répond |
|---|---|---|
| U | W/(m²·K) | Combien passe en **régime permanent** (températures figées) ? C'est la question de l'hiver. |
| \|Y12\| | W/(m²·K) | Combien passe de l'**onde de 24 h** ? C'est « le U de l'été ». |
| f = \|Y12\|/U | – | Quelle **part** de l'onde passe, par rapport à U seul ? |
| Δt | h | Avec quel **retard** le pic arrive-t-il dans la pièce ? |
| \|Y11\| | W/(m²·K) | Combien la paroi **absorbe** quand l'air de la pièce oscille de ± 1 K ? |
| κ1 | J/(m²·K) | Quelle masse est **vraiment utile** à la pièce sur une journée ? |
| Cm, Am | J/K, m² | La capacité de **tout le local** et sa surface d'échange (NF EN ISO 13790). |

**Pourquoi ce n'est pas U :** l'été, la température dehors oscille chaque jour. Une paroi lourde stocke une partie de l'onde, l'écrase et la retarde. Deux murs de même U peuvent donner des pièces très différentes.

## 2. La physique, en 4 idées

1. **Fourier** : `q = −λ × dθ/dx`. La chaleur suit la **pente** de température (le gradient, en K/m). Pas de différence de température, pas de flux. Unités : W/(m·K) × K/m = W/m² ✓.
2. **Stocker** : chauffer 1 m² de couche de 1 K demande `ρ·c·e` joules (kg/m³ × J/(kg·K) × m = J/(m²·K)).
3. **Équation de la chaleur** (bilan sur une tranche dx) : `∂θ/∂t = a × ∂²θ/∂x²`, avec `a = λ/(ρ·c)` la diffusivité (m²/s). Un point se réchauffe quand ses voisins sont, en moyenne, plus chauds que lui.
4. **Onde de 24 h** dans un mur épais : `θ(x,t) = A·e^(−x/δ)·cos(ωt − x/δ)`, avec `δ = √(λ·T/(π·ρ·c))`. À chaque δ traversé, l'amplitude est divisée par 2,72 et le retard augmente de 3,82 h. Béton : δ ≈ 16,6 cm.

## 3. La méthode exacte : les matrices de transfert (NF EN ISO 13786)

Chaque couche relie (température, flux) d'une face à ceux de l'autre face par une matrice 2 × 2 de **nombres complexes** (amplitude + phase) :

```
Couche (ξ = e/δ) :  Z11 = Z22 = cosh ξ·cos ξ + i·sinh ξ·sin ξ
                    Z12 = −δ/(2λ)·[sinh ξ·cos ξ + cosh ξ·sin ξ + i·(cosh ξ·sin ξ − sinh ξ·cos ξ)]
                    Z21 = −λ/δ   ·[sinh ξ·cos ξ − cosh ξ·sin ξ + i·(sinh ξ·cos ξ + cosh ξ·sin ξ)]
Résistance R :      [1 −R ; 0 1]
Paroi :             Z = Z(Rse) × Z(couche n) × … × Z(couche 1) × Z(Rsi)

Y12 = −1/Z12     f = |Y12|/U     Δt = −arg(Y12) × 24/(2π)
Y11 = −Z11/Z12   κ1 = T/(2π) × |(Z11 − 1)/Z12|
```

Ces formules ne sont pas « magiques » : ce sont la solution exacte de l'équation de la chaleur pour une onde sinusoïdale (on les redémontre en écrivant θ(x) = A·cosh(kx) + B·sinh(kx), avec k = (1 + i)/δ).

## 4. Exemple refait à la main : béton 20 cm seul (mur, Rsi 0,13, Rse 0,04)

```
R = 0,13 + 0,20/2,3 + 0,04 = 0,2570  →  U = 3,892 W/(m²·K)
δ = √(2,3 × 86 400 / (π × 2 300 × 1 000)) = 0,1658 m      ξ = 0,20/0,1658 = 1,206
cosh ξ = 1,8197   sinh ξ = 1,5204   cos ξ = 0,3568   sin ξ = 0,9342

Z11 = 0,6492 + 1,4203 i     Z12 = −0,0808 − 0,0417 i     Z21 = 16,055 − 31,100 i
Avec Rsi, Rse :  Z12 paroi = −0,1077 − 0,4449 i      Z11 paroi = 0,0070 + 2,6643 i

Y12 = −1/Z12 = 0,514 − 2,123 i   →   |Y12| = 2,185 W/(m²·K)
Δt = 1,333 rad × 3,82 = 5,09 h       f = 2,185 / 3,892 = 0,56
κ1 = 13 751 × 2,843 / 0,4578 ≈ 85 400 J/(m²·K)
```

Règle approchée « mur épais » : retard ≈ 1,206 × 3,82 = 4,6 h (bon ordre de grandeur), amortissement ≈ e^(−1,206) = 0,30 (trop optimiste, car 20 cm ne suffisent pas à « oublier » la face intérieure).

## 5. Le résultat à retenir : ITI et ITE

Béton 20 cm + laine minérale 12 cm :

| | U | Δt | f | κ1 côté pièce |
|---|---|---|---|---|
| ITE | 0,271 | 7,3 h | 0,19 | **85 kJ/(m²·K)** |
| ITI (+ BA13) | 0,268 | 6,9 h | 0,38 | **14 kJ/(m²·K)** |

Ce qui traverse le mur change peu (U est petit dans les deux cas). Ce qui change, c'est la **masse utile à la pièce** : en ITI, l'isolant « débranche » le béton. Bouton « Retourner la paroi » pour le voir.

## 6. Comment on sait que c'est juste

- **Une deuxième méthode, totalement indépendante** : simulation par différences finies (tranches de 4 mm, 12 jours minute par minute). |Y12|, Δt et |Y11| concordent à **mieux que 0,1 %** (test Node `tests/confort-parois.test.js`).
- **Limites physiques testées** : couche très fine → f = 1 et Δt = 0 ; déterminant = 1 pour toutes les parois ; retourner une paroi garde U et |Y12| et échange κ1 et κ2 ; κ1 toujours sous le plafond de Rsi.
- L'exemple ci-dessus est recalculé par les tests au millième près.

## 7. Pièges

- **Déphasage seul = piège.** 12 h de déphasage avec f = 0,03, c'est un retard sur une onde déjà écrasée. Regarde **toujours f ou |Y12| d'abord**.
- **Masse totale ≠ masse utile.** Un plancher de 600 kg/m² n'offre que 65 à 95 kJ/(m²·K) à la pièce : l'onde de 24 h ne va pas au fond, et la chaleur doit passer Rsi.
- **Le plafond de Rsi** : κ1 ne dépasse jamais T/(2π)/Rsi ≈ 106 kJ/(m²·K). Au-delà d'environ 10 cm de béton côté pièce, ajouter de la masse ne sert presque plus. La « règle des 10 cm » l'oublie et surestime κ1 des parois lourdes.
- **U ne dépend pas de l'ordre des couches ; κ1 et f, si.**

## 8. Limites (H)

- **(H)** Onde sinusoïdale pure de 24 h, sans soleil sur la façade (température soleil-air à l'étape 2).
- **(H)** Matériaux creux (parpaing, brique creuse, monomur) traités comme une couche homogène équivalente.
- **(H)** Conduction 1D : pas de ponts thermiques ; lames d'air ventilées non traitées ; sol (ISO 13370) non modélisé.
- **(H)** Rs conventionnelles constantes.
- **(H)** **Toutes les valeurs de matériaux sont des exemples** (λ, ρ, c courants), à vérifier sur NF EN ISO 10456, les règles Th-U ou l'ACERMI.
- **(H)** Classes d'inertie : valeurs du tableau 12 de NF EN ISO 13790:2008 à vérifier sur le texte ; la règle « classe la plus proche » est la nôtre.
- **(H)** Paroi entre deux locaux semblables : on suppose que les deux côtés oscillent pareil.
- **(H)** Les exemples chiffrés du texte de NF EN ISO 13786 n'ont pas pu être comparés (texte non disponible).

## 9. Valeurs à vérifier quand tu auras les normes

| Valeur | Où | Statut |
|---|---|---|
| Rsi / Rse (0,13 / 0,10 / 0,17 ; 0,04) | NF EN ISO 6946 | valeurs conventionnelles bien connues, à confirmer sur le texte |
| Formules des matrices (Z11, Z12, Z21) | NF EN ISO 13786 | **vérifiées par la physique** (redémontrées + différences finies) |
| Classes Cm/Af et Am/Af (80 / 110 / 165 / 260 / 370 kJ ; 2,5 / 2,5 / 2,5 / 3 / 3,5) | NF EN ISO 13790:2008, tableau 12 | **(H)** à vérifier |
| λ, ρ, c des 23 matériaux | NF EN ISO 10456, Th-U, ACERMI | **exemples** |

---

## 3 questions pour vérifier que tu as compris

**Q1.** Deux murs ont le même U = 0,25 W/(m²·K). Le mur A a Δt = 14 h et f = 0,05 ; le mur B a Δt = 8 h et f = 0,30. Lequel laisse passer le plus de chaleur l'après-midi, et pourquoi le déphasage de A n'est-il pas l'argument principal ?

<details><summary>Réponse</summary>

Amplitude du flux qui arrive = f × U × amplitude dehors. Pour ± 8 °C : A → 0,05 × 0,25 × 8 = **± 0,1 W/m²** ; B → 0,30 × 0,25 × 8 = **± 0,6 W/m²**. B laisse passer 6 fois plus d'oscillation. Le retard de A s'applique à une onde presque nulle : c'est **f (ou |Y12|)** qui compte d'abord, Δt ensuite.
</details>

**Q2.** Pourquoi l'ITE donne-t-elle un bien meilleur confort d'été que l'ITI, alors que les deux murs ont le même U ?

<details><summary>Réponse</summary>

U ne dépend pas de l'ordre des couches (les résistances s'additionnent). Mais la pièce n'échange qu'avec ce qu'elle « touche ». En ITE, l'air de la pièce touche le béton : κ1 ≈ 85 kJ/(m²·K), le mur éponge les apports du jour (soleil des vitrages, occupants, PC) et les rend la nuit. En ITI, l'isolant coupe la pièce du béton : κ1 ≈ 14 kJ/(m²·K), la pièce se comporte comme une construction légère et monte vite en température.
</details>

**Q3.** Que représente δ ? Calcule-le pour une brique pleine (λ = 0,9, ρ = 1 800, c = 1 000) et dis ce que deviennent l'amplitude et le retard après 2δ dans un mur très épais.

<details><summary>Réponse</summary>

δ est la profondeur de pénétration de l'onde de 24 h : à chaque δ, l'amplitude est divisée par e ≈ 2,72 et le retard augmente de 1 rad = 3,82 h.
δ = √(0,9 × 86 400 / (π × 1 800 × 1 000)) = √0,01375 = **0,117 m ≈ 11,7 cm**.
Après 2δ (23 cm) : amplitude × e^(−2) ≈ **0,14** (86 % écrasés), retard ≈ 2 × 3,82 ≈ **7,6 h** (approximation « mur épais », sans Rsi ni Rse).
</details>
