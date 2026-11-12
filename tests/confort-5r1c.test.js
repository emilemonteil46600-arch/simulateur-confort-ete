/* Tests du Simulateur de confort d'été — étape 3 : le modèle horaire 5R1C.
   Validations :
   1. le bilan d'énergie de chaque nœud est nul à chaque pas (à l'arrondi près) ;
   2. le régime permanent retrouve la solution analytique du circuit (3 équations, 3 inconnues) ;
   3. la réponse à un échelon est une exponentielle de constante de temps τ = (Cm/3600)/(Htr,em + H3) ;
   4. les exemples refaits à la main dans la Méthode (une heure, la maison d'exemple) ;
   5. BESTEST 600FF / 900FF (ANSI/ASHRAE 140, évolution libre) avec une météo PVGIS de Denver (H : indicatif,
      la météo officielle DRYCOLD n'est pas publique ; plages publiées rapportées de mémoire, à vérifier).
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

charger('commun/commun.js');
charger('donnees/confort-materiaux.js');
charger('donnees/confort-projet.js');
charger('donnees/confort-meteo.js');
const P = charger('calcul/calcul-parois.js');
const B = charger('calcul/calcul-batiment.js');
const S = charger('calcul/calcul-soleil.js');
const R = charger('calcul/calcul-5r1c.js');
const C = charger('calcul/calcul.js');
const METEO = charger('donnees/meteo/toulouse.js');
const DENVER = charger('tests/references/pvgis-denver-tmy.json');
const X = window.CONFORT_PROJET;
const M = window.CONFORT_MATERIAUX;
const cloner = function (o) { return JSON.parse(JSON.stringify(o)); };

/* ---------- Une petite maison de test, à la main ---------- */
// Af 100 m², V 250 m³, Cm 10 MJ/K, Am 250 m², fenêtres 15 m² U 1,4, murs 100 m² U 0,3, toit 100 m² U 0,15, sol 100 m² U 0,3.
function maisonTest() {
  return {
    Af: 100, Am: 250, Cm: 10e6, V: 250, Htr_w: 21,
    opaques: [{ nom: 'Murs', UA: 30, vers: 'exterieur' }, { nom: 'Toit', UA: 15, vers: 'exterieur' }, { nom: 'Sol', UA: 30, vers: 'sol' }]
  };
}
const serie = function (N, v) { const t = new Float64Array(N); t.fill(v); return t; };

// Résolution directe du circuit en régime permanent (élimination de Gauss, 3 × 3) : θm, θs, θair.
function regimePermanentExact(c, Hve, thetaE, thetaEop, phi) {
  const H1 = 1 / (1 / Hve + 1 / c.Htr_is);
  // Nœud m : Htr_em (θe,op − θm) + Htr_ms (θs − θm) + Φm = 0
  // Nœud s : Htr_ms (θm − θs) + Htr_is (θair − θs) + Htr_w (θe − θs) + Φst = 0
  // Nœud air : Htr_is (θs − θair) + Hve (θe − θair) + Φia = 0
  const A = [
    [-(c.Htr_em + c.Htr_ms), c.Htr_ms, 0, -(phi.m + c.Htr_em * thetaEop)],
    [c.Htr_ms, -(c.Htr_ms + c.Htr_is + c.Htr_w), c.Htr_is, -(phi.st + c.Htr_w * thetaE)],
    [0, c.Htr_is, -(c.Htr_is + Hve), -(phi.ia + Hve * thetaE)]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) { const f = A[j][i] / A[i][i]; for (let k = i; k < 4; k++) A[j][k] -= f * A[i][k]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let s = A[i][3]; for (let k = i + 1; k < 3; k++) s -= A[i][k] * x[k]; x[i] = s / A[i][i]; }
  void H1;
  return { thetaM: x[0], thetaS: x[1], thetaAir: x[2] };
}

test('Sommaire : le chapitre 3 est dans ConfortCalcul', function () {
  assert.equal(C.cinqR1C, R);
});

