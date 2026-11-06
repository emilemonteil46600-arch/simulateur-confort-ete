/* ==========================================================
   Outils pour les tests : charge les fichiers du site dans Node.
   Les fichiers du site remplissent des variables globales
   (window.BAO, window.BT01…) : ici, « window » = l'objet global de Node.
   ========================================================== */
const path = require('path');

const RACINE = path.join(__dirname, '..');
globalThis.window = globalThis;

// Faux localStorage (en mémoire) pour tester la sauvegarde sans navigateur.
const memoire = new Map();
globalThis.localStorage = {
  getItem: function (cle) { return memoire.has(cle) ? memoire.get(cle) : null; },
  setItem: function (cle, valeur) { memoire.set(cle, String(valeur)); },
  removeItem: function (cle) { memoire.delete(cle); },
  clear: function () { memoire.clear(); }
};

function charger(fichier) {
  return require(path.join(RACINE, fichier));
}

// Compare deux nombres à une précision donnée (ex. 0.001).
function proche(valeur, attendu, precision) {
  return Math.abs(valeur - attendu) <= (precision || 1e-9);
}

module.exports = { RACINE, charger, proche };
