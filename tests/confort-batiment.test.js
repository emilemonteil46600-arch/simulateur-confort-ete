/* Tests du Simulateur de confort d'été — étape 1 bis : la maison.
   L'exemple refait à la main dans la Méthode (§ 17), les formules de géométrie,
   et la caméra de la maquette 3D (pas de vue en miroir).
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger, proche } = require('./aide-tests.js');

charger('commun/commun.js');
charger('donnees/confort-materiaux.js');
charger('donnees/confort-projet.js');
const P = charger('calcul/calcul-parois.js');
const B = charger('calcul/calcul-batiment.js');
const C = charger('calcul/calcul.js');
const D3 = charger('affichage/maison3d.js');
const M = window.CONFORT_MATERIAUX;
const X = window.CONFORT_PROJET;
const cloner = function (o) { return JSON.parse(JSON.stringify(o)); };

function analysesDe(projet) {
  const a = {};
  Object.keys(projet.parois).forEach(function (k) {
    a[k] = P.analyserParoi(M.parois.find(function (p) { return p.id === projet.parois[k]; }), M.materiaux);
  });
  return a;
}
const VITRAGE = X.vitrages.find(function (v) { return v.id === X.projet.vitrage; });

test('Orientation : azimut → nom ; façades à +90°', function () {
  assert.equal(B.orientation(0).nom, 'Nord');
  assert.equal(B.orientation(100).nom, 'Est');
  assert.equal(B.orientation(180).court, 'S');
  assert.equal(B.orientation(-90).nom, 'Ouest');
  assert.equal(B.orientation(337).court, 'NO');
  assert.deepEqual(B.azimutsFacades(180), { A: 180, B: 270, C: 0, D: 90 });
});

test('Méthode § 17 : la maison d\'exemple refaite à la main', function () {
  const pr = cloner(X.projet);
  const s = B.syntheseProjet(pr, analysesDe(pr), VITRAGE);
  assert.ok(proche(s.hauteurToit, 2.80, 0.005), 'faîtage ' + s.hauteurToit);
  assert.deepEqual(s.facades.map(function (f) { return f.orientation.court; }), ['S', 'O', 'N', 'E']);
  assert.ok(proche(s.facades.reduce(function (t, f) { return t + f.brute; }, 0), 97.2, 1e-9));
  assert.ok(proche(s.facades.reduce(function (t, f) { return t + f.opaque; }, 0), 84.2, 1e-9));
  assert.ok(proche(s.vitrageSurPlancher, 0.1625, 1e-9));
  assert.ok(proche(s.surfaceToiture, 80, 1e-9) && proche(s.volume, 216, 1e-9));
  const l = s.deperditions.lignes;
  assert.ok(proche(l[0].UA, 25.48, 0.01) && proche(l[1].UA, 18.20, 1e-9) && proche(l[2].UA, 9.06, 0.01) && proche(l[3].UA, 26.38, 0.01));
  assert.ok(proche(s.deperditions.H, 79.1, 0.05), 'H = ' + s.deperditions.H);
  assert.ok(proche(l.reduce(function (t, x) { return t + x.part; }, 0), 1, 1e-12));
  assert.ok(proche(s.inertie.cm / 1000, 9314, 1), 'Cm = ' + s.inertie.cm);
  assert.ok(proche(s.inertie.cmSurAf / 1000, 116.4, 0.1));
  assert.equal(s.inertie.classe.id, 'legere');
});

test('Combles aménagés : rampants = L·l / cos α, pignons dans les murs, volume des combles', function () {
  const g = Object.assign(cloner(X.projet.geometrie), { combles: 'amenages' });
  assert.ok(proche(B.surfaceToiture(g), 80 / Math.cos(35 * Math.PI / 180), 1e-9));
  assert.ok(proche(B.surfaceToiture(g), 97.66, 0.01));
  assert.ok(proche(B.surfaceFacade(g, 'B'), 21.6 + 8 * B.hauteurToit(g) / 2, 1e-9));
  assert.ok(proche(B.surfaceFacade(g, 'A'), 27, 1e-9), 'pas de pignon sur les façades A et C');
  assert.ok(proche(B.volume(g), 216 + 80 * B.hauteurToit(g) / 2, 1e-9));
  const g4 = Object.assign(cloner(g), { toit: 'quatre-pans', longueur: 8, largeur: 8 });
  assert.ok(proche(B.volumeCombles(g4), 64 * B.hauteurToit(g4) / 3, 1e-9), '4 pans sur un carré = pyramide');
  const g4b = Object.assign(cloner(g4), { longueur: 6, largeur: 12 });
  assert.ok(proche(B.hauteurToit(g4b), 3 * Math.tan(35 * Math.PI / 180), 1e-12), '4 pans : on prend le côté court');
  assert.equal(B.hauteurToit(Object.assign(cloner(g), { toit: 'plat' })), 0);
});

test('Saisie suspecte et saisie impossible', function () {
  const pr = cloner(X.projet);
  pr.facades.C.vitrage = 25;
  assert.ok(B.bilanFacades(pr).find(function (f) { return f.id === 'C'; }).trop);
  assert.ok(B.erreursGeometrie({ longueur: 0, largeur: 8, niveaux: 1, hauteurEtage: 2.7, toit: 'plat' }).length > 0);
  assert.equal(B.erreursGeometrie(X.projet.geometrie).length, 0);
});

test('Plus de niveaux : planchers intermédiaires dans l\'inertie (deux faces)', function () {
  const pr = cloner(X.projet);
  pr.geometrie.niveaux = 2;
  const els = B.elementsInertie(pr, analysesDe(pr));
  const pi = els.find(function (e) { return e.nom === 'Planchers intermédiaires'; });
  assert.ok(pi && pi.contact === 'deux' && proche(pi.aire, 80, 1e-9));
  assert.ok(B.inertieMaison(pr, analysesDe(pr)).cmSurAf > 0);
});

test('Maquette 3D : caméra orthonormée et directe (pas de vue en miroir)', function () {
  [[0, 20], [135, 30], [250, 60]].forEach(function (v) {
    const cam = D3.camera(v[0], v[1]);
    const dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    const cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
    assert.ok(proche(dot(cam.r, cam.h), 0, 1e-12) && proche(dot(cam.r, cam.c), 0, 1e-12) && proche(dot(cam.h, cam.c), 0, 1e-12));
    const rh = cross(cam.r, cam.h);
    assert.ok(proche(rh[0], cam.c[0], 1e-12) && proche(rh[1], cam.c[1], 1e-12) && proche(rh[2], cam.c[2], 1e-12), 'r × h = c');
  });
  // Depuis le Sud (θ = 180°), on regarde vers le Nord : l'Est est à droite.
  const sud = D3.camera(180, 10);
  assert.ok(sud.r[0] > 0.99, 'Est à droite quand on regarde vers le Nord');
});

test('Maquette 3D : faces, normales extérieures, fenêtres de la bonne surface', function () {
  const m = D3.construire(cloner(X.projet));
  assert.equal(m.faces.filter(function (f) { return f.type === 'mur'; }).length, 4);
  assert.equal(m.faces.filter(function (f) { return f.type === 'toit'; }).length, 2);
  const A = m.faces.find(function (f) { return f.id === 'A'; });
  assert.ok(A.n[1] < -0.99, 'la façade A (azimut 180°) regarde vers le Sud');
  const g = X.projet.geometrie;
  const fen = D3.dispositionFenetres(6, 10, g);
  const aire = fen.reduce(function (t, w) { return t + (w.x1 - w.x0) * (w.z1 - w.z0); }, 0);
  assert.ok(proche(aire, 6, 1e-9), 'les fenêtres dessinées ont la surface saisie');
  const toit4 = D3.construire(Object.assign(cloner(X.projet), { geometrie: Object.assign(cloner(g), { toit: 'quatre-pans' }) }));
  assert.equal(toit4.faces.filter(function (f) { return f.type === 'toit'; }).length, 4);
  assert.ok(D3.rendreSVG(cloner(X.projet), { theta: 145, phi: 26, zoom: 1 }, 'A').indexOf('m-choisi') !== -1);
});

test('Le sommaire calcul.js donne accès au chapitre de la maison', function () {
  assert.equal(C.batiment, B);
});
