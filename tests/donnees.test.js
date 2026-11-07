/* Tests des données publiques : chaque valeur a une source, une date, un statut,
   et rien de confidentiel n'est publié.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { RACINE, charger } = require('./aide-tests.js');

const STATUTS = ['exemple', 'valide'];

function sansDoublon(liste) { return new Set(liste).size === liste.length; }

test('Confort d\'été : chaque matériau a des λ, ρ, c plausibles, une source, un mois, un statut ; chaque paroi d\'exemple est complète', function () {
  charger('donnees/confort-materiaux.js');
  const CM = window.CONFORT_MATERIAUX;
  const familles = CM.familles.map(function (f) { return f.id; });
  assert.ok(sansDoublon(CM.materiaux.map(function (m) { return m.id; })), 'matériaux en double');
  CM.materiaux.forEach(function (m) {
    assert.ok(familles.indexOf(m.famille) !== -1, m.id + ' : famille inconnue');
    assert.ok(m.lambda > 0.015 && m.lambda < 5, m.id + ' : λ hors plage');
    assert.ok(m.rho >= 10 && m.rho <= 3000, m.id + ' : ρ hors plage');
    assert.ok(m.c >= 500 && m.c <= 2500, m.id + ' : c hors plage');
    assert.ok(m.source && m.source.trim(), m.id + ' : source manquante');
    assert.match(m.dateRef, /^\d{4}-\d{2}$/, m.id + ' : mois manquant');
    assert.ok(STATUTS.indexOf(m.statut) !== -1, m.id + ' : statut inconnu');
  });
  assert.ok(sansDoublon(CM.parois.map(function (p) { return p.id; })), 'parois en double');
  CM.parois.forEach(function (p) {
    assert.ok(['exterieure', 'interieure'].indexOf(p.type) !== -1, p.id + ' : type inconnu');
    assert.ok(p.couches.length > 0, p.id + ' : aucune couche');
    p.couches.forEach(function (c) {
      assert.ok(CM.materiaux.some(function (m) { return m.id === c.materiau; }), p.id + ' : matériau ' + c.materiau + ' inconnu');
      assert.ok(c.e > 0 && c.e < 1, p.id + ' : épaisseur en mètres attendue');
    });
  });
  CM.local.elements.forEach(function (e) {
    assert.ok(CM.parois.some(function (p) { return p.id === e.paroi; }), 'local : paroi ' + e.paroi + ' inconnue');
  });
  assert.ok(CM.onde.source && STATUTS.indexOf(CM.onde.statut) !== -1, 'onde d\'exemple sans source');
});

test('Lexique : chaque terme a un identifiant unique, une définition, et ses motifs ne sont pas partagés', function () {
  charger('donnees/lexique.js');
  const T = window.LEXIQUE.termes;
  assert.ok(T.length >= 20);
  assert.ok(sansDoublon(T.map(function (t) { return t.id; })), 'identifiants en double');
  const motifs = [];
  T.forEach(function (t) {
    assert.ok(t.terme && t.definition && t.definition.length > 20, t.id + ' : définition manquante');
    (t.motifs || []).forEach(function (m) { motifs.push(m.toLowerCase()); });
  });
  assert.ok(sansDoublon(motifs), 'un même motif renvoie vers deux termes');
});

test('Confidentialité : aucun nom de l\'entreprise dans les données publiques', function () {
  const fichiers = function (d) {
    return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
      return e.isDirectory() ? fichiers(path.join(d, e.name)) : [path.join(d, e.name)];
    });
  };
  fichiers(path.join(RACINE, 'donnees')).forEach(function (f) {
    const texte = fs.readFileSync(f, 'utf8');
    assert.ok(!/argetec/i.test(texte), path.relative(RACINE, f) + ' contient « Argetec »');
  });
});