test('Conductances : 1/Htr,op = 1/Htr,ms + 1/Htr,em ; Htr,is = 3,45 × 4,5 × Af ; Hve = ρ·c·n·V', function () {
  const c = R.conductances(maisonTest());
  assert.ok(proche(1 / c.Htr_op, 1 / c.Htr_ms + 1 / c.Htr_em, 1e-12));
  assert.ok(proche(c.Htr_is, 3.45 * 4.5 * 100, 1e-9));
  assert.ok(proche(c.Htr_ms, 9.1 * 250, 1e-9));
  assert.ok(proche(c.partSol, 30 / 75, 1e-12));
  // 0,5 vol/h dans 250 m³ : 125 m³/h × 1 200 J/(m³·K) / 3 600 s = 41,67 W/K.
  assert.ok(proche(R.conductanceVentilation(0.5, 250), 41.6667, 1e-3));
  assert.ok(proche(R.infiltrations(4), 0.2, 1e-12));
});

test('Répartition des apports : Φia + Φst + Φm + part perdue vers les vitres = Φint + Φsol', function () {
  const c = R.conductances(maisonTest());
  const p = R.repartirApports(1000, 2000, c);
  assert.ok(proche(p.ia, 500, 1e-9));
  const versVitres = c.Htr_w / (9.1 * c.Atot) * 2500;
  assert.ok(proche(p.ia + p.st + p.m + versVitres, 3000, 1e-9));
  assert.ok(proche(p.m, 250 / 450 * 2500, 1e-9));
});

test('Bilan d\'énergie : nul à chaque pas sur tout l\'été de la maison de test (< 1e-6 W)', function () {
  const N = 24 * 153;
  const T = new Float64Array(8760);
  for (let k = 0; k < 8760; k++) T[k] = 20 + 8 * Math.sin(2 * Math.PI * (k - 15) / 24) + 5 * Math.sin(2 * Math.PI * k / (24 * 20));
  const sol = new Float64Array(N), int = new Float64Array(N);
  for (let i = 0; i < N; i++) { sol[i] = Math.max(0, 3000 * Math.sin(2 * Math.PI * (i - 6) / 24)); int[i] = 300 + 200 * ((i % 24) > 18 ? 1 : 0); }
  const e = Object.assign(maisonTest(), {
    T: T, apports: { internes: int, solaires: sol },
    ventilation: { base: 0.7, nuit: { active: true, debit: 3, debut: 22, fin: 7, ecart: 2, seuil: 24 } }, heures: [120 * 24, 120 * 24 + N]
  });
  const r = R.simuler(e);
  assert.ok(r.bilanMax < 1e-6, 'bilan ' + r.bilanMax);
  assert.equal(r.N, N);
  // La surventilation s'est bien déclenchée certaines nuits, jamais le jour.
  let nuits = 0;
  for (let i = 0; i < N; i++) {
    if (r.nuit[i]) { nuits++; const h = (r.k0 + i + 2) % 24; assert.ok(h >= 22 || h < 7, 'ouvert à ' + h + ' h'); assert.ok(r.n[i] > 3, 'débit ' + r.n[i]); }
    else assert.ok(proche(r.n[i], 0.7, 1e-12));
  }
  assert.ok(nuits > 50, nuits + ' heures de surventilation');
  // Température opérative = 0,3 air + 0,7 surfaces.
  assert.ok(proche(r.Top[500], 0.3 * r.Tair[500] + 0.7 * r.Ts[500], 1e-12));
});

