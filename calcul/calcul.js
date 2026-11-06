/* ==========================================================
   CONFORT D'ÉTÉ — SOMMAIRE DU CALCUL
   ----------------------------------------------------------
   Le simulateur se lit comme un cours en plusieurs chapitres.
   Chaque chapitre est un fichier de fonctions pures (aucun accès à la page) :

     Chapitre 1  calcul-parois.js       Les parois : U, masse, déphasage,
                                        amortissement, admittance, κ, inertie du local
     Chapitre 2  calcul-soleil.js       (étape 2) météo, soleil sur les façades, apports
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

  const ConfortCalcul = {
    parois: parois
  };

  global.ConfortCalcul = ConfortCalcul;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortCalcul;
})(typeof window !== 'undefined' ? window : globalThis);
