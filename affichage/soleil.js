/* ==========================================================
   CONFORT D'ÉTÉ — LE SOLEIL SUR LA MAISON (onglet Projet)
   ----------------------------------------------------------
   Affichage seulement : AUCUN calcul physique ici. Tout vient de
   ConfortSoleil (calcul/calcul-soleil.js). Ce fichier :
     - charge la météo de la ville choisie (donnees/meteo/<ville>.js, à la demande) ;
     - pilote la barre « jour · heure » et l'animation de la journée ;
     - donne le soleil de l'heure à la maquette 3D (ombre, façades qui chauffent, volets) ;
     - dessine les cartes « Le soleil sur ta maison » et « Ce qui entre dans la maison ».
   ========================================================== */
(function () {
  'use strict';

  const S = window.ConfortSoleil;
  const G = window.ConfortGraphiques;
  const X = window.CONFORT_PROJET;
  const V = window.CONFORT_METEO_VILLES;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (q) { return document.querySelector(q); };
  if (!S || !V || !$('#barre-soleil')) return;

  // Version des fichiers (la même que celle de ce script), pour charger la météo sans vieux cache.
  const VERSION = ((document.currentScript && document.currentScript.src) || '').split('?v=')[1] || '';

  // Période calculée : 1er mai → 30 septembre (mai sert à voir le printemps ; les bilans portent sur juin → septembre).
  const J_DEBUT = S.jourDeLAnnee(5, 1), J_FIN = S.jourDeLAnnee(9, 30), J_ETE = S.jourDeLAnnee(6, 1);
  const K0 = (J_DEBUT - 1) * 24, K1 = J_FIN * 24, K_ETE = (J_ETE - 1) * 24;
  const FACADES = ['A', 'B', 'C', 'D'];

  // Réglages d'affichage (dans le navigateur, hors sauvegarde : pas des données de calcul).
  const CLE = 'bao.confort.soleil.affichage';
  const vue = Object.assign({ jour: S.jourDeLAnnee(7, 21), heure: 16 }, BAO.lire(CLE, {}) || {});
  function sauverVue() { try { localStorage.setItem(CLE, JSON.stringify({ jour: vue.jour, heure: Math.round(vue.heure) })); } catch (e) { /* rien */ } }

  let meteo = null, villeChargee = null, chargement = null;
  let calc = null;          // { entrees, serie, sansProtection, semaine, lieu }
  let anim = null;

  /* ==========================================================
     MÉTÉO : chargée à la demande (une balise <script>, compatible file://)
     ========================================================== */
  function ville() { const p = window.ConfortProjet.projet(); return V.villes.find(function (v) { return v.id === p.ville; }) || V.villes[0]; }

  function chargerMeteo(id, suite) {
    const dispo = window.CONFORT_METEO && window.CONFORT_METEO[id];
    if (dispo) { suite(dispo); return; }
    if (chargement === id) return;
    chargement = id;
    const sc = document.createElement('script');
    sc.src = 'donnees/meteo/' + id + '.js' + (VERSION ? '?v=' + VERSION : '');
    sc.onload = function () { chargement = null; if (window.CONFORT_METEO && window.CONFORT_METEO[id]) suite(window.CONFORT_METEO[id]); };
    sc.onerror = function () { chargement = null; $('#soleil-projet').innerHTML = '<div class="alerte attention">La météo de ' + esc(id) + ' n\'a pas pu être chargée (fichier donnees/meteo/' + esc(id) + '.js).</div>'; };
    document.head.appendChild(sc);
  }

  /* ==========================================================
     LE CALCUL (appel au chapitre 2, rien de plus)
     ========================================================== */
  function entrees(sansProtection) {
    const P = window.ConfortProjet, r = P.resultat(), projet = P.projet();
    const alpha = function (id) { return (X.couleurs.find(function (c) { return c.id === id; }) || X.couleurs[1]).alpha; };
    const prot = {};
    P.protections().forEach(function (p) { prot[p.id] = sansProtection ? { Fc: 1 } : p; });
    const v = ville();
    return {
      projet: projet, synthese: r.synthese, lieu: { lat: v.lat, lon: v.lon }, meteo: meteo, vitrage: r.vitrage,
      protections: prot, seuil: P.seuil(), usage: X.scenarios.usages[projet.usage] || X.scenarios.usages.logement,
      U: { murs: r.analyses.murs.U, toiture: r.analyses.toiture.U },
      alpha: { murs: alpha(projet.couleurs.murs), toiture: alpha(projet.couleurs.toiture) },
      casquettes: projet.casquettes, fenetre: X.fenetre, heures: [K0, K1]
    };
  }

  function recalculer() {
    const P = window.ConfortProjet;
    if (!P || !P.resultat()) { calc = null; toutDessiner(); return; }
    const v = ville();
    if (!meteo || villeChargee !== v.id) {
      $('#soleil-projet').innerHTML = '<div class="carte soleil-carte"><p class="aide" style="margin:0">Chargement de la météo de ' + esc(v.nom) + '…</p></div>';
      chargerMeteo(v.id, function (m) { meteo = m; villeChargee = v.id; recalculer(); });
      return;
    }
    const e = entrees(false);
    calc = {
      entrees: e, lieu: e.lieu, meteo: meteo,
      serie: S.apportsHoraires(e),
      sansProtection: S.apportsHoraires(entrees(true)),
      semaine: S.semaineLaPlusChaude(meteo.T, K_ETE, K1)
    };
    toutDessiner();
    // L'étape 3 (affichage/confort.js) écoute : elle calcule les températures à partir de ces apports.
    document.dispatchEvent(new CustomEvent('confort:apports'));
  }

  /* ==========================================================
     L'HEURE AFFICHÉE
     ========================================================== */
  // Heure UTC depuis le 1er janvier (t) de l'heure légale affichée ; k = l'heure météo correspondante.
  function instant() {
    const t = (vue.jour - 1) * 24 + vue.heure - S.decalageLegal(vue.jour);
    const k = Math.floor(t + 1e-9);
    return { t: t, k: k, i: k - K0 };
  }

  function etatHeure() {
    const ins = instant();
    const e = calc.entrees;
    const soleil = S.positionSoleil(ins.t + meteo.decalage, calc.lieu);
    const mh = { Gbn: meteo.Gbn[ins.k], Gdh: meteo.Gdh[ins.k] };
    const eclairement = {}, baissees = {}, ensoleillement = {}, fenetres = {};
    e.synthese.facades.forEach(function (f) {
      const ecl = S.eclairementParoi(mh, soleil, 90, f.azimut);
      eclairement[f.id] = ecl.total;
      const fa = e.projet.facades[f.id] || {};
      const part = S.fractionEnsoleillee(soleil, f.azimut, { profondeur: Number(e.casquettes[f.id]) || 0, ecart: e.fenetre.ecart, hauteurFenetre: e.fenetre.hauteur });
      ensoleillement[f.id] = part;
      const a = S.apportFenetre(ecl, { surface: f.vitrage, g: e.vitrage.g, partCadre: S.PART_CADRE, Fw: S.FACTEUR_INCIDENCE, protection: e.protections[fa.protection], seuil: e.seuil, fractionEnsoleillee: part });
      baissees[f.id] = a.baissee;
      fenetres[f.id] = { ecl: ecl, a: a, part: part, f: f, fa: fa };
    });
    let toit = 0;
    S.pansDuToit(e.projet.geometrie, Number(e.projet.geometrie.orientation), window.ConfortBatiment).forEach(function (p) {
      toit += p.part * S.eclairementParoi(mh, soleil, p.inclinaison, p.azimut).total;
    });
    eclairement.toiture = toit;
    return { ins: ins, soleil: soleil, mh: mh, T: meteo.T[ins.k], HR: meteo.HR[ins.k], eclairement: eclairement, baissees: baissees, ensoleillement: ensoleillement, fenetres: fenetres };
  }

  /* ==========================================================
     DESSIN
     ========================================================== */
  function toutDessiner() {
    const maquette = window.ConfortProjet && window.ConfortProjet.maquette;
    if (!calc) {
      $('#barre-soleil').innerHTML = '';
      $('#soleil-projet').innerHTML = '';
      if ($('#carte-apports')) $('#carte-apports').innerHTML = '';
      if (maquette) maquette.soleil(null);
      return;
    }
    dessinerBarre();
    dessinerCarteSoleil();
    dessinerApports();
    dessinerHeure();   // en dernier : il remplit le détail et les curseurs de la carte
  }

  function dessinerBarre() {
    if ($('#soleil-jour')) return;   // déjà en place : on ne met à jour que les valeurs (dessinerHeure)
    $('#barre-soleil').innerHTML =
      '<button type="button" class="soleil-jouer" id="soleil-jouer" aria-label="Animer la journée">▶</button>' +
      '<label class="soleil-curseur"><span>Jour</span><input type="range" id="soleil-jour" min="' + J_DEBUT + '" max="' + J_FIN + '" step="1" aria-label="Jour de l\'été"><output id="soleil-jour-val"></output></label>' +
      '<label class="soleil-curseur"><span>Heure</span><input type="range" id="soleil-heure" min="0" max="23" step="1" aria-label="Heure (légale)"><output id="soleil-heure-val"></output></label>' +
      '<div class="soleil-info" id="soleil-info"></div>';
  }

  function hhmm(h) { const m = Math.round((h - Math.floor(h)) * 60); return Math.floor(h) + ' h ' + String(m === 60 ? 0 : m).padStart(2, '0'); }
  function nomAzimut(a) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(a / 22.5) % 16]; }

  // La course du jour ne change qu'avec le jour ou le lieu : on la garde.
  let course = { cle: null, pts: null };
  function courseDuJour() {
    const cle = vue.jour + '|' + calc.lieu.lat + '|' + calc.lieu.lon;
    if (course.cle !== cle) course = { cle: cle, pts: S.courseDuJour(vue.jour, calc.lieu).map(function (p) { return p.s; }) };
    return course.pts;
  }

  // Ce qui change à chaque heure : la maquette, la barre, le curseur des mini-graphiques, le détail.
  function dessinerHeure() {
    const h = etatHeure();
    const maquette = window.ConfortProjet.maquette;
    const T3 = window.ConfortTemperatures;   // étape 3 : la température dedans à cette heure (affichage/confort.js)
    const dedans = T3 ? T3.interieur(h.ins.i) : null;
    maquette.soleil({
      s: h.soleil.s, hauteur: h.soleil.hauteur, azimut: h.soleil.azimut,
      course: courseDuJour(),
      eclairement: h.eclairement, baissees: h.baissees, ensoleillement: h.ensoleillement,
      interieur: dedans
    });
    $('#soleil-jour').value = vue.jour;
    if (!anim) $('#soleil-heure').value = Math.round(vue.heure);
    $('#soleil-jour-val').textContent = S.dateDuJour(vue.jour).nom;
    $('#soleil-heure-val').textContent = hhmm(vue.heure);
    $('#soleil-jouer').textContent = anim ? '❚❚' : '▶';
    $('#soleil-info').innerHTML = (h.soleil.hauteur > 0
      ? '<span title="Hauteur du soleil au-dessus de l\'horizon">☀ <b>' + nb(h.soleil.hauteur) + '°</b></span><span title="Azimut du soleil (depuis le Nord)">' + nb(h.soleil.azimut) + '° ' + nomAzimut(h.soleil.azimut) + '</span>'
      : '<span>☾ nuit</span>') + '<span title="Température extérieure (année type)">🌡 <b>' + nb(h.T, 1) + ' °C</b></span>' +
      (dedans ? '<span title="Température opérative dedans (modèle 5R1C, étape 3)">🏠 <b>' + nb(dedans.Top, 1) + ' °C</b>' + (dedans.nuit ? ' <small>fenêtres ouvertes</small>' : '') + '</span>' : '');
    document.dispatchEvent(new CustomEvent('confort:heure', { detail: { i: h.ins.i, k: h.ins.k, jour: vue.jour, heure: vue.heure } }));
    document.querySelectorAll('.mini-curseur').forEach(function (l) { l.setAttribute('x1', xMini(vue.heure)); l.setAttribute('x2', xMini(vue.heure)); });
    const det = $('#soleil-detail');
    if (det) det.textContent = detailHeure(h);
    const titre = $('#soleil-detail-titre');
    if (titre) titre.textContent = 'L\'heure affichée calculée pas à pas (' + S.dateDuJour(vue.jour).nom + ', ' + hhmm(Math.floor(vue.heure)) + ')';
  }

  /* ---------- Mini-graphiques : une journée, façade par façade ---------- */
  const ML = 180, MH = 74;
  function xMini(h) { return (6 + h / 24 * (ML - 12)).toFixed(1); }
  function miniJour(valeurs, max, nom, total, choisi) {
    const y = function (v) { return MH - 14 - v / max * (MH - 26); };
    let d = 'M' + xMini(0) + ' ' + y(0);
    valeurs.forEach(function (v, h) { d += ' L' + xMini(h + 0.5) + ' ' + y(v).toFixed(1); });
    d += ' L' + xMini(24) + ' ' + y(0) + ' Z';
    return '<div class="mini' + (choisi ? ' choisi' : '') + '"><div class="mini-tete"><b>' + nom + '</b><span>' + nb(total, 1) + ' kWh/m²</span></div>' +
      '<svg viewBox="0 0 ' + ML + ' ' + MH + '" aria-hidden="true">' +
      '<line x1="6" x2="' + (ML - 6) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="mini-axe"/>' +
      [6, 12, 18].map(function (hh) { return '<text x="' + xMini(hh) + '" y="' + (MH - 2) + '" text-anchor="middle" class="mini-txt">' + hh + ' h</text>'; }).join('') +
      '<path d="' + d + '" class="mini-aire"/>' +
      '<line class="mini-curseur" x1="' + xMini(vue.heure) + '" x2="' + xMini(vue.heure) + '" y1="4" y2="' + y(0) + '"/></svg></div>';
  }

  // Les 24 heures légales du jour affiché : valeurs d'une série horaire (indices depuis K0).
  function journee(serie) {
    const v = [];
    for (let h = 0; h < 24; h++) {
      const i = (vue.jour - 1) * 24 + h - S.decalageLegal(vue.jour) - K0;
      v.push(i >= 0 && i < serie.length ? serie[i] : 0);
    }
    return v;
  }

  function dessinerCarteSoleil() {
    const r = calc.serie, e = calc.entrees;
    const v = ville();
    const select = window.ConfortProjet && document.querySelector('.facade-ligne.choisie');
    const choix = select ? select.dataset.facade : null;
    const jours = {};
    let max = 300;
    FACADES.concat(['toiture']).forEach(function (id) { jours[id] = journee(r.eclairement[id]); jours[id].forEach(function (x) { max = Math.max(max, x); }); });
    max = Math.ceil(max / 100) * 100;
    const nomFacade = function (id) { const f = e.synthese.facades.find(function (x) { return x.id === id; }); return id + ' · ' + f.orientation.nom; };
    const somme = function (t) { return t.reduce(function (s, x) { return s + x; }, 0) / 1000; };

    let html = '<div class="carte soleil-carte"><div class="carte-titre"><h2>Le soleil sur ta maison</h2><span class="aide">' + esc(v.nom) + ' · année type PVGIS</span></div>';
    html += '<p class="aide" style="margin:-2px 0 10px">Glisse l\'heure ou lance ▶ : le soleil tourne, l\'ombre bouge, les façades chauffent (orange) et les protections se baissent au-dessus de ' + nb(e.seuil) + ' W/m².</p>';
    html += '<h3 class="soleil-h3">Le ' + S.dateDuJour(vue.jour).nom + ', heure par heure <small>W/m² reçus (direct + diffus + réfléchi), même échelle 0 → ' + nb(max) + '</small></h3>';
    html += '<div class="minis">' + FACADES.map(function (id) { return miniJour(jours[id], max, nomFacade(id), somme(jours[id]), choix === id); }).join('') +
      miniJour(jours.toiture, max, 'Toit (pans)', somme(jours.toiture), false) + '</div>';

    // L'été entier : kWh/m² reçus par chaque façade et par le toit.
    const ete = {};
    FACADES.concat(['toiture']).forEach(function (id) { ete[id] = S.sommeKWh(r.eclairement[id], K_ETE - K0); });
    const maxEte = Math.max.apply(null, Object.keys(ete).map(function (k) { return ete[k]; }));
    html += '<h3 class="soleil-h3">Tout l\'été (juin → septembre) <small>kWh par m² de paroi</small></h3><div class="barres-ete">' +
      FACADES.concat(['toiture']).map(function (id) {
        return '<div class="barre-ete"><span class="be-nom">' + (id === 'toiture' ? 'Toit' : nomFacade(id)) + '</span><span class="be-jauge"><i style="width:' + (ete[id] / maxEte * 100).toFixed(1) + '%"></i></span><span class="be-val">' + nb(ete[id]) + '</span></div>';
      }).join('') + '</div>';

    // La semaine la plus chaude : ce qui entre, heure par heure.
    const sem = calc.semaine;
    const d0 = sem.debut / 24 + 1;
    html += '<h3 class="soleil-h3">La semaine la plus chaude <small>du ' + S.dateDuJour(d0).nom + ' au ' + S.dateDuJour(d0 + 6).nom + ' · ' + nb(sem.moyenne, 1) + ' °C en moyenne</small></h3><div id="graphe-semaine"></div>';

    html += '<details class="detail-calcul soleil-pas"><summary id="soleil-detail-titre">L\'heure affichée calculée pas à pas</summary><div class="formule" id="soleil-detail"></div></details>';
    html += '<p class="aide" style="margin:10px 0 0">Météo : ' + esc(V.source) + ' (' + esc(meteo.base) + '). Une année type est un été <b>normal</b>, pas une canicule. Modèle de ciel isotrope (H), validé contre PVGIS : voir Méthode § 25.</p></div>';
    $('#soleil-projet').innerHTML = html;

    const i0 = sem.debut - K0;
    const pts = function (f) { const t = []; for (let i = 0; i < 168; i++) t.push({ x: i / 24, y: f(i0 + i) }); return t; };
    G.dessiner($('#graphe-semaine'), {
      id: 'semaine', titre: 'Apports de chaleur pendant la semaine la plus chaude', unite: 'W', decimales: 0,
      x: { min: 0, max: 7, pas: 1, format: function (j) { return j < 7 ? 'J' + (j + 1) : ''; }, formatBulle: function (j) { const h = Math.round(j * 24); return 'J' + (Math.floor(h / 24) + 1) + ' · ' + (h % 24 + S.decalageLegal(d0)) % 24 + ' h'; } },
      series: [
        { nom: 'Soleil (fenêtres + murs + toit)', classe: 'gr-1', points: pts(function (i) { return r.fenetres[i] + r.murs[i] + r.toiture[i]; }) },
        { nom: 'Apports internes', classe: 'gr-2', points: pts(function (i) { return r.internes[i]; }) }
      ]
    });
  }

  /* ---------- Carte de droite : ce qui entre dans la maison sur l'été ---------- */
  function dessinerApports() {
    const boite = $('#carte-apports');
    if (!boite) return;
    const r = calc.serie, r0 = calc.sansProtection, e = calc.entrees;
    const de = K_ETE - K0;
    const kwh = function (s) { return S.sommeKWh(s, de); };
    const postes = [
      { nom: 'Soleil par les fenêtres', v: kwh(r.fenetres), c: 'ap-fen' },
      { nom: 'Occupants, appareils, éclairage', v: kwh(r.internes), c: 'ap-int' },
      { nom: 'Soleil par les murs', v: kwh(r.murs), c: 'ap-op' },
      { nom: 'Soleil par le toit', v: kwh(r.toiture), c: 'ap-op2' }
    ];
    const total = postes.reduce(function (s, p) { return s + Math.max(0, p.v); }, 0);
    let html = '<div class="carte"><div class="carte-titre"><h2>Ce qui entre dans la maison</h2><span class="aide">juin → septembre</span></div>' +
      '<div class="chiffre-cle">' + nb(total) + ' <small>kWh</small></div><div class="aide" style="margin-bottom:10px">soit ' + nb(total / Math.max(1, window.ConfortBatiment.surfacePlancher(e.projet.geometrie)), 1) + ' kWh par m² de plancher, à évacuer pour ne pas avoir chaud</div>' +
      '<div class="pile">' + postes.map(function (p) { return p.v > 0 ? '<i class="' + p.c + '" style="width:' + (p.v / total * 100).toFixed(2) + '%" title="' + esc(p.nom) + '"></i>' : ''; }).join('') + '</div>' +
      '<div class="pile-legende">' + postes.map(function (p) { return '<span><i class="' + p.c + '"></i>' + esc(p.nom) + ' <b>' + nb(p.v) + '</b>' + (total > 0 && p.v > 0 ? ' · ' + nb(p.v / total * 100) + ' %' : '') + '</span>'; }).join('') + '</div>';

    // Fenêtres façade par façade : avec les protections (plein) / sans (fantôme).
    const lignes = e.synthese.facades.filter(function (f) { return f.vitrage > 0; }).map(function (f) {
      return { f: f, avec: kwh(r.parFacade[f.id]), sans: kwh(r0.parFacade[f.id]), prot: (X.protections.find(function (p) { return p.id === (e.projet.facades[f.id] || {}).protection; }) || {}).nom };
    });
    const maxF = Math.max.apply(null, lignes.map(function (l) { return l.sans; }).concat([1]));
    const evite = lignes.reduce(function (s, l) { return s + l.sans - l.avec; }, 0);
    html += '<h3 class="soleil-h3" style="margin-top:14px">Par les fenêtres, façade par façade</h3><div class="barres-fen">' + lignes.map(function (l) {
      return '<div class="barre-fen" data-facade="' + l.f.id + '"><span class="bf-nom"><b>' + l.f.id + '</b> ' + esc(l.f.orientation.nom) + ' · ' + nb(l.f.vitrage, 1) + ' m²</span>' +
        '<span class="bf-val">' + nb(l.avec) + ' kWh' + (l.sans - l.avec > 0.5 ? ' <small>(−' + nb((1 - l.avec / l.sans) * 100) + ' %)</small>' : '') + '</span>' +
        '<span class="bf-jauge"><i class="bf-sans" style="width:' + (l.sans / maxF * 100).toFixed(1) + '%"></i><i class="bf-avec" style="width:' + (l.avec / maxF * 100).toFixed(1) + '%"></i></span>' +
        '<span class="bf-prot">' + esc(l.prot || 'Aucune') + '</span></div>';
    }).join('') + '</div>';
    html += '<p class="aide" style="margin:8px 0 0"><span class="cle-fantome"></span> sans protection · <span class="cle-plein"></span> avec. Les protections évitent <b>' + nb(evite) + ' kWh</b> sur l\'été.</p></div>';
    boite.innerHTML = html;
  }

  /* ---------- Le détail de l'heure : tout le calcul, nombre par nombre ---------- */
  function detailHeure(h) {
    const p = h.soleil, e = calc.entrees, v = ville();
    const n = p.jour, nf = n + (p.heureUTC - 12) / 24;
    const d = function (x, k) { return nb(x, k === undefined ? 2 : k); };
    let t = 'Lieu : ' + v.nom + '  φ = ' + d(v.lat, 3) + '°  longitude = ' + d(v.lon, 3) + '°\n';
    t += 'Heure légale ' + hhmm(vue.heure) + ' = ' + d(vue.heure - S.decalageLegal(vue.jour), 2) + ' h UTC (heure d\'été : UTC + ' + S.decalageLegal(vue.jour) + ')\n';
    t += 'Rayonnement mesuré à + ' + d(meteo.decalage, 4) + ' h → instant t = ' + d(p.heureUTC, 4) + ' h UTC, jour n = ' + n + '\n\n';
    t += '1. Le soleil\n';
    t += '  Angle du jour   B = 360° × (n − 1 + (t − 12)/24) / 365 = ' + d(S.angleDuJour(nf) / S.RAD, 3) + '°\n';
    t += '  Déclinaison     δ = ' + d(p.declinaison, 3) + '°   (Spencer)\n';
    t += '  Équation du temps  E = ' + d(p.equationTemps, 2) + ' min\n';
    t += '  Heure solaire   ts = t + longitude/15 + E/60 = ' + d(p.heureUTC, 4) + ' + ' + d(v.lon / 15, 4) + ' + ' + d(p.equationTemps / 60, 4) + ' = ' + d(p.heureSolaire, 4) + ' h\n';
    t += '  Angle horaire   ω = 15 × (ts − 12) = ' + d(p.angleHoraire, 3) + '°\n';
    t += '  sin h = sin φ·sin δ + cos φ·cos δ·cos ω  →  h = ' + d(p.hauteur, 3) + '°\n';
    t += '  azimut a = ' + d(p.azimut, 3) + '° (' + nomAzimut(p.azimut) + ')\n';
    t += '  vecteur soleil s = (' + p.s.map(function (x) { return d(x, 4); }).join(' ; ') + ')   (Est, Nord, haut)\n\n';
    t += '2. La météo de l\'heure (année type)\n';
    t += '  T = ' + d(h.T, 1) + ' °C   HR = ' + nb(h.HR) + ' %   Gbn = ' + nb(h.mh.Gbn) + ' W/m²   Gdh = ' + nb(h.mh.Gdh) + ' W/m²\n';
    const Gh = h.mh.Gbn * Math.max(0, p.s[2]) + h.mh.Gdh;
    t += '  Gh = Gbn × sin h + Gdh = ' + nb(Gh, 1) + ' W/m²\n\n';
    t += '3. Les façades (verticales) et leurs fenêtres\n';
    FACADES.forEach(function (id) {
      const x = h.fenetres[id];
      if (!x) return;
      const ecl = x.ecl;
      t += '  ' + id + ' ' + x.f.orientation.nom + ' (azimut ' + nb(x.f.azimut) + '°)  cos θ = s·n = ' + d(ecl.cosIncidence, 4) + '\n';
      t += '     direct ' + nb(ecl.direct, 1) + ' + diffus ' + nb(ecl.diffus, 1) + ' + réfléchi ' + nb(ecl.reflechi, 1) + ' = ' + nb(ecl.total, 1) + ' W/m²\n';
      if (x.f.vitrage > 0) {
        t += '     fenêtre ' + nb(x.f.vitrage, 2) + ' m² × (1 − ' + d(S.PART_CADRE, 1) + ') × g ' + d(e.vitrage.g, 2) + ' × Fw ' + d(S.FACTEUR_INCIDENCE, 1) + ' × Fc ' + d(x.a.Fc, 2) +
          (x.part < 0.999 ? ' (casquette : ' + nb(x.part * 100) + ' % au soleil)' : '') + (x.a.baissee ? ' [' + (x.fa.protection || '') + ' baissé]' : '') + '\n';
        t += '       = ' + nb(x.a.eclairementVitre, 1) + ' W/m² × ' + d(x.f.vitrage * x.a.coef, 3) + ' m² = ' + nb(x.a.flux, 1) + ' W\n';
      }
    });
    t += '\n4. Toute la maison à cette heure (W)\n';
    const i = h.ins.i, r = calc.serie;
    if (i >= 0 && i < r.N) {
      t += '  fenêtres ' + nb(r.fenetres[i]) + ' + murs ' + nb(r.murs[i]) + ' + toit ' + nb(r.toiture[i]) + ' + internes ' + nb(r.internes[i]) + ' = ' + nb(r.total[i]) + ' W\n';
      t += '  (murs et toit : α × Rse × U × A × I − ciel ; négatif = la paroi perd vers le ciel)';
    }
    return t;
  }

  /* ==========================================================
     ÉVÉNEMENTS
     ========================================================== */
  function arreter() { if (anim) { cancelAnimationFrame(anim.id); anim = null; vue.heure = Math.round(vue.heure) % 24; sauverVue(); dessinerHeure(); } }
  function jouer() {
    if (anim) { arreter(); return; }
    if (vue.heure >= 21) vue.heure = 5;
    anim = { avant: null, id: 0 };
    const pas = function (instantMs) {
      if (!anim) return;
      if (anim.avant !== null) vue.heure += (instantMs - anim.avant) / 1000 * 1.6;   // 1,6 heure par seconde
      anim.avant = instantMs;
      if (vue.heure >= 22) { vue.heure = 22; arreter(); return; }
      $('#soleil-heure').value = vue.heure;
      dessinerHeure();
      anim.id = requestAnimationFrame(pas);
    };
    anim.id = requestAnimationFrame(pas);
    dessinerHeure();
  }

  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'soleil-heure') { if (anim) { cancelAnimationFrame(anim.id); anim = null; } vue.heure = Number(ev.target.value); sauverVue(); dessinerHeure(); }
    if (ev.target.id === 'soleil-jour') { vue.jour = Number(ev.target.value); sauverVue(); dessinerCarteSoleil(); dessinerHeure(); }
  });
  document.addEventListener('click', function (ev) { if (ev.target.closest('#soleil-jouer')) jouer(); });
  document.addEventListener('confort:projet', function () { arreter(); recalculer(); });
  document.querySelectorAll('[data-onglet="calcul"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { if (calc) dessinerHeure(); }, 0); }); });

  /* ==========================================================
     ONGLET DONNÉES : météo, scénarios, constantes du chapitre 2
     ========================================================== */
  function dessinerDonnees() {
    $('#stats-meteo').textContent = V.villes.length + ' villes · 8 760 h chacune';
    $('#table-meteo').innerHTML = '<thead><tr><th>Ville</th><th>Zone RE2020 (H)</th><th class="num">Latitude</th><th class="num">Longitude</th><th>Source</th></tr></thead><tbody>' +
      V.villes.map(function (v) { return '<tr><td>' + esc(v.nom) + '</td><td>' + v.zone + '</td><td class="num">' + nb(v.lat, 3) + '°</td><td class="num">' + nb(v.lon, 3) + '°</td><td>PVGIS 5.3 (TMY)</td></tr>'; }).join('') + '</tbody>';
    const noms = { logement: 'Logement', bureaux: 'Bureaux', enseignement: 'Enseignement', 'petite-enfance': 'Petite enfance', salle: 'Salle polyvalente' };
    const spark = function (p) {
      let d = '';
      p.forEach(function (v, h) { d += (h ? ' L' : 'M') + (h * 3 + 1.5) + ' ' + (19 - v * 17).toFixed(1); });
      return '<svg class="spark" viewBox="0 0 72 20" aria-hidden="true"><path d="' + d + '"/></svg>';
    };
    const u = X.scenarios.usages;
    $('#table-scenarios').innerHTML = '<thead><tr><th>Usage</th><th>Poste</th><th class="num">Pointe W/m²</th><th>Semaine (0 → 24 h)</th><th>Week-end</th><th class="num">Moyenne semaine</th></tr></thead><tbody>' +
      Object.keys(u).map(function (k) {
        return ['occupants', 'equipements', 'eclairage'].map(function (p, i) {
          const x = u[k][p];
          const moy = x.max * x.semaine.reduce(function (s, v) { return s + v; }, 0) / 24;
          return '<tr>' + (i === 0 ? '<td rowspan="3"><b>' + noms[k] + '</b>' + (u[k].fermetures ? '<br><small class="aide">fermé ' + u[k].fermetures.map(function (f) { return f[0][1] + '/' + f[0][0] + ' → ' + f[1][1] + '/' + f[1][0]; }).join(', ') + '</small>' : '') + '</td>' : '') +
            '<td>' + { occupants: 'Occupants', equipements: 'Appareils', eclairage: 'Éclairage' }[p] + '</td><td class="num">' + nb(x.max, 1) + '</td><td>' + spark(x.semaine) + '</td><td>' + spark(x.weekend) + '</td><td class="num">' + nb(moy, 2) + '</td></tr>';
        }).join('');
      }).join('') + '</tbody>';
    $('#table-soleil').innerHTML = '<thead><tr><th>Grandeur</th><th class="num">Valeur</th><th>Origine</th></tr></thead><tbody>' + [
      ['Albédo du sol ρ', nb(S.ALBEDO, 1), 'Sol ordinaire (H)'],
      ['Part du cadre Ff', nb(S.PART_CADRE, 1), 'NF EN ISO 13790 (H)'],
      ['Correction d\'incidence du vitrage Fw', nb(S.FACTEUR_INCIDENCE, 1), 'NF EN ISO 13790 (H)'],
      ['Résistance superficielle extérieure Rse', nb(S.RSE, 2) + ' m²·K/W', 'NF EN ISO 6946'],
      ['Rayonnement vers le ciel hr', nb(S.HR_CIEL, 1) + ' W/(m²·K)', '5 ε avec ε = 0,9 — NF EN ISO 13790 (H)'],
      ['Écart air / ciel Δθer', nb(S.DT_CIEL) + ' K', 'Climat tempéré — NF EN ISO 13790 (H)'],
      ['Fenêtre type (casquettes)', nb(X.fenetre.hauteur, 2) + ' m de haut, casquette ' + nb(X.fenetre.ecart, 1) + ' m au-dessus', 'Hypothèse (H)'],
      ['Couleurs α', X.couleurs.map(function (c) { return c.nom.toLowerCase() + ' ' + nb(c.alpha, 1); }).join(' · '), X.sourceCouleurs]
    ].map(function (l) { return '<tr><td>' + l[0] + '</td><td class="num">' + l[1] + '</td><td>' + esc(l[2]) + '</td></tr>'; }).join('') + '</tbody>';
  }

  // Ce que l'étape 3 (affichage/confort.js) lit : les apports calculés et les bornes de la période. Aucun calcul ici.
  window.ConfortApports = {
    calc: function () { return calc; }, K0: K0, K1: K1, K_ETE: K_ETE,
    vue: function () { return vue; }, instant: instant, hhmm: hhmm,
    redessinerHeure: function () { if (calc) dessinerHeure(); }
  };

  dessinerDonnees();
  recalculer();
})();
