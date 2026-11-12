/* Tests du Simulateur de confort d'été — étape 2 : la météo, le soleil, les apports.
   Validations :
   1. la position du soleil (Spencer) contre une méthode indépendante (NOAA, d'après Meeus) ;
   2. le rayonnement sur des façades Sud et Ouest contre le calcul de PVGIS (Toulouse, 2022) ;
   3. la cohérence de la météo embarquée (G horizontal) et du décalage horaire ;
   4. les exemples refaits à la main dans la Méthode (heure type, casquette, paroi opaque).
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
const C = charger('calcul/calcul.js');
const METEO = charger('donnees/meteo/toulouse.js');
const REF = charger('tests/references/pvgis-toulouse-2022-ete.json');
const X = window.CONFORT_PROJET;
const VILLES = window.CONFORT_METEO_VILLES;
const RAD = Math.PI / 180;
const TOULOUSE = { lat: 43.604, lon: 1.444 };

/* ---------- Méthode indépendante : l'algorithme de la NOAA (d'après J. Meeus, Astronomical Algorithms) ---------- */
function soleilNOAA(t, lieu) {
  const jd = 2459945.5 + t / 24;               // t heures UTC depuis le 1er janvier 2023 (année de 365 jours)
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Cc = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lambda = L0 + Cc - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.pow(Math.tan(eps * RAD / 2), 2);
  const eot = 4 / RAD * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
    0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  const minutes = (t % 24) * 60 + eot + 4 * lieu.lon;
  const ha = (minutes / 4 - 180) * RAD;
  const phi = lieu.lat * RAD;
  const cz = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const z = Math.acos(Math.max(-1, Math.min(1, cz)));
  // Azimut par l'arc cosinus (autre écriture que celle du site), depuis le Nord.
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(phi) * cz - Math.sin(decl)) / (Math.cos(phi) * Math.sin(z))))) / RAD;
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return { hauteur: 90 - z / RAD, azimut: az, declinaison: decl / RAD, eot: eot };
}

test('Soleil : Spencer = NOAA à mieux que 0,5° (hauteur) toute l\'année, à Toulouse et à Paris', function () {
  [TOULOUSE, { lat: 48.857, lon: 2.352 }].forEach(function (lieu) {
    let maxH = 0, maxA = 0, maxD = 0, maxE = 0;
    for (let t = 0.5; t < 8760; t += 1.7) {
      const a = S.positionSoleil(t, lieu), b = soleilNOAA(t, lieu);
      maxD = Math.max(maxD, Math.abs(a.declinaison - b.declinaison));
      maxE = Math.max(maxE, Math.abs(a.equationTemps - b.eot));
      if (b.hauteur < 3) continue;
      maxH = Math.max(maxH, Math.abs(a.hauteur - b.hauteur));
      maxA = Math.max(maxA, Math.abs(((a.azimut - b.azimut + 540) % 360) - 180));
    }
    assert.ok(maxD < 0.35, 'déclinaison : écart ' + maxD.toFixed(3) + '°');
    assert.ok(maxE < 0.7, 'équation du temps : écart ' + maxE.toFixed(2) + ' min');
    assert.ok(maxH < 0.5, 'hauteur : écart ' + maxH.toFixed(3) + '°');
    assert.ok(maxA < 1.5, 'azimut : écart ' + maxA.toFixed(3) + '°');
  });
});

