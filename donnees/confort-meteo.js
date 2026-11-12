/* ==========================================================
   Confort d'été — les villes et leur météo (PUBLIC)
   ----------------------------------------------------------
   Source : PVGIS 5.3 (Photovoltaic Geographical Information System), Centre commun de recherche (JRC)
   de la Commission européenne : https://re.jrc.ec.europa.eu/pvg_tools/
   « Année météorologique type » (TMY) : pour chaque mois, le mois réel le plus représentatif
   des années 2005 à 2023 (rayonnement satellite SARAH-3, température, humidité et vent de la réanalyse ERA5).
   Licence (H) : la Commission autorise la réutilisation de ses données à condition de citer la source
   (décision 2011/833/UE) ; à vérifier sur la page « Legal notice » de PVGIS.

   Une année type n'est PAS une canicule : elle représente un été « normal ».
   La météo de chaque ville est dans donnees/meteo/<id>.js (chargée à la demande).
   Zone climatique RE2020 (H) : d'après le département, à vérifier dans l'arrêté du 4 août 2021.
   ========================================================== */
window.CONFORT_METEO_VILLES = {
  source: 'PVGIS 5.3, Commission européenne (JRC) — année météo type 2005–2023',
  lien: 'https://re.jrc.ec.europa.eu/pvg_tools/',
  dateRef: '2026-11',
  statut: 'valide',
  villes: [
    { id: 'paris', nom: 'Paris', lat: 48.857, lon: 2.352, zone: 'H1a' },
    { id: 'strasbourg', nom: 'Strasbourg', lat: 48.573, lon: 7.752, zone: 'H1b' },
    { id: 'lyon', nom: 'Lyon', lat: 45.764, lon: 4.836, zone: 'H1c' },
    { id: 'bordeaux', nom: 'Bordeaux', lat: 44.838, lon: -0.579, zone: 'H2c' },
    { id: 'toulouse', nom: 'Toulouse', lat: 43.604, lon: 1.444, zone: 'H2c' },
    { id: 'pau', nom: 'Pau', lat: 43.295, lon: -0.371, zone: 'H2c' },
    { id: 'bayonne', nom: 'Bayonne', lat: 43.493, lon: -1.475, zone: 'H2c' },
    { id: 'marseille', nom: 'Marseille', lat: 43.296, lon: 5.370, zone: 'H3' },
    { id: 'nice', nom: 'Nice', lat: 43.703, lon: 7.266, zone: 'H3' },
    { id: 'perpignan', nom: 'Perpignan', lat: 42.699, lon: 2.895, zone: 'H3' }
  ]
};
// Charge la météo d'une ville à la demande (une balise <script>, compatible file://), puis appelle suite(meteo).
// Partagé par l'onglet Projet (affichage/soleil.js) et le labo (affichage/labo.js). version : le ?v= du site.
window.CONFORT_METEO_VILLES.charger = function (id, suite, version, erreur) {
  const dispo = window.CONFORT_METEO && window.CONFORT_METEO[id];
  if (dispo) { suite(dispo); return; }
  const attente = window.CONFORT_METEO_VILLES.attentes = window.CONFORT_METEO_VILLES.attentes || {};
  if (attente[id]) { attente[id].push(suite); return; }
  attente[id] = [suite];
  const sc = document.createElement('script');
  sc.src = 'donnees/meteo/' + id + '.js' + (version ? '?v=' + version : '');
  sc.onload = function () { const l = attente[id]; delete attente[id]; if (window.CONFORT_METEO && window.CONFORT_METEO[id]) l.forEach(function (f) { f(window.CONFORT_METEO[id]); }); };
  sc.onerror = function () { delete attente[id]; if (erreur) erreur(id); };
  document.head.appendChild(sc);
};
if (typeof module !== 'undefined' && module.exports) module.exports = window.CONFORT_METEO_VILLES;
