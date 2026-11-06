# Simulateur de confort d'été

Un simulateur de confort d'été **transparent** pour l'audit énergétique des bâtiments : chaque formule est expliquée,
sourcée et vérifiée. Il complète une STD (Pléiades) pour tester vite des variantes et comprendre ce qui pèse.

**En ligne :** https://emilemonteil46600-arch.github.io/simulateur-confort-ete/

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Parois couche par couche : U, déphasage, amortissement, admittance, capacité κ (NF EN ISO 13786), inertie du local (NF EN ISO 13790), validées par différences finies | ✅ |
| 2 | Météo embarquée, soleil sur chaque façade, apports solaires et internes | à venir |
| 3 | Modèle horaire 5R1C : températures d'air, radiante, opérative | à venir |
| 4 | Indicateurs : heures > 26/28 °C, degrés-heures, confort adaptatif, PMV/PPD, Givoni, score sur 100 | à venir |
| 5 | Préconisations automatiques : ce qui pèse le plus, bouquets | à venir |
| 6 | Outil complet : pièce / bâtiment, logement / tertiaire, variantes, fiche Word | à venir |
| 7 | Validation face à Pléiades | à venir |

Cahier des charges : [`docs/CAHIER-DES-CHARGES.md`](docs/CAHIER-DES-CHARGES.md). Une fiche de compréhension par étape dans [`docs/`](docs/).

## Principes

- **Calcul · Méthode · Données** : le résultat, le cours (formules, physique, exemple refait à la main, limites), les valeurs modifiables.
- **Aucun chiffre sans source**, **hypothèses marquées (H)**.
- HTML, CSS, JavaScript purs, sans installation : ouvrir `index.html`. Tests : `node --test`.
- Les données personnelles restent dans le navigateur (sauvegarde complète en JSON).

Fait partie des outils d'Émile : [boîte à outils thermique](https://emilemonteil46600-arch.github.io/boite-a-outils-thermique/).
