# Étape 2 — La météo, le soleil et la chaleur qui entre (fiche de compréhension)

> But de l'étape : savoir, **heure par heure**, combien de watts entrent dans la maison : par le soleil
> (fenêtres, murs, toit) et par ses occupants. C'est l'entrée du modèle horaire de l'étape 3, qui dira
> quelle température il fait dedans.

Où le voir : onglet **Projet**.
- Étape 1 de la saisie : la **ville** (10 villes, météo PVGIS).
- Sous la maquette : la barre **jour · heure** et ▶ pour animer la journée. Le soleil tourne, l'ombre bouge,
  les façades chauffent (orange), les volets descendent quand la façade dépasse 200 W/m².
- Carte « **Le soleil sur ta maison** » : la journée façade par façade, tout l'été, la semaine la plus chaude,
  et **l'heure affichée calculée pas à pas**.
- Carte de droite « **Ce qui entre dans la maison** » : le bilan de juin à septembre, et ce que les protections évitent.
- Saisie : couleur des murs et de la couverture, **casquette** par façade. Onglet Données : protections (Fc, seuil),
  météo, scénarios d'apports internes.

---

## 1. La météo : une année type

| Grandeur | Ce que c'est | Unité |
|---|---|---|
| T | Température de l'air à 2 m | °C |
| HR | Humidité relative (servira à l'étape 4 : PMV, Givoni) | % |
| **Gbn** | Rayonnement **direct**, mesuré face au soleil | W/m² |
| **Gdh** | Rayonnement **diffus** (tout le ciel), sur un plan horizontal | W/m² |
| V | Vent à 10 m | m/s |

- Source : **PVGIS 5.3** (Commission européenne, JRC) : satellites SARAH-3 pour le soleil, réanalyse ERA5 pour le reste.
- **Année type (TMY)** : pour chaque mois, le mois réel le plus « moyen » de 2005 à 2023, mis bout à bout. Un été **normal**, pas une canicule.
- Heures en **UTC**. Le rayonnement de l'heure k est mesuré à k + 0,1746 h (≈ 10 min). Vérifié : avec ce décalage,
  Gbn × sin h + Gdh retrouve le global horizontal de PVGIS à 2 W/m² près (9 W/m² sans, 17 W/m² à la demi-heure).
- 10 villes embarquées (≈ 145 ko chacune), chargées seulement quand on les choisit : le site marche toujours sans réseau.

## 2. Où est le soleil ?

| Étape | Formule | Pourquoi |
|---|---|---|
| Angle du jour | B = 360° × (n − 1 + (t − 12)/24) / 365 | La position de la Terre sur son orbite |
| Déclinaison | δ = série de Spencer en cos B, sin B… | L'axe penché de 23,44° : les saisons |
| Équation du temps | E = 229,2 × (…) min | Orbite elliptique + axe penché : le soleil avance / retarde de −14 à +16 min |
| Heure solaire | ts = t(UTC) + longitude/15 + E/60 | 15° par heure, donc 4 min par degré de longitude |
| Angle horaire | ω = 15° × (ts − 12) | Négatif le matin |
| Hauteur | sin h = sin φ sin δ + cos φ cos δ cos ω | Rotation du repère de l'équateur vers le lieu |
| Azimut | a = 180° + atan2(sin ω, cos ω sin φ − tan δ cos φ) | Depuis le Nord, sens horaire |
| Vecteur soleil | s = (cos h sin a ; cos h cos a ; sin h) | (Est, Nord, haut) : le même repère que la maquette |

**Repère de tête** : à midi solaire, h = 90° − φ + δ. Toulouse le 21 juin : ≈ 70°. En été, le soleil de midi tape
surtout le **toit** ; il arrive en biais sur une façade Sud.

## 3. Ce que reçoit une paroi (inclinaison β, azimut γ, normale n)

```
direct    Ib = Gbn × max(0 ; cos θ)            cos θ = s · n   (produit scalaire)
diffus    Id = Gdh × (1 + cos β) / 2           un mur voit la moitié du ciel
réfléchi  Ir = ρ × Gh × (1 − cos β) / 2        ρ = albédo du sol (H 0,2) ; Gh = Gbn sin h + Gdh
```

Modèle « ciel isotrope » de Liu et Jordan (H). En été (Toulouse, juin → août), **l'Ouest reçoit ≈ 10 % de plus que le Sud**,
et au moment le plus chaud de la journée.

## 4. Ce qui entre par une fenêtre

```
Φ = I_vitre × A × (1 − Ff) × g × Fw × Fc        [W]
```

| Terme | Valeur | Origine |
|---|---|---|
| I_vitre | direct × part au soleil + diffus + réfléchi | casquette : part au soleil = 1 − (d tan Ω − e)/H, tan Ω = tan h / cos(a − γ) |
| Ff | 0,3 | cadre opaque, NF EN ISO 13790 (H) |
| g | 0,5 à 0,85 | facteur solaire du vitrage (Données › Types de fenêtres) |
| Fw | 0,9 | le vitrage transmet moins en biais, NF EN ISO 13790 (H) |
| Fc | 1 relevée ; 0,15 (BSO) à 0,65 (store intérieur) baissée | exemples (H), NF EN ISO 52022-1 à vérifier |
| Gestion | baissée si la façade reçoit > 200 W/m² | hypothèse (H) |

Une protection **intérieure** arrête le soleil après la vitre : la chaleur est déjà dedans. D'où Fc ≈ 0,65.

## 5. Murs, toit, occupants

```
Paroi opaque :  Φ = α × Rse × U × A × I  −  Fciel × Rse × U × A × hr × Δθer
                α couleur (0,4 claire → 0,8 sombre (H)) ; Rse 0,04 ; hr 4,5 W/(m²·K) ; Δθer 11 K (H)
Exemple : mur clair, U 0,5, 20 m², 500 W/m² → 80 − 9,9 = 70,1 W ; 4 fois plus isolé → 17,5 W
```

Rse × U, c'est la part de la chaleur absorbée qui traverse : une paroi isolée laisse passer très peu de soleil.

**Apports internes** : puissance de pointe (W/m²) × profil horaire (0 à 1), semaine / week-end, en heure légale.
Logement d'exemple ≈ 4,5 W/m² en moyenne (4 personnes × 75 W sur 80 m², appareils, éclairage). Écoles fermées
du 7 juillet au 31 août (H). Toutes les valeurs sont des **exemples (H)**.

## 6. L'heure type, refaite à la main (Toulouse, 21 juillet, 16 h)

```
16 h (heure d'été) = 14 h UTC ; soleil placé à 14,1746 h ; n = 202
B = 198,336° ; δ = 20,620° ; E = −6,360 min
ts = 14,1746 + 1,444/15 − 6,360/60 = 14,1649 h ; ω = 32,473°
sin h = 0,6897 × 0,3522 + 0,7241 × 0,9359 × 0,8436 = 0,8146 → h = 54,55° ; a = 240,05°
s = (−0,5025 ; −0,2896 ; 0,8146)
T = 32 °C ; Gbn = 792 ; Gdh = 153 ; Gh = 792 × 0,8146 + 153 = 798,2 W/m²
Façade Ouest, n = (−1 ; 0 ; 0) : cos θ = 0,5025
  398,0 (direct) + 76,5 (diffus) + 79,8 (réfléchi) = 554,3 W/m²
Fenêtre Ouest 3 m², g 0,6 : 554,3 × 3 × 0,7 × 0,6 × 0,9 = 628,6 W   (≈ 8 personnes au repos)
  volet roulant baissé (Fc 0,25) : 157,1 W
```

Le même calcul est affiché sous la maquette (« L'heure affichée calculée pas à pas ») et refait par les tests.

## 7. Ce que donne la maison d'exemple (Toulouse, juin → septembre)

| Poste | kWh |
|---|---|
| Soleil par les fenêtres (avec les volets) | 816 |
| Apports internes | 1 092 |
| Soleil par les murs | 59 |
| Soleil par le plafond des combles | 79 |
| Fenêtres **sans** protection | 1 745 |

Les volets roulants évitent ≈ 930 kWh. Des BSO partout : 667 kWh.

## 8. Comment on sait que c'est juste

1. **Soleil** : comparé à une méthode indépendante (NOAA / Meeus), toute l'année, Toulouse et Paris : < 0,5° sur la hauteur.
2. **Décalage horaire** : vérifié sur les données (section 1).
3. **Façades** : comparées au calcul de PVGIS (Toulouse 2022, Sud et Ouest verticales, mai → septembre) :
   direct à **< 2 %** chaque mois ; total à **< 4 %** sur l'été (modèle de ciel différent : Muneer chez PVGIS).
4. **Exemples à la main** (heure type, casquette, paroi opaque) refaits par `tests/confort-soleil.test.js`.
5. **Sens physiques** : Ouest > Sud en été, toit > façades, BSO ÷ 2, casquette au Sud efficace, isolation ÷ 4 → soleil ÷ 4.

## 9. Limites (H)

- Ciel isotrope ; albédo 0,2 ; Ff 0,3 ; Fw 0,9 ; Fc et seuil de gestion : **exemples**.
- Pas de masques lointains (relief, voisins, arbres). Casquette infiniment longue, diffus non réduit, pas de joues.
- Combles perdus : le comble qui chauffe sous les tuiles n'est pas modélisé (toiture probablement sous-estimée).
- Apports internes d'exemple, chaleur sensible seulement. Heure d'été du 1er avril au 31 octobre ; l'année type commence un lundi.
- Année type = été normal. **Pas encore de canicule** : PVGIS donne les années réelles 2005–2023 heure par heure,
  mais **sans l'humidité** (nécessaire pour PMV / Givoni à l'étape 4). À décider avec Émile.
- Zones RE2020 des villes (H) : à vérifier dans l'arrêté.

---

## 3 questions pour vérifier que tu as compris

**1.** Fin juin à Toulouse, à midi solaire, le soleil est à environ 70° de hauteur. Pourquoi une façade Sud
reçoit-elle alors **moins** de direct qu'une façade Ouest à 18 h (heure d'été) ?

