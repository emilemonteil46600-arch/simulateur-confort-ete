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
  const So = window.ConfortSoleil;        // chapitre 2 : la météo et le soleil (scénario « vraie météo »)
  const R5 = window.ConfortCinqR1C;       // chapitre 3 : le sol sous la dalle (plancher bas)
  const V = window.CONFORT_METEO_VILLES;
  const X = window.CONFORT_PROJET;
  const VERSION = ((document.currentScript && document.currentScript.src) || '').split('?v=')[1] || '';
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (s) { return document.querySelector(s); };
  if (!T || !A || !So || !R5 || !V || !$('#labo')) return;

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
  const SCENARIOS = [{ id: 'meteo', nom: '☀ Vraie météo' }, { id: 'echelon', nom: '🔥 Coup de chaud' }, { id: 'journee', nom: '🌗 Jour / nuit' }];
  const DEBUTS = [{ id: 'semaine', nom: 'Semaine la plus chaude' }, { id: 172, nom: '21 juin' }, { id: 202, nom: '21 juillet' }, { id: 227, nom: '15 août' }];
  const ORIENTATIONS = [{ id: 0, nom: 'N' }, { id: 45, nom: 'NE' }, { id: 90, nom: 'E' }, { id: 135, nom: 'SE' }, { id: 180, nom: 'S' }, { id: 225, nom: 'SO' }, { id: 270, nom: 'O' }, { id: 315, nom: 'NO' }];
  const PRECHAUFFAGE_JOURS = 4;
  const PIECES = [{ id: 'fixe', nom: '❄️ Pièce climatisée' }, { id: 'libre', nom: '🏠 Pièce libre' }];

  // Réglages d'affichage du labo (dans le navigateur, hors sauvegarde : ce ne sont pas des données de calcul).
  const CLE = 'bao.confort.labo.affichage';
  const DEFAUT = {
    scenario: 'meteo', tAvant: 20, tApres: 35, duree: 48,
    // Vraie météo : ville (null = celle du projet), début, nombre de jours, orientation (azimut), pente du toit, couleur (α).
    ville: null, debut: 'semaine', jours: 5, orientation: 270, pente: 35, couleur: 'moyenne',
    piece: 'libre', tInterieure: 24, aireMur: 10, volume: 50, renouvellement: 0.5, mobilier: 0, vitesse: 3
  };
  let reglage = Object.assign({}, DEFAUT, BAO.lire(CLE, {}) || {});
  function sauverReglage() { try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch (e) { /* rien */ } }

  let sim = null, position = 0, enCours = false, dernierInstant = null;
  let meteo = null, villeChargee = null;   // la météo du scénario « vraie météo »
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

  /* ---------- La vraie météo : ce que « voit » la face extérieure, heure par heure ----------
     Mur et toiture : la température sol-air (chapitre 2, air + soleil absorbé − ciel froid), selon l'orientation,
     la pente et la couleur. Plancher bas : le sol sous la dalle (chapitre 3, (H)). En heure légale. */
  function ville() {
    const id = reglage.ville || (window.ConfortProjet ? window.ConfortProjet.projet().ville : null) || X.villeParDefaut;
    return V.villes.find(function (v) { return v.id === id; }) || V.villes[0];
  }
  function jourDebut(m) {
    if (reglage.debut === 'semaine') {
      const s = So.semaineLaPlusChaude(m.T, (So.jourDeLAnnee(6, 1) - 1) * 24, So.jourDeLAnnee(9, 30) * 24);
      return s.debut / 24 + 1;
    }
    return Number(reglage.debut);
  }
  function scenarioMeteo(m) {
    const nature = A.nature();
    const v = ville(), j0 = jourDebut(m), jours = Number(reglage.jours);
    const decal = So.decalageLegal(j0);
    const k0 = (j0 - 1) * 24 - decal - PRECHAUFFAGE_JOURS * 24, k1 = k0 + PRECHAUFFAGE_JOURS * 24 + jours * 24 + 1;
    const alpha = (X.couleurs.find(function (c) { return c.id === reglage.couleur; }) || X.couleurs[1]).alpha;
    let valeurs;
    if (nature === 'plancher') {
      const sol = R5.temperatureSol(m.T, X.sol).serie;
      valeurs = new Float64Array(k1 - k0);
      for (let i = 0; i < valeurs.length; i++) valeurs[i] = sol[((k0 + i) % 8760 + 8760) % 8760];
    } else {
      const inclinaison = nature === 'toiture' ? Number(reglage.pente) : 90;
      valeurs = So.serieSolAir(m, { lat: v.lat, lon: v.lon }, inclinaison, Number(reglage.orientation), alpha, k0, k1);
    }
    const air = new Float64Array(k1 - k0);
    for (let i = 0; i < air.length; i++) air[i] = m.T[((k0 + i) % 8760 + 8760) % 8760];
    return { type: 'serie', origine: -PRECHAUFFAGE_JOURS * 24, valeurs: valeurs, air: { type: 'serie', origine: -PRECHAUFFAGE_JOURS * 24, valeurs: air },
      jourDebut: j0, ville: v, nature: nature, alpha: alpha, duree: jours * 24 };
  }

  function lancerCalcul() {
    const couches = couchesPhysiques();
    if (!couches) { sim = null; dessinerTout(); return; }
    const p = A.paroi();
    const rs = P.resistancesSuperficielles(p.sensFlux, p.type === 'interieure');
    const onde = A.onde();
    let scenario, duree = Number(reglage.duree);
    if (reglage.scenario === 'meteo') {
      const v = ville();
      if (!meteo || villeChargee !== v.id) {
        V.charger(v.id, function (m) { meteo = m; villeChargee = v.id; lancerCalcul(); }, VERSION, function () { BAO.notifier('La météo de ' + v.nom + ' n\'a pas pu être chargée.'); });
        return;
      }
      scenario = scenarioMeteo(meteo);
      duree = scenario.duree;
    } else if (reglage.scenario === 'echelon') scenario = { type: 'echelon', tAvant: Number(reglage.tAvant), tApres: Number(reglage.tApres) };
    else scenario = { type: 'journee', tMoyenne: Number(onde.tMoyenne), amplitude: Number(onde.amplitude), heureMax: Number(onde.heureMax) };
    sim = T.simuler({
      couches: couches, rs: rs, scenario: scenario, prechauffageJours: PRECHAUFFAGE_JOURS,
      piece: { mode: reglage.piece, tInterieure: Number(reglage.tInterieure), aireMur: Number(reglage.aireMur), volume: Number(reglage.volume),
        renouvellement: Number(reglage.renouvellement), capaciteMobilier: Number(reglage.mobilier) * 1000 },
      dureeHeures: duree, pasSecondes: 60, sortieMinutes: 60 / IMAGES_PAR_HEURE
    });
    sim.couches = couches;
    sim.rs = rs;
    sim.scenario = scenario;
    sim.duree = duree;
    // Vraie météo : l'air dehors (la paroi, elle, voit le sol-air) pour le graphique et la lecture.
    sim.tAir = scenario.type === 'serie' ? sim.temps.map(function (h) { return T.temperatureExterieure(scenario.air, h); }) : null;
    let mn = Infinity, mx = -Infinity;
    sim.profils.forEach(function (pr, i) {
      pr.concat([sim.tExt[i], sim.tPiece[i]]).forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
    });
    if (mx - mn < 2) { mn -= 1; mx += 1; }
    echelleT = [Math.floor(mn - 0.5), Math.ceil(mx + 0.5)];
    position = Math.min(position, duree);
    $('#labo-temps').max = String(duree * IMAGES_PAR_HEURE);
    semerParticules();
    dessinerGraphe();
    dessinerTout();
    // L'onglet « Ma paroi » (affichage/paroi.js) lit la simulation pour le verdict.
    document.dispatchEvent(new CustomEvent('confort:labo', { detail: { sim: sim, reglage: reglage } }));
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
      // La poubelle, en bas de chaque couche (pas s'il n'en reste qu'une : un mur sans couche n'existe pas).
      if (couches.length > 1) s += poubelle(milieu, BAS - 20, k);
      // Couche tirée hors du mur : on montre qu'elle va partir.
      if (glisse && glisse.jeter && glisse.index === k) s += '<rect x="' + (x0 + 1.5).toFixed(1) + '" y="' + (HAUT + 1.5) + '" width="' + (x1 - x0 - 3).toFixed(1) + '" height="' + (BAS - HAUT - 3) + '" class="labo-jeter-cadre"/>';
    });

    // Dehors : soleil (ou lune la nuit) et température.
    const xs = L - DEHORS / 2;
    s += jour ? soleil(xs, HAUT + 24) : lune(xs, HAUT + 24);
    s += '<text x="' + xs + '" y="' + (HAUT + 92) + '" text-anchor="middle" class="labo-t-grande">' + nb(te, 1) + '°</text>';
    s += '<text x="' + xs + '" y="' + (HAUT + 112) + '" text-anchor="middle" class="labo-legende">' + (sim.scenario.type === 'serie' ? (sim.scenario.nature === 'plancher' ? 'sol sous la dalle' : 'dehors · sol-air ☀') : 'dehors') + '</text>';
    if (sim.tAir) s += '<text x="' + xs + '" y="' + (HAUT + 128) + '" text-anchor="middle" class="labo-legende">air ' + nb(sim.tAir[i], 1) + '°</text>';
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

  // Petite icône poubelle (cercle + seau + couvercle), cliquable : data-supprimer = n° de la couche.
  function poubelle(x, y, k) {
    return '<g class="labo-poubelle" data-supprimer="' + k + '" transform="translate(' + x.toFixed(1) + ' ' + y + ')">' +
      '<title>Retirer cette couche</title><circle r="12"/>' +
      '<path d="M-5.5 -4.5h11M-2 -4.5v-2h4v2M-4.2 -4.5l.8 9.5h6.8l.8-9.5M-1.2 -1.5v4.5M1.2 -1.5v4.5"/></g>';
  }
  function retirer(k) {
    if (A.paroi().couches.length <= 1) { BAO.notifier('Il faut au moins une couche dans le mur.'); return; }
    const nom = (A.paroi().couches[k] || {}).materiau;
    A.modifier(function (p) { p.couches.splice(k, 1); });
    selection = null;
    const m = A.materiaux().find(function (x) { return x.id === nom; });
    BAO.notifier((m ? m.nom.replace(/ \(.*\)$/, '') : 'Couche') + ' retirée du mur.');
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
    $('#labo-jour').textContent = sim.scenario.type === 'serie' ? So.dateDuJour(sim.scenario.jourDebut + Math.floor(h / 24)).nom : 'Jour ' + (Math.floor(h / 24) + 1);
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
    } else if (reglage.scenario === 'meteo') {
      const r = T.resumerSimulation(sim, 0), sc = sim.scenario;
      lecture = (sc.nature === 'plancher'
        ? 'Le sol sous la dalle reste à <b>' + nb(r.tExt.min, 1) + ' à ' + nb(r.tExt.max, 1) + ' °C</b> (H) : le plancher bas est le seul « froid » gratuit de la maison.'
        : 'À ' + esc(sc.ville.nom) + ', la face extérieure (' + (sc.nature === 'toiture' ? 'toit à ' + nb(reglage.pente) + '°' : 'façade ' + (ORIENTATIONS.find(function (o) { return o.id === Number(reglage.orientation); }) || {}).nom) + ', α = ' + nb(sc.alpha, 1) + ') voit une température sol-air qui monte à <b>' + nb(r.tExt.max, 1) + ' °C</b> ; la face intérieure, à <b>' + nb(r.tSi.max, 1) + ' °C</b>' +
          (r.dephasageObserve !== null ? ', <b>' + nb(r.dephasageObserve, 1) + ' h</b> après (matrices : ' + nb(d.dephasage, 1) + ' h)' : '') + '.') +
        ' Flux de pointe qui entre : <b>' + nb(r.flux.max, 1) + ' W/m²</b>.';
    } else {
      lecture = 'Le pic de chaleur arrive environ <b>' + nb(d.dephasage, 1) + ' h</b> après le pic dehors, réduit à <b>' + nb(d.amortissement * 100, 0) + ' %</b> de ce que donnerait U seul.';
    }
    if (sim.bilan) lecture += ' <span class="muet">Contrôle de conservation de l\'énergie : écart de ' + nb(sim.bilan.ecartRelatif * 100, 6) + ' %.</span>';
    $('#labo-mesures').innerHTML = html + '<p class="labo-lecture">' + lecture + '</p>';
  }

  function dessinerGraphe() {
    if (!sim) { $('#labo-graphe').innerHTML = ''; rendu = null; return; }
    const serie = function (v) { return sim.temps.map(function (t, i) { return { x: t, y: v[i] }; }); };
    const duree = sim.duree, vraie = sim.scenario.type === 'serie';
    const series = [
      { nom: vraie ? (sim.scenario.nature === 'plancher' ? 'Sol sous la dalle (H)' : 'Dehors, sol-air (air + soleil)') : 'Dehors', classe: 'gr-1', points: serie(sim.tExt) },
      { nom: reglage.piece === 'libre' ? 'Air de la pièce' : 'Pièce (fixée)', classe: 'gr-2', points: serie(sim.tPiece) },
      { nom: 'Face intérieure de la paroi', classe: 'gr-ref', points: serie(sim.tSi) }
    ];
    if (sim.tAir && sim.scenario.nature !== 'plancher') series.push({ nom: 'Air dehors (météo)', classe: 'gr-essai', points: serie(sim.tAir) });
    rendu = G.dessiner($('#labo-graphe'), {
      id: 'labo', titre: 'Températures pendant la simulation', unite: '°C',
      x: { min: 0, max: duree, pas: duree > 48 ? 24 : 12, format: function (v) { return vraie ? (v < duree ? 'J' + (v / 24 + 1) : '') : nb(v) + ' h'; },
        formatBulle: vraie ? function (v) { return So.dateDuJour(sim.scenario.jourDebut + Math.floor(v / 24)).nom + ' · ' + nb(v % 24) + ' h'; } : undefined },
      series: series
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
      '<button type="button" class="labo-retirer" data-labo="retirer" title="Retirer cette couche du mur">' + ICONE_POUBELLE + ' Retirer</button></div>';
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
    // Un choix à boutons (orientation, couleur, début) : data-mreglage = la clé, data-valeur = la valeur.
    const choix = function (cle, nom, liste, val) {
      return '<div class="champ labo-choix-bloc"><span class="etiquette">' + nom + '</span><div class="segments" role="group" aria-label="' + nom + '">' +
        liste.map(function (x) { return '<button type="button" data-mreglage="' + cle + '" data-valeur="' + x.id + '" aria-pressed="' + (String(x.id) === String(val)) + '"><span>' + esc(x.nom) + '</span></button>'; }).join('') + '</div></div>';
    };
    if (reglage.scenario === 'meteo') {
      const nature = A.nature(), v = ville();
      $('#labo-champs-scenario').innerHTML =
        '<label class="champ"><span class="etiquette">Ville (météo PVGIS)</span><select data-mselect="ville" aria-label="Ville">' +
          V.villes.map(function (x) { return '<option value="' + x.id + '"' + (x.id === v.id ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('') + '</select></label>' +
        choix('debut', 'À partir de', DEBUTS, reglage.debut) + champ('jours', 'Jours', 'j') +
        (nature === 'plancher'
          ? '<p class="aide" style="margin:0;flex-basis:100%">Plancher bas : la face extérieure est le <b>sol sous la dalle</b>, pris à la moyenne annuelle de l\'air, amortie et retardée (H, Méthode § 30). Pas de soleil.</p>'
          : choix('orientation', nature === 'toiture' ? 'Le pan regarde vers' : 'La façade regarde vers', ORIENTATIONS, reglage.orientation) +
            (nature === 'toiture' ? champ('pente', 'Pente du toit', '°') : '') +
            choix('couleur', 'Couleur extérieure (α)', X.couleurs.map(function (c) { return { id: c.id, nom: c.nom + ' ' + nb(c.alpha, 1) }; }), reglage.couleur) +
            '<p class="aide" style="margin:0;flex-basis:100%">La face extérieure voit la température <b>sol-air</b> : l\'air + le soleil absorbé (α × Rse × I) − le ciel froid (Méthode § 24 et § 36). Heure légale.</p>');
    } else {
      $('#labo-champs-scenario').innerHTML = reglage.scenario === 'echelon'
        ? champ('tAvant', 'Dehors avant', '°C') + champ('tApres', 'Dehors après', '°C') + champ('duree', 'Durée', 'h')
        : '<p class="aide" style="margin:0;flex-basis:100%">Journées de l\'atelier : ' + nb(onde.tMoyenne, 1) + ' ± ' + nb(onde.amplitude, 1) + ' °C, maximum à ' + nb(onde.heureMax, 1) + ' h (réglage « Une journée chaude », dans l\'atelier).</p>' + champ('duree', 'Durée', 'h');
    }
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

  const ICONE_POUBELLE = '<svg viewBox="-8 -8 16 16" width="16" height="16" aria-hidden="true"><path d="M-5.5 -4.5h11M-2 -4.5v-2h4v2M-4.2 -4.5l.8 9.5h6.8l.8-9.5M-1.2 -1.5v4.5M1.2 -1.5v4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function brancher() {
    const scene = $('#labo-scene');
    // Déplacer une couche existante (on attrape son nom), ou la retirer (poubelle).
    scene.addEventListener('pointerdown', function (e) {
      const bin = e.target.closest('[data-supprimer]');
      if (bin && sim) { e.preventDefault(); retirer(Number(bin.dataset.supprimer)); return; }
      const poignee = e.target.closest('[data-couche]');
      if (!poignee || !sim) return;
      glisse = { index: Number(poignee.dataset.couche), x: e.clientX, y: e.clientY, bouge: false, cible: null, jeter: false };
      scene.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    scene.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      if (Math.abs(e.clientX - glisse.x) > 5 || Math.abs(e.clientY - glisse.y) > 5) glisse.bouge = true;
      if (!glisse.bouge) return;
      // Tirée nettement au-dessus ou au-dessous du dessin : la couche sera retirée au lâcher.
      const r = document.querySelector('#labo-scene svg').getBoundingClientRect();
      glisse.jeter = A.paroi().couches.length > 1 && (e.clientY < r.top - 30 || e.clientY > r.bottom + 30);
      glisse.cible = glisse.jeter ? null : cibleInsertion(xSvg(e));
      dessinerScene();
    });
    scene.addEventListener('pointerup', function () {
      if (!glisse) return;
      const g = glisse;
      glisse = null;
      if (!g.bouge) { selection = selection === g.index ? null : g.index; dessinerScene(); dessinerEdition(); return; }
      if (g.jeter) { retirer(g.index); return; }
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
      if (b.dataset.labo === 'retirer') { retirer(k); return; }
      A.modifier(function (p) {
        const cs = p.couches;
        if (b.dataset.labo === 'interieur' && k > 0) { cs.splice(k - 1, 0, cs.splice(k, 1)[0]); selection = k - 1; }
        if (b.dataset.labo === 'exterieur' && k < cs.length - 1) { cs.splice(k + 1, 0, cs.splice(k, 1)[0]); selection = k + 1; }
      });
    });

    $('#labo-jouer').addEventListener('click', function () { if (enCours) arreter(); else lancer(); });
    $('#labo-zero').addEventListener('click', function () { arreter(); position = 0; semerParticules(); dessinerTout(); });
    $('#labo-temps').addEventListener('input', function (e) { arreter(); position = Number(e.target.value) / IMAGES_PAR_HEURE; dessinerScene(); dessinerHorloge(); dessinerMesures(); });

    $('#labo').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-scenario], button[data-piece], button[data-vitesse], button[data-mreglage]');
      if (!b) return;
      if (b.dataset.mreglage) { const v = b.dataset.valeur; reglage[b.dataset.mreglage] = isFinite(Number(v)) && v !== '' ? Number(v) : v; }
      if (b.dataset.scenario) { reglage.scenario = b.dataset.scenario; position = 0; }
      if (b.dataset.piece) reglage.piece = b.dataset.piece;
      if (b.dataset.vitesse) reglage.vitesse = Number(b.dataset.vitesse);
      sauverReglage();
      dessinerReglages();
      if (!b.dataset.vitesse) recalculer();
    });
    $('#labo').addEventListener('change', function (e) {
      if (e.target.dataset.mselect === 'ville') { reglage.ville = e.target.value; sauverReglage(); position = 0; recalculer(); return; }
      const cle = e.target.dataset.reglage;
      if (!cle) return;
      const v = BAO.lireNombre(e.target.value);
      const temperature = ['tAvant', 'tApres', 'tInterieure'].indexOf(cle) !== -1;
      const positif = ['duree', 'aireMur', 'volume', 'jours'].indexOf(cle) !== -1;
      if (!isFinite(v) || (positif && v <= 0) || (!temperature && v < 0) || (cle === 'duree' && v > 240) || (cle === 'jours' && v > 14) || (cle === 'pente' && v > 70)) {
        BAO.notifier('Valeur invalide.'); dessinerReglages(); return;
      }
      reglage[cle] = v;
      sauverReglage();
      recalculer();
    });

    document.addEventListener('confort:paroi', function () {
      if (selection !== null && selection >= A.paroi().couches.length) selection = null;
      dessinerReglages();   // la nature (mur / toiture / plancher) change les réglages de la vraie météo
      recalculer();
    });
    // La ville du projet a changé : le labo « vraie météo » suit, s'il n'a pas sa propre ville.
    document.addEventListener('confort:projet', function () { if (reglage.scenario === 'meteo' && !reglage.ville) { dessinerReglages(); recalculer(); } });
    document.addEventListener('confort:donnees', dessinerPalette);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { lirePalette(); dessinerTout(); });
    window.addEventListener('resize', function () { if (!enCours) { semerParticules(); dessinerScene(); } });
    document.querySelectorAll('[data-onglet="paroi"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { semerParticules(); dessinerScene(); }, 0); }); });
  }

  lirePalette();
  dessinerPalette();
  dessinerReglages();
  brancher();
  lancerCalcul();
})();
