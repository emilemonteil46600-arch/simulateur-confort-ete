/* ==========================================================
   CONFORT D'ÉTÉ — SOMMAIRE DU CALCUL
   ----------------------------------------------------------
   Le simulateur se lit comme un cours en plusieurs chapitres.
   Chaque chapitre est un fichier de fonctions pures (aucun accès à la page) :

     Chapitre 1  calcul-parois.js       Les parois : U, masse, déphasage,
                                        amortissement, admittance, κ, inertie du local
     Chapitre 1 bis calcul-batiment.js  La maison : orientation, surfaces, volume,
                                        déperditions H = Σ U·A, inertie de la maison
     Chapitre 1 ter calcul-transitoire.js Le labo : la chaleur qui avance (différences finies)
     Chapitre 2  calcul-soleil.js       Météo, soleil sur les façades, apports de chaleur
     Chapitre 3  calcul-5r1c.js         (étape 3) le modèle horaire 5R1C
     Chapitre 4  calcul-indicateurs.js  (étape 4) heures, DH, adaptatif, PMV/PPD, score
     Chapitre 5  calcul-preconisations.js (étape 5) sensibilité et bouquets

   Ce fichier ne calcule rien : il rassemble les chapitres sous un seul nom,
   ConfortCalcul, pour l'interface et pour les tests Node.
   ========================================================== */
(function (global) {
  'use strict';

  const parois = global.ConfortParois ||
    (typeof require === 'function' ? require('./calcul-parois.js') : null);

  const batiment = global.ConfortBatiment ||
    (typeof require === 'function' ? require('./calcul-batiment.js') : null);

  const transitoire = global.ConfortTransitoire ||
    (typeof require === 'function' ? require('./calcul-transitoire.js') : null);

  const soleil = global.ConfortSoleil ||
    (typeof require === 'function' ? require('./calcul-soleil.js') : null);

  const ConfortCalcul = {
    parois: parois,
    batiment: batiment,
    transitoire: transitoire,
    soleil: soleil
  };

  global.ConfortCalcul = ConfortCalcul;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortCalcul;
})(typeof window !== 'undefined' ? window : globalThis);
