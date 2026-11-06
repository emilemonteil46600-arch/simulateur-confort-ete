/* Tests des exercices « Teste-toi » : pour 40 tirages de chaque exercice, la réponse
   existe, la bonne réponse est acceptée et une réponse fausse est refusée.
   Lancer : node --test (depuis la racine du dépôt) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { charger } = require('./aide-tests.js');

const BAO = charger('commun/commun.js');
charger('calcul/calcul-parois.js');
charger('calcul/calcul-batiment.js');
charger('calcul/calcul-transitoire.js');
const OUTILS = {
  'simulateur de confort d\'été': charger('affichage/exercices.js')
};

Object.keys(OUTILS).forEach(function (outil) {
  test('Exercices du ' + outil + ' : réponses cohérentes sur 40 tirages', function () {
    assert.ok(OUTILS[outil].length >= 3);
    OUTILS[outil].forEach(function (ex) {
      for (let graine = 1; graine <= 40; graine++) {
        const e = ex.generer(BAO.hasard(graine));
        assert.ok(e.enonce && e.correction, ex.titre + ' : énoncé ou correction vide');
        if (e.type === 'choix') {
          assert.ok(e.bonne >= 0 && e.bonne < e.choix.length, ex.titre + ' : bonne réponse hors des choix');
          assert.equal(new Set(e.choix).size, e.choix.length, ex.titre + ' : choix en double');
          assert.ok(BAO.verifierReponse(e, String(e.bonne)));
        } else {
          assert.ok(isFinite(e.reponse), ex.titre + ' : réponse non numérique');
          assert.ok(BAO.verifierReponse(e, BAO.nombre(e.reponse, 3)), ex.titre + ' : la bonne réponse est refusée');
          assert.ok(!BAO.verifierReponse(e, String(e.reponse * 1.3 + 5)), ex.titre + ' : une réponse fausse est acceptée');
        }
      }
    });
  });
});

test('Même graine → mêmes exercices (tirage reproductible)', function () {
  const ex = OUTILS['simulateur de confort d\'été'][0];
  const a = ex.generer(BAO.hasard(7));
  const b = ex.generer(BAO.hasard(7));
  assert.equal(a.enonce, b.enonce);
});

test('Vérification des réponses : « 19 % », « 1 250,5 », tolérance', function () {
  const e = { type: 'nombre', reponse: 19.2, tolerance: 0.5 };
  assert.ok(BAO.verifierReponse(e, '19 %'));
  assert.ok(!BAO.verifierReponse(e, '18'));
  assert.ok(BAO.verifierReponse({ type: 'nombre', reponse: 1250.5, tolerance: 1 }, '1 250,5'));
  assert.ok(!BAO.verifierReponse(e, ''));
  assert.equal(BAO.tirer(function () { return 0.999; }, 10, 120, 5), 120);
  assert.equal(BAO.tirer(function () { return 0; }, 10, 120, 5), 10);
});
