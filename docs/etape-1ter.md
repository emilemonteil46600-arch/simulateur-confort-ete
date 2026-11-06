# Étape 1 ter — Le labo : la chaleur qui traverse le mur (fiche de compréhension)

> But de l'étape : **voir** l'inertie. On construit un mur couche par couche (on ajoute, on glisse l'isolant
> d'un côté à l'autre, on met un BA13), on choisit ce qui se passe dehors et dans la pièce, puis on lance le temps.
> La température avance dans le mur, le flux entre dans la pièce, minute par minute.

Où le voir : onglet **Atelier parois** › « Le labo », en haut de la page.

---

## 1. Ce qu'on voit à l'écran

| À l'écran | Ce que c'est | Unité |
|---|---|---|
| Couleurs du mur (bleu → rouge) | La **température** de chaque tranche de 5 mm | °C |
| Courbe noire | Le profil θ(x) : air de la pièce → face intérieure → mur → face extérieure → air dehors | °C |
| Pente de la courbe | Le **gradient** dθ/dx | K/m |
| Flèche dans la pièce | Le **flux** de chaleur qui entre (q = −λ·dθ/dx à la surface) | W/m² |
| Horloge | Le temps simulé (jour, heure) | h |
| Graphique du bas | T dehors, T de la pièce, T de la face intérieure dans le temps | °C |

**Vocabulaire juste :** ce qui **avance**, c'est la température (elle diffuse) ; ce qui **passe**, c'est le **flux de chaleur**.
« Le flux traverse le mur » est donc correct. La flèche est grande quand la courbe est raide près de la face intérieure.

## 2. La méthode : les différences finies

1. On découpe le mur en tranches de 5 mm au plus. Tranche i : capacité Ci = ρ·c·dx [J/(m²·K)].
2. Entre deux tranches, conductance G = 1 / (dx1/(2λ1) + dx2/(2λ2)) : Fourier entre deux points voisins (deux demi-tranches en série).
3. Bilan de chaque tranche pendant Δt = 60 s : **ce qui s'accumule = ce qui entre − ce qui sort**
   `Ci × (Ti' − Ti)/Δt = G gauche × (T gauche' − Ti') + G droite × (T droite' − Ti')`
4. Schéma **implicite** (températures de fin de pas) : toujours stable. On résout un système tridiagonal (algorithme de Thomas).

C'est l'équation de la chaleur ∂θ/∂t = a·∂²θ/∂x² écrite tranche par tranche, exactement ce que fait une STD.

**La pièce** (mode « libre ») : un nœud de plus. Capacité Cp = (1 200 × V + mobilier) / A mur, ventilation Hv = 1 200 × n × V / 3 600 / A mur.
(H) Seul le mur étudié échange avec la pièce ; les autres parois sont adiabatiques et sans masse.

## 3. Le bon réflexe : t ≈ e²/a

Le temps qu'une variation de température met à traverser une épaisseur e : **t ≈ e² / a**, avec a = λ/(ρc).
- Béton 20 cm : 0,04 / 1,0·10⁻⁶ = 40 000 s ≈ **11 h**.
- Laine minérale 12 cm : 0,0144 / 1,7·10⁻⁶ ≈ 8 500 s ≈ **2,4 h**.

Piège : l'isolant laisse passer le **front** de température plus vite que le béton, mais il transporte **très peu de chaleur** (λ 65 fois plus petit). La vitesse du front et la quantité de chaleur, ce n'est pas la même chose.

## 4. L'expérience qui résume tout (refaite par les tests)

Béton 18 cm + PSE 14 cm (U = 0,252 dans les deux cas). Coup de chaud : dehors passe de 20 à 35 °C et y reste.
Pièce « libre » (10 m² de ce mur, 50 m³, 0,5 vol/h, sans mobilier) :

