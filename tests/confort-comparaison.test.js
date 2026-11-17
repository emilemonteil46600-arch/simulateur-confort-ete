/* Tests du comparateur de parois : mêmes conditions pour toutes, écarts à l'existant, hiver.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

charger('commun/commun.js');
charger('donnees/confort-materiaux.js');
charger('donnees/confort-projet.js');
const P = charger('calcul/calcul-parois.js');
const S = charger('calcul/calcul-soleil.js');
const K = charger('calcul/calcul-comparaison.js');
const C = charger('calcul/calcul.js');
const METEO = charger('donnees/meteo/toulouse.js');
const M = window.CONFORT_MATERIAUX, X = window.CONFORT_PROJET;
const modele = function (id) { return M.parois.find(function (p) { return p.id === id; }); };
const COND = { meteo: METEO, lieu: { lat: 43.604, lon: 1.444 }, nature: 'mur', orientation: 270, pente: 35, alpha: 0.6, debut: 'semaine', jours: 5, sol: X.sol };

test('Sommaire : le comparateur est dans ConfortCalcul', function () { assert.equal(C.comparaison, K); });

test('Hiver : θsi = θi − U × Rsi × (θi − θe) ; mur non isolé froid, mur isolé tiède', function () {
  // Béton 20 cm nu : U = 3,892 → 20 − 3,892 × 0,13 × 25 = 7,35 °C (paroi froide, condensation probable).
  assert.ok(proche(K.hiver(3.892, 0.13).tSi, 7.351, 1e-3));
  // U = 0,25 → 20 − 0,25 × 0,13 × 25 = 19,19 °C.
  assert.ok(proche(K.hiver(0.25, 0.13).tSi, 19.1875, 1e-9));
  assert.ok(proche(K.hiver(0.25, 0.13).R, 4, 1e-12));
});

test('Scénario commun : semaine la plus chaude de Toulouse, façade Ouest, 4 jours de préchauffage, heure légale', function () {
  const sc = K.scenarioMeteoParoi(COND);
  assert.equal(sc.jourDebut, S.jourDeLAnnee(6, 14), 'la semaine la plus chaude de l\'année type commence le 14 juin');
  assert.equal(sc.duree, 120); assert.equal(sc.origine, -96);
  assert.equal(sc.valeurs.length, 96 + 120 + 1);
  let max = -Infinity; for (let i = 96; i < sc.valeurs.length; i++) max = Math.max(max, sc.valeurs[i]);
  assert.ok(proche(max, 52.0, 0.1), 'sol-air max ' + max);
  // Plancher bas : le sol, presque constant, sans soleil.
  const sol = K.scenarioMeteoParoi(Object.assign({}, COND, { nature: 'plancher' }));
  let mn = Infinity, mx = -Infinity; for (let i = 0; i < sol.valeurs.length; i++) { mn = Math.min(mn, sol.valeurs[i]); mx = Math.max(mx, sol.valeurs[i]); }
  assert.ok(mx - mn < 1 && mx < 16, 'sol ' + mn + ' → ' + mx);
});

test('Comparer : béton nu (existant), ITI et ITE dans les mêmes conditions', function () {
  const sc = K.scenarioMeteoParoi(COND);
  const nu = { couches: [{ materiau: 'beton-arme', e: 0.18 }] };
  const iti = { couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'pse', e: 0.14 }, { materiau: 'beton-arme', e: 0.18 }] };
  const ite = { couches: [{ materiau: 'beton-arme', e: 0.18 }, { materiau: 'pse', e: 0.14 }] };
  const ev = [nu, iti, ite].map(function (p) { return K.evaluerParoi(p, M.materiaux, 'mur', sc); });
  assert.ok(ev.every(function (e) { return e.ok; }));
  // La face intérieure : θsi = θpièce + Rsi × q, à chaque heure.
  const e0 = ev[0], i = 60;
  assert.ok(proche(e0.serie.tSi[i], 26 + 0.13 * e0.serie.flux[i], 1e-9));
  // Le mur nu laisse entrer beaucoup ; les deux isolations écrasent le flux ; même U pour ITI et ITE.
  assert.ok(e0.valeurs.fluxMax > 30, 'béton nu : ' + e0.valeurs.fluxMax + ' W/m²');
  assert.ok(ev[1].valeurs.fluxMax < 5 && ev[2].valeurs.fluxMax < 5);
  assert.ok(proche(ev[1].valeurs.U, ev[2].valeurs.U, 0.02));
  // L'ITE garde la masse côté pièce : κ1 bien plus grand que l'ITI.
  assert.ok(ev[2].valeurs.kappa1 > 5 * ev[1].valeurs.kappa1, 'κ1 ITE ' + ev[2].valeurs.kappa1 + ' / ITI ' + ev[1].valeurs.kappa1);
  // Hiver : la face intérieure passe de ≈ 7 °C à plus de 19 °C.
  assert.ok(e0.valeurs.tSiHiver < 9 && ev[2].valeurs.tSiHiver > 19);
  // Le tableau : la référence n'a pas d'écart ; les variantes sont jugées dans le bon sens.
  const t = K.comparer(ev, 0);
  assert.equal(t.length, K.LIGNES.length);
  const ligne = function (id) { return t.find(function (l) { return l.id === id; }); };
  assert.ok(ligne('U').cases[0].reference && ligne('U').cases[0].ecart === undefined);
  assert.equal(ligne('U').cases[2].jugement, 'mieux');
  assert.equal(ligne('fluxMax').cases[1].jugement, 'mieux');
  assert.equal(ligne('kappa1').cases[1].jugement, 'pire', 'l\'ITI dégrade la capacité côté pièce');
  assert.equal(ligne('epaisseur').cases[2].jugement, 'neutre');
  assert.ok(proche(ligne('epaisseur').cases[2].ecart, 14, 1e-9));
  // Une paroi incomplète ne casse pas le tableau.
  const bad = K.evaluerParoi({ couches: [{ materiau: 'inconnu', e: 0.1 }] }, M.materiaux, 'mur', sc);
  assert.equal(bad.ok, false);
  assert.equal(K.comparer([ev[0], bad], 0)[0].cases[1].valeur, null);
});