test('Régime permanent : tout constant → le circuit résolu à la main, et θ = θe + Φ/H quand sol = dehors', function () {
  const N = 24 * 60;
  const e = Object.assign(maisonTest(), {
    T: serie(8760, 25), Tsol: serie(8760, 25), apports: { internes: serie(N, 400), solaires: serie(N, 800) },
    ventilation: { base: 0.6, nuit: null }, heures: [0, N], thetaInitiale: 10
  });
  const r = R.simuler(e);
  const c = r.conductances, Hve = R.conductanceVentilation(0.6, 250);
  const ex = regimePermanentExact(c, Hve, 25, 25, R.repartirApports(400, 800, c));
  assert.ok(proche(r.Tair[N - 1], ex.thetaAir, 1e-6), 'air ' + r.Tair[N - 1] + ' ≠ ' + ex.thetaAir);
  assert.ok(proche(r.Ts[N - 1], ex.thetaS, 1e-6));
  assert.ok(proche(r.Tm[N - 1], ex.thetaM, 1e-6));
  // La formule simple θe + Φ/H donne la moyenne : l'air et les surfaces sont un peu au-dessus, la masse un peu en dessous.
  const simple = R.regimePermanent(c, 25, Hve, 1200);
  assert.ok(proche(simple.H, 75 + 21 + Hve, 1e-9));
  assert.ok(Math.abs(r.Tair[N - 1] - simple.theta) < 0.6 && Math.abs(r.Tm[N - 1] - simple.theta) < 0.6, 'simple ' + simple.theta + ' air ' + r.Tair[N - 1] + ' masse ' + r.Tm[N - 1]);
  // Le sol à 15 °C au lieu de 25 : la maison est plus fraîche, et le circuit résolu à la main le retrouve.
  e.Tsol = serie(8760, 15);
  const r2 = R.simuler(e);
  const ex2 = regimePermanentExact(c, Hve, 25, (1 - c.partSol) * 25 + c.partSol * 15, R.repartirApports(400, 800, c));
  assert.ok(proche(r2.Tair[N - 1], ex2.thetaAir, 1e-6));
  assert.ok(r2.Tair[N - 1] < r.Tair[N - 1] - 1);
});

test('Échelon : sans apport, la masse rejoint dehors en exponentielle de constante de temps τ = (Cm/3600)/(Htr,em + H3)', function () {
  const N = 24 * 15;
  const e = Object.assign(maisonTest(), {
    T: serie(8760, 30), Tsol: serie(8760, 30), apports: { internes: serie(N, 0), solaires: serie(N, 0) },
    ventilation: { base: 0.5, nuit: null }, heures: [0, N], thetaInitiale: 20
  });
  const r = R.simuler(e);
  const c = r.conductances, Hve = R.conductanceVentilation(0.5, 250);
  const tau = R.constanteDeTemps(c, Hve);
  // Crank-Nicolson : d'une heure à l'autre, l'écart avec dehors est multiplié par (1 − a)/(1 + a), a = 1/(2τ).
  const a = 1 / (2 * tau);
  const attendu = (1 - a) / (1 + a);
  for (let i = 10; i < 100; i++) {
    const rapport = (r.Tm[i + 1] - 30) / (r.Tm[i] - 30);
    // r.Tm est la moyenne sur l'heure, mais le rapport de deux moyennes successives est le même.
    assert.ok(proche(rapport, attendu, 1e-9), 'heure ' + i + ' : ' + rapport + ' ≠ ' + attendu);
  }
  assert.ok(tau > 20 && tau < 60, 'τ = ' + tau + ' h');
  // Après 3 τ, il reste 5 % de l'écart ; le continu donne e⁻³ = 4,98 %.
  const i3 = Math.round(3 * tau);
  assert.ok(Math.abs((r.Tm[i3] - 30) / (-10) - Math.exp(-3)) < 0.01);
});

test('Méthode § 33 : une heure refaite à la main (maison de test, 1 pas)', function () {
  const c = R.conductances(maisonTest());
  const Hve = R.conductanceVentilation(0.7, 250);
  const phi = R.repartirApports(500, 1500, c);
  const p = R.pasHoraire(24, c, { thetaE: 30, thetaEop: 30, thetaSup: 30, Hve: Hve, phi: phi });
  // Valeurs de la Méthode (arrondies à l'affichage, jamais au calcul).
  assert.ok(proche(c.Atot, 450, 1e-9) && proche(c.Htr_is, 1552.5, 1e-9) && proche(c.Htr_ms, 2275, 1e-9));
  assert.ok(proche(Hve, 58.333, 1e-3));
  assert.ok(proche(c.Htr_em, 77.557, 1e-3));
  assert.ok(proche(p.H1, 56.221, 1e-3));
  assert.ok(proche(p.H2, 77.221, 1e-3));
  assert.ok(proche(p.H3, 74.686, 1e-3));
  assert.ok(proche(phi.ia, 250, 1e-9) && proche(phi.m, 972.222, 1e-3) && proche(phi.st, 768.803, 1e-3));
  assert.ok(proche(p.thetaM, 25.003, 1e-3), 'θm ' + p.thetaM);
  assert.ok(proche(p.thetaMMoy, 24.501, 1e-3));
  assert.ok(proche(p.thetaS, 25.111, 1e-3), 'θs ' + p.thetaS);
  assert.ok(proche(p.thetaAir, 25.443, 1e-3), 'θair ' + p.thetaAir);
  assert.ok(proche(p.thetaOp, 25.211, 1e-3), 'θop ' + p.thetaOp);
  assert.ok(proche(p.flux.stockage, 2785.9, 0.05) && proche(p.flux.ventilation, 265.8, 0.05));
  assert.ok(Math.abs(p.bilan.air) < 1e-9 && Math.abs(p.bilan.surfaces) < 1e-9 && Math.abs(p.bilan.masse) < 1e-9);
});

