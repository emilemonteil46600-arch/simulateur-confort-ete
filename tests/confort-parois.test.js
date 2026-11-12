/* Tests du Simulateur de confort d'été — étape 1 : les parois.
   1. L'exemple refait à la main dans la Méthode (béton 20 cm).
   2. Les limites physiques (couche fine, déterminant, retournement, plafond de Rsi).
   3. Une validation INDÉPENDANTE : simulation par différences finies de la même paroi.
   4. L'inertie du local d'exemple.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

charger('commun/commun.js');
charger('donnees/confort-materiaux.js');
const P = charger('calcul/calcul-parois.js');
const C = charger('calcul/calcul.js');
const M = window.CONFORT_MATERIAUX;
const RS_MUR = P.resistancesSuperficielles('horizontal', false);

const BETON = { lambda: 2.3, rho: 2300, c: 1000 };
const LAINE = { lambda: 0.035, rho: 20, c: 1030 };
const PLATRE = { lambda: 0.25, rho: 900, c: 1000 };
const couche = function (m, e) { return Object.assign({ e: e }, m); };

/* ---------- Différences finies (volumes finis, schéma de Crank-Nicolson) ----------
   Paroi découpée en tranches de 4 mm au plus. Chaque tranche : capacité ρ·c·dx.
   Entre deux tranches : conductance 1/(dx1/2λ1 + dx2/2λ2). Aux bords : 1/(Rs + dx/2λ).
   Air intérieur θi(t) = ai·cos(ωt), extérieur θe(t) = ae·cos(ωt). On simule plusieurs
   jours puis on mesure, sur le dernier jour, l'amplitude et la phase du flux qui entre
   dans la pièce (projection de Fourier sur cos et sin). */
function differencesFinies(couches, rs, ai, ae, jours, pas) {
  const cel = [];
  couches.forEach(function (c) {
    const n = Math.max(3, Math.ceil(c.e / 0.004));
    for (let i = 0; i < n; i++) cel.push({ dx: c.e / n, l: c.lambda, C: c.rho * c.c * c.e / n });
  });
  const N = cel.length, G = [1 / (rs.rsi + cel[0].dx / 2 / cel[0].l)];
  for (let i = 0; i < N - 1; i++) G.push(1 / (cel[i].dx / 2 / cel[i].l + cel[i + 1].dx / 2 / cel[i + 1].l));
  G.push(1 / (rs.rse + cel[N - 1].dx / 2 / cel[N - 1].l));
  const w = P.OMEGA, etapes = Math.round(jours * 86400 / pas), parJour = Math.round(86400 / pas);
  let T = new Float64Array(N), sc = 0, ss = 0;
  const a = new Float64Array(N), b = new Float64Array(N), cc = new Float64Array(N), d = new Float64Array(N);
  for (let s = 0; s < etapes; s++) {
    const t0 = s * pas, t1 = t0 + pas;
    const ti0 = ai * Math.cos(w * t0), ti1 = ai * Math.cos(w * t1), te0 = ae * Math.cos(w * t0), te1 = ae * Math.cos(w * t1);
    for (let i = 0; i < N; i++) {
      const gl = G[i], gr = G[i + 1];
      const Tl = i === 0 ? ti0 : T[i - 1], Tr = i === N - 1 ? te0 : T[i + 1];
      a[i] = i === 0 ? 0 : -gl / 2;
      cc[i] = i === N - 1 ? 0 : -gr / 2;
      b[i] = cel[i].C / pas + (gl + gr) / 2;
      d[i] = cel[i].C / pas * T[i] + (gl * (Tl - T[i]) + gr * (Tr - T[i])) / 2 +
        (i === 0 ? gl / 2 * ti1 : 0) + (i === N - 1 ? gr / 2 * te1 : 0);
    }
    for (let i = 1; i < N; i++) { const m = a[i] / b[i - 1]; b[i] -= m * cc[i - 1]; d[i] -= m * d[i - 1]; }
    const X = new Float64Array(N);
    X[N - 1] = d[N - 1] / b[N - 1];
    for (let i = N - 2; i >= 0; i--) X[i] = (d[i] - cc[i] * X[i + 1]) / b[i];
    T = X;
    if (s >= etapes - parJour) {
      const q = G[0] * (T[0] - ti1);   // flux qui entre dans la pièce (W/m²)
      sc += q * Math.cos(w * t1); ss += q * Math.sin(w * t1);
    }
  }
  const A = 2 / parJour * sc, B = 2 / parJour * ss;
  return { amplitude: Math.hypot(A, B), retardHeures: ((-Math.atan2(-B, A) * 12 / Math.PI) % 24 + 24) % 24 };
}

