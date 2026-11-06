/* Tests du site : syntaxe de chaque fichier JavaScript, et chaque page
   ne charge que des fichiers qui existent.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RACINE } = require('./aide-tests.js');

// Tous les fichiers du site (hors .git et tests), récursivement.
function fichiers(dossier, extension) {
  let liste = [];
  fs.readdirSync(dossier, { withFileTypes: true }).forEach(function (e) {
    if (e.name.startsWith('.') || e.name === 'tests' || e.name === 'node_modules') return;
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) liste = liste.concat(fichiers(chemin, extension));
    else if (e.name.endsWith(extension)) liste.push(chemin);
  });
  return liste;
}

test('Syntaxe JavaScript (node --check) de chaque fichier du site', function () {
  const js = fichiers(RACINE, '.js');
  assert.ok(js.length > 5);
  js.forEach(function (f) {
    execFileSync(process.execPath, ['--check', f]);
  });
});

test('Chaque page ne charge que des scripts et feuilles de style qui existent', function () {
  fichiers(RACINE, '.html').forEach(function (page) {
    const html = fs.readFileSync(page, 'utf8');
    const liens = Array.from(html.matchAll(/(?:src|href)="([^"#:?]+\.(?:js|css))(?:\?[^"]*)?"/g)).map(function (m) { return m[1]; });
    liens.forEach(function (lien) {
      const cible = path.join(path.dirname(page), lien);
      assert.ok(fs.existsSync(cible), path.relative(RACINE, page) + ' → ' + lien + ' introuvable');
    });
  });
});

test('Le simulateur a ses trois onglets Calcul · Méthode · Données', function () {
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  ['calcul', 'methode', 'donnees'].forEach(function (o) {
    assert.ok(html.includes('data-onglet="' + o + '"') && html.includes('id="onglet-' + o + '"'), 'onglet « ' + o + ' » manquant');
  });
});

test('Chaque script et feuille de style du site porte le même numéro de version (?v=…), pour vider le cache', function () {
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const locaux = Array.from(html.matchAll(/(?:src|href)="(?!https?:|data:)([^"#]+\.(?:js|css)[^"]*)"/g)).map(function (m) { return m[1]; });
  assert.ok(locaux.length >= 10);
  const versions = new Set(locaux.map(function (l) { const v = /\?v=([\w.-]+)$/.exec(l); return v ? v[1] : 'aucune'; }));
  assert.equal(versions.size, 1, 'versions différentes : ' + Array.from(versions).join(', '));
  assert.ok(!versions.has('aucune'), 'un fichier sans ?v=');
});
