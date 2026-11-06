/* ==========================================================
   CONFORT D'ÉTÉ — LE LABO ANIMÉ (onglet Atelier parois)
   ----------------------------------------------------------
   Affichage et animation seulement : AUCUN calcul thermique ici.
   La simulation vient de ConfortTransitoire.simuler (calcul/calcul-transitoire.js) ;
   la paroi est celle de l'atelier (window.ConfortAtelier).

   Ce qu'on dessine :
   - le mur en coupe, avec la texture de chaque matériau (comme sur un plan) ;
   - par-dessus, un dégradé de couleur = la TEMPÉRATURE dans l'épaisseur (bleu froid → rouge chaud) ;
   - la courbe θ(x) ;
   - des particules de chaleur : elles vont dans le sens du FLUX local, d'autant plus vite que
     le flux est fort (q = G × ΔT entre deux tranches voisines, valeurs du calcul).
   ========================================================== */
(function () {
  'use strict';

  const T = window.ConfortTransitoire;
  const P = window.ConfortParois;
  const G = window.ConfortGraphiques;
  const A = window.ConfortAtelier;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (s) { return document.querySelector(s); };
  if (!T || !A || !$('#labo')) return;

  // Dimensions du dessin (unités du viewBox). Écran étroit : dessin moins large, donc plus grand à l'écran.
  let L = 900, PIECE = 160, DEHORS = 160, MUR = 580;
  const H = 380, HAUT = 94, BAS = 340;
  function adapterDimensions() {
    const etroit = ($('#labo-scene').clientWidth || 900) < 640;
    L = etroit ? 560 : 900;
    PIECE = DEHORS = etroit ? 96 : 160;
    MUR = L - PIECE - DEHORS;
  }
  const IMAGES_PAR_HEURE = 6;    // une image toutes les 10 min de simulation
  const NB_PARTICULES = 70;

  // Les matériaux qu'on glisse dans le mur (ou qu'on ajoute d'un clic, côté intérieur).
  const PALETTE = [
    { materiau: 'plaque-platre', e: 0.013, nom: 'BA13' },
    { materiau: 'laine-verre', e: 0.10, nom: 'Laine de verre' },
    { materiau: 'pse', e: 0.10, nom: 'PSE' },
    { materiau: 'fibre-bois-rigide', e: 0.10, nom: 'Fibre de bois' },
    { materiau: 'beton-arme', e: 0.18, nom: 'Béton' },
    { materiau: 'parpaing', e: 0.20, nom: 'Parpaing' },
    { materiau: 'brique-pleine', e: 0.22, nom: 'Brique' },
    { materiau: 'pierre-calcaire', e: 0.40, nom: 'Pierre' },
    { materiau: 'bois-resineux', e: 0.05, nom: 'Bois' },
    { materiau: 'enduit-ciment', e: 0.015, nom: 'Enduit' }
  ];
  const VITESSES = [{ id: 1, nom: '×1' }, { id: 3, nom: '×3' }, { id: 8, nom: '×8' }];
  const SCENARIOS = [{ id: 'echelon', nom: '🔥 Coup de chaud' }, { id: 'journee', nom: '🌗 Jour / nuit' }];
  const PIECES = [{ id: 'fixe', nom: '❄️ Pièce climatisée' }, { id: 'libre', nom: '🏠 Pièce libre' }];

  // Réglages d'affichage du labo (dans le navigateur, hors sauvegarde : ce ne sont pas des données de calcul).
  const CLE = 'bao.confort.labo.affichage';
  const DEFAUT = {
    scenario: 'echelon', tAvant: 20, tApres: 35, duree: 48,
    piece: 'fixe', tInterieure: 20, aireMur: 10, volume: 50, renouvellement: 0.5, mobilier: 0, vitesse: 3
  };
  let reglage = Object.assign({}, DEFAUT, BAO.lire(CLE, {}) || {});
  function sauverReglage() { try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch (e) { /* rien */ } }

  let sim = null, position = 0, enCours = false, dernierInstant = null;
  let selection = null, glisse = null, glissePalette = null, rendu = null, echelleT = null;
  let particules = [];

  /* ==========================================================
     LA SIMULATION
     ========================================================== */
  function couchesPhysiques() {
    const brutes = P.couchesPhysiques(A.paroi(), A.materiaux());
    if (!brutes.length || brutes.some(function (c) { return !c || !(c.e > 0 && c.lambda > 0 && c.rho > 0 && c.c > 0); })) return null;
    return brutes;
  }

  function lancerCalcul() {
    const couches = couchesPhysiques();
    if (!couches) { sim = null; dessinerTout(); return; }
    const p = A.paroi();
    const rs = P.resistancesSuperficielles(p.sensFlux, p.type === 'interieure');
    const onde = A.onde();
    const scenario = reglage.scenario === 'echelon'
      ? { type: 'echelon', tAvant: Number(reglage.tAvant), tApres: Number(reglage.tApres) }
      : { type: 'journee', tMoyenne: Number(onde.tMoyenne), amplitude: Number(onde.amplitude), heureMax: Number(onde.heureMax) };
    sim = T.simuler({
      couches: couches, rs: rs, scenario: scenario,
      piece: { mode: reglage.piece, tInterieure: Number(reglage.tInterieure), aireMur: Number(reglage.aireMur), volume: Number(reglage.volume),
        renouvellement: Number(reglage.renouvellement), capaciteMobilier: Number(reglage.mobilier) * 1000 },
      dureeHeures: Number(reglage.duree), pasSecondes: 60, sortieMinutes: 60 / IMAGES_PAR_HEURE
    });
    sim.couches = couches;
    sim.rs = rs;
    let mn = Infinity, mx = -Infinity;
    sim.profils.forEach(function (pr, i) {
      pr.concat([sim.tExt[i], sim.tPiece[i]]).forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
    });
    if (mx - mn < 2) { mn -= 1; mx += 1; }
    echelleT = [Math.floor(mn - 0.5), Math.ceil(mx + 0.5)];
    position = Math.min(position, Number(reglage.duree));
    $('#labo-temps').max = String(Number(reglage.duree) * IMAGES_PAR_HEURE);
    semerParticules();
    dessinerGraphe();
    dessinerTout();
  }
  let attente = null;
  function recalculer() { clearTimeout(attente); attente = setTimeout(lancerCalcul, 120); }

  /* ==========================================================
     COULEURS ET GÉOMÉTRIE DU DESSIN
     ========================================================== */
  function hexVersRvb(h) { const v = parseInt(String(h).replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  let palette = null;
  function lirePalette() {
    const css = getComputedStyle(document.documentElement);
    palette = ['--chaleur-froid', '--chaleur-neutre', '--chaleur-chaud'].map(function (n) { return hexVersRvb(css.getPropertyValue(n).trim() || '#888888'); });
  }
  function couleur(t) {
    const f = Math.max(0, Math.min(1, (t - echelleT[0]) / (echelleT[1] - echelleT[0])));
    const a = f < 0.5 ? palette[0] : palette[1], b = f < 0.5 ? palette[1] : palette[2];
    const k = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }).join(',') + ')';
  }

  // Bords des couches en pixels : largeur proportionnelle à l'épaisseur, avec un minimum pour rester saisissable.
  function bordsCouches(couches) {
    const total = couches.reduce(function (s, c) { return s + c.e; }, 0);
    const l = couches.map(function (c) { return Math.max(30, c.e / total * MUR); });
    const somme = l.reduce(function (s, x) { return s + x; }, 0);
    const bords = [PIECE];
    l.forEach(function (x) { bords.push(bords[bords.length - 1] + x * MUR / somme); });
    return bords;
  }
  function versPixel(couches, bords, x) {
    let cumul = 0;
    for (let k = 0; k < couches.length; k++) {
      if (x <= cumul + couches[k].e + 1e-12) return bords[k] + (x - cumul) / couches[k].e * (bords[k + 1] - bords[k]);
      cumul += couches[k].e;
    }
    return bords[bords.length - 1];
  }
  function imageCourante() { return Math.max(0, Math.min(sim.temps.length - 1, Math.round(position * IMAGES_PAR_HEURE))); }

  // Flux local (W/m², positif vers la pièce) à chaque interface : F[i] = G[i] × (T à droite − T à gauche).
  function fluxInterfaces(i) {
    const pr = sim.profils[i], Gc = sim.conductances, N = pr.length;
    const F = [];
    for (let k = 0; k <= N; k++) {
      const gauche = k === 0 ? sim.tPiece[i] : pr[k - 1];
      const droite = k === N ? sim.tExt[i] : pr[k];
      F.push(Gc[k] * (droite - gauche));
    }
    return F;
  }

  /* ==========================================================
     LE MUR EN COUPE (SVG)
     ========================================================== */
  const TEXTURES = {
    beton: '<pattern id="tx-beton" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.4"/><circle cx="15" cy="9" r="0.9"/><circle cx="9" cy="17" r="1.6"/><circle cx="19" cy="19" r="0.8"/><path d="M12 3l2 1-1 2z"/></pattern>',
    maconnerie: '<pattern id="tx-maconnerie" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 0.5h40M0 10.5h40M20 0v10M0 10v10M40 10v10" fill="none" stroke-width="1.2"/></pattern>',
    isolant: '<pattern id="tx-isolant" width="24" height="16" patternUnits="userSpaceOnUse"><path d="M0 8c4-8 8-8 12 0s8 8 12 0" fill="none" stroke-width="1.3"/></pattern>',
    bois: '<pattern id="tx-bois" width="30" height="12" patternUnits="userSpaceOnUse"><path d="M0 4c8-2 14 2 30 0M0 10c10 1 18-2 30 0" fill="none" stroke-width="1"/></pattern>',
    revetement: '<pattern id="tx-revetement" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="0.5"/></pattern>'
  };

  function svgCoupe() {
    if (!sim) return '<div class="alerte attention" style="margin:12px">Complète les couches de la paroi pour lancer le labo.</div>';
    const i = imageCourante();
    const couches = sim.couches, bords = bordsCouches(couches);
    const yT = function (t) { return BAS - 12 - (t - echelleT[0]) / (echelleT[1] - echelleT[0]) * (BAS - HAUT - 24); };
    const ta = sim.tPiece[i], te = sim.tExt[i], q = sim.fluxInt[i];
    const profil = sim.profils[i];
    const h = sim.temps[i] % 24;
    const jour = reglage.scenario === 'echelon' || (h > 6 && h < 20.5);

    let s = '<svg class="labo-svg" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Coupe du mur : température dans l\'épaisseur et chaleur qui entre dans la pièce">';
    // Textures et dégradé de température (une couleur par tranche, fondues en un dégradé continu).
    s += '<defs>' + Object.keys(TEXTURES).map(function (k) { return TEXTURES[k]; }).join('') +
      '<linearGradient id="labo-degrade" gradientUnits="userSpaceOnUse" x1="' + PIECE + '" x2="' + (L - DEHORS) + '" y1="0" y2="0">' +
      '<stop offset="0" stop-color="' + couleur(sim.tSi[i]) + '"/>' +
      sim.cellules.map(function (c, k) {
        return '<stop offset="' + ((versPixel(couches, bords, c.xc) - PIECE) / MUR).toFixed(4) + '" stop-color="' + couleur(profil[k]) + '"/>';
      }).join('') + '<stop offset="1" stop-color="' + couleur(sim.tSe[i]) + '"/></linearGradient>' +
      '<radialGradient id="labo-halo"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>';

    // L'air : une teinte légère de sa température.
    s += '<rect x="0" y="0" width="' + PIECE + '" height="' + H + '" fill="' + couleur(ta) + '" class="labo-air"/>';
    s += '<rect x="' + (L - DEHORS) + '" y="0" width="' + DEHORS + '" height="' + H + '" fill="' + couleur(te) + '" class="labo-air"/>';

    // Le mur : dégradé thermique, puis la texture de chaque matériau par-dessus.
    s += '<rect x="' + PIECE + '" y="' + HAUT + '" width="' + MUR + '" height="' + (BAS - HAUT) + '" fill="url(#labo-degrade)"/>';
    couches.forEach(function (c, k) {
      const x0 = bords[k], x1 = bords[k + 1], fam = c.materiau.famille || 'revetement';
      s += '<rect x="' + x0.toFixed(1) + '" y="' + HAUT + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (BAS - HAUT) + '" fill="url(#tx-' + fam + ')" class="labo-texture tx-' + fam + '"/>';
      if (k > 0) s += '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + HAUT + '" y2="' + BAS + '" class="labo-joint"/>';
      if (selection === k) s += '<rect x="' + (x0 + 1.5).toFixed(1) + '" y="' + (HAUT + 1.5) + '" width="' + (x1 - x0 - 3).toFixed(1) + '" height="' + (BAS - HAUT - 3) + '" class="labo-choix-cadre"/>';
    });
    s += '<rect x="' + PIECE + '" y="' + HAUT + '" width="' + MUR + '" height="' + (BAS - HAUT) + '" class="labo-contour"/>';

    // Particules de chaleur (sens et vitesse = flux local).
    particules.forEach(function (pt) {
      s += '<circle cx="' + pt.x.toFixed(1) + '" cy="' + (HAUT + 8 + pt.y * (BAS - HAUT - 16)).toFixed(1) + '" r="2.6" class="labo-particule" fill-opacity="' + pt.o.toFixed(2) + '"/>';
    });

    // La courbe θ(x).
    const pts = [[PIECE - 22, ta], [PIECE, sim.tSi[i]]];
    sim.cellules.forEach(function (c, k) { pts.push([versPixel(couches, bords, c.xc), profil[k]]); });
    pts.push([L - DEHORS, sim.tSe[i]], [L - DEHORS + 22, te]);
    const chemin = pts.map(function (pt) { return pt[0].toFixed(1) + ',' + yT(pt[1]).toFixed(1); }).join(' ');
    s += '<polyline points="' + chemin + '" class="labo-courbe-halo"/><polyline points="' + chemin + '" class="labo-courbe"/>';

    // Les noms des couches (on les attrape pour glisser) et les épaisseurs.
    couches.forEach(function (c, k) {
      const x0 = bords[k], x1 = bords[k + 1], milieu = (x0 + x1) / 2;
      const tenue = glisse && glisse.index === k && glisse.bouge;
      s += '<g class="labo-poignee' + (selection === k ? ' choisie' : '') + (tenue ? ' tenue' : '') + '" data-couche="' + k + '">' +
        '<rect x="' + (x0 + 2).toFixed(1) + '" y="' + (HAUT - 32) + '" width="' + (x1 - x0 - 4).toFixed(1) + '" height="24" rx="12"/>' +
        '<text x="' + milieu.toFixed(1) + '" y="' + (HAUT - 16) + '" text-anchor="middle">' + esc(nomCourt(c.materiau.nom, x1 - x0 - 8)) + '</text></g>' +
        '<text x="' + milieu.toFixed(1) + '" y="' + (BAS + 22) + '" text-anchor="middle" class="labo-ep">' + nb(c.e * 100, c.e < 0.02 ? 1 : 0) + ' cm</text>';
    });

    // Dehors : soleil (ou lune la nuit) et température.
    const xs = L - DEHORS / 2;
    s += jour ? soleil(xs, HAUT + 24) : lune(xs, HAUT + 24);
    s += '<text x="' + xs + '" y="' + (HAUT + 92) + '" text-anchor="middle" class="labo-t-grande">' + nb(te, 1) + '°</text>';
    s += '<text x="' + xs + '" y="' + (HAUT + 112) + '" text-anchor="middle" class="labo-legende">dehors</text>';
    // La pièce : sa température et la chaleur qui entre.
    const xp = PIECE / 2;
    s += '<text x="' + xp + '" y="' + (HAUT + 44) + '" text-anchor="middle" class="labo-legende">' + (reglage.piece === 'libre' ? 'pièce' : 'pièce (climatisée)') + '</text>';
    s += '<text x="' + xp + '" y="' + (HAUT + 92) + '" text-anchor="middle" class="labo-t-grande">' + nb(ta, 1) + '°</text>';
    s += fleche(PIECE - 10, BAS - 70, q);

    // Repère d'insertion pendant un glisser-déposer.
    const cible = (glisse && glisse.bouge) ? glisse.cible : (glissePalette && glissePalette.dansMur ? glissePalette.cible : null);
    if (cible !== null && cible !== undefined) {
      s += '<line x1="' + bords[cible] + '" x2="' + bords[cible] + '" y1="' + (HAUT - 36) + '" y2="' + (BAS + 6) + '" class="labo-insertion"/>';
    }
    return s + '</svg>';
  }

  function nomCourt(nom, largeur) {
    const max = Math.floor(largeur / 6.6);
    const court = nom.replace(/ \(.*\)$/, '').replace('Polystyrène expansé', 'PSE');
    return court.length <= max ? court : (max > 3 ? court.slice(0, max - 1) + '…' : '');
  }

  function soleil(x, y) {
    let rayons = '';
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      rayons += '<line x1="' + (x + 19 * Math.cos(a)).toFixed(1) + '" y1="' + (y + 19 * Math.sin(a)).toFixed(1) + '" x2="' + (x + 27 * Math.cos(a)).toFixed(1) + '" y2="' + (y + 27 * Math.sin(a)).toFixed(1) + '"/>';
    }
    return '<g class="labo-soleil"><circle cx="' + x + '" cy="' + y + '" r="34" fill="url(#labo-halo)" opacity=".5"/>' + rayons + '<circle cx="' + x + '" cy="' + y + '" r="13"/></g>';
  }
  function lune(x, y) {
    return '<g class="labo-lune"><path d="M' + (x + 6) + ' ' + (y - 14) + 'a14 14 0 1 0 8 24a11 11 0 1 1 -8 -24z"/></g>';
  }

  // Grosse flèche dans la pièce : la chaleur qui entre (vers la gauche) ou qui sort (vers la droite).
  function fleche(xMur, y, q) {
    const longueur = Math.min(PIECE - 30, 16 + Math.abs(q) * 8);
    const entre = q >= 0;
    const xa = entre ? xMur : xMur - longueur, xb = entre ? xMur - longueur : xMur;
    const dir = entre ? -1 : 1;
    let s = '<g class="labo-fleche-g' + (Math.abs(q) < 0.05 ? ' nulle' : '') + '">';
    s += '<line x1="' + xa + '" y1="' + y + '" x2="' + (xb - dir * 8) + '" y2="' + y + '" class="labo-fleche"/>';
    s += '<polygon points="' + xb + ',' + y + ' ' + (xb - dir * 13) + ',' + (y - 9) + ' ' + (xb - dir * 13) + ',' + (y + 9) + '" class="labo-pointe"/>';
    s += '<text x="' + (PIECE / 2) + '" y="' + (y + 30) + '" text-anchor="middle" class="labo-flux">' + nb(Math.abs(q), 1) + ' W/m²</text>';
    s += '<text x="' + (PIECE / 2) + '" y="' + (y + 46) + '" text-anchor="middle" class="labo-legende">' + (entre ? 'chaleur qui entre' : 'chaleur qui sort') + '</text></g>';
    return s;
  }

  /* ==========================================================
     PARTICULES DE CHALEUR
     Vitesse (px/s) ∝ flux local ; elles naissent du côté d'où vient la chaleur.
     ========================================================== */
  function semerParticules() {
    particules = [];
    for (let k = 0; k < NB_PARTICULES; k++) particules.push({ x: PIECE + Math.random() * MUR, y: Math.random(), o: 0 });
    if (sim) bougerParticules(0);
  }
  function bougerParticules(dt) {
    if (!sim) return;
    const i = imageCourante();
    const F = fluxInterfaces(i);
    const couches = sim.couches, bords = bordsCouches(couches);
    const limites = sim.cellules.map(function (c) { return versPixel(couches, bords, c.x1); });
    const qMax = Math.max(0.5, Math.max.apply(null, F.map(Math.abs)));
    particules.forEach(function (pt) {
      let k = 0;
      while (k < limites.length - 1 && pt.x > limites[k]) k++;
      const q = (F[k] + F[k + 1]) / 2;                // flux local, positif vers la pièce (vers la gauche)
      const v = Math.sign(q) * Math.min(220, Math.abs(q) * 7);
      pt.x -= v * dt;
      // Bien visibles là où passe beaucoup de chaleur, effacées là où il n'en passe presque pas.
      pt.o = Math.abs(q) / qMax < 0.05 ? 0 : Math.min(0.95, 0.2 + 0.8 * Math.abs(q) / qMax);
      if (pt.x < PIECE) { pt.x = L - DEHORS - Math.random() * 6; pt.y = Math.random(); }
      if (pt.x > L - DEHORS) { pt.x = PIECE + Math.random() * 6; pt.y = Math.random(); }
    });
  }

  /* ==========================================================
     LE RESTE DE L'ÉCRAN
     ========================================================== */
  function dessinerHorloge() {
    if (!sim) return;
    const i = imageCourante(), h = sim.temps[i];
    $('#labo-jour').textContent = 'Jour ' + (Math.floor(h / 24) + 1);
    $('#labo-heure').textContent = Math.floor(h % 24) + ' h ' + String(Math.round((h % 1) * 60) % 60).padStart(2, '0');
    $('#labo-temps').value = String(i);
    if (rendu) {
      const ligne = document.querySelector('#labo-graphe .labo-curseur');
      if (ligne) { ligne.setAttribute('x1', rendu.X(h)); ligne.setAttribute('x2', rendu.X(h)); }
    }
  }

  function dessinerMesures() {
    if (!sim) { $('#labo-mesures').innerHTML = ''; return; }
    const i = imageCourante();
    const d = P.caracteristiquesDynamiques(sim.couches, sim.rs);
    const grand = function (val, unite, nom) { return '<div class="labo-mesure"><b>' + val + '<small>' + unite + '</small></b><span>' + nom + '</span></div>'; };
    let html = '<div class="labo-mesures">' +
      grand(nb(sim.tPiece[i], 1), ' °C', reglage.piece === 'libre' ? 'Air de la pièce' : 'Pièce (fixée)') +
      grand(nb(sim.tSi[i], 1), ' °C', 'Face intérieure du mur') +
      grand(nb(sim.fluxInt[i], 1), ' W/m²', sim.fluxInt[i] >= 0 ? 'Chaleur qui entre' : 'Chaleur qui sort') +
      grand(nb(sim.energieInt[i], 0), ' Wh/m²', 'Entrée depuis le début') + '</div>';
    let lecture;
    if (reglage.scenario === 'echelon') {
      const t50 = T.tempsDeReponse(sim.temps, reglage.piece === 'libre' ? sim.tPiece : sim.tSi, 0.5);
      const t = t50 === null ? 'plus de ' + reglage.duree + ' h' : nb(t50, 1) + ' h';
      lecture = reglage.piece === 'libre'
        ? 'La pièce fait la moitié du chemin vers sa température finale en <b>' + t + '</b>.'
        : 'La face intérieure fait la moitié de sa montée en <b>' + t + '</b>. À très long terme, le flux tend vers U × ΔT = ' + nb(d.U, 3) + ' × ' + nb(Number(reglage.tApres) - Number(reglage.tInterieure), 1) + ' = <b>' + nb(d.U * (Number(reglage.tApres) - Number(reglage.tInterieure)), 1) + ' W/m²</b>.';
    } else {
      lecture = 'Le pic de chaleur arrive environ <b>' + nb(d.dephasage, 1) + ' h</b> après le pic dehors, réduit à <b>' + nb(d.amortissement * 100, 0) + ' %</b> de ce que donnerait U seul.';
    }
    if (sim.bilan) lecture += ' <span class="muet">Contrôle de conservation de l\'énergie : écart de ' + nb(sim.bilan.ecartRelatif * 100, 6) + ' %.</span>';
    $('#labo-mesures').innerHTML = html + '<p class="labo-lecture">' + lecture + '</p>';
  }

  function dessinerGraphe() {
    if (!sim) { $('#labo-graphe').innerHTML = ''; rendu = null; return; }
    const serie = function (v) { return sim.temps.map(function (t, i) { return { x: t, y: v[i] }; }); };
    const duree = Number(reglage.duree);
    rendu = G.dessiner($('#labo-graphe'), {
      id: 'labo', titre: 'Températures pendant la simulation', unite: '°C',
      x: { min: 0, max: duree, pas: duree > 48 ? 24 : 12, format: function (v) { return nb(v) + ' h'; } },
      series: [
        { nom: 'Dehors', classe: 'gr-1', points: serie(sim.tExt) },
        { nom: reglage.piece === 'libre' ? 'Air de la pièce' : 'Pièce (fixée)', classe: 'gr-2', points: serie(sim.tPiece) },
        { nom: 'Face intérieure du mur', classe: 'gr-ref', points: serie(sim.tSi) }
      ]
    });
    const svg = document.querySelector('#labo-graphe svg');
    if (svg) svg.insertAdjacentHTML('beforeend', '<line class="labo-curseur" x1="0" x2="0" y1="14" y2="216"/>');
  }

  function dessinerEdition() {
    const p = A.paroi();
    if (selection === null || !p.couches[selection]) { $('#labo-edition').innerHTML = ''; return; }
    const c = p.couches[selection];
    const options = A.materiaux().map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === c.materiau ? ' selected' : '') + '>' + esc(m.nom) + '</option>'; }).join('');
    $('#labo-edition').innerHTML = '<div class="labo-outil"><span class="labo-outil-n">' + (selection + 1) + '</span>' +
      '<select data-labo="materiau" aria-label="Matériau">' + options + '</select>' +
      '<label class="labo-ep-curseur"><input type="range" min="0.5" max="50" step="0.5" value="' + (c.e * 100) + '" data-labo="e" aria-label="Épaisseur"><output>' + nb(c.e * 100, 1) + ' cm</output></label>' +
      '<button type="button" class="labo-rond" data-labo="interieur" title="Vers l\'intérieur" aria-label="Vers l\'intérieur">←</button>' +
      '<button type="button" class="labo-rond" data-labo="exterieur" title="Vers l\'extérieur" aria-label="Vers l\'extérieur">→</button>' +
      '<button type="button" class="labo-rond danger" data-labo="retirer" title="Retirer" aria-label="Retirer la couche">✕</button></div>';
  }

  function dessinerReglages() {
    const seg = function (el, liste, val, attr) {
      el.innerHTML = liste.map(function (x) { return '<button type="button" ' + attr + '="' + x.id + '" aria-pressed="' + (String(x.id) === String(val)) + '"><span>' + esc(x.nom) + '</span></button>'; }).join('');
    };
    seg($('#labo-scenario'), SCENARIOS, reglage.scenario, 'data-scenario');
    seg($('#labo-piece'), PIECES, reglage.piece, 'data-piece');
    seg($('#labo-vitesse'), VITESSES, reglage.vitesse, 'data-vitesse');
    const champ = function (cle, nom, unite) {
      return '<label class="champ"><span class="etiquette">' + nom + '</span><span class="labo-saisie"><input type="text" inputmode="decimal" data-reglage="' + cle + '" value="' + esc(BAO.versChamp(reglage[cle])) + '"><small>' + unite + '</small></span></label>';
    };
    const onde = A.onde();
    $('#labo-champs-scenario').innerHTML = reglage.scenario === 'echelon'
      ? champ('tAvant', 'Dehors avant', '°C') + champ('tApres', 'Dehors après', '°C') + champ('duree', 'Durée', 'h')
      : '<p class="aide" style="margin:0;flex-basis:100%">Journées de l\'atelier : ' + nb(onde.tMoyenne, 1) + ' ± ' + nb(onde.amplitude, 1) + ' °C, maximum à ' + nb(onde.heureMax, 1) + ' h (réglage « Une journée chaude », plus bas).</p>' + champ('duree', 'Durée', 'h');
    $('#labo-champs-piece').innerHTML = champ('tInterieure', reglage.piece === 'libre' ? 'Pièce au départ' : 'Pièce', '°C') +
      (reglage.piece === 'libre' ? champ('aireMur', 'Surface de ce mur', 'm²') + champ('volume', 'Volume', 'm³') +
        champ('renouvellement', 'Air neuf', 'vol/h') + champ('mobilier', 'Mobilier (H)', 'kJ/K') : '');
  }

  function dessinerPalette() {
    const mats = A.materiaux();
    $('#labo-palette').innerHTML = PALETTE.map(function (x, i) {
      const m = mats.find(function (y) { return y.id === x.materiau; });
      const fam = m ? m.famille : 'revetement';
      return '<button type="button" class="tuile-materiau" data-palette="' + i + '" title="Glisse-moi dans le mur (ou clique : côté intérieur)">' +
        '<svg viewBox="0 0 44 30" aria-hidden="true"><defs>' + TEXTURES[fam].replace('id="tx-' + fam + '"', 'id="mini-' + fam + '-' + i + '"') + '</defs>' +
        '<rect width="44" height="30" rx="5" class="mini-fond mini-' + fam + '"/><rect width="44" height="30" rx="5" fill="url(#mini-' + fam + '-' + i + ')" class="labo-texture tx-' + fam + '"/></svg>' +
        '<span>' + esc(x.nom) + '</span></button>';
    }).join('');
  }

  function dessinerScene() { adapterDimensions(); $('#labo-scene').innerHTML = svgCoupe(); }
  function dessinerTout() { dessinerScene(); dessinerHorloge(); dessinerMesures(); dessinerEdition(); }

  /* ==========================================================
     LE TEMPS QUI PASSE
     ========================================================== */
  function boucle(instant) {
    if (!enCours) return;
    if (dernierInstant !== null && sim) {
      const dt = Math.min(0.1, (instant - dernierInstant) / 1000);
      position += dt * Number(reglage.vitesse);
      bougerParticules(dt);
      if (position >= Number(reglage.duree)) { position = Number(reglage.duree); arreter(); }
      dessinerScene(); dessinerHorloge(); dessinerMesures();
    }
    dernierInstant = instant;
    if (enCours) requestAnimationFrame(boucle);
  }
  function lancer() {
    if (!sim) return;
    if (position >= Number(reglage.duree)) position = 0;
    enCours = true; dernierInstant = null;
    $('#labo-jouer').textContent = '❚❚';
    $('#labo-jouer').setAttribute('aria-label', 'Pause');
    requestAnimationFrame(boucle);
  }
  function arreter() {
    enCours = false;
    $('#labo-jouer').textContent = '▶';
    $('#labo-jouer').setAttribute('aria-label', 'Lancer');
  }

  /* ==========================================================
     GLISSER-DÉPOSER : déplacer une couche, ou poser un matériau de la palette
     ========================================================== */
  function xSvg(e) {
    const svg = document.querySelector('#labo-scene svg');
    const r = svg.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * L;
  }
  function dansLeMur(e) {
    const svg = document.querySelector('#labo-scene svg');
    if (!svg) return false;
    const r = svg.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function cibleInsertion(x) {
    const bords = bordsCouches(sim.couches);
    let meilleur = 0, ecart = Infinity;
    bords.forEach(function (b, k) { if (Math.abs(b - x) < ecart) { ecart = Math.abs(b - x); meilleur = k; } });
    return meilleur;
  }
  function inserer(index, x) {
    A.modifier(function (p) { p.couches.splice(index, 0, { materiau: x.materiau, e: x.e }); });
    selection = index;
  }

  function brancher() {
    const scene = $('#labo-scene');
    // Déplacer une couche existante (on attrape son nom).
    scene.addEventListener('pointerdown', function (e) {
      const poignee = e.target.closest('[data-couche]');
      if (!poignee || !sim) return;
      glisse = { index: Number(poignee.dataset.couche), x: e.clientX, bouge: false, cible: null };
      scene.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    scene.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      if (Math.abs(e.clientX - glisse.x) > 5) glisse.bouge = true;
      if (!glisse.bouge) return;
      glisse.cible = cibleInsertion(xSvg(e));
      dessinerScene();
    });
    scene.addEventListener('pointerup', function () {
      if (!glisse) return;
      const g = glisse;
      glisse = null;
      if (!g.bouge) { selection = selection === g.index ? null : g.index; dessinerScene(); dessinerEdition(); return; }
      let cible = g.cible;
      if (cible === null || cible === g.index || cible === g.index + 1) { dessinerScene(); return; }
      A.modifier(function (p) {
        const c = p.couches.splice(g.index, 1)[0];
        if (cible > g.index) cible -= 1;
        p.couches.splice(cible, 0, c);
      });
      selection = cible;
    });

    // Poser un matériau de la palette : on le glisse dans le mur (ou on clique : côté intérieur).
    const palette = $('#labo-palette');
    palette.addEventListener('pointerdown', function (e) {
      const b = e.target.closest('[data-palette]');
      if (!b) return;
      glissePalette = { x: PALETTE[Number(b.dataset.palette)], depart: [e.clientX, e.clientY], bouge: false, fantome: null, dansMur: false, cible: null };
      palette.setPointerCapture(e.pointerId);
    });
    palette.addEventListener('pointermove', function (e) {
      const g = glissePalette;
      if (!g) return;
      if (!g.bouge && Math.hypot(e.clientX - g.depart[0], e.clientY - g.depart[1]) > 6) {
        g.bouge = true;
        g.fantome = document.createElement('div');
        g.fantome.className = 'labo-fantome';
        g.fantome.textContent = g.x.nom;
        document.body.appendChild(g.fantome);
      }
      if (!g.bouge) return;
      g.fantome.style.left = e.clientX + 'px';
      g.fantome.style.top = e.clientY + 'px';
      g.dansMur = !!sim && dansLeMur(e);
      g.cible = g.dansMur ? cibleInsertion(xSvg(e)) : null;
      dessinerScene();
    });
    palette.addEventListener('pointerup', function () {
      const g = glissePalette;
      glissePalette = null;
      if (!g) return;
      if (g.fantome) g.fantome.remove();
      if (!g.bouge) { inserer(0, g.x); return; }
      if (g.dansMur && g.cible !== null) inserer(g.cible, g.x); else dessinerScene();
    });

    // Modifier la couche choisie.
    const edition = $('#labo-edition');
    edition.addEventListener('input', function (e) {
      if (e.target.dataset.labo === 'e') e.target.nextElementSibling.textContent = nb(Number(e.target.value), 1) + ' cm';
    });
    edition.addEventListener('change', function (e) {
      const k = selection;
      if (e.target.dataset.labo === 'e') A.modifier(function (p) { p.couches[k].e = Number(e.target.value) / 100; });
      if (e.target.dataset.labo === 'materiau') A.modifier(function (p) { p.couches[k].materiau = e.target.value; });
    });
    edition.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-labo]');
      if (!b) return;
      const k = selection;
      A.modifier(function (p) {
        const cs = p.couches;
        if (b.dataset.labo === 'retirer' && cs.length > 1) { cs.splice(k, 1); selection = null; }
        if (b.dataset.labo === 'interieur' && k > 0) { cs.splice(k - 1, 0, cs.splice(k, 1)[0]); selection = k - 1; }
        if (b.dataset.labo === 'exterieur' && k < cs.length - 1) { cs.splice(k + 1, 0, cs.splice(k, 1)[0]); selection = k + 1; }
      });
    });

    $('#labo-jouer').addEventListener('click', function () { if (enCours) arreter(); else lancer(); });
    $('#labo-zero').addEventListener('click', function () { arreter(); position = 0; semerParticules(); dessinerTout(); });
    $('#labo-temps').addEventListener('input', function (e) { arreter(); position = Number(e.target.value) / IMAGES_PAR_HEURE; dessinerScene(); dessinerHorloge(); dessinerMesures(); });

    $('#labo').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-scenario], button[data-piece], button[data-vitesse]');
      if (!b) return;
      if (b.dataset.scenario) { reglage.scenario = b.dataset.scenario; position = 0; }
      if (b.dataset.piece) reglage.piece = b.dataset.piece;
      if (b.dataset.vitesse) reglage.vitesse = Number(b.dataset.vitesse);
      sauverReglage();
      dessinerReglages();
      if (!b.dataset.vitesse) recalculer();
    });
    $('#labo').addEventListener('change', function (e) {
      const cle = e.target.dataset.reglage;
      if (!cle) return;
      const v = BAO.lireNombre(e.target.value);
      const temperature = ['tAvant', 'tApres', 'tInterieure'].indexOf(cle) !== -1;
      const positif = ['duree', 'aireMur', 'volume'].indexOf(cle) !== -1;
      if (!isFinite(v) || (positif && v <= 0) || (!temperature && v < 0) || (cle === 'duree' && v > 240)) {
        BAO.notifier('Valeur invalide.'); dessinerReglages(); return;
      }
      reglage[cle] = v;
      sauverReglage();
      recalculer();
    });

    document.addEventListener('confort:paroi', function () {
      if (selection !== null && selection >= A.paroi().couches.length) selection = null;
      recalculer();
    });
    document.addEventListener('confort:donnees', dessinerPalette);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { lirePalette(); dessinerTout(); });
    window.addEventListener('resize', function () { if (!enCours) { semerParticules(); dessinerScene(); } });
    document.querySelectorAll('[data-onglet="atelier"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { semerParticules(); dessinerScene(); }, 0); }); });
  }

  lirePalette();
  dessinerPalette();
  dessinerReglages();
  brancher();
  lancerCalcul();
})();