test('Soleil : repères physiques (solstice, équinoxe, midi solaire)', function () {
  assert.ok(proche(S.declinaison(172), 23.45, 0.1), 'solstice d\'été : δ ≈ +23,45°');
  assert.ok(proche(S.declinaison(355), -23.45, 0.15), 'solstice d\'hiver : δ ≈ −23,45°');
  assert.ok(Math.abs(S.declinaison(80)) < 0.6, 'équinoxe de printemps : δ ≈ 0');
  // À midi solaire : soleil plein Sud, hauteur = 90° − φ + δ.
  const n = 172;
  // Midi solaire en UTC : 12 h − longitude/15 − E/60 (E dépend un peu de l'heure : 3 itérations suffisent).
  let tMidi = (n - 1) * 24 + 12;
  for (let i = 0; i < 3; i++) tMidi = (n - 1) * 24 + 12 - TOULOUSE.lon / 15 - S.equationDuTemps(n + (tMidi % 24 - 12) / 24) / 60;
  const p = S.positionSoleil(tMidi, TOULOUSE);
  assert.ok(proche(p.heureSolaire, 12, 1e-6));
  assert.ok(proche(p.azimut, 180, 1e-4), 'azimut ' + p.azimut);
  assert.ok(proche(p.hauteur, 90 - TOULOUSE.lat + p.declinaison, 1e-6));
  // Le matin, le soleil est à l'Est (azimut < 180°) ; le soir à l'Ouest.
  assert.ok(S.positionSoleil(tMidi - 4, TOULOUSE).azimut < 180);
  assert.ok(S.positionSoleil(tMidi + 4, TOULOUSE).azimut > 180);
  // Le vecteur soleil est unitaire.
  const s = p.s;
  assert.ok(proche(Math.hypot(s[0], s[1], s[2]), 1, 1e-12));
});

test('Paroi : horizontale → Gh = Gbn·sin h + Gdh ; face au soleil → tout le direct ; dos au soleil → 0', function () {
  const p = S.positionSoleil(201 * 24 + 12, TOULOUSE);
  const m = { Gbn: 800, Gdh: 120 };
  const h = S.eclairementParoi(m, p, 0, 0);
  assert.ok(proche(h.total, 800 * Math.sin(p.hauteur * RAD) + 120, 1e-9));
  assert.ok(proche(h.reflechi, 0, 1e-12));
  // Paroi tournée exactement vers le soleil : inclinaison = 90° − h, azimut = celui du soleil.
  const face = S.eclairementParoi(m, p, 90 - p.hauteur, p.azimut);
  assert.ok(proche(face.direct, 800, 1e-6));
  // Façade Nord à midi en été : pas de direct.
  assert.equal(S.eclairementParoi(m, p, 90, 0).direct, 0);
  // Mur vertical : il voit la moitié du ciel et la moitié du sol.
  const v = S.eclairementParoi(m, p, 90, 180);
  assert.ok(proche(v.diffus, 60, 1e-9));
  assert.ok(proche(v.reflechi, 0.2 * h.Gh / 2, 1e-9));
  // Soleil couché : ni direct ni réfléchi du direct.
  const nuit = S.positionSoleil(201 * 24 + 1, TOULOUSE);
  assert.equal(S.eclairementParoi(m, nuit, 90, 180).direct, 0);
});

test('Validation PVGIS : façades Sud et Ouest, Toulouse 2022, mai → septembre', function () {
  const h = REF.horaire;
  const somme = {};
  h.temps.forEach(function (stamp, i) {
    const m = Number(stamp.slice(4, 6)), j = Number(stamp.slice(6, 8));
    const t = (S.jourDeLAnnee(m, j) - 1) * 24 + Number(stamp.slice(9, 11)) + Number(stamp.slice(11, 13)) / 60;
    const p = S.positionSoleil(t, REF.lieu);
    const sinh = Math.sin(p.hauteur * RAD);
    const mh = { Gbn: sinh > 0.02 ? h.Gbh[i] / sinh : 0, Gdh: h.Gdh[i] };
    const sud = S.eclairementParoi(mh, p, 90, 180), ouest = S.eclairementParoi(mh, p, 90, 270);
    const o = somme[m] = somme[m] || { sudDirect: 0, sudTotal: 0, ouestDirect: 0, ouestTotal: 0 };
    o.sudDirect += sud.direct / 1000; o.sudTotal += sud.total / 1000;
    o.ouestDirect += ouest.direct / 1000; o.ouestTotal += ouest.total / 1000;
  });
  let total = { moi: 0, pvgis: 0 };
  Object.keys(REF.mensuel).forEach(function (m) {
    const r = REF.mensuel[m], o = somme[m];
    // Le direct ne dépend que de la géométrie du soleil : il doit coller à 3 % près.
    assert.ok(Math.abs(o.sudDirect / r.sudDirect - 1) < 0.03, 'mois ' + m + ' Sud direct : ' + o.sudDirect.toFixed(1) + ' / ' + r.sudDirect);
    assert.ok(Math.abs(o.ouestDirect / r.ouestDirect - 1) < 0.03, 'mois ' + m + ' Ouest direct : ' + o.ouestDirect.toFixed(1) + ' / ' + r.ouestDirect);
    // Le total dépend aussi du modèle de ciel (isotrope ici, Muneer pour PVGIS) : 12 % au plus par mois.
    assert.ok(Math.abs(o.sudTotal / r.sudTotal - 1) < 0.12, 'mois ' + m + ' Sud total');
    assert.ok(Math.abs(o.ouestTotal / r.ouestTotal - 1) < 0.12, 'mois ' + m + ' Ouest total');
    total.moi += o.sudTotal + o.ouestTotal; total.pvgis += r.sudTotal + r.ouestTotal;
  });
  assert.ok(Math.abs(total.moi / total.pvgis - 1) < 0.04, 'été entier : ' + total.moi.toFixed(0) + ' / ' + total.pvgis.toFixed(0) + ' kWh/m²');
});

