/* ==========================================================
   CONFORT D'ÉTÉ — ONGLET PROJET (la maison)
   ----------------------------------------------------------
   Saisie simple, maquette 3D, résultats. AUCUN calcul ici :
   tout passe par ConfortCalcul (calcul-batiment.js, calcul-parois.js).
   ========================================================== */
(function () {
  'use strict';

  const B = window.ConfortBatiment;
  const P = window.ConfortParois;
  const X = window.CONFORT_PROJET;
  const M = window.CONFORT_MATERIAUX;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (s) { return document.querySelector(s); };

  const CLES = {
    projet: 'bao.confort.projet.v1',
    materiaux: 'bao.confort.materiaux.v1',
    parois: 'bao.confort.parois.v1',
    reglages: 'bao.confort.reglages.v1'
  };

  const TOITS = [
    { id: 'plat', nom: 'Plat', icone: '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M5 10h30v12H5z"/></svg>' },
    { id: 'deux-pans', nom: '2 pans', icone: '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M5 22V12L20 3l15 9v10z"/></svg>' },
    { id: 'quatre-pans', nom: '4 pans', icone: '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="M5 22V13l8-8h14l8 8v9z"/></svg>' }
  ];
  const INDICATEURS_FUTURS = ['Givoni', 'Degrés-heures', 'Heures > 28 °C', 'Confort adaptatif', 'PMV / PPD', 'Nuits chaudes'];

  /* ==========================================================
     ÉTAT
     ========================================================== */
  function completer(p) {
    const base = BAO.cloner(X.projet);
    p = p || {};
    return {
      nom: p.nom !== undefined ? p.nom : base.nom,
      usage: p.usage || base.usage,
      geometrie: Object.assign(base.geometrie, p.geometrie || {}),
      facades: B.FACADES.reduce(function (o, f) { o[f] = Object.assign({ vitrage: 0, protection: 'aucune' }, base.facades[f], (p.facades || {})[f] || {}); return o; }, {}),
      vitrage: p.vitrage || base.vitrage,
      parois: Object.assign(base.parois, p.parois || {}),
      cloisons: Object.assign(base.cloisons, p.cloisons || {})
    };
  }

  let projet = completer(BAO.lire(CLES.projet, null));
  let selection = null;

  function sauver() { BAO.ecrire(CLES.projet, projet); }

  // La bibliothèque d'Émile si elle existe (onglet Données), complétée par les exemples.
  function materiaux() {
    const perso = BAO.lire(CLES.materiaux, null);
    const liste = perso && Array.isArray(perso.liste) ? perso.liste.slice() : BAO.cloner(M.materiaux);
    M.materiaux.forEach(function (m) { if (!liste.some(function (x) { return x.id === m.id; })) liste.push(m); });
    return liste;
  }
  function mesParois() { return BAO.lire(CLES.parois, {}) || {}; }
  function reglages() { return BAO.lire(CLES.reglages, null) || {}; }
  function vitrages() {
    const r = reglages();
    const liste = Array.isArray(r.vitrages) ? r.vitrages.slice() : BAO.cloner(X.vitrages);
    X.vitrages.forEach(function (v) { if (!liste.some(function (x) { return x.id === v.id; })) liste.push(BAO.cloner(v)); });
    return liste;
  }
  function vitrageChoisi() { const l = vitrages(); return l.find(function (v) { return v.id === projet.vitrage; }) || l[0]; }

  // Une paroi du projet : 'perso:<nom>' (atelier) ou l'identifiant d'un modèle.
  function paroi(ref) {
    if (ref && ref.indexOf('perso:') === 0) return mesParois()[ref.slice(6)] || null;
    return M.parois.find(function (p) { return p.id === ref; }) || null;
  }
  function nomParoi(ref) {
    if (ref && ref.indexOf('perso:') === 0) return ref.slice(6);
    const p = paroi(ref);
    return p ? p.nom : '?';
  }

  function analyses() {
    const mats = materiaux();
    const a = {};
    Object.keys(projet.parois).forEach(function (k) {
      const p = paroi(projet.parois[k]);
      a[k] = p ? P.analyserParoi(p, mats) : { ok: false, erreurs: ['Paroi introuvable : ' + projet.parois[k]] };
    });
    return a;
  }

  /* ==========================================================
     SAISIE
     ========================================================== */
  function segments(element, liste, valeur, attribut) {
    element.innerHTML = liste.map(function (x) {
      return '<button type="button" ' + attribut + '="' + esc(x.id) + '" aria-pressed="' + (String(x.id) === String(valeur)) + '">' + (x.icone || '') + '<span>' + esc(x.nom) + '</span></button>';
    }).join('');
  }

  function optionsParois(type, choisi) {
    const persos = Object.keys(mesParois()).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    const opt = function (v, t) { return '<option value="' + esc(v) + '"' + (v === choisi ? ' selected' : '') + '>' + esc(t) + '</option>'; };
    const modeles = M.parois.filter(function (p) { return p.type === type; });
    return (persos.length ? '<optgroup label="Mes parois (atelier)">' + persos.map(function (n) { return opt('perso:' + n, n); }).join('') + '</optgroup>' : '') +
      '<optgroup label="Modèles">' + modeles.map(function (p) { return opt(p.id, p.nom); }).join('') + '</optgroup>' +
      (paroi(choisi) ? '' : opt(choisi, '(paroi introuvable)'));
  }

  function renderSaisie() {
    const g = projet.geometrie;
    $('#projet-nom').value = projet.nom || '';
    $('#projet-usage').innerHTML = X.usages.map(function (u) { return '<option value="' + u.id + '"' + (u.id === projet.usage ? ' selected' : '') + '>' + esc(u.nom) + '</option>'; }).join('');
    document.querySelectorAll('input[data-geo]').forEach(function (i) { i.value = g[i.dataset.geo]; });
    $('#g-cloisons').value = projet.cloisons.ratio;
    segments($('#g-niveaux'), [1, 2, 3, 4].map(function (n) { return { id: n, nom: String(n) }; }), g.niveaux, 'data-niveaux');
    segments($('#g-toit'), TOITS, g.toit, 'data-toit');
    segments($('#g-combles'), [{ id: 'perdus', nom: 'Perdus' }, { id: 'amenages', nom: 'Aménagés' }], g.combles, 'data-combles');
    $('#bloc-pente').hidden = $('#bloc-combles').hidden = g.toit === 'plat';
    $('#bloc-plancherInter').hidden = Number(g.niveaux) < 2;

    $('#p-murs').innerHTML = optionsParois('exterieure', projet.parois.murs);
    $('#p-toiture').innerHTML = optionsParois('exterieure', projet.parois.toiture);
    $('#p-plancherBas').innerHTML = optionsParois('exterieure', projet.parois.plancherBas);
    $('#p-plancherInter').innerHTML = optionsParois('interieure', projet.parois.plancherInter);
    $('#p-cloisons').innerHTML = optionsParois('interieure', projet.parois.cloisons);
    $('#vitrage-type').innerHTML = vitrages().map(function (v) {
      return '<option value="' + esc(v.id) + '"' + (v.id === projet.vitrage ? ' selected' : '') + '>' + esc(v.nom) + ' — Uw ' + nb(Number(v.Uw), 1) + '</option>';
    }).join('');
    renderBoussole();
    renderFacades();
    renderSorties();
  }

  function renderSorties() {
    const g = projet.geometrie;
    const o = B.orientation(g.orientation);
    const val = {
      longueur: nb(g.longueur, 1) + ' m', largeur: nb(g.largeur, 1) + ' m', hauteurEtage: nb(g.hauteurEtage, 2) + ' m',
      pente: nb(g.pente) + '°', orientation: nb(g.orientation) + '° · ' + o.nom, cloisons: nb(projet.cloisons.ratio, 1)
    };
    document.querySelectorAll('output[data-sortie]').forEach(function (s) { s.textContent = val[s.dataset.sortie]; });
    const toit = TOITS.find(function (t) { return t.id === g.toit; });
    const vitre = B.FACADES.reduce(function (s, f) { return s + (Number(projet.facades[f].vitrage) || 0); }, 0);
    const resume = {
      projet: (X.usages.find(function (u) { return u.id === projet.usage; }) || {}).nom || '',
      volume: nb(g.longueur, 1) + ' × ' + nb(g.largeur, 1) + ' m · ' + g.niveaux + ' niv.',
      toiture: toit.nom + (g.toit === 'plat' ? '' : ' · ' + nb(g.pente) + '°'),
      orientation: 'A → ' + o.nom,
      fenetres: nb(vitre, 1) + ' m²',
      parois: nomParoi(projet.parois.murs).split(' ')[0]
    };
    document.querySelectorAll('[data-resume]').forEach(function (s) { s.textContent = resume[s.dataset.resume]; });
  }

  function renderBoussole() {
    const az = Number(projet.geometrie.orientation);
    let html = '<div class="boussole-centre" style="transform: rotate(' + az + 'deg)"><span class="boussole-fleche"></span><span class="boussole-a" style="transform: rotate(' + (-az) + 'deg)">A</span></div>';
    B.ORIENTATIONS.forEach(function (o, i) {
      const a = i * 45 * Math.PI / 180;
      const choisi = Math.round(B.normaliserAzimut(az) / 45) % 8 === i;
      html += '<button type="button" data-azimut="' + (i * 45) + '" aria-pressed="' + choisi + '" title="Façade A vers le ' + esc(o.nom) + '" style="left:' + (50 + 40 * Math.sin(a)).toFixed(1) + '%;top:' + (50 - 40 * Math.cos(a)).toFixed(1) + '%">' + o.court + '</button>';
    });
    $('#boussole').innerHTML = html;
  }

  function renderFacades() {
    const az = B.azimutsFacades(projet.geometrie.orientation);
    $('#facades').innerHTML = B.FACADES.map(function (f) {
      const fa = projet.facades[f];
      return '<div class="facade-ligne' + (selection === f ? ' choisie' : '') + '" data-facade="' + f + '">' +
        '<span class="facade-nom"><b>' + f + '</b> ' + esc(B.orientation(az[f]).nom) + '</span>' +
        '<label class="facade-m2"><input type="text" inputmode="decimal" data-champ="vitrage" value="' + esc(BAO.versChamp(fa.vitrage)) + '" aria-label="Vitrage façade ' + f + ' en m²"><span>m²</span></label>' +
        '<select data-champ="protection" aria-label="Protection façade ' + f + '">' + X.protections.map(function (p) {
          return '<option value="' + p.id + '"' + (p.id === fa.protection ? ' selected' : '') + '>' + esc(p.nom) + '</option>';
        }).join('') + '</select></div>';
    }).join('');
  }

  /* ==========================================================
     RÉSULTAT
     ========================================================== */
  function tuile(nom, val, unite, dit) {
    return '<div class="tuile"><span class="tuile-nom">' + nom + '</span><span class="tuile-val">' + val + (unite ? ' <small>' + unite + '</small>' : '') + '</span>' + (dit ? '<span class="tuile-dit">' + dit + '</span>' : '') + '</div>';
  }

  function jaugeVide() {
    return '<svg class="jauge" viewBox="0 0 200 116" aria-hidden="true"><path d="M20 104 A80 80 0 0 1 180 104" class="jauge-fond"/>' +
      '<text x="100" y="92" text-anchor="middle" class="jauge-val">? <tspan class="jauge-sur">/ 10</tspan></text></svg>';
  }

  // Rose des fenêtres : un pétale par façade, dans sa vraie direction, longueur ∝ m² de vitrage.
  function roseFenetres(synthese) {
    const max = Math.max.apply(null, synthese.facades.map(function (f) { return f.vitrage; }).concat([0.01]));
    let svg = '<svg class="rose" viewBox="0 0 200 200" role="img" aria-label="Surface de fenêtres par orientation">';
    svg += '<circle cx="100" cy="100" r="78" class="rose-cercle"/><circle cx="100" cy="100" r="39" class="rose-cercle rose-mi"/>';
    [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(function (x) {
      const a = x[1] * Math.PI / 180;
      svg += '<text x="' + (100 + 92 * Math.sin(a)).toFixed(1) + '" y="' + (104 - 92 * Math.cos(a)).toFixed(1) + '" text-anchor="middle" class="rose-cardinal">' + x[0] + '</text>';
    });
    synthese.facades.forEach(function (f) {
      const a = f.azimut * Math.PI / 180, r = 60 * f.vitrage / max, l = 0.32;
      const p = function (rr, da) { return (100 + rr * Math.sin(a + da)).toFixed(1) + ',' + (100 - rr * Math.cos(a + da)).toFixed(1); };
      if (f.vitrage > 0) svg += '<polygon points="100,100 ' + p(r, -l) + ' ' + p(r * 1.04, 0) + ' ' + p(r, l) + '" class="rose-petale' + (selection === f.id ? ' choisi' : '') + '" data-facade="' + f.id + '"><title>Façade ' + f.id + ' (' + f.orientation.nom + ') : ' + nb(f.vitrage, 1) + ' m²</title></polygon>';
      const t = Math.max(r, 22) + 12;
      svg += '<text x="' + (100 + t * Math.sin(a)).toFixed(1) + '" y="' + (104 - t * Math.cos(a)).toFixed(1) + '" text-anchor="middle" class="rose-val">' + nb(f.vitrage, 1) + '</text>';
    });
    return svg + '</svg>';
  }

  function renderResultat() {
    const erreurs = B.erreursGeometrie(projet.geometrie);
    const an = analyses();
    Object.keys(an).forEach(function (k) {
      if ((k === 'plancherInter' && Number(projet.geometrie.niveaux) < 2) || (k === 'cloisons' && !(Number(projet.cloisons.ratio) > 0))) return;
      if (!an[k].ok) erreurs.push(an[k].erreurs.join(' '));
    });
    const v = vitrageChoisi();
    let html = '<div class="carte note-carte"><div class="carte-titre"><h2>Note de confort d\'été</h2><span class="badge bientot">étape 4</span></div>' +
      jaugeVide() +
      '<p class="aide" style="margin:2px 0 8px;text-align:center">Elle combinera les indicateurs ci-dessous, chacun noté sur 10 avec <b>tes barèmes</b> et pondéré par <b>tes coefficients</b>.</p>' +
      '<div class="puces-futures">' + INDICATEURS_FUTURS.map(function (i) { return '<span>' + i + '</span>'; }).join('') + '</div></div>';

    if (erreurs.length) {
      $('#chiffres-maison').innerHTML = '';
      $('#resultat-projet').innerHTML = html + '<div class="alerte attention"><b>À corriger :</b><ul style="margin:6px 0 0 18px;padding:0">' + erreurs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
      return null;
    }
    const s = B.syntheseProjet(projet, an, v);
    const d = s.deperditions, inr = s.inertie;

    $('#chiffres-maison').innerHTML =
      tuile('Surface de plancher', nb(s.surfacePlancher), 'm²', projet.geometrie.niveaux + ' niveau' + (projet.geometrie.niveaux > 1 ? 'x' : '')) +
      tuile('Volume chauffé', nb(s.volume), 'm³', B.combleChauffe(projet.geometrie) ? 'combles compris' : '') +
      tuile('Fenêtres', nb(s.vitrageTotal, 1), 'm²', nb(s.vitrageSurPlancher * 100) + ' % du plancher') +
      tuile('Faîtage', nb(s.hauteurMurs + s.hauteurToit, 1), 'm', 'murs ' + nb(s.hauteurMurs, 1) + ' m');

    html += '<div class="carte"><div class="carte-titre"><h2>Fenêtres par orientation</h2><span class="aide">m² de vitrage</span></div>' + roseFenetres(s) + '</div>';

    html += '<div class="carte"><div class="carte-titre"><h2>Déperditions</h2><span class="aide">par les parois, H = Σ U·A</span></div>' +
      '<div class="chiffre-cle">' + nb(d.H) + ' <small>W/K</small></div><div class="aide" style="margin-bottom:10px">soit ' + nb(d.parM2, 2) + ' W/K par m² de plancher</div>' +
      '<div class="barres-postes">' + d.lignes.map(function (l) {
        return '<div class="barre-poste"><span class="bp-nom">' + esc(l.nom) + '</span><span class="bp-val">' + nb(l.UA, 1) + ' W/K · ' + nb(l.part * 100) + ' %</span>' +
          '<span class="bp-jauge"><i style="width:' + (l.part * 100).toFixed(1) + '%"></i></span></div>';
      }).join('') + '</div></div>';

    const classes = P.CLASSES_INERTIE;
    html += '<div class="carte"><div class="carte-titre"><h2>Inertie</h2><span class="aide">NF EN ISO 13790 (H)</span></div>' +
      '<div class="chiffre-cle">' + esc(inr.classe ? inr.classe.nom : '–') + '</div><div class="aide" style="margin-bottom:10px">' + nb(inr.cmSurAf / 1000) + ' kJ/(m²·K) de plancher · Cm = ' + nb(inr.cm / 1e6, 1) + ' MJ/K</div>' +
      '<div class="echelle-inertie">' + classes.map(function (c) { return '<span class="' + (inr.classe && inr.classe.id === c.id ? 'actif' : '') + '">' + esc(c.nom) + '</span>'; }).join('') + '</div></div>';

    const exemples = [];
    if (v && v.statut !== 'valide') exemples.push('fenêtres (' + v.nom + ')');
    Object.keys(an).forEach(function (k) { if (an[k].ok && an[k].exemples.length) exemples.push(nomParoi(projet.parois[k])); });
    const trop = s.facades.filter(function (f) { return f.trop; }).map(function (f) { return f.id; });
    if (trop.length) html += '<div class="alerte attention">Façade(s) ' + trop.join(', ') + ' : plus de 80 % vitrée, vérifie la saisie (H).</div>';
    const uniques = exemples.filter(function (x, i, t) { return t.indexOf(x) === i; });
    if (uniques.length) {
      html += '<details class="alerte attention exemples"><summary><b>' + uniques.length + ' élément' + (uniques.length > 1 ? 's' : '') + ' encore en valeurs d\'exemple</b> : à valider dans l\'onglet Données</summary>' +
        '<ul>' + uniques.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
    }

    html += '<details class="carte detail-calcul"><summary>Le détail des calculs</summary><div class="formule">' + esc(detailCalcul(s, an, v)) + '</div></details>';
    $('#resultat-projet').innerHTML = html;
    return s;
  }

  function detailCalcul(s, an, v) {
    const g = projet.geometrie;
    let t = 'Hauteur des murs  Hm = ' + g.niveaux + ' × ' + nb(g.hauteurEtage, 2) + ' = ' + nb(s.hauteurMurs, 2) + ' m\n';
    if (g.toit !== 'plat') t += 'Faîtage  h = côté/2 × tan ' + nb(g.pente) + '° = ' + nb(s.hauteurToit, 2) + ' m\n';
    t += '\nFaçade  orientation   brute   vitrée   opaque\n';
    s.facades.forEach(function (f) {
      t += '  ' + f.id + '     ' + (f.orientation.nom + '          ').slice(0, 11) + nb(f.brute, 1).padStart(6) + '  ' + nb(f.vitrage, 1).padStart(6) + '  ' + nb(f.opaque, 1).padStart(6) + ' m²\n';
    });
    t += '\nH = Σ U × A\n';
    s.deperditions.lignes.forEach(function (l) { t += '  ' + (l.nom + '                    ').slice(0, 22) + nb(l.U, 4) + ' × ' + nb(l.A, 1) + ' = ' + nb(l.UA, 2) + ' W/K\n'; });
    t += '  Total H = ' + nb(s.deperditions.H, 1) + ' W/K\n\nCm = Σ κ × A\n';
    s.inertie.lignes.forEach(function (l) { t += '  ' + (l.nom + '                    ').slice(0, 22) + l.kappas.map(function (k) { return nb(k / 1000, 2); }).join(' + ') + ' × ' + nb(l.aire, 1) + ' = ' + nb(l.cm / 1000) + ' kJ/K\n'; });
    t += '  Cm = ' + nb(s.inertie.cm / 1000) + ' kJ/K ; Cm / Af = ' + nb(s.inertie.cmSurAf / 1000, 1) + ' kJ/(m²·K) → ' + (s.inertie.classe ? s.inertie.classe.nom : '–');
    return t;
  }

  /* ==========================================================
     DONNÉES : types de fenêtres
     ========================================================== */
  function renderVitrages() {
    const liste = vitrages();
    const valides = liste.filter(function (v) { return v.statut === 'valide'; }).length;
    $('#stats-vitrages').innerHTML = liste.length + ' fenêtres · <b>' + valides + ' validée' + (valides > 1 ? 's' : '') + '</b>';
    $('#corps-vitrages').innerHTML = liste.map(function (v, i) {
      const num = function (c) { return '<td><input type="text" inputmode="decimal" data-champ="' + c + '" value="' + esc(BAO.versChamp(v[c])) + '" style="width:70px;text-align:right" aria-label="' + c + '"></td>'; };
      return '<tr data-index="' + i + '"><td>' + esc(v.nom) + '</td>' + num('Uw') + num('g') +
        '<td><input type="text" data-champ="source" value="' + esc(v.source || '') + '" style="min-width:260px" aria-label="Source"></td>' +
        '<td><input type="month" data-champ="dateRef" value="' + esc(v.dateRef || '') + '" style="min-width:140px" aria-label="Mois"></td>' +
        '<td>' + BAO.selectStatut(v.statut, 'data-champ="statut"') + '</td></tr>';
    }).join('');
  }

  /* ==========================================================
     ÉVÉNEMENTS
     ========================================================== */
  let maquette = null;

  function choisir(cible) {
    selection = cible;
    if (cible === 'toiture') {
      ouvrir('toiture');
    } else {
      ouvrir('fenetres');
      const champ = document.querySelector('.facade-ligne[data-facade="' + cible + '"] input');
      if (champ) champ.focus({ preventScroll: true });
    }
    toutRedessiner(false);
  }

  // La composition de toiture suit la forme : terrasse pour un toit plat, plafond pour des combles perdus,
  // rampants pour des combles aménagés. On ne touche pas à une paroi choisie dans l'atelier (« perso: »).
  const TOITURE_PAR_DEFAUT = { plat: 'terrasse-beton', perdus: 'combles-laine', amenages: 'rampants-laine' };
  const MODELES_TOITURE = ['terrasse-beton', 'combles-laine', 'combles-ouate', 'rampants-laine'];
  function adapterToiture() {
    const actuel = projet.parois.toiture;
    if (MODELES_TOITURE.indexOf(actuel) === -1) return;
    const g = projet.geometrie;
    const voulu = TOITURE_PAR_DEFAUT[g.toit === 'plat' ? 'plat' : g.combles];
    const compatible = g.toit === 'plat' ? actuel === 'terrasse-beton'
      : (g.combles === 'amenages' ? actuel === 'rampants-laine' : (actuel === 'combles-laine' || actuel === 'combles-ouate'));
    if (!compatible) {
      projet.parois.toiture = voulu;
      BAO.notifier('Toiture : « ' + nomParoi(voulu) + ' » (modifiable dans l\'étape 3).');
    }
  }

  function ouvrir(pas) {
    const d = document.querySelector('details.pas[data-pas="' + pas + '"]');
    if (d) d.open = true;
  }

  function toutRedessiner(saisieComplete) {
    if (saisieComplete) renderSaisie(); else { renderSorties(); renderFacades(); }
    maquette.mettreAJour(projet, selection);
    renderResultat();
  }

  function apresModif(saisieComplete) { sauver(); toutRedessiner(saisieComplete); }

  function brancher() {
    $('#projet-nom').addEventListener('input', function (e) { projet.nom = e.target.value; sauver(); });
    $('#projet-usage').addEventListener('change', function (e) { projet.usage = e.target.value; apresModif(false); });
    document.querySelectorAll('input[data-geo]').forEach(function (i) {
      i.addEventListener('input', function () {
        projet.geometrie[i.dataset.geo] = Number(i.value);
        if (i.dataset.geo === 'orientation') renderBoussole();
        apresModif(false);
      });
    });
    $('#g-cloisons').addEventListener('input', function (e) { projet.cloisons.ratio = Number(e.target.value); apresModif(false); });
    $('#saisie').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      const g = projet.geometrie;
      if (b.dataset.niveaux) g.niveaux = Number(b.dataset.niveaux);
      else if (b.dataset.toit) { g.toit = b.dataset.toit; adapterToiture(); }
      else if (b.dataset.combles) { g.combles = b.dataset.combles; adapterToiture(); }
      else if (b.dataset.azimut !== undefined) g.orientation = Number(b.dataset.azimut);
      else if (b.id === 'btn-projet-exemple') {
        if (!confirm('Revenir à la maison d\'exemple ? Ta saisie actuelle sera remplacée.')) return;
        projet = completer(BAO.cloner(X.projet));
        selection = null;
      } else return;
      apresModif(true);
    });
    $('#saisie').addEventListener('change', function (e) {
      const t = e.target;
      if (t.dataset.paroi) { projet.parois[t.dataset.paroi] = t.value; apresModif(false); return; }
      if (t.id === 'vitrage-type') { projet.vitrage = t.value; apresModif(false); return; }
      const ligne = t.closest('.facade-ligne');
      if (!ligne) return;
      const fa = projet.facades[ligne.dataset.facade];
      if (t.dataset.champ === 'vitrage') {
        const v = BAO.lireNombre(t.value);
        if (!isFinite(v) || v < 0) { BAO.notifier('Surface invalide : un nombre de m² (ex. 4,5).'); renderFacades(); return; }
        fa.vitrage = v;
      } else if (t.dataset.champ === 'protection') fa.protection = t.value;
      apresModif(false);
    });
    $('#saisie').addEventListener('focusin', function (e) {
      const ligne = e.target.closest('.facade-ligne');
      if (ligne && selection !== ligne.dataset.facade) {
        selection = ligne.dataset.facade;
        document.querySelectorAll('.facade-ligne').forEach(function (l) { l.classList.toggle('choisie', l === ligne); });
        maquette.mettreAJour(projet, selection);
      }
    });
    $('#resultat-projet').addEventListener('click', function (e) {
      const p = e.target.closest('[data-facade]');
      if (p) choisir(p.dataset.facade);
    });

    // Données : fenêtres
    $('#corps-vitrages').addEventListener('change', function (e) {
      const tr = e.target.closest('tr[data-index]');
      const champ = e.target.dataset.champ;
      if (!tr || !champ) return;
      const liste = vitrages();
      const v = liste[Number(tr.dataset.index)];
      if (champ === 'Uw' || champ === 'g') {
        const n = BAO.lireNombre(e.target.value);
        if (!isFinite(n) || n <= 0 || (champ === 'g' && n > 1)) { BAO.notifier('Valeur invalide.'); renderVitrages(); return; }
        v[champ] = n;
      } else v[champ] = e.target.value;
      const r = reglages();
      r.vitrages = liste;
      BAO.ecrire(CLES.reglages, r);
      renderVitrages();
      toutRedessiner(true);
    });

    // L'atelier ou les matériaux ont changé : les listes et le résultat suivent.
    document.addEventListener('confort:donnees', function () { toutRedessiner(true); });
  }

  // Démarrage protégé : si un fichier manque ou si le navigateur a gardé une ancienne version en mémoire,
  // on l'écrit clairement au lieu d'afficher une page vide.
  try {
    if (!B || !P || !window.ConfortMaison3D) throw new Error('fichier de calcul ou de dessin manquant');
    maquette = window.ConfortMaison3D.creer($('#maison3d'), { surSelection: choisir });
    brancher();
    renderVitrages();
    toutRedessiner(true);
  } catch (e) {
    const msg = '<div class="alerte attention" style="margin:0"><b>La page n\'a pas pu démarrer.</b> Ton navigateur utilise sans doute ' +
      'une ancienne version gardée en mémoire : recharge avec <b>Ctrl + F5</b> (ou Cmd + Maj + R sur Mac).<br><small>Détail : ' + esc(e.message) + '</small></div>';
    $('#resultat-projet').innerHTML = msg;
    if (window.console) console.error(e);
  }
})();
