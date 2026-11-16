/* Tests des indicateurs de synthèse (degrés-heures indicatifs, pics, origine des apports) et des charges internes libres.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

const S = charger('calcul/calcul-soleil.js');
const I = charger('calcul/calcul-indicateurs.js');
const C = charger('calcul/calcul.js');

test('Sommaire : les indicateurs sont dans ConfortCalcul', function () { assert.equal(C.indicateurs, I); });

test('Degrés-heures : 4 h à 30 °C le jour = 8 DH ; la nuit le seuil est 26 °C', function () {
  // 21 juillet (heure d'été, UTC + 2) : l'indice 0 est 0 h UTC = 2 h légales.
  const k0 = (S.jourDeLAnnee(7, 21) - 1) * 24;
  const Top = new Float64Array(24).fill(25);
  for (let i = 12; i < 16; i++) Top[i] = 30;          // 14 h → 18 h légales : le jour
  let r = I.indicateurs(Top, k0, 0);
  assert.ok(proche(r.dh, 8, 1e-12) && r.heuresAuDessus === 4 && proche(r.dhNuit, 0, 1e-12));
  assert.ok(proche(r.topMax, 30, 1e-12) && r.iMax === 12 && proche(r.topNuitMax, 25, 1e-12));
  assert.equal(r.repere.id, 'confortable');
  // 27 °C à 3 h légales (indice 1) : 1 DH de nuit ; à 15 h légales, 27 °C ne compte pas.
  const T2 = new Float64Array(24).fill(27);
  r = I.indicateurs(T2, k0, 0);
  const nuits = [0, 1, 2, 3, 4, 20, 21, 22, 23].length;   // 2 h → 7 h et 22 h → 2 h légales
  assert.ok(proche(r.dh, nuits, 1e-12) && proche(r.dhJour, 0, 1e-12), 'DH ' + r.dh);
  assert.equal(I.heureLegale(k0), 2);
  assert.equal(I.heureLegale(10 * 24), 1, 'en janvier : UTC + 1');
  // Repères (H) : 350 et 1 250.
  assert.equal(I.indicateurs(new Float64Array(200).fill(31), k0, 0).repere.id, 'tolerable');
  assert.equal(I.indicateurs(new Float64Array(600).fill(31), k0, 0).repere.id, 'inconfort');
});

test('Origine des apports : seulement ce qui entre, en kWh', function () {
  const N = 4, t = function (v) { return Float64Array.from(v); };
  const apports = { N: N, fenetres: t([1000, 0, 0, 0]), murs: t([100, -50, 0, 0]), toiture: t([100, -50, 0, 0]), internes: t([500, 500, 500, 500]) };
  const sim = { flux: { ventilation: t([200, -300, 0, 0]), fenetres: t([50, -80, 0, 0]), opaques: t([50, -20, 0, 0]) } };
  const r = I.originesChaleur(apports, sim, 0);
  assert.ok(proche(r.vitrages, 1, 1e-12) && proche(r.opaques, 0.2, 1e-12) && proche(r.internes, 2, 1e-12) && proche(r.air, 0.3, 1e-12));
  assert.ok(proche(r.total, 3.5, 1e-12));
});

test('Charges internes libres : 8 W/m² de 8 h à 18 h en semaine, veille 10 % → 2,94 W/m² en moyenne', function () {
  const u = S.usageLibre({ puissance: 8, debut: 8, fin: 18, veille: 0.1, weekend: false });
  assert.equal(u.occupants.semaine[7], 0.1); assert.equal(u.occupants.semaine[8], 1); assert.equal(u.occupants.semaine[17], 1); assert.equal(u.occupants.semaine[18], 0.1);
  assert.ok(u.occupants.weekend.every(function (x) { return x === 0.1; }));
  // (5 × (10 × 8 + 14 × 0,8) + 2 × 24 × 0,8) / 168 = (5 × 91,2 + 38,4) / 168 = 2,943 W/m²
  assert.ok(proche(S.moyenneUsage(u), 2.9429, 1e-3), 'moyenne ' + S.moyenneUsage(u));
  // Plage qui passe minuit (20 h → 6 h), week-end compris.
  const n = S.usageLibre({ puissance: 5, debut: 20, fin: 6, veille: 0, weekend: true });
  assert.equal(n.occupants.semaine[23], 1); assert.equal(n.occupants.semaine[3], 1); assert.equal(n.occupants.semaine[12], 0);
  assert.ok(proche(S.moyenneUsage(n), 5 * 10 / 24, 1e-9));
  // Un apport horaire utilisable par le chapitre 2.
  assert.ok(proche(S.apportInterne(u, 2, 10, 100).total, 800, 1e-9));
});