test('Météo embarquée : 10 villes, 8 760 h, valeurs plausibles, décalage ≈ 10 min', function () {
  assert.equal(VILLES.villes.length, 10);
  assert.equal(METEO.T.length, 8760);
  ['T', 'HR', 'Gbn', 'Gdh', 'V'].forEach(function (c) { assert.equal(METEO[c].length, 8760, c); });
  assert.ok(METEO.decalage > 0.1 && METEO.decalage < 0.3);
  assert.ok(Math.max.apply(null, METEO.T) < 45 && Math.min.apply(null, METEO.T) > -20);
  assert.ok(Math.max.apply(null, METEO.Gbn) < 1100);
  // La nuit (soleil à plus de 5° sous l'horizon) : aucun rayonnement.
  for (let k = 0; k < 8760; k++) {
    if (S.positionSoleil(k + METEO.decalage, TOULOUSE).hauteur < -5) assert.equal(METEO.Gbn[k] + METEO.Gdh[k], 0, 'heure ' + k);
  }
});

test('Le temps : jour de l\'année, heure légale, jour de la semaine', function () {
  assert.equal(S.jourDeLAnnee(1, 1), 1);
  assert.equal(S.jourDeLAnnee(7, 21), 202);
  assert.equal(S.jourDeLAnnee(12, 31), 365);
  assert.deepEqual(S.dateDuJour(202), { mois: 7, jour: 21, nom: '21 juillet' });
  assert.equal(S.decalageLegal(202), 2);
  assert.equal(S.decalageLegal(15), 1);
  assert.equal(S.jourSemaine(1), 0);   // lundi (H)
  assert.equal(S.jourSemaine(7), 6);   // dimanche
});

test('Casquette : exemple de la Méthode (h = 60°, plein Sud, d = 0,5 m)', function () {
  const soleil = { hauteur: 60, azimut: 180 };
  const f = S.fractionEnsoleillee(soleil, 180, { profondeur: 0.5, ecart: 0.2, hauteurFenetre: 1.35 });
  // tan Ω = tan 60° = 1,732 ; ombre = 0,5 × 1,732 − 0,2 = 0,666 m ; part au soleil = 1 − 0,666 / 1,35 = 0,507.
  assert.ok(proche(f, 1 - (0.5 * Math.tan(60 * RAD) - 0.2) / 1.35, 1e-12));
  assert.ok(proche(f, 0.5067, 1e-4));
  // Soleil de côté (60° d'écart) : l'angle de profil grandit, l'ombre aussi.
  assert.ok(S.fractionEnsoleillee({ hauteur: 60, azimut: 240 }, 180, { profondeur: 0.5, ecart: 0.2, hauteurFenetre: 1.35 }) < f);
  // Soleil bas : la casquette ne fait presque rien.
  assert.equal(S.fractionEnsoleillee({ hauteur: 10, azimut: 180 }, 180, { profondeur: 0.5, ecart: 0.2, hauteurFenetre: 1.35 }), 1);
  // Pas de casquette : 1.
  assert.equal(S.fractionEnsoleillee(soleil, 180, null), 1);
});