test('Le sol sous la dalle (H) : moyenne annuelle, saisons amorties de moitié et retardées d\'un mois', function () {
  const s = R.temperatureSol(METEO.T);
  assert.ok(proche(s.moyenneAnnuelle, METEO.T.reduce(function (a, b) { return a + b; }, 0) / 8760, 1e-9));
  const juillet = s.serie[S.jourDeLAnnee(7, 15) * 24], janvier = s.serie[S.jourDeLAnnee(1, 15) * 24], aout = s.serie[S.jourDeLAnnee(8, 25) * 24];
  assert.ok(juillet > s.moyenneAnnuelle && janvier < s.moyenneAnnuelle);
  assert.ok(aout > juillet, 'le sol est plus chaud fin août que mi-juillet (retard)');
  let max = -Infinity, min = Infinity;
  for (let k = 0; k < 8760; k++) { max = Math.max(max, s.serie[k]); min = Math.min(min, s.serie[k]); }
  assert.ok(max - min < 12 && max - min > 3, 'amplitude du sol ' + (max - min));
  assert.ok(max < 25, 'le sol reste frais en été : ' + max);
});

/* ---------- La maison d'exemple (Méthode § 34) ---------- */
function apportsMaisonExemple(projet, analyses, vitrage, synthese) {
  const K0 = (S.jourDeLAnnee(5, 1) - 1) * 24, K1 = S.jourDeLAnnee(9, 30) * 24;
  const prot = {};
  X.protections.forEach(function (p) { prot[p.id] = p; });
  const alpha = function (id) { return X.couleurs.find(function (c) { return c.id === id; }).alpha; };
  return S.apportsHoraires({
    projet: projet, synthese: synthese, lieu: { lat: 43.604, lon: 1.444 }, meteo: METEO, vitrage: vitrage, protections: prot,
    seuil: X.seuilProtection.valeur, usage: X.scenarios.usages[projet.usage], U: { murs: analyses.murs.U, toiture: analyses.toiture.U },
    alpha: { murs: alpha(projet.couleurs.murs), toiture: alpha(projet.couleurs.toiture) }, casquettes: projet.casquettes, fenetre: X.fenetre, heures: [K0, K1]
  });
}

