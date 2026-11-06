/* ==========================================================
   CONFORT D'ÉTÉ — INTERFACE (étape 1 : les parois)
   ----------------------------------------------------------
   Affichage, boutons, sauvegarde. Aucun calcul ici :
   tous les calculs passent par ConfortCalcul (calcul.js → calcul-parois.js).
   ========================================================== */
(function () {
  'use strict';

  const P = window.ConfortCalcul.parois;
  const S = window.ConfortSchemas;
  const G = window.ConfortGraphiques;
  const EX = window.CONFORT_MATERIAUX;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (s) { return document.querySelector(s); };

  const CLES = {
    paroi: 'bao.confort.paroi.v1',
    parois: 'bao.confort.parois.v1',
    local: 'bao.confort.local.v1',
    materiaux: 'bao.confort.materiaux.v1',
    reglages: 'bao.confort.reglages.v1',
    onglet: 'bao.confort.onglet'
  };

  const CONTACTS = [
    { id: 'exterieur', nom: '1 face (l\'autre dehors)' },
    { id: 'voisin', nom: '1 face (l\'autre : local voisin semblable)' },
    { id: 'deux', nom: '2 faces dans le local' }
  ];

  /* ==========================================================
     ÉTAT
     ========================================================== */
  function modele(id) { return EX.parois.find(function (p) { return p.id === id; }); }
  function paroiDepuisModele(id) {
    const m = BAO.cloner(modele(id));
    return { nom: m.nom, type: m.type, sensFlux: m.sensFlux, couches: m.couches };
  }

  // Bibliothèque : celle d'Émile si elle existe, complétée par les nouveaux matériaux d'exemple.
  function chargerMateriaux() {
    const perso = BAO.lire(CLES.materiaux, null);
    const liste = perso && Array.isArray(perso.liste) ? perso.liste : BAO.cloner(EX.materiaux);
    EX.materiaux.forEach(function (m) {
      if (!liste.some(function (x) { return x.id === m.id; })) liste.push(BAO.cloner(m));
    });
    return { liste: liste };
  }

  let materiaux = chargerMateriaux();
  let paroi = BAO.lire(CLES.paroi, null) || paroiDepuisModele('beton-ite');
  let local = BAO.lire(CLES.local, null) || BAO.cloner(EX.local);
  let reglages = BAO.lire(CLES.reglages, null) || {};
  reglages.onde = Object.assign({}, EX.onde, reglages.onde || {});

  const mesParois = BAO.calculsEnregistres({
    cle: CLES.parois,
    mot: 'calcul de paroi',   // BAO accorde au masculin (« Aucun calcul de paroi enregistré »)
    courant: function () { return paroi; },
    charger: function (p) { paroi = p; sauverParoi(); renderTout(); },
    vide: function () { return { nom: 'Nouvelle paroi', type: 'exterieure', sensFlux: 'horizontal', couches: [{ materiau: 'beton-arme', e: 0.2 }] }; },
    estVide: function () { return false; }
  });

  function sauverParoi() { BAO.ecrire(CLES.paroi, paroi); }
  function sauverLocal() { BAO.ecrire(CLES.local, local); }
  function sauverMateriaux() { BAO.ecrire(CLES.materiaux, materiaux); }
  function sauverReglages() { BAO.ecrire(CLES.reglages, reglages); }

  function trouverMateriau(id) { return materiaux.liste.find(function (m) { return m.id === id; }) || null; }
  function analyser(p) { return P.analyserParoi(p, materiaux.liste); }
  function famillesDe(p) { return p.couches.map(function (c) { const m = trouverMateriau(c.materiau); return m ? m.famille : 'revetement'; }); }
  function estExemple(m) { return EX.materiaux.some(function (x) { return x.id === m.id; }); }

  /* ---------- Petits formats ---------- */
  function cplx(z, d) {
    const dec = d === undefined ? 4 : d;
    return nb(z.re, dec) + (z.im < 0 ? ' − ' : ' + ') + nb(Math.abs(z.im), dec) + ' i';
  }
  function kJ(v) { return nb(v / 1000, 1); }
  function heure(h) { return nb(h, 1) + ' h'; }

  /* ==========================================================
     ONGLET CALCUL — la paroi
     ========================================================== */
  function optionsMateriaux(choisi) {
    return EX.familles.map(function (f) {
      const ms = materiaux.liste.filter(function (m) { return m.famille === f.id; });
      if (!ms.length) return '';
      return '<optgroup label="' + esc(f.nom) + '">' + ms.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === choisi ? ' selected' : '') + '>' + esc(m.nom) + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + (trouverMateriau(choisi) ? '' : '<option value="' + esc(choisi) + '" selected>(matériau supprimé)</option>');
  }

  function renderParoi() {
    $('#nom-projet').value = paroi.nom || '';
    $('#type-paroi').value = paroi.type === 'interieure' ? 'interieure' : 'exterieure';
    $('#sens-flux').innerHTML = Object.keys(P.RESISTANCES_SUPERFICIELLES).map(function (k) {
      const r = P.RESISTANCES_SUPERFICIELLES[k];
      return '<option value="' + k + '"' + (k === paroi.sensFlux ? ' selected' : '') + '>' + esc(r.nom) + ' — Rsi ' + nb(r.rsi, 2) + '</option>';
    }).join('');
    $('#modele').innerHTML = EX.parois.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nom) + '</option>'; }).join('');

    const n = paroi.couches.length;
    $('#corps-couches').innerHTML = n ? paroi.couches.map(function (c, i) {
      const m = trouverMateriau(c.materiau);
      return '<tr data-couche="' + i + '">' +
        '<td class="muet">' + (i + 1) + (i === 0 ? ' <small>int.</small>' : i === n - 1 ? ' <small>ext.</small>' : '') + '</td>' +
        '<td><select data-champ="materiau" aria-label="Matériau de la couche ' + (i + 1) + '">' + optionsMateriaux(c.materiau) + '</select></td>' +
        '<td class="num"><input type="text" inputmode="decimal" data-champ="e" value="' + esc(BAO.versChamp(Math.round(c.e * 1e5) / 1e3)) + '" aria-label="Épaisseur en cm"></td>' +
        '<td class="num">' + (m ? nb(m.lambda, 3) : '–') + '</td>' +
        '<td class="num">' + (m ? nb(m.rho) : '–') + '</td>' +
        '<td class="num">' + (m ? nb(m.c) : '–') + '</td>' +
        '<td><div class="boutons-ligne">' +
          '<button type="button" class="bouton discret" data-action="monter" title="Vers l\'intérieur" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="bouton discret" data-action="descendre" title="Vers l\'extérieur" aria-label="Descendre"' + (i === n - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="bouton discret danger" data-action="retirer" title="Retirer" aria-label="Retirer la couche">✕</button>' +
        '</div></td></tr>';
    }).join('') : '<tr><td colspan="7" class="vide">Aucune couche : ajoute-en une.</td></tr>';
  }

  function renderResultats(a) {
    let html = '<div class="carte-titre"><h2>Résultat</h2></div><div class="aide" style="margin-top:-8px">' + esc(paroi.nom || 'Sans nom') + '</div>';
    if (!a.ok) {
      $('#resultats').innerHTML = html + '<div class="alerte attention" style="margin:10px 0 0"><ul style="margin:0 0 0 18px;padding:0">' +
        a.erreurs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
      return;
    }
    const d = a.dyn;
    const part = d.kappa1 / a.plafondKappa;
    html += '<div class="indicateurs">' +
      bloc('U (hiver)', nb(a.U, 3), 'W/(m²·K)', 'R = ' + nb(a.R, 2) + ' m²·K/W') +
      bloc('Déphasage Δt', nb(d.dephasage, 1), 'h', 'retard du pic de flux') +
      bloc('Amortissement f', nb(d.amortissement, 2), '', 'part de l\'onde qui passe') +
      bloc('|Y12|', nb(d.transmittancePeriodique, 3), 'W/(m²·K)', 'ce qui passe de l\'onde') +
      bloc('κ1 (côté pièce)', kJ(d.kappa1), 'kJ/(m²·K)', nb(part * 100, 0) + ' % du plafond Rsi') +
      bloc('Admittance |Y11|', nb(d.admittance, 2), 'W/(m²·K)', 'avance ' + nb(d.avanceAdmittance, 1) + ' h') +
      bloc('Masse', nb(a.masse), 'kg/m²', 'épaisseur ' + nb(a.epaisseur * 100, 1) + ' cm') +
      bloc('κ2 (côté ext.)', kJ(d.kappa2), 'kJ/(m²·K)', 'C totale ' + kJ(a.capacite) + ' kJ/(m²·K)') +
      '</div>';
    html += '<p class="aide" style="margin:8px 0 0">L\'onde de dehors arrive <b>' + heure(d.dephasage) + '</b> plus tard, réduite à <b>' + nb(d.amortissement * 100, 0) +
      ' %</b> de ce que donnerait U seul. Côté pièce, la paroi stocke <b>' + kJ(d.kappa1) + ' kJ/(m²·K)</b> par jour (règle des 10 cm : ' + kJ(a.capaciteDixCm) +
      ' ; plafond Rsi : ' + kJ(a.plafondKappa) + ').</p>';
    html += a.exemples.length
      ? '<div class="alerte attention" style="margin:12px 0 0"><b>Encore en exemple :</b> ' + esc(a.exemples.join(', ')) + '. Vérifie λ, ρ et c dans l\'onglet Données.</div>'
      : '<div class="alerte ok" style="margin:12px 0 0">Tous les matériaux de cette paroi sont validés.</div>';
    $('#resultats').innerHTML = html;
  }

  function bloc(nom, val, unite, dit) {
    return '<div class="indicateur"><div class="nom">' + nom + '</div><div class="val">' + val + (unite ? ' <small>' + unite + '</small>' : '') + '</div><div class="dit">' + dit + '</div></div>';
  }

  function renderSchema(a) {
    $('#schema').innerHTML = a.ok ? S.coupeParoi(a, famillesDe(paroi)) : '<p class="muet">Complète les couches pour voir la coupe.</p>';
    $('#legende-schema').innerHTML = a.ok ? a.couches.map(function (c, i) {
      return '<span><b>' + (i + 1) + '</b> ' + esc(c.nom) + ' ' + nb(c.e * 100, 1) + ' cm</span>';
    }).join('') : '';
  }

  function renderDetailCouches(a) {
    if (!a.ok) { $('#detail-couches').innerHTML = ''; return; }
    const lignes = a.couches.map(function (c, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.nom) + '</td>' +
        '<td class="num">' + nb(c.e * 100, 1) + '</td><td class="num">' + nb(c.R, 3) + '</td>' +
        '<td class="num">' + nb(c.masse, 1) + '</td><td class="num">' + kJ(c.capacite) + '</td>' +
        '<td class="num">' + nb(c.diffusivite * 1e6, 3) + '</td><td class="num">' + nb(c.effusivite) + '</td>' +
        '<td class="num">' + nb(c.delta * 100, 1) + '</td><td class="num">' + nb(c.xi, 3) + '</td></tr>';
    }).join('');
    $('#detail-couches').innerHTML = '<thead><tr><th>N°</th><th>Matériau</th><th class="num">e (cm)</th><th class="num">R = e/λ</th><th class="num">m = ρe (kg/m²)</th>' +
      '<th class="num">C = ρce (kJ/(m²·K))</th><th class="num">a (10⁻⁶ m²/s)</th><th class="num">b (W·s½/(m²·K))</th><th class="num">δ (cm)</th><th class="num">ξ = e/δ</th></tr></thead><tbody>' + lignes +
      '<tr><td></td><td><b>Rsi + Rse</b></td><td></td><td class="num">' + nb(a.rs.rsi + a.rs.rse, 2) + '</td><td colspan="6"></td></tr>' +
      '<tr><td></td><td><b>Total</b></td><td class="num"><b>' + nb(a.epaisseur * 100, 1) + '</b></td><td class="num"><b>' + nb(a.R, 3) + '</b></td><td class="num"><b>' + nb(a.masse, 1) + '</b></td><td class="num"><b>' + kJ(a.capacite) + '</b></td><td colspan="4"></td></tr></tbody>';
  }

  function renderDetailMatrice(a) {
    if (!a.ok) { $('#detail-matrice').innerHTML = ''; return; }
    const d = a.dyn, Z = d.Z;
    const coeur = paroi.couches.map(function (c, i) {
      const phys = { e: c.e, lambda: a.couches[i].lambda, rho: a.couches[i].rho, c: a.couches[i].c };
      const M = P.matriceCouche(phys);
      return 'Couche ' + (i + 1) + ' (' + a.couches[i].nom + ', ξ = ' + nb(a.couches[i].xi, 3) + ') :\n' +
        '  Z11 = Z22 = ' + cplx(M.z11) + '\n  Z12 = ' + cplx(M.z12) + '   Z21 = ' + cplx(M.z21, 3);
    }).join('\n');
    const U = d.U;
    const formule =
      'Rsi = ' + nb(a.rs.rsi, 2) + '   Rse = ' + nb(a.rs.rse, 2) + (a.interieure ? '  (paroi intérieure : Rsi des deux côtés)' : '') + '\n\n' +
      coeur + '\n\n' +
      'Paroi complète  Z = Z(Rse) × Z(couche ' + paroi.couches.length + ') × … × Z(couche 1) × Z(Rsi) :\n' +
      '  Z11 = ' + cplx(Z.z11) + '   Z12 = ' + cplx(Z.z12) + '\n' +
      '  Z21 = ' + cplx(Z.z21, 3) + '   Z22 = ' + cplx(Z.z22) + '\n' +
      '  contrôle : Z11·Z22 − Z12·Z21 = ' + cplx(d.determinant, 6) + '  (doit valoir 1)\n\n' +
      'Y12 = −1/Z12 = ' + cplx(d.Y12) + '   |Y12| = ' + nb(d.transmittancePeriodique, 4) + ' W/(m²·K)\n' +
      'f   = |Y12| / U = ' + nb(d.transmittancePeriodique, 4) + ' / ' + nb(U, 4) + ' = ' + nb(d.amortissement, 3) + '\n' +
      'Δt  = −arg(Y12) × 24/(2π) = ' + nb(-P.cxArgument(d.Y12), 4) + ' rad × 3,82 → ' + nb(d.dephasage, 2) + ' h\n' +
      'Y11 = −Z11/Z12 = ' + cplx(d.Y11) + '   |Y11| = ' + nb(d.admittance, 3) + ' W/(m²·K)\n' +
      'κ1  = 86 400/(2π) × |(Z11 − 1)/Z12| = ' + nb(d.kappa1) + ' J/(m²·K)\n' +
      'κ2  = 86 400/(2π) × |(Z22 − 1)/Z12| = ' + nb(d.kappa2) + ' J/(m²·K)' +
      (a.interieure ? '\n\nDeux côtés qui oscillent pareil (local voisin semblable) :\n  κ face 1 = ' + nb(a.deuxFaces.kappaFace1) + ' J/(m²·K)   κ face 2 = ' + nb(a.deuxFaces.kappaFace2) + ' J/(m²·K)' : '');
    $('#detail-matrice').innerHTML = '<div class="formule">' + esc(formule) + '</div>';
  }

  /* ---------- L'onde sur 24 h ---------- */
  function renderOnde(a) {
    const o = reglages.onde;
    $('#onde-moy').value = BAO.versChamp(o.tMoyenne);
    $('#onde-amp').value = BAO.versChamp(o.amplitude);
    $('#onde-max').value = BAO.versChamp(o.heureMax);
    $('#onde-ti').value = BAO.versChamp(o.tInterieure);
    renderGraphes(a);
  }

  function renderGraphes(a) {
    if (!a.ok) { $('#graphe-temperatures').innerHTML = $('#graphe-flux').innerHTML = $('#resume-onde').innerHTML = ''; return; }
    const o = reglages.onde;
    const r = P.ondeJournaliere(a.dyn, a.rs, o, 15);
    const x = { min: 0, max: 24, pas: 6, format: function (v) { return nb(v) + ' h'; }, formatBulle: function (v) { return BAO.versChamp(Math.floor(v)) + ' h ' + String(Math.round((v % 1) * 60)).padStart(2, '0'); } };
    G.dessiner($('#graphe-temperatures'), {
      id: 'temperatures', titre: 'Températures sur 24 h', unite: '°C', x: x,
      series: [
        { nom: 'Air extérieur', classe: 'gr-1', points: r.points.map(function (p) { return { x: p.heure, y: p.tExt }; }) },
        { nom: 'Face intérieure de la paroi', classe: 'gr-2', points: r.points.map(function (p) { return { x: p.heure, y: p.tSurface }; }) },
        { nom: 'Air intérieur (fixé)', classe: 'gr-ref', points: r.points.map(function (p) { return { x: p.heure, y: o.tInterieure }; }) }
      ],
      reperes: [{ x: o.heureMax, texte: 'pic dehors' }]
    });
    G.dessiner($('#graphe-flux'), {
      id: 'flux', titre: 'Flux entrant sur 24 h', unite: 'W/m²', decimales: 2, x: x,
      series: [
        { nom: 'Avec l\'inertie (réel)', classe: 'gr-2', points: r.points.map(function (p) { return { x: p.heure, y: p.flux }; }) },
        { nom: 'Sans inertie (U seul)', classe: 'gr-ref', points: r.points.map(function (p) { return { x: p.heure, y: p.fluxSansInertie }; }) }
      ],
      reperes: [{ x: r.heurePicFlux, texte: 'pic du flux' }]
    });
    $('#resume-onde').innerHTML = '<div class="formule">' + esc(
      'Flux moyen   = U × (θe moy − θi) = ' + nb(a.U, 3) + ' × (' + nb(o.tMoyenne, 1) + ' − ' + nb(o.tInterieure, 1) + ') = ' + nb(r.fluxMoyen, 2) + ' W/m²\n' +
      'Oscillation  sans inertie : U × A = ' + nb(a.U, 3) + ' × ' + nb(o.amplitude, 1) + ' = ± ' + nb(r.amplitudeFluxSansInertie, 2) + ' W/m²\n' +
      '             réelle : |Y12| × A = ' + nb(a.dyn.transmittancePeriodique, 3) + ' × ' + nb(o.amplitude, 1) + ' = ± ' + nb(r.amplitudeFlux, 2) + ' W/m²\n' +
      'Pic du flux  ' + nb(o.heureMax, 1) + ' h + ' + nb(a.dyn.dephasage, 1) + ' h = ' + heure(r.heurePicFlux) + '\n' +
      'Face intérieure : θsi = θi + Rsi × q  →  ± ' + nb(a.rs.rsi * r.amplitudeFlux, 2) + ' K autour de ' + nb(o.tInterieure + a.rs.rsi * r.fluxMoyen, 2) + ' °C') + '</div>';
  }

  /* ---------- Comparer mes parois ---------- */
  function renderComparaison(aCourante) {
    const tous = mesParois.tous();
    const noms = Object.keys(tous).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
    const lignes = [{ nom: (paroi.nom || 'Sans nom') + ' (en cours)', a: aCourante, courante: true }]
      .concat(noms.filter(function (n) { return n !== paroi.nom; }).map(function (n) { return { nom: n, a: analyser(tous[n]) }; }));
    $('#comparaison').innerHTML = '<thead><tr><th>Paroi</th><th class="num">U</th><th class="num">m (kg/m²)</th><th class="num">Δt (h)</th><th class="num">f</th><th class="num">κ1 (kJ/(m²·K))</th><th class="num">|Y11|</th></tr></thead><tbody>' +
      lignes.map(function (l) {
        if (!l.a.ok) return '<tr><td>' + esc(l.nom) + '</td><td colspan="6" class="muet">incomplète</td></tr>';
        const d = l.a.dyn;
        return '<tr' + (l.courante ? ' style="font-weight:650"' : '') + '><td>' + esc(l.nom) + '</td><td class="num">' + nb(l.a.U, 3) + '</td><td class="num">' + nb(l.a.masse) + '</td>' +
          '<td class="num">' + nb(d.dephasage, 1) + '</td><td class="num">' + nb(d.amortissement, 2) + '</td><td class="num">' + kJ(d.kappa1) + '</td><td class="num">' + nb(d.admittance, 2) + '</td></tr>';
      }).join('') +
      (noms.length ? '' : '<tr><td colspan="7" class="vide">Enregistre des parois (à droite) pour les comparer ici.</td></tr>') + '</tbody>';
  }

  /* ==========================================================
     INERTIE DU LOCAL
     ========================================================== */
  // Une référence de paroi : 'courante', 'modele:<id>' ou 'perso:<nom>'.
  function paroiDeReference(ref) {
    if (ref === 'courante') return paroi;
    if (ref && ref.indexOf('perso:') === 0) return mesParois.tous()[ref.slice(6)] || null;
    const id = ref && ref.indexOf('modele:') === 0 ? ref.slice(7) : ref;
    return modele(id) || null;
  }

  function optionsParois(ref) {
    const perso = Object.keys(mesParois.tous()).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
    const norm = ref && ref.indexOf(':') === -1 && ref !== 'courante' ? 'modele:' + ref : ref;
    const opt = function (v, t) { return '<option value="' + esc(v) + '"' + (v === norm ? ' selected' : '') + '>' + esc(t) + '</option>'; };
    return opt('courante', 'Paroi en cours') +
      (perso.length ? '<optgroup label="Mes parois">' + perso.map(function (n) { return opt('perso:' + n, n); }).join('') + '</optgroup>' : '') +
      '<optgroup label="Modèles">' + EX.parois.map(function (p) { return opt('modele:' + p.id, p.nom); }).join('') + '</optgroup>';
  }

  function calculerLocal() {
    const elements = [];
    const erreurs = [];
    local.elements.forEach(function (el, i) {
      const p = paroiDeReference(el.paroi);
      const an = p ? analyser(p) : null;
      if (!an || !an.ok) { erreurs.push(i); return; }
      if (!(Number(el.aire) > 0)) { erreurs.push(i); return; }
      elements.push({ index: i, nom: el.nom, aire: el.aire, contact: el.contact, analyse: an });
    });
    return { resultat: P.inertieLocal(elements, local.surfacePlancher), elements: elements, erreurs: erreurs };
  }

  function renderLocal() {
    $('#local-nom').value = local.nom || '';
    $('#local-af').value = BAO.versChamp(local.surfacePlancher);
    const calc = calculerLocal();
    const parIndex = {};
    calc.elements.forEach(function (e, k) { parIndex[e.index] = calc.resultat.lignes[k]; });
    $('#corps-local').innerHTML = local.elements.length ? local.elements.map(function (el, i) {
      const l = parIndex[i];
      return '<tr data-element="' + i + '">' +
        '<td><input type="text" data-champ="nom" value="' + esc(el.nom || '') + '" style="min-width:150px" aria-label="Élément"></td>' +
        '<td><select data-champ="paroi" aria-label="Paroi" style="max-width:240px">' + optionsParois(el.paroi) + '</select></td>' +
        '<td><select data-champ="contact" aria-label="Faces dans le local">' + CONTACTS.map(function (c) { return '<option value="' + c.id + '"' + (c.id === el.contact ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select></td>' +
        '<td class="num"><input type="text" inputmode="decimal" data-champ="aire" value="' + esc(BAO.versChamp(el.aire)) + '" style="width:70px;text-align:right" aria-label="Aire"></td>' +
        '<td class="num" data-cellule="kappa">' + (l ? l.kappas.map(kJ).join(' + ') : '<span class="muet">–</span>') + '</td>' +
        '<td class="num" data-cellule="cm">' + (l ? kJ(l.cm) : '–') + '</td>' +
        '<td><button type="button" class="bouton discret danger" data-action="retirer" aria-label="Retirer cet élément">✕</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="vide">Aucun élément.</td></tr>';
    renderResultatLocal(calc);
  }

  function renderResultatLocal(calc) {
    const r = calc.resultat;
    let html = '';
    if (calc.erreurs.length) html += '<div class="alerte attention" style="margin:0 0 10px">Élément(s) ignoré(s), paroi incomplète ou aire nulle : ' + calc.erreurs.map(function (i) { return esc(local.elements[i].nom || ('n° ' + (i + 1))); }).join(', ') + '.</div>';
    if (!(Number(local.surfacePlancher) > 0)) { $('#resultat-local').innerHTML = html + '<p class="muet">Indique la surface de plancher Af.</p>'; return; }
    html += '<div class="indicateurs">' +
      bloc('Cm', nb(r.cm / 1e6, 2), 'MJ/K', 'capacité utile du local') +
      bloc('Am', nb(r.am, 1), 'm²', 'surface d\'échange de la masse') +
      bloc('Cm / Af', kJ(r.cmSurAf), 'kJ/(m²·K)', 'par m² de plancher') +
      bloc('Classe (H)', r.classe ? esc(r.classe.nom) : '–', '', 'repère ISO 13790 le plus proche') + '</div>';
    html += '<div class="formule">' + esc(
      'Cm = Σ κ × A = ' + calc.resultat.lignes.map(function (l) { return l.kappas.map(kJ).join('+') + ' × ' + nb(l.aire, 1); }).join(' + ') + '\n   = ' + nb(r.cm / 1000) + ' kJ/K\n' +
      'Am = Cm² / Σ κ²·A = ' + nb(r.am, 1) + ' m²   (Am / Af = ' + nb(r.amSurAf, 2) + ')\n' +
      'Cm / Af = ' + nb(r.cm / 1000) + ' / ' + nb(Number(local.surfacePlancher), 1) + ' = ' + kJ(r.cmSurAf) + ' kJ/(m²·K)') + '</div>';
    html += '<div class="defilement" style="margin-top:10px"><table>' + tableClasses(r.classe) + '</table></div>';
    $('#resultat-local').innerHTML = html;
  }

  function tableClasses(choisie) {
    return '<thead><tr><th>Classe</th><th class="num">Cm / Af (kJ/(m²·K))</th><th class="num">Am / Af</th></tr></thead><tbody>' +
      P.CLASSES_INERTIE.map(function (c) {
        const sel = choisie && choisie.id === c.id;
        return '<tr' + (sel ? ' style="font-weight:700"' : '') + '><td>' + (sel ? '▸ ' : '') + esc(c.nom) + '</td><td class="num">' + nb(c.cmSurAf / 1000) + '</td><td class="num">' + nb(c.amSurAf, 1) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ==========================================================
     ONGLET DONNÉES
     ========================================================== */
  function renderMateriaux() {
    const valides = materiaux.liste.filter(function (m) { return m.statut === 'valide'; }).length;
    $('#stats-materiaux').innerHTML = materiaux.liste.length + ' matériaux · <b>' + valides + ' validé' + (valides > 1 ? 's' : '') + '</b>';
    $('#corps-materiaux').innerHTML = materiaux.liste.map(function (m, i) {
      const num = function (champ, d) { return '<td><input type="text" inputmode="decimal" data-champ="' + champ + '" value="' + esc(BAO.versChamp(m[champ])) + '" style="width:78px;text-align:right" aria-label="' + champ + '"></td>'; };
      return '<tr data-index="' + i + '">' +
        '<td><input type="text" data-champ="nom" value="' + esc(m.nom) + '" style="min-width:200px" aria-label="Matériau"></td>' +
        '<td><select data-champ="famille" aria-label="Famille">' + EX.familles.map(function (f) { return '<option value="' + f.id + '"' + (f.id === m.famille ? ' selected' : '') + '>' + esc(f.nom) + '</option>'; }).join('') + '</select></td>' +
        num('lambda') + num('rho') + num('c') +
        '<td><input type="text" data-champ="source" value="' + esc(m.source || '') + '" style="min-width:280px" aria-label="Source"></td>' +
        '<td><input type="month" data-champ="dateRef" value="' + esc(m.dateRef || '') + '" style="min-width:140px" aria-label="Mois"></td>' +
        '<td>' + BAO.selectStatut(m.statut, 'data-champ="statut"') + '</td>' +
        '<td>' + (estExemple(m) ? '' : '<button type="button" class="bouton discret danger" data-action="supprimer" aria-label="Supprimer ce matériau">✕</button>') + '</td></tr>';
    }).join('');
  }

  function renderNormes() {
    $('#table-rs').innerHTML = '<thead><tr><th>Sens du flux</th><th class="num">Rsi</th><th class="num">Rse</th></tr></thead><tbody>' +
      Object.keys(P.RESISTANCES_SUPERFICIELLES).map(function (k) {
        const r = P.RESISTANCES_SUPERFICIELLES[k];
        return '<tr><td>' + esc(r.nom) + '</td><td class="num">' + nb(r.rsi, 2) + '</td><td class="num">' + nb(r.rse, 2) + '</td></tr>';
      }).join('') + '</tbody>';
    $('#table-classes').innerHTML = tableClasses(null);
    $('#table-classes-methode').innerHTML = tableClasses(null);
  }

  /* ==========================================================
     RENDU GLOBAL ET ÉVÉNEMENTS
     ========================================================== */
  function renderCalcul() {
    const a = analyser(paroi);
    renderResultats(a);
    renderSchema(a);
    renderDetailCouches(a);
    renderDetailMatrice(a);
    renderGraphes(a);
    renderComparaison(a);
    renderLocal();
  }

  function renderTout() {
    renderParoi();
    renderOnde(analyser(paroi));
    renderCalcul();
    renderMateriaux();
    renderNormes();
    mesParois.rendre();
  }

  function apresModifParoi(redessinerTable) {
    sauverParoi();
    if (redessinerTable) renderParoi();
    renderCalcul();
  }

  function brancherEvenements() {
    $('#nom-projet').addEventListener('input', function (e) { paroi.nom = e.target.value; sauverParoi(); const a = analyser(paroi); renderResultats(a); renderComparaison(a); });
    // Après « Enregistrer » ou « Supprimer » (gérés par BAO, branchés avant) : la comparaison et le local suivent.
    ['#btn-enregistrer', '#btn-supprimer-projet'].forEach(function (id) {
      $(id).addEventListener('click', function () { renderComparaison(analyser(paroi)); renderLocal(); });
    });
    $('#type-paroi').addEventListener('change', function (e) { paroi.type = e.target.value; apresModifParoi(false); });
    $('#sens-flux').addEventListener('change', function (e) { paroi.sensFlux = e.target.value; apresModifParoi(false); });
    $('#btn-modele').addEventListener('click', function () {
      const id = $('#modele').value;
      if (!confirm('Remplacer la paroi en cours par « ' + modele(id).nom + ' » ? (Elle n\'est gardée que si tu l\'as enregistrée.)')) return;
      paroi = paroiDepuisModele(id);
      apresModifParoi(true);
    });

    $('#corps-couches').addEventListener('change', function (e) {
      const tr = e.target.closest('tr[data-couche]');
      if (!tr) return;
      const c = paroi.couches[Number(tr.dataset.couche)];
      if (e.target.dataset.champ === 'materiau') { c.materiau = e.target.value; apresModifParoi(true); }
      if (e.target.dataset.champ === 'e') {
        const cm = BAO.lireNombre(e.target.value);
        if (!isFinite(cm) || cm <= 0) { BAO.notifier('Épaisseur invalide : tape un nombre de centimètres (ex. 20).'); renderParoi(); return; }
        c.e = cm / 100;
        apresModifParoi(false);
      }
    });
    $('#corps-couches').addEventListener('click', function (e) {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const i = Number(b.closest('tr[data-couche]').dataset.couche);
      const cs = paroi.couches;
      if (b.dataset.action === 'retirer') cs.splice(i, 1);
      if (b.dataset.action === 'monter' && i > 0) cs.splice(i - 1, 0, cs.splice(i, 1)[0]);
      if (b.dataset.action === 'descendre' && i < cs.length - 1) cs.splice(i + 1, 0, cs.splice(i, 1)[0]);
      apresModifParoi(true);
    });
    $('#btn-ajouter-couche').addEventListener('click', function () {
      paroi.couches.push({ materiau: 'laine-verre', e: 0.10 });
      apresModifParoi(true);
    });
    $('#btn-retourner').addEventListener('click', function () {
      paroi.couches.reverse();
      apresModifParoi(true);
      BAO.notifier('Paroi retournée : U est le même, regarde κ1 et l\'amortissement.');
    });

    // --- Onde ---
    [['#onde-moy', 'tMoyenne'], ['#onde-amp', 'amplitude'], ['#onde-max', 'heureMax'], ['#onde-ti', 'tInterieure']].forEach(function (x) {
      $(x[0]).addEventListener('change', function (e) {
        const v = BAO.lireNombre(e.target.value);
        if (!isFinite(v) || (x[1] === 'amplitude' && v < 0) || (x[1] === 'heureMax' && (v < 0 || v > 24))) { BAO.notifier('Valeur invalide.'); renderOnde(analyser(paroi)); return; }
        reglages.onde[x[1]] = v;
        sauverReglages();
        renderGraphes(analyser(paroi));
      });
    });

    // --- Local ---
    $('#local-nom').addEventListener('input', function (e) { local.nom = e.target.value; sauverLocal(); });
    $('#local-af').addEventListener('change', function (e) { local.surfacePlancher = BAO.lirePositif(e.target.value); sauverLocal(); renderLocal(); });
    $('#corps-local').addEventListener('change', function (e) {
      const tr = e.target.closest('tr[data-element]');
      const champ = e.target.dataset.champ;
      if (!tr || !champ) return;
      const el = local.elements[Number(tr.dataset.element)];
      el[champ] = champ === 'aire' ? BAO.lirePositif(e.target.value) : e.target.value;
      sauverLocal();
      renderLocal();
    });
    $('#corps-local').addEventListener('click', function (e) {
      const b = e.target.closest('[data-action="retirer"]');
      if (!b) return;
      local.elements.splice(Number(b.closest('tr[data-element]').dataset.element), 1);
      sauverLocal();
      renderLocal();
    });
    $('#btn-ajouter-element').addEventListener('click', function () {
      local.elements.push({ nom: 'Nouvel élément', paroi: 'courante', contact: 'exterieur', aire: 10 });
      sauverLocal();
      renderLocal();
    });
    $('#btn-local-exemple').addEventListener('click', function () {
      if (!confirm('Remplacer le local par le bureau d\'exemple ?')) return;
      local = BAO.cloner(EX.local);
      sauverLocal();
      renderLocal();
    });

    // --- Données : matériaux ---
    $('#corps-materiaux').addEventListener('change', function (e) {
      const tr = e.target.closest('tr[data-index]');
      const champ = e.target.dataset.champ;
      if (!tr || !champ) return;
      const m = materiaux.liste[Number(tr.dataset.index)];
      if (['lambda', 'rho', 'c'].indexOf(champ) !== -1) {
        const v = BAO.lireNombre(e.target.value);
        if (!isFinite(v) || v <= 0) { BAO.notifier('Valeur invalide : un nombre positif (ex. 0,035).'); renderMateriaux(); return; }
        m[champ] = v;
      } else {
        m[champ] = e.target.value;
        if (champ === 'statut' && m.statut === 'valide' && /exemple|à vérifier|ordre de grandeur/i.test(m.source || '')) BAO.notifier('Validé — pense à noter la vraie source.');
      }
      sauverMateriaux();
      renderMateriaux();
      renderParoi();
      renderCalcul();
    });
    $('#corps-materiaux').addEventListener('click', function (e) {
      const b = e.target.closest('[data-action="supprimer"]');
      if (!b) return;
      const i = Number(b.closest('tr[data-index]').dataset.index);
      const m = materiaux.liste[i];
      const utilise = paroi.couches.some(function (c) { return c.materiau === m.id; });
      if (!confirm('Supprimer le matériau « ' + m.nom + ' » ?' + (utilise ? ' Il est utilisé dans la paroi en cours.' : ''))) return;
      materiaux.liste.splice(i, 1);
      sauverMateriaux();
      renderTout();
    });
    $('#btn-nouveau-materiau').addEventListener('click', function () {
      materiaux.liste.push({ id: BAO.identifiant('m'), nom: 'Nouveau matériau', famille: 'maconnerie', lambda: 1, rho: 1000, c: 1000, source: '', dateRef: '', statut: 'exemple' });
      sauverMateriaux();
      renderMateriaux();
      renderParoi();
      const champs = document.querySelectorAll('#corps-materiaux input[data-champ="nom"]');
      const dernier = champs[champs.length - 1];
      if (dernier) { dernier.focus(); dernier.select(); }
    });
  }

  /* ==========================================================
     DÉMARRAGE
     ========================================================== */
  BAO.initOnglets(CLES.onglet);
  BAO.carteDonnees($('#mes-donnees'));   // sauvegarde complète et restauration
  BAO.testeToi($('#teste-toi'), window.ConfortExercices);
  BAO.sectionsRepliables('#onglet-methode .methode');
  brancherEvenements();
  renderTout();
})();
