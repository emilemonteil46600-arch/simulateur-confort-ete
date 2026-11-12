/* Tests du Simulateur de confort d'été — étape 1 ter : le labo (différences finies).
   Le labo doit retrouver les matrices de transfert (étape 1), le régime permanent (U × ΔT),
   et conserver l'énergie. Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

const P = charger('calcul/calcul-parois.js');
const T = charger('calcul/calcul-transitoire.js');
const C = charger('calcul/calcul.js');
const RS = P.resistancesSuperficielles('horizontal', false);
const BETON = { lambda: 2.3, rho: 2300, c: 1000 };
const LAINE = { lambda: 0.035, rho: 20, c: 1030 };
const PLATRE = { lambda: 0.25, rho: 900, c: 1000 };
const couche = function (m, e) { return Object.assign({ e: e }, m); };
const ITE = [couche(BETON, 0.20), couche(LAINE, 0.12)];
const ITI = [couche(PLATRE, 0.013), couche(LAINE, 0.12), couche(BETON, 0.20)];

test('Maillage : tranches de 5 mm au plus, au moins 2 par couche, épaisseur totale conservée', function () {
  const m = T.mailler([couche(PLATRE, 0.013), couche(BETON, 0.2)]);
  assert.equal(m.filter(function (c) { return c.couche === 0; }).length, 3);
  assert.equal(m.filter(function (c) { return c.couche === 1; }).length, 40);
  assert.ok(proche(m[m.length - 1].x1, 0.213, 1e-12));
  assert.ok(m.every(function (c) { return c.dx <= 0.005 + 1e-12; }));
  assert.equal(T.mailler([couche(PLATRE, 0.001)]).length, 2);
});

test('Algorithme de Thomas : résout un petit système tridiagonal', function () {
  // 2x + y = 3 ; x + 2y + z = 4 ; y + 2z = 3  →  x = y = z = 1
  const x = T.thomas([0, 1, 1], [2, 2, 2], [1, 1, 0], [3, 4, 3]);
  assert.ok(proche(x[0], 1, 1e-12) && proche(x[1], 1, 1e-12) && proche(x[2], 1, 1e-12));
});

test('Journées d\'été : le labo retrouve |Y12| et le déphasage des matrices (écart < 1 %)', function () {
  [ITE, ITI, [couche(BETON, 0.20)]].forEach(function (cs) {
    const d = P.caracteristiquesDynamiques(cs, RS);
    const r = T.simuler({ couches: cs, rs: RS, scenario: { type: 'journee', tMoyenne: 0, amplitude: 1, heureMax: 0 },
      piece: { mode: 'fixe', tInterieure: 0 }, dureeHeures: 24, pasSecondes: 60, sortieMinutes: 5, prechauffageJours: 6 });
    const mx = Math.max.apply(null, r.fluxInt), mn = Math.min.apply(null, r.fluxInt);
    assert.ok(Math.abs((mx - mn) / 2 / d.transmittancePeriodique - 1) < 0.01, 'amplitude ' + (mx - mn) / 2 + ' / ' + d.transmittancePeriodique);
    const pic = r.temps[r.fluxInt.indexOf(mx)];
    assert.ok(Math.abs(pic - d.dephasage) < 0.1, 'pic à ' + pic + ' h au lieu de ' + d.dephasage);
  });
});

test('Coup de chaud très long : le flux tend vers U × ΔT, et l\'énergie est conservée', function () {
  [ITE, ITI].forEach(function (cs) {
    const U = P.coefficientU(cs, RS);
    const r = T.simuler({ couches: cs, rs: RS, scenario: { type: 'echelon', tAvant: 20, tApres: 35 },
      piece: { mode: 'fixe', tInterieure: 20 }, dureeHeures: 400, pasSecondes: 300, sortieMinutes: 60 });
    assert.ok(proche(r.fluxInt[r.fluxInt.length - 1], U * 15, 1e-3), 'flux final ' + r.fluxInt[r.fluxInt.length - 1]);
    assert.ok(r.bilan.ecartRelatif < 1e-9, 'bilan ' + r.bilan.ecartRelatif);
    assert.ok(r.fluxInt[0] === 0 || Math.abs(r.fluxInt[0]) < 1e-9, 'au départ, rien n\'entre');
  });
});

test('Pièce libre : l\'ITE garde la pièce plus fraîche que l\'ITI (masse côté pièce), énergie conservée', function () {
  const piece = { mode: 'libre', tInterieure: 20, aireMur: 10, volume: 50, renouvellement: 0.5, capaciteMobilier: 0 };
  const fin = function (cs) {
    const r = T.simuler({ couches: cs, rs: RS, scenario: { type: 'echelon', tAvant: 20, tApres: 35 }, piece: piece, dureeHeures: 72, pasSecondes: 60, sortieMinutes: 30 });
    assert.ok(r.bilan.ecartRelatif < 1e-9);
    return r.tPiece[r.tPiece.length - 1];
  };
  const tIte = fin(ITE), tIti = fin(ITI);
  assert.ok(tIte < tIti - 5, 'ITE ' + tIte + ' °C / ITI ' + tIti + ' °C');
  assert.ok(proche(tIti, 35, 0.1), 'en ITI, la ventilation amène la pièce à la température extérieure');
});

test('Pièce ramenée au m² de mur : capacité et ventilation', function () {
  const p = T.pieceParM2({ mode: 'libre', aireMur: 10, volume: 50, renouvellement: 0.5, capaciteMobilier: 100000 });
  assert.ok(proche(p.C, (1200 * 50 + 100000) / 10, 1e-9));
  assert.ok(proche(p.Hv, 1200 * 0.5 * 50 / 3600 / 10, 1e-12));
  assert.equal(T.pieceParM2({ mode: 'fixe' }), null);
});

test('Ordres de grandeur de la Méthode : temps de traversée e²/a et nombre de Fourier', function () {
  assert.ok(proche(T.tempsDiffusion(0.20, P.diffusivite(BETON)) / 3600, 11.1, 0.05), 'béton 20 cm ≈ 11 h');
  assert.ok(proche(T.tempsDiffusion(0.12, P.diffusivite(LAINE)) / 3600, 2.35, 0.01), 'laine 12 cm ≈ 2,4 h');
  assert.ok(proche(T.nombreFourier(P.diffusivite(BETON), 12.5, 0.005), 0.5, 1e-9), 'explicite stable jusqu\'à 12,5 s pour 5 mm de béton');
});

test('Le sommaire calcul.js donne accès au labo', function () {
  assert.equal(C.transitoire, T);
});

/* ---------- Onglet « Ma paroi » : une vraie série horaire, l'air neuf à part, le résumé ---------- */
test('Scénario « série » : interpolation linéaire, bornes tenues, et une série constante = un échelon', function () {
  const sc = { type: 'serie', origine: -24, valeurs: [10, 20, 30, 30, 30] };
  assert.equal(T.temperatureExterieure(sc, -24), 10);
  assert.ok(proche(T.temperatureExterieure(sc, -23.5), 15, 1e-12));
  assert.equal(T.temperatureExterieure(sc, -22), 30);
  assert.equal(T.temperatureExterieure(sc, -30), 10, 'avant le début : la 1re valeur');
  assert.equal(T.temperatureExterieure(sc, 100), 30, 'après la fin : la dernière');
  // Une série constante à 35 °C après 4 jours à 35 °C : la paroi finit en régime permanent, q = U × ΔT.
  const n = 24 * 4 + 48 + 1;
  const cst = { type: 'serie', origine: -96, valeurs: new Array(n).fill(35) };
  const piece = { mode: 'fixe', tInterieure: 20 };
  const r = T.simuler({ couches: ITE, rs: RS, scenario: cst, prechauffageJours: 4, piece: piece, dureeHeures: 48, pasSecondes: 60, sortieMinutes: 60 });
  const U = P.coefficientU(ITE, RS);
  assert.ok(proche(r.fluxInt[r.fluxInt.length - 1], U * 15, 0.02), 'q = ' + r.fluxInt[r.fluxInt.length - 1] + ' ≠ U·ΔT = ' + U * 15);
});