test('Méthode § 9 : béton 20 cm seul, refait à la main', function () {
  const b = couche(BETON, 0.20);
  const delta = P.profondeurPenetration(b);
  assert.ok(proche(delta, 0.1658, 1e-4), 'δ = ' + delta);
  assert.ok(proche(0.20 / delta, 1.206, 1e-3));
  const Zc = P.matriceCouche(b);
  assert.ok(proche(Zc.z11.re, 0.6492, 1e-4) && proche(Zc.z11.im, 1.4203, 1e-4), 'Z11 couche');
  assert.ok(proche(Zc.z12.re, -0.0808, 1e-4) && proche(Zc.z12.im, -0.0417, 1e-4), 'Z12 couche');
  assert.ok(proche(Zc.z21.re, 16.055, 1e-3) && proche(Zc.z21.im, -31.100, 1e-3), 'Z21 couche');
  const d = P.caracteristiquesDynamiques([b], RS_MUR);
  assert.ok(proche(d.Z.z12.re, -0.1077, 1e-4) && proche(d.Z.z12.im, -0.4449, 1e-4), 'Z12 paroi');
  assert.ok(proche(d.Z.z11.re, 0.0070, 1e-4) && proche(d.Z.z11.im, 2.6643, 1e-4), 'Z11 paroi');
  assert.ok(proche(d.U, 3.892, 1e-3), 'U = ' + d.U);
  assert.ok(proche(d.transmittancePeriodique, 2.185, 1e-3), '|Y12| = ' + d.transmittancePeriodique);
  assert.ok(proche(d.dephasage, 5.09, 0.01), 'Δt = ' + d.dephasage);
  assert.ok(proche(d.amortissement, 0.56, 0.005), 'f = ' + d.amortissement);
  assert.ok(proche(d.kappa1 / 1000, 85.4, 0.1), 'κ1 = ' + d.kappa1);
  assert.ok(proche(P.retardApproche(0.20, delta), 4.6, 0.01));
  assert.ok(proche(P.amortissementApproche(0.20, delta), 0.30, 0.005));
});

test('Méthode § 10 : ITI et ITE, même U, κ1 très différent', function () {
  const ite = P.caracteristiquesDynamiques([couche(BETON, 0.20), couche(LAINE, 0.12)], RS_MUR);
  const iti = P.caracteristiquesDynamiques([couche(PLATRE, 0.013), couche(LAINE, 0.12), couche(BETON, 0.20)], RS_MUR);
  assert.ok(proche(ite.U, 0.271, 1e-3) && proche(iti.U, 0.268, 1e-3));
  assert.ok(proche(ite.dephasage, 7.3, 0.05) && proche(iti.dephasage, 6.9, 0.05));
  assert.ok(proche(ite.amortissement, 0.19, 0.005) && proche(iti.amortissement, 0.38, 0.005));
  assert.ok(proche(ite.kappa1 / 1000, 85, 0.6) && proche(iti.kappa1 / 1000, 14, 0.3));
});

test('Retourner une paroi ne change pas U, mais échange κ1 et κ2 et garde |Y12|', function () {
  const couches = [couche(PLATRE, 0.013), couche(LAINE, 0.10), couche(BETON, 0.18)];
  const rs = { rsi: 0.13, rse: 0.13 };   // mêmes Rs des deux côtés : la paroi est vraiment retournée
  const a = P.caracteristiquesDynamiques(couches, rs);
  const b = P.caracteristiquesDynamiques(couches.slice().reverse(), rs);
  assert.ok(proche(a.U, b.U, 1e-12));
  assert.ok(proche(a.transmittancePeriodique, b.transmittancePeriodique, 1e-9), 'réciprocité : |Y12| identique');
  assert.ok(proche(a.kappa1, b.kappa2, 1e-6) && proche(a.kappa2, b.kappa1, 1e-6));
});