test('Méthode § 34 : la maison d\'exemple à Toulouse, juin → septembre', function () {
  const projet = cloner(X.projet);
  const an = {};
  Object.keys(projet.parois).forEach(function (k) { an[k] = P.analyserParoi(M.parois.find(function (p) { return p.id === projet.parois[k]; }), M.materiaux); });
  const vit = X.vitrages.find(function (v) { return v.id === projet.vitrage; });
  const s = B.syntheseProjet(projet, an, vit);
  const ap = apportsMaisonExemple(projet, an, vit, s);
  const e = R.entreesMaison({ synthese: s, apports: ap, meteo: METEO, ventilation: projet.ventilation });
  const r = R.simuler(e);
  const c = r.conductances;
  assert.ok(proche(s.inertie.am, 229.6, 0.05), 'Am ' + s.inertie.am);
  assert.ok(proche(c.Htr_is, 1242, 1e-9) && proche(c.Htr_ms, 2089.4, 0.05) && proche(c.Htr_em, 62.74, 0.005) && proche(c.Htr_w, 18.2, 1e-9));
  assert.ok(proche(e.ventilation.base, 0.7, 1e-12), 'VMC 0,5 + n50 4 / 20 = 0,7 vol/h');
  assert.ok(proche(R.conductanceVentilation(0.7, 216), 50.4, 1e-9));
  assert.ok(proche(R.constanteDeTemps(c, 50.4), 20.3, 0.05), 'τ = ' + R.constanteDeTemps(c, 50.4));
  assert.ok(r.bilanMax < 1e-6);
  const de = (S.jourDeLAnnee(6, 1) - 1) * 24 - ap.k0;
  const top = R.resumer(r.Top, de), text = R.resumer(r.Text, de);
  assert.ok(proche(text.max, 38.8, 0.05) && proche(text.moyenne, 21.9, 0.05));
  // Avec les volets et les fenêtres ouvertes la nuit (3 vol/h, 22 h → 7 h) : pic 33,3 °C, moyenne 24,8 °C.
  assert.ok(proche(top.max, 33.3, 0.05), 'Top max ' + top.max);
  assert.ok(proche(top.moyenne, 24.8, 0.05), 'Top moyenne ' + top.moyenne);
  let h28 = 0;
  for (let i = de; i < r.N; i++) if (r.Top[i] > 28) h28++;
  assert.ok(h28 > 300 && h28 < 360, 'heures > 28 °C : ' + h28);
  // Sans surventilation nocturne : plus chaud (pic 34,6 °C, moyenne 26,1 °C).
  const sans = cloner(projet.ventilation); sans.nuit.active = false;
  const r0 = R.simuler(R.entreesMaison({ synthese: s, apports: ap, meteo: METEO, ventilation: sans }));
  const top0 = R.resumer(r0.Top, de);
  assert.ok(proche(top0.max, 34.6, 0.05) && proche(top0.moyenne, 26.1, 0.05), 'sans nuit : ' + top0.max + ' / ' + top0.moyenne);
  // Sens physiques : la maison en ITE lourde a un pic plus bas ; sans protection, plus haut ; plus de ventilation de base, plus frais en moyenne.
  const lourd = cloner(projet); lourd.parois.murs = 'parpaing-ite'; lourd.parois.cloisons = 'refend-beton';
  const anL = {};
  Object.keys(lourd.parois).forEach(function (k) { anL[k] = P.analyserParoi(M.parois.find(function (p) { return p.id === lourd.parois[k]; }), M.materiaux); });
  const sL = B.syntheseProjet(lourd, anL, vit);
  const rL = R.simuler(R.entreesMaison({ synthese: sL, apports: apportsMaisonExemple(lourd, anL, vit, sL), meteo: METEO, ventilation: projet.ventilation }));
  assert.ok(sL.inertie.cm > 2 * s.inertie.cm && R.resumer(rL.Top, de).max < top.max - 1, 'maison lourde : pic ' + R.resumer(rL.Top, de).max);
  const nu = cloner(projet); B.FACADES.forEach(function (f) { nu.facades[f].protection = 'aucune'; });
  const rN = R.simuler(R.entreesMaison({ synthese: s, apports: apportsMaisonExemple(nu, an, vit, s), meteo: METEO, ventilation: projet.ventilation }));
  assert.ok(R.resumer(rN.Top, de).max > top.max + 2, 'sans volets : pic ' + R.resumer(rN.Top, de).max);
  // Mise en régime : mai sert à oublier la température initiale (τ ≈ 20 h ≪ 31 jours).
  const r1 = R.simuler(Object.assign(e, { thetaInitiale: 35 }));
  assert.ok(Math.abs(r1.Top[de] - r.Top[de]) < 1e-6);
});