test('Paroi opaque : exemple de la Méthode (mur clair au soleil, puis isolé)', function () {
  // α 0,4 · Rse 0,04 · U 0,5 · A 20 · I 500 = 80 W ; ciel : 0,5 · 0,04 · 0,5 · 20 · 4,5 · 11 = 9,9 W.
  const a = S.apportOpaque({ total: 500 }, { inclinaison: 90, alpha: 0.4, U: 0.5, A: 20 });
  assert.ok(proche(a.soleil, 80, 1e-9));
  assert.ok(proche(a.ciel, 9.9, 1e-9));
  assert.ok(proche(a.flux, 70.1, 1e-9));
  // 4 fois plus isolé → 4 fois moins de chaleur qui entre.
  assert.ok(proche(S.apportOpaque({ total: 500 }, { inclinaison: 90, alpha: 0.4, U: 0.125, A: 20 }).flux, 70.1 / 4, 1e-9));
});

test('Fenêtre : la protection n\'agit qu\'au-dessus du seuil ; Fc intérieur > extérieur', function () {
  const ecl = { direct: 400, diffus: 100, reflechi: 20, total: 520 };
  const base = { surface: 2, g: 0.6, partCadre: 0.3, Fw: 0.9, seuil: 200 };
  const sans = S.apportFenetre(ecl, base);
  assert.ok(proche(sans.flux, 520 * 2 * 0.7 * 0.6 * 0.9, 1e-9));
  const bso = S.apportFenetre(ecl, Object.assign({}, base, { protection: { Fc: 0.15 } }));
  assert.ok(bso.baissee && proche(bso.flux, sans.flux * 0.15, 1e-9));
  const faible = S.apportFenetre({ direct: 0, diffus: 100, reflechi: 10, total: 110 }, Object.assign({}, base, { protection: { Fc: 0.15 } }));
  assert.ok(!faible.baissee && faible.Fc === 1, 'sous le seuil, la protection reste relevée');
  const fc = function (id) { return X.protections.find(function (p) { return p.id === id; }).Fc; };
  assert.ok(fc('store-interieur') > fc('store-exterieur') && fc('store-exterieur') > fc('bso'));
});

test('Apports internes : école fermée l\'été ; un logement ≈ 4 à 5 W/m² en moyenne', function () {
  const u = X.scenarios.usages;
  const juillet = S.jourDeLAnnee(7, 15);
  assert.equal(S.apportInterne(u.enseignement, juillet, 10, 100).postes.occupants, 0);
  assert.ok(S.apportInterne(u.enseignement, S.jourDeLAnnee(6, 12), 10, 100).postes.occupants > 0);   // un lundi (H)
  let s = 0;
  for (let h = 0; h < 24; h++) s += S.apportInterne(u.logement, 1, h, 1).total;
  assert.ok(s / 24 > 4 && s / 24 < 5, 'logement : ' + (s / 24).toFixed(2) + ' W/m²');
  Object.keys(u).forEach(function (k) {
    ['occupants', 'equipements', 'eclairage'].forEach(function (p) {
      assert.equal(u[k][p].semaine.length, 24, k + ' ' + p);
      assert.equal(u[k][p].weekend.length, 24, k + ' ' + p);
    });
  });
});

/* ---------- La maison d'exemple à Toulouse ---------- */
const M = window.CONFORT_MATERIAUX;
function entreesExemple(modif) {
  const projet = JSON.parse(JSON.stringify(X.projet));
  if (modif) modif(projet);
  const an = {};
  Object.keys(projet.parois).forEach(function (k) { an[k] = P.analyserParoi(M.parois.find(function (p) { return p.id === projet.parois[k]; }), M.materiaux); });
  const vitrage = X.vitrages.find(function (v) { return v.id === projet.vitrage; });
  const alpha = function (id) { return X.couleurs.find(function (c) { return c.id === id; }).alpha; };
  return {
    projet: projet, synthese: B.syntheseProjet(projet, an, vitrage), lieu: TOULOUSE, meteo: METEO, vitrage: vitrage,
    protections: X.protections.reduce(function (o, p) { o[p.id] = p; return o; }, {}), seuil: X.seuilProtection.valeur,
    usage: X.scenarios.usages[projet.usage], U: { murs: an.murs.U, toiture: an.toiture.U },
    alpha: { murs: alpha(projet.couleurs.murs), toiture: alpha(projet.couleurs.toiture) },
    casquettes: projet.casquettes, fenetre: X.fenetre,
    heures: [(S.jourDeLAnnee(6, 1) - 1) * 24, S.jourDeLAnnee(9, 30) * 24]
  };
}

