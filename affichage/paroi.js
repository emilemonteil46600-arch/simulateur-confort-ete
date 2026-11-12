/* ==========================================================
   CONFORT D'ÉTÉ — ONGLET « MA PAROI » (mode simple)
   ----------------------------------------------------------
   Affichage seulement : AUCUN calcul ici. La paroi est celle de l'atelier
   (window.ConfortAtelier, même état, même sauvegarde) ; le labo animé (affichage/labo.js)
   fait la simulation ; les repères viennent de ConfortParois.reperesConfort et
   ConfortTransitoire.resumerSimulation. Ce fichier :
     - les trois natures (mur extérieur, toiture, plancher bas) et les modèles de départ ;
     - la carte « Confort d'été de cette paroi » : le verdict, les repères (H), quoi faire ;
     - le tableau des repères dans l'onglet Données.
   ========================================================== */
(function () {
  'use strict';

  const A = window.ConfortAtelier;
  const P = window.ConfortParois;
  const T = window.ConfortTransitoire;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (q) { return document.querySelector(q); };
  if (!A || !P || !T || !$('#paroi-nature')) return;

  const ICONES = {
    mur: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 6h40v28H4z" class="ic-fond"/><path d="M4 13h40M4 20h40M4 27h40M14 6v7M24 13v7M14 20v7M24 27v7M34 6v7M34 20v7" class="ic-trait"/><path d="M4 6v28" class="ic-accent"/></svg>',
    toiture: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 22L24 6l20 16" class="ic-accent"/><path d="M8 22h32v12H8z" class="ic-fond"/><path d="M8 22L24 9l16 13" class="ic-trait"/><circle cx="40" cy="8" r="4" class="ic-soleil"/></svg>',
    plancher: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 8h40v14H4z" class="ic-fond"/><path d="M4 22h40" class="ic-accent"/><path d="M4 22h40v12H4z" class="ic-sol"/><path d="M8 28h4M18 30h4M30 27h4M38 31h3" class="ic-trait"/></svg>'
  };
  const EXPLICATIONS = {
    dephasage: 'Le temps que met le pic de chaleur de l\'après-midi pour traverser. ≥ 10 h, il arrive la nuit, quand on peut ventiler.',
    amortissement: 'Ce qui reste de l\'onde journalière après la traversée, par rapport à une paroi « sans masse » de même U.',
    kappa1: 'La chaleur que la paroi peut absorber côté pièce sur une journée : elle encaisse les pointes de la pièce.',
    U: 'Ce qui entre en moyenne pour 1 °C d\'écart. Sans isolation, le soleil du toit ou du mur Ouest arrive tout entier.',
    surchauffeFace: 'La face intérieure plus chaude que l\'air : on la ressent par rayonnement (température opérative).',
    fluxPointe: 'La chaleur qui entre par m² au pire moment, dans le labo « vraie météo ».'
  };
  const CONSEILS = {
    dephasage: 'Ajoute de la masse (béton, brique pleine, terre, bois massif) ou de l\'épaisseur : le déphasage grandit avec e/δ.',
    amortissement: 'Plus de masse et plus d\'isolant : l\'amortissement s\'écrase quand ξ = e/δ grandit, et le reste de l\'onde est multiplié par U.',
    kappa1: 'Mets la masse côté pièce : isolation par l\'extérieur plutôt que par l\'intérieur, ou une couche lourde derrière le parement.',
    U: 'Isole davantage, et plutôt par l\'extérieur. Pour une toiture, vise 30 cm d\'isolant.',
    surchauffeFace: 'Protège la face extérieure du soleil (couleur claire, ventilation sous couverture), isole, et garde de la masse côté pièce.',
    fluxPointe: 'Même remède : moins de soleil absorbé (α), plus d\'isolant, plus de masse côté pièce.'
  };
  let derniereSim = null, dernierReglage = null;

  /* ---------- Les trois natures et les modèles ---------- */
  function dessinerNature() {
    const nature = A.nature();
    $('#paroi-nature').innerHTML = Object.keys(A.NATURES).map(function (n) {
      return '<button type="button" class="nature-carte" data-nature="' + n + '" aria-pressed="' + (n === nature) + '">' + ICONES[n] + '<b>' + esc(A.NATURES[n].nom) + '</b>' +
        '<small>' + { mur: 'façade, soleil selon l\'orientation', toiture: 'rampants, plafond ou terrasse : le plus exposé', plancher: 'sur terre-plein : le sol frais (H)' }[n] + '</small></button>';
    }).join('');
    const modeles = A.modeles(nature);
    $('#paroi-modele').innerHTML = '<option value="">Partir d\'un modèle…</option>' + modeles.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.nom) + '</option>'; }).join('');
    const p = A.paroi();
    $('#paroi-composition').innerHTML = '<span class="muet">int.</span> ' + p.couches.map(function (c) {
      const m = A.materiaux().find(function (x) { return x.id === c.materiau; });
      return '<span class="couche-puce">' + esc(m ? m.nom : c.materiau) + ' <b>' + nb(c.e * 100, c.e < 0.02 ? 1 : 0) + ' cm</b></span>';
    }).join(' ') + ' <span class="muet">ext.</span>';
  }

  /* ---------- Le verdict ---------- */
  function niveauTexte(n) { return { bon: 'bon', moyen: 'moyen', faible: 'faible' }[n] || '?'; }
  function dessinerVerdict() {
    const boite = $('#paroi-verdict');
    const a = A.analyser();
    if (!a.ok) { boite.innerHTML = '<div class="alerte attention">' + esc(a.erreurs.join(' ')) + '</div>'; return; }
    const nature = A.nature();
    let simu = null, note = '';
    if (derniereSim && dernierReglage && dernierReglage.scenario === 'meteo' && derniereSim.scenario && derniereSim.scenario.type === 'serie') {
      const r = T.resumerSimulation(derniereSim, 0);
      simu = { surchauffeFace: r.ecartFaceMax, fluxPointe: r.flux.max, resume: r };
    } else note = '<p class="aide" style="margin:8px 0 0">Les deux derniers repères viennent du labo : choisis <b>☀ Vraie météo</b> pour les avoir.</p>';
    const rep = P.reperesConfort(a, nature, simu);
    const v = rep.verdict;
    const titres = { bon: 'Bonne paroi d\'été', moyen: 'Paroi moyenne l\'été', faible: 'Paroi faible l\'été' };
    const phrases = {
      bon: 'Elle retarde, écrase et absorbe la chaleur : elle aide la maison à rester fraîche.',
      moyen: 'Elle fait une partie du travail. Regarde les repères orange et rouges : c\'est là que ça se joue.',
      faible: 'La chaleur passe vite et fort. Une maison faite de parois comme celle-ci chauffera dès les premiers jours chauds.'
    };
    const bons = rep.liste.filter(function (l) { return l.niveau === 'bon'; }).length, notes = rep.liste.filter(function (l) { return l.niveau; }).length;
    let html = '<div class="verdict verdict-' + (v || 'inconnu') + '"><div class="verdict-pastille">' + (v ? { bon: '✓', moyen: '~', faible: '!' }[v] : '?') + '</div>' +
      '<div><b>' + esc(titres[v] || 'Lance le labo') + '</b><span>' + esc(phrases[v] || '') + ' <small>' + bons + ' repère' + (bons > 1 ? 's' : '') + ' sur ' + notes + ' au vert · repères courants (H), pas une norme.</small></span></div></div>';
    html += '<div class="reperes">' + rep.liste.map(function (l) {
      const s = l.seuils, haut = l.sens === 'haut';
      const bornes = haut ? 'bon ≥ ' + nb(s[0], s[0] < 1 ? 2 : 0) + ' · moyen ≥ ' + nb(s[1], s[1] < 1 ? 2 : 0) : 'bon ≤ ' + nb(s[0], s[0] < 1 ? 2 : (s[0] < 10 ? 1 : 0)) + ' · moyen ≤ ' + nb(s[1], s[1] < 1 ? 2 : (s[1] < 10 ? 1 : 0));
      const val = l.valeur === null || l.valeur === undefined || !isFinite(l.valeur) ? '–' : nb(l.valeur, l.id === 'amortissement' ? 3 : (l.id === 'U' ? 3 : 1));
      return '<div class="repere repere-' + (l.niveau || 'inconnu') + '" title="' + esc(l.source) + '"><i></i><span class="repere-nom">' + esc(l.nom) + '<small>' + esc(EXPLICATIONS[l.id]) + '</small></span>' +
        '<span class="repere-val"><b>' + val + '</b> <small>' + esc(l.unite) + '</small><em>' + bornes + '</em></span></div>';
    }).join('') + '</div>' + note;
    const faibles = rep.liste.filter(function (l) { return l.niveau && l.niveau !== 'bon'; });
    if (faibles.length) html += '<h3 class="soleil-h3" style="margin-top:12px">Pour faire mieux</h3><ul class="conseils">' + faibles.map(function (l) { return '<li><b>' + esc(l.nom) + '</b> : ' + esc(CONSEILS[l.id]) + '</li>'; }).join('') + '</ul>';
    if (simu) {
      const r = simu.resume;
      html += '<p class="aide" style="margin:10px 0 0">Dans le labo (' + esc(derniereSim.scenario.ville.nom) + ') : face extérieure jusqu\'à <b>' + nb(r.tExt.max, 1) + ' °C</b>' + (derniereSim.scenario.nature === 'plancher' ? ' (sol)' : ' (sol-air)') + ', face intérieure jusqu\'à <b>' + nb(r.tSi.max, 1) + ' °C</b>, ' +
        (dernierReglage.piece === 'libre' ? 'pièce libre jusqu\'à <b>' + nb(r.tPiece.max, 1) + ' °C</b>' : 'pièce fixée à ' + nb(r.tPiece.max, 1) + ' °C') + ', ' + nb(r.energie / 1000, 2) + ' kWh/m² entrés sur la période. ' +
        '(H) Seule cette paroi échange : les autres sont supposées parfaites. C\'est un test de paroi, pas le confort de la maison (onglet Projet).</p>';
    }
    boite.innerHTML = html;
  }

  /* ---------- Données : les repères ---------- */
  function dessinerDonnees() {
    const t = $('#table-reperes');
    if (!t) return;
    const R = P.REPERES_CONFORT;
    t.innerHTML = '<thead><tr><th>Repère</th><th>Sens</th><th class="num">Bon</th><th class="num">Moyen</th><th>Origine</th></tr></thead><tbody>' + Object.keys(R).map(function (id) {
      const r = R[id], s = Array.isArray(r.seuils) ? { '': r.seuils } : r.seuils;
      return Object.keys(s).map(function (k, i) {
        return '<tr>' + (i === 0 ? '<td rowspan="' + Object.keys(s).length + '">' + esc(r.nom) + (r.unite ? ' <span class="muet">(' + esc(r.unite) + ')</span>' : '') + '</td>' : '') +
          '<td>' + (k ? esc(k) + ' · ' : '') + (r.sens === 'haut' ? 'plus c\'est haut, mieux c\'est' : 'plus c\'est bas, mieux c\'est') + '</td><td class="num">' + (r.sens === 'haut' ? '≥ ' : '≤ ') + nb(s[k][0], s[k][0] < 1 ? 2 : 1) + '</td><td class="num">' + (r.sens === 'haut' ? '≥ ' : '≤ ') + nb(s[k][1], s[k][1] < 1 ? 2 : 1) + '</td>' +
          (i === 0 ? '<td rowspan="' + Object.keys(s).length + '">' + esc(r.source) + '</td>' : '') + '</tr>';
      }).join('');
    }).join('') + '</tbody>';
  }

  /* ---------- Événements ---------- */
  $('#paroi-nature').addEventListener('click', function (e) {
    const b = e.target.closest('[data-nature]');
    if (b) A.choisirNature(b.dataset.nature);
  });
  $('#paroi-modele').addEventListener('change', function (e) {
    if (!e.target.value) return;
    A.appliquerModele(e.target.value);
    BAO.notifier('Paroi remplacée par le modèle. L\'ancienne n\'est gardée que si tu l\'avais enregistrée (atelier).');
  });
  document.querySelectorAll('#onglet-paroi .lien-expert').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); const b = document.querySelector('.onglets [data-onglet="' + a.dataset.vers + '"]'); if (b) b.click(); });
  });
  // La paroi a changé : l'ancienne simulation ne vaut plus (le labo en renvoie une neuve juste après).
  document.addEventListener('confort:paroi', function () { derniereSim = null; dessinerNature(); dessinerVerdict(); });
  document.addEventListener('confort:donnees', function () { dessinerNature(); dessinerVerdict(); });
  document.addEventListener('confort:labo', function (e) { derniereSim = e.detail.sim; dernierReglage = e.detail.reglage; dessinerVerdict(); });

  dessinerDonnees();
  dessinerNature();
  dessinerVerdict();
})();