/* ---------- BESTEST 600FF / 900FF (ANSI/ASHRAE 140), évolution libre ---------- */
// Géométrie et parois publiques (Judkoff & Neymark, IEA BESTEST, NREL/TP-472-6231, 1995) : zone 8 × 6 × 2,7 m,
// 12 m² de vitrage plein Sud (U 3,0 ; g 0,787), 200 W d'apports internes en continu, 0,5 vol/h d'infiltration
// (0,41 vol/h à l'altitude de Denver, 1 609 m, pour un calcul à la masse volumique du niveau de la mer (H)),
// α extérieur 0,6, sol à 10 °C. Météo : DRYCOLD (TMY Denver), remplacée ici par l'année type PVGIS de Denver (H).
const BESTEST_MATERIAUX = [
  { id: 'platre', nom: 'Plasterboard', lambda: 0.16, rho: 950, c: 840 }, { id: 'fibre', nom: 'Fiberglass quilt', lambda: 0.04, rho: 12, c: 840 },
  { id: 'bardage', nom: 'Wood siding', lambda: 0.14, rho: 530, c: 900 }, { id: 'roofdeck', nom: 'Roof deck', lambda: 0.14, rho: 530, c: 900 },
  { id: 'bois', nom: 'Timber flooring', lambda: 0.14, rho: 650, c: 1200 }, { id: 'isolant', nom: 'Insulation', lambda: 0.04, rho: 10, c: 840 },
  { id: 'bloc', nom: 'Concrete block', lambda: 0.51, rho: 1400, c: 1000 }, { id: 'mousse', nom: 'Foam insulation', lambda: 0.04, rho: 10, c: 1400 },
  { id: 'dalle', nom: 'Concrete slab', lambda: 1.13, rho: 1400, c: 1000 }
];
const BESTEST_CAS = {
  600: { mur: [['platre', 0.012], ['fibre', 0.066], ['bardage', 0.009]], toit: [['platre', 0.010], ['fibre', 0.1118], ['roofdeck', 0.019]], sol: [['bois', 0.025], ['isolant', 1.003]] },
  900: { mur: [['bloc', 0.100], ['mousse', 0.0615], ['bardage', 0.009]], toit: [['platre', 0.010], ['fibre', 0.1118], ['roofdeck', 0.019]], sol: [['dalle', 0.080], ['isolant', 1.007]] }
};
// Plages publiées des logiciels de référence (max / min / moyenne annuels de l'air, °C) (H : rapportées de mémoire
// de la table « free-float » du rapport IEA BESTEST 1995 / ASHRAE 140 annexe B8, à vérifier).
const BESTEST_PLAGES = { 600: { max: [64.9, 75.1], min: [-18.8, -15.6], moyenne: [24.2, 27.4] }, 900: { max: [41.8, 46.4], min: [-6.4, -1.6], moyenne: [24.5, 27.5] } };

function bestest(cas) {
  const c = BESTEST_CAS[cas];
  const paroi = function (couches, sens) {
    return P.analyserParoi({ type: 'exterieure', sensFlux: sens, couches: couches.map(function (x) { return { materiau: x[0], e: x[1] }; }) }, BESTEST_MATERIAUX);
  };
  const mur = paroi(c.mur, 'horizontal'), toit = paroi(c.toit, 'montant'), sol = paroi(c.sol, 'descendant');
  const Af = 48, V = 129.6, Aw = 12;
  const inr = P.inertieLocal([
    { nom: 'murs', aire: 63.6, contact: 'exterieur', analyse: mur }, { nom: 'toit', aire: 48, contact: 'exterieur', analyse: toit }, { nom: 'sol', aire: 48, contact: 'exterieur', analyse: sol }
  ], Af);
  const facades = [{ az: 0, A: 21.6 }, { az: 90, A: 16.2 }, { az: 180, A: 21.6 - Aw }, { az: 270, A: 16.2 }];
  const lieu = { lat: DENVER.lieu.lat, lon: DENVER.lieu.lon };
  const N = 8760, solaires = new Float64Array(N), internes = new Float64Array(N).fill(200);
  for (let k = 0; k < N; k++) {
    const so = S.positionSoleil(k + DENVER.decalage, lieu);
    const mh = { Gbn: DENVER.Gbn[k], Gdh: DENVER.Gdh[k] };
    let f = 0;
    facades.forEach(function (fa) {
      const ecl = S.eclairementParoi(mh, so, 90, fa.az);
      if (fa.az === 180) f += S.apportFenetre(ecl, { surface: Aw, g: 0.787, partCadre: 0, Fw: 0.9, protection: null, seuil: 0 }).flux;
      f += S.apportOpaque(ecl, { inclinaison: 90, alpha: 0.6, U: mur.U, A: fa.A }).flux;
    });
    f += S.apportOpaque(S.eclairementParoi(mh, so, 0, 0), { inclinaison: 0, alpha: 0.6, U: toit.U, A: 48 }).flux;
    solaires[k] = f;
  }
  const e = {
    Af: Af, Am: inr.am, Cm: inr.cm, V: V, Htr_w: 3.0 * Aw,
    opaques: [{ nom: 'murs', UA: mur.U * 63.6, vers: 'exterieur' }, { nom: 'toit', UA: toit.U * 48, vers: 'exterieur' }, { nom: 'sol', UA: sol.U * 48, vers: 'sol' }],
    T: DENVER.T, Tsol: serie(N, 10), apports: { internes: internes, solaires: solaires }, ventilation: { base: 0.41, nuit: null }, heures: [0, N], thetaInitiale: 20
  };
  let r = R.simuler(e);
  e.thetaInitiale = r.Tm[N - 1];        // mise en régime : la 2e année part de la fin de la 1re
  r = R.simuler(e);
  return { parois: { mur: mur, toit: toit, sol: sol }, inertie: inr, resultat: r, resume: R.resumer(r.Tair) };
}