test('Maison d\'exemple à Toulouse (juin → septembre) : ordres de grandeur et sens physiques', function () {
  const r = S.apportsHoraires(entreesExemple());
  assert.equal(r.N, 122 * 24);
  const kwh = function (s) { return S.sommeKWh(s); };
  // Le total est bien la somme des postes, heure par heure.
  for (let i = 0; i < r.N; i += 37) assert.ok(proche(r.total[i], r.fenetres[i] + r.murs[i] + r.toiture[i] + r.internes[i], 1e-9));
  // Au cœur de l'été (juin → août), l'Ouest reçoit plus que le Sud (soleil haut à midi, bas et de face
  // l'après-midi). En septembre, le Sud reprend l'avantage : sur juin → septembre, ils sont à égalité.
  const ete = 92 * 24;
  const ouest = S.sommeKWh(r.eclairement.D, 0, ete), sud = S.sommeKWh(r.eclairement.A, 0, ete);
  assert.ok(ouest > 1.05 * sud, 'Ouest ' + ouest.toFixed(0) + ' / Sud ' + sud.toFixed(0) + ' kWh/m²');
  // Le toit reçoit plus que n'importe quelle façade.
  assert.ok(kwh(r.eclairement.toiture) > kwh(r.eclairement.D));
  // Les fenêtres dominent les apports solaires (murs et plafond isolés).
  assert.ok(kwh(r.fenetres) > 3 * Math.abs(kwh(r.murs) + kwh(r.toiture)));
  // Des BSO partout divisent au moins par 2 les apports par les fenêtres, par rapport à « aucune protection » ;
  // et les volets roulants de l'exemple sont entre les deux.
  const partout = function (id) { return function (p) { Object.keys(p.facades).forEach(function (f) { p.facades[f].protection = id; }); }; };
  const bso = S.apportsHoraires(entreesExemple(partout('bso'))), nues = S.apportsHoraires(entreesExemple(partout('aucune')));
  assert.ok(kwh(bso.fenetres) < 0.5 * kwh(nues.fenetres));
  assert.ok(kwh(bso.fenetres) < kwh(r.fenetres) && kwh(r.fenetres) < kwh(nues.fenetres));
  // Une casquette de 1 m sur la façade Sud y fait baisser les apports.
  const casq = S.apportsHoraires(entreesExemple(function (p) { p.casquettes.A = 1; }));
  assert.ok(kwh(casq.parFacade.A) < kwh(r.parFacade.A));
  // Façade Sud plus vitrée (6 m²) → plus d'apports qu'à l'Est (3 m²).
  assert.ok(kwh(r.parFacade.A) > kwh(r.parFacade.B));
});

test('Semaine la plus chaude : 7 jours, dans la période, moyenne correcte', function () {
  const k0 = (S.jourDeLAnnee(6, 1) - 1) * 24, k1 = S.jourDeLAnnee(9, 30) * 24;
  const s = S.semaineLaPlusChaude(METEO.T, k0, k1);
  assert.equal(s.fin - s.debut, 168);
  assert.ok(s.debut >= k0 && s.fin <= k1 && s.debut % 24 === 0);
  let m = 0;
  for (let k = s.debut; k < s.fin; k++) m += METEO.T[k];
  assert.ok(proche(m / 168, s.moyenne, 1e-9));
  for (let d = k0; d + 168 <= k1; d += 24) {
    let x = 0;
    for (let k = d; k < d + 168; k++) x += METEO.T[k];
    assert.ok(x / 168 <= s.moyenne + 1e-9);
  }
});