<details><summary>Réponse</summary>

Le direct sur une façade verticale vaut Gbn × cos θ, avec cos θ = cos h × cos(a − γ).
À midi, plein Sud : cos θ = cos 70° ≈ 0,34 : le soleil arrive très en biais, il « glisse » sur la façade.
À 18 h (≈ 16 h solaire, ω = 60°), le soleil est bas (h ≈ 37°) et presque plein Ouest (a ≈ 268°) :
cos θ ≈ cos 37° × cos 2° ≈ 0,8.
Plus de deux fois plus de direct, et au moment où l'air est le plus chaud.

</details>

**2.** Une fenêtre Ouest de 3 m² (g = 0,6) reçoit 554 W/m². Elle laisse entrer 629 W sans protection.
Avec un store **intérieur** (Fc 0,65), puis un volet **extérieur** (Fc 0,25), combien entre-t-il, et pourquoi un tel écart ?

<details><summary>Réponse</summary>

Store intérieur : 629 × 0,65 ≈ 409 W. Volet extérieur : 629 × 0,25 ≈ 157 W.
Le store intérieur arrête la lumière **après** la vitre : le rayonnement est entré, il chauffe le store,
qui rend sa chaleur à l'air de la pièce. Le volet l'arrête **avant** : la chaleur reste dehors.

</details>

**3.** Le toit reçoit beaucoup plus de soleil que les façades (584 kWh/m² contre 220 à 380). Pourtant, dans la
maison d'exemple, il ne fait entrer que 79 kWh sur l'été, contre 816 pour les fenêtres. Pourquoi ? Et qu'est-ce
que le calcul oublie peut-être (H) ?

<details><summary>Réponse</summary>

Une paroi opaque ne laisse passer que la part Rse × U de la chaleur absorbée : avec U ≈ 0,2 et Rse = 0,04,
c'est moins de 1 %. Le reste repart dehors. Une fenêtre, elle, laisse entrer directement 38 % (0,7 × 0,6 × 0,9)
du rayonnement.
Ce qu'on oublie peut-être : en combles perdus, les tuiles chauffent l'air du comble, qui peut dépasser 40 °C
et chauffer le plafond par le dessus. Le calcul applique la formule au plafond comme s'il était dehors (H) :
l'effet de la toiture est probablement sous-estimé. Les parois en différences finies (étape 8) pourront le corriger.

</details>