test('Air neuf à part : avec une série sol-air, la pièce libre respire l\'air dehors, pas le sol-air', function () {
  const n = 24 * 6 + 1;
  const chaud = new Array(n).fill(45), air = new Array(n).fill(25);
  const base = { couches: ITE, rs: RS, prechauffageJours: 4, piece: { mode: 'libre', tInterieure: 25, aireMur: 10, volume: 50, renouvellement: 2, capaciteMobilier: 0 }, dureeHeures: 48, pasSecondes: 60, sortieMinutes: 60 };
  const sans = T.simuler(Object.assign({}, base, { scenario: { type: 'serie', origine: -96, valeurs: chaud } }));
  const avec = T.simuler(Object.assign({}, base, { scenario: { type: 'serie', origine: -96, valeurs: chaud, air: { type: 'serie', origine: -96, valeurs: air } } }));
  const fin = function (r) { return r.tPiece[r.tPiece.length - 1]; };
  assert.ok(fin(sans) > 40, 'sans série d\'air, la pièce respire le sol-air : ' + fin(sans));
  assert.ok(fin(avec) > 25 && fin(avec) < 30, 'avec l\'air à 25 °C et 2 vol/h, la pièce reste proche de 25 : ' + fin(avec));
  assert.equal(T.temperatureAirNeuf({ type: 'echelon', tAvant: 20, tApres: 35 }, 1), 35);
});

test('Résumé d\'une simulation : pics, déphasage et amortissement observés retrouvent les matrices sur une sinusoïde', function () {
  const dyn = P.caracteristiquesDynamiques(ITE, RS);
  const r = T.simuler({ couches: ITE, rs: RS, scenario: { type: 'journee', tMoyenne: 25, amplitude: 8, heureMax: 15 }, piece: { mode: 'fixe', tInterieure: 25 }, dureeHeures: 72, pasSecondes: 60, sortieMinutes: 10 });
  const z = T.resumerSimulation(r, 24, 72);
  assert.ok(proche(z.tExt.max, 33, 1e-6) && proche(z.tExt.min, 17, 1e-6));
  assert.ok(Math.abs(z.dephasageObserve - dyn.dephasage) < 0.35, 'déphasage observé ' + z.dephasageObserve + ' ≠ ' + dyn.dephasage);
  // Face intérieure : amplitude = f × U × 8 × Rsi (θsi − θa = Rsi × q), donc l'amortissement observé sur θsi vaut f × U × Rsi.
  assert.ok(proche(z.amortissementObserve, dyn.amortissement * dyn.U * RS.rsi, 0.003), 'amortissement observé ' + z.amortissementObserve);
  assert.ok(z.flux.max > 0 && z.ecartFaceMax > 0 && z.energie > 0 && proche(z.heures, 48, 1e-9));
});