test('Sommaire : ConfortCalcul expose le chapitre 2', function () {
  assert.equal(C.soleil, S);
});

test('Heure type de la Méthode (§ 26) : Toulouse, 21 juillet, 16 h, façade Ouest', function () {
  const k = 201 * 24 + 14;                         // 16 h légale = 14 h UTC (heure d'été)
  assert.equal(METEO.T[k], 32);
  assert.equal(METEO.Gbn[k], 792);
  assert.equal(METEO.Gdh[k], 153);
  const p = S.positionSoleil(k + METEO.decalage, TOULOUSE);
  assert.ok(proche(p.declinaison, 20.620, 0.001));
  assert.ok(proche(p.equationTemps, -6.360, 0.001));
  assert.ok(proche(p.heureSolaire, 14.1649, 0.0001));
  assert.ok(proche(p.angleHoraire, 32.473, 0.001));
  assert.ok(proche(p.hauteur, 54.552, 0.001));
  assert.ok(proche(p.azimut, 240.048, 0.001));
  const m = { Gbn: 792, Gdh: 153 };
  const ouest = S.eclairementParoi(m, p, 90, 270);
  assert.ok(proche(ouest.cosIncidence, 0.5025, 0.0001));
  assert.ok(proche(ouest.direct, 398.0, 0.05) && proche(ouest.diffus, 76.5, 1e-9) && proche(ouest.reflechi, 79.8, 0.05));
  assert.ok(proche(ouest.total, 554.3, 0.05));
  assert.ok(proche(S.eclairementParoi(m, p, 90, 180).total, 385.6, 0.05));
  // Fenêtre Ouest de la maison d'exemple (façade B) : 3 m², g 0,6, volet roulant baissé (554 > 200 W/m²).
  const base = { surface: 3, g: 0.6, partCadre: 0.3, Fw: 0.9, seuil: 200 };
  assert.ok(proche(S.apportFenetre(ouest, base).flux, 628.6, 0.05));
  const volet = S.apportFenetre(ouest, Object.assign({ protection: { Fc: 0.25 } }, base));
  assert.ok(volet.baissee && proche(volet.flux, 157.1, 0.05));
});

test('Méthode § 36 : la température sol-air, à la main', function () {
  // Mur (vertical, Fciel = ½), α 0,6, 500 W/m², air à 30 °C : 30 + 0,6 × 0,04 × 500 − 0,5 × 0,04 × 4,5 × 11 = 41,01 °C.
  assert.ok(proche(S.temperatureSolAir(30, { total: 500 }, 90, 0.6), 41.01, 1e-9));
  // Toit sombre à 35° : Fciel = (1 + cos 35°)/2 = 0,9097 → 30 + 28,8 − 1,80 = 57,0 °C.
  assert.ok(proche(S.temperatureSolAir(30, { total: 900 }, 35, 0.8), 30 + 28.8 - 0.9097 * 0.04 * 4.5 * 11, 1e-3));
  // La nuit, sans soleil : plus froid que l'air (le ciel), de 1 °C pour un mur.
  assert.ok(proche(S.temperatureSolAir(20, { total: 0 }, 90, 0.6), 19.01, 1e-9));
  // Série sur la semaine la plus chaude de Toulouse, façade Ouest claire : le sol-air dépasse l'air l'après-midi, jamais de plus de ~25 °C.
  const k0 = (S.jourDeLAnnee(7, 20) - 1) * 24, k1 = k0 + 72;
  const s = S.serieSolAir(METEO, TOULOUSE, 90, 270, 0.4, k0, k1);
  let maxEcart = -Infinity;
  for (let i = 0; i < s.length; i++) maxEcart = Math.max(maxEcart, s[i] - METEO.T[k0 + i]);
  assert.ok(s.length === 72 && maxEcart > 5 && maxEcart < 25, 'écart sol-air − air max : ' + maxEcart);
  // Modulo l'année : des indices négatifs rebouclent sur décembre.
  assert.ok(S.serieSolAir(METEO, TOULOUSE, 90, 180, 0.4, -5, 5).length === 10);
});