| | Pièce après 6 h | après 24 h | après 72 h | mi-chemin atteint en |
|---|---|---|---|---|
| **ITE** (béton côté pièce) | 22,5 °C | 24,2 °C | 27,8 °C | **20,5 h** |
| **ITI** (isolant côté pièce) | 31,7 °C | 34,6 °C | 35,0 °C | **2 h** |

Même U, mais **10 fois plus de temps** pour chauffer la pièce en ITE. L'air neuf apporte la chaleur, et en ITE le béton l'absorbe. En ITI, l'isolant « débranche » le béton de la pièce.

## 5. Comment on sait que c'est juste

- **Journées d'été en régime établi** : le labo retrouve |Y12| et le déphasage des matrices de l'étape 1 à moins de 1 % (deux méthodes indépendantes).
- **Coup de chaud très long** : le flux tend exactement vers **U × ΔT** (le régime permanent de l'hiver).
- **Conservation de l'énergie** : la variation d'énergie stockée égale l'énergie entrée à 10⁻⁹ près (affiché sous le graphique).
- Tests du maillage (5 mm, 2 tranches minimum) et de l'algorithme de Thomas sur un petit système connu.

## 6. Limites (H)

- **(H)** Conduction 1D (pas de ponts thermiques).
- **(H)** Pas de soleil sur la façade : la température soleil-air arrive à l'étape 2.
- **(H)** Pièce simplifiée : un seul mur échange, les autres sont adiabatiques et sans masse ; ρc de l'air = 1 200 J/(m³·K).
- **(H)** Rs constantes ; air neuf à la température extérieure, sans récupération.
- **(H)** Schéma implicite d'ordre 1 en temps : avec Δt = 60 s, l'écart sur l'amplitude reste sous 1 % (vérifié).

---

## 3 questions pour vérifier que tu as compris

**Q1.** Dans le labo, tu vois la couleur changer **plus vite** dans l'isolant que dans le béton. Pourtant l'isolant protège. Comment c'est possible ?

<details><summary>Réponse</summary>

La vitesse du front dépend de la **diffusivité** a = λ/(ρc). L'isolant a un λ minuscule, mais aussi un ρc minuscule : son a (≈ 1,7·10⁻⁶ m²/s) est du même ordre que celui du béton. Le front le traverse donc vite (t ≈ e²/a ≈ 2,4 h pour 12 cm).
Mais la **quantité de chaleur** qui passe est le flux q = −λ·dθ/dx, et λ est 65 fois plus petit que celui du béton. La température change vite, mais presque aucune chaleur ne passe.
</details>

**Q2.** Coup de chaud, pièce climatisée à 20 °C, mur béton 18 + PSE 14. Vers quoi tend le flux qui entre au bout de très longtemps, et pourquoi le labo met-il des dizaines d'heures à y arriver en ITE ?

<details><summary>Réponse</summary>

Vers le régime permanent : q = U × ΔT = 0,252 × 15 = **3,8 W/m²**.
En ITE, il faut d'abord **charger le béton** côté pièce (une grosse capacité ρ·c·e) avant que le flux atteigne la pièce. Ce stockage prend des dizaines d'heures. En ITI, le béton est dehors et la face intérieure (isolant + enduit) répond vite.
</details>

**Q3.** Pourquoi le schéma de calcul est-il **implicite**, et que se passerait-il avec un schéma explicite à Δt = 60 s sur des tranches de 5 mm de béton ?

<details><summary>Réponse</summary>

Le schéma explicite n'est stable que si le nombre de Fourier Fo = a·Δt/dx² ≤ 1/2. Pour le béton (a = 10⁻⁶ m²/s) et dx = 5 mm : Fo = 10⁻⁶ × 60 / 0,005² = **2,4** > 0,5. Les températures se mettraient à osciller et à exploser (instabilité numérique). L'implicite calcule toutes les températures de fin de pas ensemble (système tridiagonal) : il est stable quel que soit Δt.
</details>
