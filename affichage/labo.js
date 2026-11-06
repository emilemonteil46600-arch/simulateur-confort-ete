/* ==========================================================
   CONFORT D'ÉTÉ — LE LABO ANIMÉ (onglet Atelier parois)
   ----------------------------------------------------------
   Affichage et animation seulement : AUCUN calcul thermique ici.
   La simulation vient de ConfortTransitoire.simuler (calcul/calcul-transitoire.js) ;
   la paroi est celle de l'atelier (window.ConfortAtelier).
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

  // Dimensions du dessin (unités du viewBox). Sur un écran étroit, le dessin est moins large
  // (donc tout paraît plus grand une fois mis à l'échelle).
  let L = 900, PIECE = 150, DEHORS = 150, MUR = 600;
  const H = 330;
  function adapterDimensions() {
    const etroit = ($('#labo-scene').clientWidth || 900) < 640;
    L = etroit ? 540 : 900;
    PIECE = DEHORS = etroit ? 92 : 150;
    MUR = L - PIECE - DEHORS;
  }
  const HAUT = 64, BAS = 300;                    // le mur en hauteur
  const BANDE = 22;                              // bandeau des noms de couches (zone à glisser)
  const IMAGES_PAR_HEURE = 6;                    // une image toutes les 10 min de simulation

  // Les couches qu'on ajoute d'un clic (côté intérieur), avec une épaisseur de départ (m).
  const PALETTE = [
    { materiau: 'plaque-platre', e: 0.013, nom: 'BA13' },
    { materiau: 'enduit-platre', e: 0.01, nom: 'Enduit plâtre' },
    { materiau: 'laine-verre', e: 0.10, nom: 'Laine de verre' },
    { materiau: 'laine-roche', e: 0.10, nom: 'Laine de roche' },
    { materiau: 'pse', e: 0.10, nom: 'PSE' },
    { materiau: 'fibre-bois-rigide', e: 0.10, nom: 'Fibre de bois' },
    { materiau: 'beton-arme', e: 0.18, nom: 'Béton' },
    { materiau: 'parpaing', e: 0.20, nom: 'Parpaing' },
    { materiau: 'brique-pleine', e: 0.22, nom: 'Brique pleine' },
    { materiau: 'pierre-calcaire', e: 0.40, nom: 'Pierre' },
    { materiau: 'bois-resineux', e: 0.05, nom: 'Bois' },
    { materiau: 'enduit-ciment', e: 0.015, nom: 'Enduit ext.' }
  ];
  const VITESSES = [{ id: 1, nom: '1 h/s' }, { id: 3, nom: '3 h/s' }, { id: 8, nom: '8 h/s' }];
  const SCENARIOS = [{ id: 'echelon', nom: 'Coup de chaud' }, { id: 'journee', nom: 'Journées d\'été' }];
  const PIECES = [{ id: 'fixe', nom: 'Climatisée (T fixe)' }, { id: 'libre', nom: 'Libre (sans clim)' }];

  // Réglages du labo (gardés dans le navigateur, pas des données de calcul à sauvegarder).
  const CLE = 'bao.confort.labo.affichage';
  const DEFAUT = {
    scenario: 'echelon', tAvant: 20, tApres: 35, duree: 48,
    piece: 'fixe', tInterieure: 20, aireMur: 10, volume: 50, renouvellement: 0.5, mobilier: 0,
    vitesse: 3
  };
  let reglage = Object.assign({}, DEFAUT, BAO.lire(CLE, {}) || {});
  function sauverReglage() { try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch (e) { /* rien */ } }

  let sim = null;           // résultat de la simulation
  let position = 0;         // en heures
  let enCours = false;
  let dernierInstant = null;
  let selection = null;     // index de la couche sélectionnée
  let glisse = null;        // glisser-déposer en cours
  let rendu = null;         // échelles du graphique (curseur)
  let echelleT = null;      // [Tmin, Tmax] de toute la simulation

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
    dessinerGraphe();
    dessinerTout();
  }

  let attente = null;
  function recalculer() { clearTimeout(attente); attente = setTimeout(lancerCalcul, 120); }

  /* ==========================================================
     LES COULEURS (température → couleur, froid bleu, chaud rouge)
     ========================================================== */
  function couleurVar(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }
  function hexVersRvb(h) { const v = parseInt(h.replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  let palette = null;
  function lirePalette() {
    palette = ['--chaleur-froid', '--chaleur-neutre', '--chaleur-chaud'].map(function (n) { return hexVersRvb(couleurVar(n) || '#888888'); });
  }
  function couleur(t) {
    const f = Math.max(0, Math.min(1, (t - echelleT[0]) / (echelleT[1] - echelleT[0])));
    const a = f < 0.5 ? palette[0] : palette[1], b = f < 0.5 ? palette[1] : palette[2];
    const k = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }).join(',') + ')';
  }

  /* ==========================================================
     LE MUR EN COUPE (SVG)
     ========================================================== */
  // Largeur dessinée de chaque couche : proportionnelle à l'épaisseur, avec un minimum pour rester cliquable.
  function largeursCouches(couches) {
    const total = couches.reduce(function (s, c) { return s + c.e; }, 0);
    const l = couches.map(function (c) { return Math.max(26, c.e / total * MUR); });
    const somme = l.reduce(function (s, x) { return s + x; }, 0);
    const bords = [PIECE];
    l.forEach(function (x) { bords.push(bords[bords.length - 1] + x * MUR / somme); });
    return bords;
  }

  function imageCourante() {
    const i = Math.max(0, Math.min(sim.temps.length - 1, Math.round(position * IMAGES_PAR_HEURE)));
    return i;
  }

  function svgCoupe() {
    const p = A.paroi();
    if (!sim) return '<div class="alerte attention">Complète les couches de la paroi pour lancer le labo.</div>';
    const i = imageCourante();
    const couches = sim.couches;
    const bords = largeursCouches(couches);
    const xMur = function (x) {   // position réelle dans le mur (m) → pixel
      let cumul = 0;
      for (let k = 0; k < couches.length; k++) {
        if (x <= cumul + couches[k].e + 1e-12) return bords[k] + (x - cumul) / couches[k].e * (bords[k + 1] - bords[k]);
        cumul += couches[k].e;
      }
      return bords[bords.length - 1];
    };
    const yT = function (t) { return BAS - (t - echelleT[0]) / (echelleT[1] - echelleT[0]) * (BAS - HAUT); };
    const ta = sim.tPiece[i], te = sim.tExt[i], q = sim.fluxInt[i];
    const profil = sim.profils[i];

    let s = '<svg class="labo-svg" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Coupe du mur : température dans l\'épaisseur et flux qui entre dans la pièce">';
    // L'air de la pièce et l'air extérieur, colorés par leur température.
    s += '<rect x="0" y="' + HAUT + '" width="' + PIECE + '" height="' + (BAS - HAUT) + '" fill="' + couleur(ta) + '" class="labo-air"/>';
    s += '<rect x="' + (L - DEHORS) + '" y="' + HAUT + '" width="' + DEHORS + '" height="' + (BAS - HAUT) + '" fill="' + couleur(te) + '" class="labo-air"/>';
    // Les tranches du mur, chacune de sa couleur : c'est la carte des températures.
    sim.cellules.forEach(function (c, k) {
      const x0 = xMur(c.x0), x1 = xMur(c.x1);
      s += '<rect x="' + x0.toFixed(2) + '" y="' + HAUT + '" width="' + (x1 - x0 + 0.6).toFixed(2) + '" height="' + (BAS - HAUT) + '" fill="' + couleur(profil[k]) + '"/>';
    });
    // Les limites et les noms des couches (le bandeau sert à glisser).
    couches.forEach(function (c, k) {
      const x0 = bords[k], x1 = bords[k + 1];
      const isolant = c.materiau.famille === 'isolant';
      s += '<rect x="' + x0.toFixed(1) + '" y="' + HAUT + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (BAS - HAUT) + '" class="labo-couche' + (isolant ? ' isolant' : '') + (selection === k ? ' choisie' : '') + '"/>';
      s += '<g class="labo-poignee' + (selection === k ? ' choisie' : '') + (glisse && glisse.index === k && glisse.bouge ? ' tenue' : '') + '" data-couche="' + k + '">' +
        '<rect x="' + (x0 + 1).toFixed(1) + '" y="' + (HAUT - BANDE - 4) + '" width="' + (x1 - x0 - 2).toFixed(1) + '" height="' + BANDE + '" rx="6"/>' +
        '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (HAUT - BANDE / 2 - 0.5).toFixed(1) + '" text-anchor="middle">' + esc(nomCourt(c.materiau.nom, x1 - x0)) + '</text>' +
        '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (BAS + 16) + '" text-anchor="middle" class="labo-ep">' + nb(c.e * 100, c.e < 0.02 ? 1 : 0) + ' cm</text></g>';
    });
    // Repère de la température : graduations à gauche.
    for (let t = Math.ceil(echelleT[0] / 5) * 5; t <= echelleT[1]; t += 5) {
      s += '<line x1="' + PIECE + '" x2="' + (L - DEHORS) + '" y1="' + yT(t).toFixed(1) + '" y2="' + yT(t).toFixed(1) + '" class="labo-grille"/>';
      s += '<line x1="0" x2="' + PIECE + '" y1="' + yT(t).toFixed(1) + '" y2="' + yT(t).toFixed(1) + '" class="labo-grille"/>';
      s += '<text x="6" y="' + (yT(t) - 3).toFixed(1) + '" class="labo-grad">' + t + ' °C</text>';
    }
    // La courbe θ(x) : air de la pièce → face intérieure → tranches → face extérieure → air extérieur.
    const pts = [[8, ta], [PIECE, sim.tSi[i]]];
    sim.cellules.forEach(function (c, k) { pts.push([xMur(c.xc), profil[k]]); });
    pts.push([L - DEHORS, sim.tSe[i]], [L - 8, te]);
    const chemin = pts.map(function (pt) { return pt[0].toFixed(1) + ',' + yT(pt[1]).toFixed(1); }).join(' ');
    s += '<polyline points="' + chemin + '" class="labo-courbe-halo"/><polyline points="' + chemin + '" class="labo-courbe"/>';
    // Le flux qui entre dans la pièce : une flèche dont la longueur suit |q|.
    s += fleche(PIECE - 6, (HAUT + BAS) / 2 + 40, q, 'entre dans la pièce');
    // Étiquettes des airs.
    s += etiquette(PIECE / 2, HAUT + 22, 'Pièce', ta);
    s += etiquette(L - DEHORS / 2, HAUT + 22, 'Dehors', te);
    if (glisse && glisse.bouge && glisse.cible !== null) {
      const xc = bords[glisse.cible];
      s += '<line x1="' + xc + '" x2="' + xc + '" y1="' + (HAUT - BANDE - 8) + '" y2="' + (BAS + 4) + '" class="labo-insertion"/>';
    }
    s += '<text x="' + (PIECE / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="labo-grad">intérieur</text>';
    s += '<text x="' + (L - DEHORS / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="labo-grad">extérieur</text>';
    s += '</svg>';
    return s;
  }

  function nomCourt(nom, largeur) {
    const max = Math.floor(largeur / 7);
    const court = nom.replace(/ \(.*\)$/, '');
    return court.length <= max ? court : (max > 3 ? court.slice(0, max - 1) + '…' : '');
  }

  function etiquette(x, y, nom, t) {
    const w = Math.min(104, PIECE - 8);
    return '<g class="labo-etiquette"><rect x="' + (x - w / 2) + '" y="' + (y - 15) + '" width="' + w + '" height="24" rx="12"/>' +
      '<text x="' + x + '" y="' + (y + 2) + '" text-anchor="middle">' + nom + ' ' + nb(t, 1) + ' °C</text></g>';
  }

  // Flèche horizontale dans la pièce : vers la gauche si la chaleur entre (q > 0), vers la droite si elle sort.
  function fleche(xMurInt, y, q, texte) {
    const longueur = Math.min(PIECE - 30, 14 + Math.abs(q) * 9);
    const sens = q >= 0 ? -1 : 1;
    const x1 = q >= 0 ? xMurInt : xMurInt - longueur, x2 = q >= 0 ? xMurInt - longueur : xMurInt;
    const pointe = q >= 0 ? x2 : x2;
    let s = '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" class="labo-fleche"/>';
    s += '<polygon points="' + pointe + ',' + y + ' ' + (pointe - sens * 10) + ',' + (y - 6) + ' ' + (pointe - sens * 10) + ',' + (y + 6) + '" class="labo-pointe"/>';
    s += '<text x="' + (xMurInt - 4) + '" y="' + (y + 22) + '" text-anchor="end" class="labo-flux">' + (q >= 0 ? '' : '−') + nb(Math.abs(q), 1) + ' W/m²</text>';
    s += '<text x="' + (xMurInt - 4) + '" y="' + (y + 36) + '" text-anchor="end" class="labo-grad">' + (q >= 0 ? texte : 'sort de la pièce') + '</text>';
    return s;
  }

  /* ==========================================================
     LE RESTE DE L'ÉCRAN
     ========================================================== */
  function dessinerHorloge() {
    if (!sim) return;
    const i = imageCourante();
    const h = sim.temps[i];
    const jour = Math.floor(h / 24) + 1, hh = Math.floor(h % 24), mm = Math.round((h % 1) * 60) % 60;
    $('#labo-jour').textContent = 'Jour ' + jour;
    $('#labo-heure').textContent = hh + ' h ' + String(mm).padStart(2, '0');
    $('#labo-dehors').textContent = 'dehors ' + nb(sim.tExt[i], 1) + ' °C';
    $('#labo-temps').value = String(i);
    if (rendu) {
      const x = rendu.X(h);
      const ligne = document.querySelector('#labo-graphe .labo-curseur');
      if (ligne) { ligne.setAttribute('x1', x); ligne.setAttribute('x2', x); }
    }
  }

  function dessinerMesures() {
    if (!sim) { $('#labo-mesures').innerHTML = ''; return; }
    const i = imageCourante();
    const tuile = function (nom, val, dit) { return '<div class="tuile"><span class="tuile-nom">' + nom + '</span><span class="tuile-val">' + val + '</span>' + (dit ? '<span class="tuile-dit">' + dit + '</span>' : '') + '</div>'; };
    const d = P.caracteristiquesDynamiques(sim.couches, sim.rs);
    let html = '<div class="tuiles">' +
      tuile('Flux entrant maintenant', nb(sim.fluxInt[i], 1) + ' <small>W/m²</small>', sim.fluxInt[i] >= 0 ? 'la chaleur entre' : 'la chaleur sort') +
      tuile('Chaleur entrée depuis le début', nb(sim.energieInt[i], 0) + ' <small>Wh/m²</small>', '') +
      tuile('Face intérieure', nb(sim.tSi[i], 1) + ' <small>°C</small>', '') +
      tuile(reglage.piece === 'libre' ? 'Air de la pièce' : 'Pièce (fixée)', nb(sim.tPiece[i], 1) + ' <small>°C</small>', reglage.piece === 'libre' ? 'max ' + nb(Math.max.apply(null, sim.tPiece), 1) + ' °C' : '') + '</div>';
    if (reglage.scenario === 'echelon') {
      const t50 = T.tempsDeReponse(sim.temps, reglage.piece === 'libre' ? sim.tPiece : sim.tSi, 0.5);
      const regime = d.U * (Number(reglage.tApres) - Number(reglage.tInterieure));
      html += '<p class="aide labo-lecture">' + (reglage.piece === 'libre'
        ? 'La pièce fait la moitié du chemin vers sa température finale en <b>' + (t50 === null ? 'plus de ' + reglage.duree + ' h' : nb(t50, 1) + ' h') + '</b>.'
        : 'La face intérieure fait la moitié de sa montée en <b>' + (t50 === null ? 'plus de ' + reglage.duree + ' h' : nb(t50, 1) + ' h') + '</b>. ' +
          'Au bout d\'un temps infini, le flux tend vers U × ΔT = ' + nb(d.U, 3) + ' × ' + nb(Number(reglage.tApres) - Number(reglage.tInterieure), 1) + ' = <b>' + nb(regime, 1) + ' W/m²</b> (le régime permanent de l\'hiver).') + '</p>';
    } else {
      html += '<p class="aide labo-lecture">Régime établi après 4 jours de préchauffage. Le pic de flux arrive environ <b>' + nb(d.dephasage, 1) + ' h</b> après le pic dehors (déphasage), réduit à <b>' + nb(d.amortissement * 100, 0) + ' %</b> de ce que donnerait U seul (amortissement).</p>';
    }
    if (sim.bilan) html += '<p class="aide labo-lecture">Contrôle de conservation de l\'énergie : écart de ' + nb(sim.bilan.ecartRelatif * 100, 6) + ' %.</p>';
    $('#labo-mesures').innerHTML = html;
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
    $('#labo-edition').innerHTML = '<div class="labo-outil"><b>Couche ' + (selection + 1) + '</b>' +
      '<select data-labo="materiau" aria-label="Matériau">' + options + '</select>' +
      '<label class="labo-ep-curseur">Épaisseur <input type="range" min="0.5" max="50" step="0.5" value="' + (c.e * 100) + '" data-labo="e"><output>' + nb(c.e * 100, 1) + ' cm</output></label>' +
      '<button type="button" class="bouton discret" data-labo="interieur" title="Vers l\'intérieur">← intérieur</button>' +
      '<button type="button" class="bouton discret" data-labo="exterieur" title="Vers l\'extérieur">extérieur →</button>' +
      '<button type="button" class="bouton discret danger" data-labo="retirer">✕ Retirer</button></div>';
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
      ? champ('tAvant', 'Avant', '°C') + champ('tApres', 'Après le coup de chaud', '°C') + champ('duree', 'Durée', 'h')
      : '<p class="aide" style="margin:0">Onde de l\'atelier : ' + nb(onde.tMoyenne, 1) + ' ± ' + nb(onde.amplitude, 1) + ' °C, maximum à ' + nb(onde.heureMax, 1) + ' h (réglable plus bas, « Une journée chaude »).</p>' + champ('duree', 'Durée', 'h');
    $('#labo-champs-piece').innerHTML = champ('tInterieure', reglage.piece === 'libre' ? 'T de départ' : 'T de la pièce', '°C') +
      (reglage.piece === 'libre' ? champ('aireMur', 'Surface de ce mur', 'm²') + champ('volume', 'Volume de la pièce', 'm³') +
        champ('renouvellement', 'Renouvellement d\'air', 'vol/h') + champ('mobilier', 'Mobilier (H)', 'kJ/K') : '');
  }

  function dessinerPalette() {
    $('#labo-palette').innerHTML = '<span class="aide">Ajouter côté intérieur :</span>' + PALETTE.map(function (x, i) {
      return '<button type="button" class="puce-couche" data-palette="' + i + '">+ ' + esc(x.nom) + '</button>';
    }).join('');
  }

  function dessinerScene() { adapterDimensions(); $('#labo-scene').innerHTML = svgCoupe(); }

  function dessinerTout() {
    dessinerScene();
    dessinerHorloge();
    dessinerMesures();
    dessinerEdition();
  }

  /* ==========================================================
     LE TEMPS QUI PASSE
     ========================================================== */
  function boucle(instant) {
    if (!enCours) return;
    if (dernierInstant !== null && sim) {
      position += (instant - dernierInstant) / 1000 * Number(reglage.vitesse);
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
    $('#labo-jouer').textContent = '⏸ Pause';
    requestAnimationFrame(boucle);
  }
  function arreter() { enCours = false; $('#labo-jouer').textContent = '▶ Lancer'; }

  /* ==========================================================
     GLISSER-DÉPOSER DES COUCHES
     ========================================================== */
  function xSvg(e) {
    const svg = document.querySelector('#labo-scene svg');
    const r = svg.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * L;
  }
  function cibleInsertion(x) {
    const bords = largeursCouches(sim.couches);
    let meilleur = 0, ecart = Infinity;
    bords.forEach(function (b, k) { if (Math.abs(b - x) < ecart) { ecart = Math.abs(b - x); meilleur = k; } });
    return meilleur;
  }

  function brancher() {
    const scene = $('#labo-scene');
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
      BAO.notifier('Couche déplacée : regarde ce qui change quand tu relances le temps.');
    });

    $('#labo-palette').addEventListener('click', function (e) {
      const b = e.target.closest('[data-palette]');
      if (!b) return;
      const x = PALETTE[Number(b.dataset.palette)];
      A.modifier(function (p) { p.couches.unshift({ materiau: x.materiau, e: x.e }); });
      selection = 0;
    });

    $('#labo-edition').addEventListener('input', function (e) {
      if (e.target.dataset.labo !== 'e') return;
      e.target.nextElementSibling.textContent = nb(Number(e.target.value), 1) + ' cm';
    });
    $('#labo-edition').addEventListener('change', function (e) {
      const k = selection;
      if (e.target.dataset.labo === 'e') A.modifier(function (p) { p.couches[k].e = Number(e.target.value) / 100; });
      if (e.target.dataset.labo === 'materiau') A.modifier(function (p) { p.couches[k].materiau = e.target.value; });
    });
    $('#labo-edition').addEventListener('click', function (e) {
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
    $('#labo-zero').addEventListener('click', function () { arreter(); position = 0; dessinerTout(); });
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
      const positif = ['duree', 'aireMur', 'volume'].indexOf(cle) !== -1;
      if (!isFinite(v) || (positif && v <= 0) || v < 0 && cle !== 'tAvant' && cle !== 'tApres' && cle !== 'tInterieure' || (cle === 'duree' && v > 240)) {
        BAO.notifier('Valeur invalide.'); dessinerReglages(); return;
      }
      reglage[cle] = v;
      sauverReglage();
      recalculer();
    });

    // La paroi de l'atelier a changé (tableau, modèle, matériaux…) : on relance le calcul.
    document.addEventListener('confort:paroi', function () {
      const n = A.paroi().couches.length;
      if (selection !== null && selection >= n) selection = null;
      recalculer();
    });
    // Le thème clair / sombre change les couleurs.
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { lirePalette(); dessinerTout(); });
    window.addEventListener('resize', function () { if (!enCours) dessinerScene(); });
    // L'onglet devient visible : la largeur réelle est enfin connue.
    document.querySelectorAll('[data-onglet="atelier"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(dessinerScene, 0); }); });
  }

  lirePalette();
  dessinerPalette();
  dessinerReglages();
  brancher();
  lancerCalcul();
})();
