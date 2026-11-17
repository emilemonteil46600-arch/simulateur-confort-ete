# Comparer des parois — l'existant et ses variantes (fiche de compréhension)

> Cap du projet depuis le 16/11/2026 : Pléiades fait déjà le bâtiment. Cet outil sert à **comparer des parois, proprement**,
> et à en sortir une preuve (un graphe, une fiche) pour défendre un choix de composition.

Où le voir : onglet **Paroi** (le premier).
1. Compose la paroi existante (cartes mur / toiture / plancher, coupe animée), puis **« ＋ Ajouter à la comparaison »**.
2. Modifie une couche, ajoute la variante. Jusqu'à 4 parois. Les parois ajoutées sont des **copies figées**.
3. Carte **Comparaison de parois** : coupes, graphe superposé, tableau d'écarts, exports.
   « Charger un exemple » montre béton nu, isolation intérieure, isolation extérieure.

---

## 1. Les mêmes conditions pour toutes

| Condition | Valeur | D'où elle vient |
|---|---|---|
| Face extérieure | température sol-air (air + soleil absorbé − ciel) ; sol sous la dalle pour un plancher | réglages de la coupe animée : ville, période, orientation, pente, couleur α |
| Pièce | **maintenue à 26 °C (H)** | on isole la paroi : ce qu'on voit ne dépend que d'elle |
| Hiver | −5 °C dehors, 20 °C dedans (H), régime permanent | convention de l'outil |
| Mise en régime | 4 jours avant la période | la paroi a oublié sa température de départ |

## 2. Ce qu'on calcule

```
Été, simulation heure par heure (différences finies 1D) :
  θsi = θpièce + Rsi × q            la face intérieure monte de Rsi × q au-dessus de l'air
  flux de pointe = max de q          chaleur entrée par jour = Σ q⁺ × 1 h / nombre de jours
Été, régime périodique 24 h (NF EN ISO 13786) : Δt, f, κ1
Hiver, régime permanent :
  U, R = 1/U, θsi = θi − U × Rsi × (θi − θe)
Mise en œuvre : épaisseur totale, masse surfacique
```

## 3. L'exemple, refait à la main (Toulouse, façade Ouest moyenne, semaine du 14 juin)

| | Béton 18 nu (existant) | + PSE 14 intérieur | + PSE 14 extérieur |
|---|---|---|---|
| Flux de pointe | 61,7 W/m² | 3,5 | 2,4 |
| Face intérieure max = 26 + 0,13 × q | 26 + 8,0 = **34,0 °C** | 26,5 | 26,3 |
| κ1 côté pièce | 73,8 kJ/(m²·K) | **14,4** (−59,5) | 75,8 |
| U | 3,66 | 0,251 | 0,252 |
| θsi hiver = 20 − U × 0,13 × 25 | 20 − 11,9 = **8,1 °C** | 19,2 | 19,2 |
| Épaisseur | 19 cm | 33,3 | 34 |

## 4. Comment lire le résultat

- **La courbe montre ce qui traverse.** ITI et ITE y sont presque confondues : même U, presque le même flux.
- **κ1 montre ce que la paroi absorbe de la pièce** (soleil par les vitrages, occupants). L'ITI la fait tomber de 74 à 14 :
  la pièce perd son amortisseur. C'est la ligne rouge du tableau, et l'argument de l'ITE en confort d'été.
- **L'hiver compte autant** : une face intérieure à 8 °C, c'est une paroi froide et un risque de condensation.
- Vert = mieux que l'existant, rouge = moins bien, gris = contrainte (épaisseur, masse).

## 5. Les exports

- **PNG** du graphe affiché (titre, conditions, légende), prêt pour un rapport ou une publication.
- **Fiche d'une page** (imprimer, ou « Enregistrer en PDF ») : coupes, deux graphes, tableau, matériaux avec source et statut,
  méthode et limites.

## 6. Pièges et limites (H)

- **Valeurs d'exemple** : tant qu'un matériau n'est pas « validé » dans Matériaux & climat, la fiche l'écrit. Mets tes valeurs
  sourcées (ACERMI, fiche fabricant, règles Th-U) avant tout usage dans un rapport.
- **Paroi seule, flux 1D** : pas de ponts thermiques, pas d'humidité, pas de lame d'air ventilée.
- **Pièce à 26 °C** : c'est une convention pour comparer. Ce n'est pas la température qu'aura le local.
- **Année type** : un été normal, pas une canicule.
- Une paroi ne fait pas le confort d'un bâtiment : vitrages, protections et ventilation pèsent souvent plus. La comparaison
  répond à « quelle composition ? », pas à « ce bâtiment est-il confortable ? ».

---

## 3 questions pour vérifier que tu as compris

**1.** ITI et ITE donnent presque la même courbe de face intérieure. Un client te dit : « donc c'est pareil, je prends le moins
cher ». Que réponds-tu ?

<details><summary>Réponse</summary>

La courbe montre ce qui traverse la paroi depuis dehors : à U égal, c'est presque pareil. Mais la pièce chauffe surtout par
ses vitrages et ses occupants. Cette chaleur-là, c'est la face intérieure qui l'absorbe : κ1 = 76 kJ/(m²·K) en ITE (le béton
reste au contact de la pièce), 14 en ITI (l'isolant le coupe). En ITI, la pièce perd l'essentiel de son inertie et ses pointes
de température seront plus hautes. Pareil l'hiver, pas l'été.

</details>

**2.** Pourquoi maintenir la pièce à 26 °C plutôt que la laisser évoluer librement ?

<details><summary>Réponse</summary>

Pour comparer des parois, il faut que seule la paroi change. Si la pièce évolue librement, sa température dépend aussi de son
volume, de sa ventilation, de la surface de la paroi : autant d'hypothèses qui brouillent la comparaison. À température fixe,
le flux et la température de face ne dépendent que de la paroi et de la météo.

</details>

**3.** Le béton nu a une face intérieure à 8,1 °C par −5 °C dehors. Refais le calcul, et dis pourquoi c'est un problème.

<details><summary>Réponse</summary>

θsi = θi − U × Rsi × (θi − θe) = 20 − 3,66 × 0,13 × 25 = 20 − 11,9 = 8,1 °C. La paroi rayonne du froid (inconfort même avec
un air à 20 °C), et elle est sous le point de rosée d'un air intérieur ordinaire (≈ 9 à 12 °C pour 20 °C et 50 à 60 %
d'humidité) : la vapeur d'eau y condense, avec des moisissures à la clé.

</details>