test('Limites physiques : couche très fine → régime permanent ; déterminant = 1 ; plafond de Rsi', function () {
  const fine = P.caracteristiquesDynamiques([couche(PLATRE, 0.0005)], RS_MUR);
  assert.ok(proche(fine.amortissement, 1, 1e-4), 'f → 1');
  assert.ok(fine.dephasage < 0.01 || fine.dephasage > 23.99, 'Δt → 0');
  M.parois.forEach(function (p) {
    const a = P.analyserParoi(p, M.materiaux);
    assert.ok(a.ok, p.id + ' : ' + a.erreurs.join(' '));
    assert.ok(proche(a.dyn.determinant.re, 1, 1e-9) && proche(a.dyn.determinant.im, 0, 1e-9), p.id + ' : det ≠ 1');
    assert.ok(a.dyn.kappa1 < a.plafondKappa, p.id + ' : κ1 au-dessus du plafond de Rsi');
    assert.ok(a.dyn.amortissement > 0 && a.dyn.amortissement <= 1.0001, p.id + ' : f hors de ]0 ; 1]');
    assert.ok(a.dyn.dephasage >= 0 && a.dyn.dephasage < 24, p.id + ' : Δt hors de [0 ; 24[');
  });
  assert.ok(proche(P.plafondKappa(0.13) / 1000, 105.8, 0.1));
});

test('Validation indépendante : matrices de transfert = différences finies (écart < 0,5 %)', function () {
  const cas = {
    'béton 20 cm': [couche(BETON, 0.20)],
    'béton + ITE': [couche(BETON, 0.20), couche(LAINE, 0.12)],
    'ITI + béton': [couche(PLATRE, 0.013), couche(LAINE, 0.12), couche(BETON, 0.20)]
  };
  Object.keys(cas).forEach(function (nom) {
    const d = P.caracteristiquesDynamiques(cas[nom], RS_MUR);
    const fdExt = differencesFinies(cas[nom], RS_MUR, 0, 1, 12, 60);
    assert.ok(Math.abs(fdExt.amplitude / d.transmittancePeriodique - 1) < 0.005, nom + ' : |Y12| ' + d.transmittancePeriodique + ' / DF ' + fdExt.amplitude);
    assert.ok(Math.abs(fdExt.retardHeures - d.dephasage) < 0.05, nom + ' : Δt ' + d.dephasage + ' / DF ' + fdExt.retardHeures);
    const fdInt = differencesFinies(cas[nom], RS_MUR, 1, 0, 12, 60);
    assert.ok(Math.abs(fdInt.amplitude / d.admittance - 1) < 0.005, nom + ' : |Y11| ' + d.admittance + ' / DF ' + fdInt.amplitude);
  });
});

test('Profil de l\'onde : amplitude 1 dehors, |Y12|·Rsi sur la face intérieure, retard = Δt', function () {
  const a = P.analyserParoi(M.parois.find(function (p) { return p.id === 'beton-ite'; }), M.materiaux);
  const pr = a.profil;
  assert.ok(proche(pr[0].amplitude, a.dyn.transmittancePeriodique * a.rs.rsi, 1e-9));
  assert.ok(proche(pr[0].retard, a.dyn.dephasage, 1e-6));
  assert.ok(proche(pr[pr.length - 1].x, a.epaisseur, 1e-9));
  assert.ok(pr[pr.length - 1].amplitude < 1 && pr[pr.length - 1].amplitude > 0.9, 'face extérieure proche de l\'air extérieur');
});

test('Onde sur 24 h : flux moyen U·Δθ, amplitude |Y12|·A, pic décalé de Δt', function () {
  const a = P.analyserParoi(M.parois.find(function (p) { return p.id === 'beton-ite'; }), M.materiaux);
  const o = P.ondeJournaliere(a.dyn, a.rs, M.onde, 15);
  assert.ok(proche(o.fluxMoyen, a.U * (M.onde.tMoyenne - M.onde.tInterieure), 1e-12));
  const max = Math.max.apply(null, o.points.map(function (p) { return p.flux; }));
  assert.ok(proche(max, o.fluxMoyen + o.amplitudeFlux, 1e-3));
  const pic = o.points.reduce(function (m, p) { return p.flux > m.flux ? p : m; });
  assert.ok(Math.abs(pic.heure - o.heurePicFlux) <= 0.25, 'pic à ' + pic.heure + ' h au lieu de ' + o.heurePicFlux);
});

