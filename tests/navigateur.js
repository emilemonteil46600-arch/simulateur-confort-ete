/* ==========================================================
   Vérification dans un vrai navigateur (Chromium, via Playwright).
   Ce n'est PAS lancé par « node --test » ni sur GitHub : il faut
   Playwright installé sur la machine. Lancer : node tests/navigateur.js

   Vérifie : aucune erreur dans la console, pas de défilement horizontal
   à 390 px (clair et sombre), les exemples de la Méthode affichés
   à l'écran, la sauvegarde complète et sa restauration.
   ========================================================== */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const URL_SITE = 'file://' + path.join(RACINE, 'index.html');
const problemes = [];
const ok = function (condition, message) {
  if (condition) console.log('  ✓ ' + message);
  else { console.log('  ✗ ' + message); problemes.push(message); }
};

async function nouvellePage(navigateur, options) {
  const contexte = await navigateur.newContext(Object.assign({ acceptDownloads: true }, options));
  const page = await contexte.newPage();
  page.on('pageerror', function (e) { problemes.push('Erreur JavaScript : ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') problemes.push('Console : ' + m.text()); });
  page.on('dialog', function (d) { d.accept(); });
  return page;
}

(async function () {
  const navigateur = await chromium.launch();

  console.log('1. Affichage sur téléphone (390 px), clair et sombre');
  for (const theme of ['light', 'dark']) {
    const page = await nouvellePage(navigateur, { viewport: { width: 390, height: 844 }, colorScheme: theme });
    await page.goto(URL_SITE);
    for (const o of await page.$$('[data-onglet]')) {
      await o.click();
      const [doc, ecran] = await page.evaluate(function () { return [document.documentElement.scrollWidth, window.innerWidth]; });
      ok(doc <= ecran, theme + ' · ' + await o.textContent() + ' : pas de défilement horizontal');
    }
    await page.context().close();
  }

  console.log('2. Étape 1 bis : la maison en 3D');
  let page = await nouvellePage(navigateur, { viewport: { width: 1440, height: 900 } });
  await page.goto(URL_SITE);
  await page.click('[data-onglet="calcul"]');
  const resProjet = function () { return page.textContent('#resultat-projet').then(function (t) { return t.replace(/\s/g, ' '); }); };
  ok(await page.$$eval('#maison3d svg .m-face', function (f) { return f.length; }) >= 3, 'Maquette 3D dessinée (faces visibles)');
  ok((await resProjet()).includes('79 W/K') && (await resProjet()).includes('Légère'), 'Maison d\'exemple : H = 79 W/K, inertie « Légère »');
  ok((await page.textContent('#chiffres-maison')).replace(/\s/g, ' ').includes('80 m²'), 'Surface de plancher 80 m² sous la maquette');
  await page.click('#maison3d .m-face[data-cible="A"] .m-contour', { force: true });
  ok(await page.$('.facade-ligne[data-facade="A"].choisie') !== null && await page.$('#maison3d .m-face.m-choisi[data-cible="A"]') !== null, 'Clic sur la façade A : sélectionnée dans la maquette et dans la saisie');
  await page.click('[data-niveaux="2"]');
  ok((await page.textContent('#chiffres-maison')).replace(/\s/g, ' ').includes('160 m²'), '2 niveaux : 160 m² de plancher');
  await page.click('details[data-pas="toiture"] summary');
  await page.click('[data-toit="quatre-pans"]');
  ok(await page.$$eval('#maison3d svg .m-toit', function (f) { return f.length; }) >= 2, 'Toit 4 pans dessiné');
  await page.click('[data-combles="amenages"]');
  ok(await page.inputValue('#p-toiture') === 'rampants-laine', 'Combles aménagés : la toiture passe en rampants');
  await page.click('#btn-projet-exemple');
  ok((await resProjet()).includes('79 W/K'), 'Retour à la maison d\'exemple');

  console.log('3. Atelier parois (étape 1)');
  await page.click('[data-onglet="atelier"]');
  const resultat = function () { return page.textContent('#resultats').then(function (t) { return t.replace(/\s/g, ' '); }); };
  ok((await resultat()).includes('0,252') && (await resultat()).includes('7,7'), 'Béton 18 + ITE PSE 14 : U = 0,252, Δt ≈ 7,7 h');
  ok(await page.$('#schema svg .sch-onde') !== null, 'Coupe de la paroi avec la courbe de l\'onde');
  ok(await page.$('#graphe-temperatures svg.graphique') !== null && await page.$('#graphe-flux svg.graphique') !== null, 'Les 2 graphiques de la journée chaude sont dessinés');
  const avant = await resultat();
  await page.click('#btn-retourner');
  const apres = await resultat();
  ok(avant.includes('75,8') && apres.includes('0,252') && !apres.includes('75,8'), 'Retourner la paroi : même U, κ1 change');
  await page.click('#btn-retourner');
  await page.fill('#corps-couches tr[data-couche="1"] input[data-champ="e"]', '30');
  await page.press('#corps-couches tr[data-couche="1"] input[data-champ="e"]', 'Tab');
  ok((await page.textContent('#detail-couches')).includes('30,0'), 'Épaisseur modifiée : le détail couche par couche suit');
  ok((await page.textContent('#detail-matrice')).includes('doit valoir 1'), 'Le calcul pas à pas affiche le contrôle du déterminant');
  ok((await page.textContent('#resultat-local')).includes('Moyenne'), 'Local d\'exemple : classe d\'inertie « Moyenne »');
  await page.fill('#nom-projet', 'Façade test');
  await page.click('#btn-enregistrer');
  ok((await page.textContent('#comparaison')).includes('Façade test'), 'Mes parois : la paroi enregistrée apparaît dans la comparaison');

  console.log('3 ter. Le labo animé');
  await page.selectOption('#modele', 'beton-ite');
  await page.click('#btn-modele');
  await page.waitForTimeout(300);
  ok(await page.$('#labo-scene svg .labo-courbe') !== null, 'Labo : mur en coupe avec la courbe de température');
  const nbCouches = function () { return page.$$eval('#corps-couches tr[data-couche]', function (t) { return t.length; }); };
  const avantAjout = await nbCouches();
  await page.click('#labo-palette [data-palette="0"]');
  await page.waitForTimeout(300);
  ok(await nbCouches() === avantAjout + 1 && (await page.inputValue('#corps-couches tr[data-couche="0"] select')) === 'plaque-platre', 'Labo : « + BA13 » ajoute une couche côté intérieur');
  await page.click('#labo-edition [data-labo="retirer"]');
  await page.waitForTimeout(300);
  ok(await nbCouches() === avantAjout, 'Labo : « Retirer » enlève la couche');
  // Glisser l'isolant (couche 3) tout à gauche : on passe de l'ITE à l'ITI.
  const k1 = function () { return page.textContent('#resultats').then(function (t) { return t.replace(/\s/g, ' '); }); };
  await page.$eval('#labo-scene', function (el) { el.scrollIntoView({ block: 'center' }); });
  const poignee = await page.$('#labo-scene [data-couche="2"] rect');
  const bp = await poignee.boundingBox();
  const sceneBox = await (await page.$('#labo-scene svg')).boundingBox();
  await page.mouse.move(bp.x + bp.width / 2, bp.y + bp.height / 2);
  await page.mouse.down();
  await page.mouse.move(sceneBox.x + sceneBox.width * 0.17, bp.y + bp.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  ok((await page.inputValue('#corps-couches tr[data-couche="0"] select')) === 'pse' && !(await k1()).includes('75,8'), 'Labo : glisser l\'isolant côté intérieur (ITE → ITI) change κ1');
  const heure0 = await page.textContent('#labo-heure');
  await page.click('#labo-jouer');
  await page.waitForTimeout(900);
  await page.click('#labo-jouer');
  ok((await page.textContent('#labo-heure')) !== heure0, 'Labo : le temps avance (' + heure0 + ' → ' + await page.textContent('#labo-heure') + ')');
  ok((await page.textContent('#labo-mesures')).includes('conservation de l'), 'Labo : contrôle de conservation de l\'énergie affiché');
  await page.click('[data-piece="libre"]');
  await page.waitForTimeout(400);
  ok((await page.textContent('#labo-mesures')).includes('Air de la pièce'), 'Labo : pièce libre');
  await page.click('[data-piece="fixe"]');

  console.log('4. Méthode, lexique, Teste-toi');
  await page.click('[data-onglet="methode"]');
  const termes = await page.$$eval('#onglet-methode .terme', function (t) { return t.length; });
  ok(termes >= 10, 'Méthode : ' + termes + ' mots reliés au lexique');
  ok(await page.$('.bouton-lexique') !== null, 'Bouton « Lexique » présent');
  await page.$$eval('details.section-methode', function (d) { d.forEach(function (x) { x.open = true; }); });
  ok(await page.$$eval('#teste-toi .exercice', function (e) { return e.length; }) >= 4, 'Teste-toi affiché');
  await page.fill('#teste-toi .exercice[data-index="0"] [data-reponse]', '123');
  await page.click('#teste-toi .exercice[data-index="0"] [data-action="verifier"]');
  ok((await page.textContent('#teste-toi .exercice[data-index="0"] .exercice-retour')).includes('Pas tout à fait'), 'Mauvaise réponse : la correction s\'affiche');

  console.log('5. Sauvegarde complète et restauration');
  await page.click('[data-onglet="donnees"]');
  const [sauvegarde] = await Promise.all([page.waitForEvent('download'), page.click('#mes-donnees [data-action="sauver"]')]);
  const fichier = path.join(os.tmpdir(), sauvegarde.suggestedFilename());
  await sauvegarde.saveAs(fichier);
  const contenu = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  ok(contenu.format === 'bao-sauvegarde-complete' && contenu.donnees['bao.confort.paroi.v1'] && contenu.donnees['bao.confort.parois.v1'] && contenu.donnees['bao.confort.projet.v1'],
    'Sauvegarde complète : projet + paroi en cours + parois enregistrées (' + Object.keys(contenu.donnees).length + ' éléments)');
  await page.context().close();

  page = await nouvellePage(navigateur, { viewport: { width: 1280, height: 900 } });
  await page.goto(URL_SITE);
  await page.click('[data-onglet="donnees"]');
  ok((await page.textContent('#mes-donnees')).includes('Aucune donnée'), 'Nouvel appareil : aucune donnée');
  await Promise.all([page.waitForNavigation(), page.setInputFiles('#mes-donnees input[type="file"]', fichier)]);
  const parois = await page.evaluate(function () { return Object.keys(JSON.parse(localStorage.getItem('bao.confort.parois.v1') || '{}')); });
  ok(parois.indexOf('Façade test') !== -1, 'Restauration : la paroi « Façade test » est revenue');
  await page.context().close();
  fs.unlinkSync(fichier);

  await navigateur.close();
  console.log(problemes.length ? '\n' + problemes.length + ' problème(s) :\n- ' + problemes.join('\n- ') : '\nTout est bon.');
  process.exit(problemes.length ? 1 : 0);
})();