test('BESTEST 600FF (maison légère) : U des parois, et max / min / moyenne annuels dans les plages publiées (H : météo PVGIS)', function () {
  const b = bestest(600);
  assert.ok(proche(b.parois.mur.U, 0.514, 0.01) && proche(b.parois.toit.U, 0.318, 0.01) && proche(b.parois.sol.U, 0.039, 0.002));
  assert.ok(b.inertie.cm / 1e6 > 1.5 && b.inertie.cm / 1e6 < 2.5, 'Cm ' + b.inertie.cm);
  const p = BESTEST_PLAGES[600], z = b.resume;
  assert.ok(z.max >= p.max[0] && z.max <= p.max[1], 'max ' + z.max.toFixed(1) + ' hors de [' + p.max + ']');
  assert.ok(z.min >= p.min[0] - 0.5 && z.min <= p.min[1] + 0.5, 'min ' + z.min.toFixed(1) + ' hors de [' + p.min + ']');
  assert.ok(z.moyenne >= p.moyenne[0] && z.moyenne <= p.moyenne[1], 'moyenne ' + z.moyenne.toFixed(1) + ' hors de [' + p.moyenne + ']');
  assert.ok(b.resultat.bilanMax < 1e-6);
});

test('BESTEST 900FF (maison lourde) : dans les plages publiées élargies de 2,5 K (H : un seul nœud de masse, météo PVGIS)', function () {
  const b = bestest(900);
  assert.ok(proche(b.parois.mur.U, 0.512, 0.01) && proche(b.parois.sol.U, 0.039, 0.002));
  assert.ok(b.inertie.cm / 1e6 > 6 && b.inertie.cm / 1e6 < 9, 'Cm ' + b.inertie.cm);
  const p = BESTEST_PLAGES[900], z = b.resume, marge = 2.5;
  assert.ok(z.max >= p.max[0] - marge && z.max <= p.max[1] + marge, 'max ' + z.max.toFixed(1) + ' hors de [' + p.max + '] ± ' + marge);
  assert.ok(z.min >= p.min[0] - marge && z.min <= p.min[1] + marge, 'min ' + z.min.toFixed(1) + ' hors de [' + p.min + '] ± ' + marge);
  assert.ok(z.moyenne >= p.moyenne[0] && z.moyenne <= p.moyenne[1], 'moyenne ' + z.moyenne.toFixed(1) + ' hors de [' + p.moyenne + ']');
  // La maison lourde écrase les extrêmes par rapport à la légère : c'est tout l'objet du BESTEST 900.
  const l = bestest(600).resume;
  assert.ok(z.max < l.max - 15 && z.min > l.min + 8, 'lourde : ' + z.max.toFixed(1) + ' / ' + z.min.toFixed(1) + ' ; légère : ' + l.max.toFixed(1) + ' / ' + l.min.toFixed(1));
});