test('Paroi intérieure symétrique : les deux faces ont la même capacité', function () {
  const a = P.analyserParoi(M.parois.find(function (p) { return p.id === 'refend-beton'; }), M.materiaux);
  assert.ok(a.interieure);
  assert.ok(proche(a.deuxFaces.kappaFace1, a.deuxFaces.kappaFace2, 1e-6));
  // Plus épais ne change presque rien : l'onde ne va pas au fond (exercice « Teste-toi »).
  const rs = P.resistancesSuperficielles('horizontal', true);
  const k15 = P.capacitesDeuxFaces([couche(BETON, 0.15)], rs).kappaFace1;
  const k30 = P.capacitesDeuxFaces([couche(BETON, 0.30)], rs).kappaFace1;
  assert.ok(k30 / k15 < 1.05);
});

test('Inertie du local d\'exemple : Cm, Am, classe', function () {
  const an = {};
  M.parois.forEach(function (p) { an[p.id] = P.analyserParoi(p, M.materiaux); });
  const r = P.inertieLocal(M.local.elements.map(function (e) {
    return { nom: e.nom, aire: e.aire, contact: e.contact, analyse: an[e.paroi] };
  }), M.local.surfacePlancher);
  assert.ok(proche(r.cm / 1e6, 4.11, 0.01), 'Cm = ' + r.cm);
  assert.ok(proche(r.am, 54.7, 0.1), 'Am = ' + r.am);
  assert.ok(proche(r.cmSurAf / 1000, 205.7, 0.1));
  assert.equal(r.classe.id, 'moyenne');
  assert.equal(P.classeInertie(400000).id, 'tres-lourde');
  assert.equal(P.classeInertie(50000).id, 'tres-legere');
});

test('Une paroi incomplète est signalée, pas calculée', function () {
  assert.equal(P.analyserParoi({ couches: [] }, M.materiaux).ok, false);
  assert.equal(P.analyserParoi({ couches: [{ materiau: 'inconnu', e: 0.1 }] }, M.materiaux).ok, false);
  assert.equal(P.analyserParoi({ couches: [{ materiau: 'beton-arme', e: 0 }] }, M.materiaux).ok, false);
});

test('Le sommaire calcul.js donne accès au chapitre des parois', function () {
  assert.equal(C.parois, P);
});

test('Repères de confort d\'une paroi (H) : niveaux cohérents, ITE meilleure qu\'ITI, toiture plus exigeante sur U', function () {
  const ite = P.analyserParoi(M.parois.find(function (p) { return p.id === 'beton-ite'; }), M.materiaux);
  const iti = P.analyserParoi(M.parois.find(function (p) { return p.id === 'parpaing-iti'; }), M.materiaux);
  const a = P.reperesConfort(ite, 'mur'), b = P.reperesConfort(iti, 'mur');
  assert.equal(a.liste.length, 4, 'sans simulation : 4 repères');
  assert.ok(a.liste.every(function (l) { return ['bon', 'moyen', 'faible'].indexOf(l.niveau) !== -1 && l.seuils.length === 2; }));
  const k = function (r) { return r.liste.find(function (l) { return l.id === 'kappa1'; }); };
  assert.equal(k(a).niveau, 'bon', 'béton côté pièce : κ1 ' + k(a).valeur);
  assert.equal(k(b).niveau, 'faible', 'ITI : κ1 ' + k(b).valeur);
  assert.ok(a.score > b.score, 'ITE ' + a.score + ' > ITI ' + b.score);
  // Avec une simulation : 6 repères, et le verdict suit le score.
  const c = P.reperesConfort(ite, 'mur', { surchauffeFace: 0.5, fluxPointe: 3 });
  assert.equal(c.liste.length, 6);
  assert.equal(c.liste[4].niveau, 'bon');
  assert.ok(['bon', 'moyen', 'faible'].indexOf(c.verdict) !== -1);
  // Le même U = 0,2 est « bon » pour un mur et seulement « moyen » pour une toiture.
  assert.equal(P.niveauRepere(P.REPERES_CONFORT.U, 0.2, 'mur').niveau, 'bon');
  assert.equal(P.niveauRepere(P.REPERES_CONFORT.U, 0.2, 'toiture').niveau, 'moyen');
  assert.equal(P.niveauRepere(P.REPERES_CONFORT.dephasage, null).niveau, null);
});
