/* ==========================================================
   CONFORT D'ÉTÉ — LA MAISON EN 3D (SVG fait main, sans bibliothèque)
   ----------------------------------------------------------
   Dessin seulement : AUCUN calcul thermique. Les dimensions viennent du projet
   et de ConfortBatiment (hauteur du toit…).

   Comment on dessine de la 3D avec du SVG (2D) :
   1. Chaque face de la maison est un polygone de points 3D (x = Est, y = Nord, z = haut, en mètres).
   2. La caméra est repérée par son azimut θ (d'où elle regarde, depuis le Nord, sens horaire)
      et sa hauteur φ (0° = à l'horizontale, 90° = vue de dessus).
      Vecteur « vers la caméra »   c = (sin θ·cos φ, cos θ·cos φ, sin φ)
      Vecteur « droite de l'écran » r = (−cos θ, sin θ, 0)
        (on regarde dans la direction −c ; la droite du spectateur est −c tournée de 90° dans le sens horaire)
      Vecteur « haut de l'écran »   h = (−sin φ·sin θ, −sin φ·cos θ, cos φ)
   3. Projection orthogonale (pas de perspective) : un point P s'affiche en
      x écran = P·r ,  y écran = −P·h   (produits scalaires, puis mise à l'échelle).
   4. Une face n'est visible que si sa normale n regarde la caméra : n·c > 0.
      La maison étant un volume convexe, cela suffit à cacher les faces arrière.
   5. Ombrage : plus une face est tournée vers une lumière fixe L, plus elle est claire
      (on assombrit de 0,3 × (1 − n·L)). Le vrai soleil arrive à l'étape 2.
   ========================================================== */
(function (global) {
  'use strict';

  const B = global.ConfortBatiment;
  const RAD = Math.PI / 180;
  const LARGEUR = 640, HAUTEUR = 440;
  const LUMIERE = normaliser([Math.sin(200 * RAD) * Math.cos(50 * RAD), Math.cos(200 * RAD) * Math.cos(50 * RAD), Math.sin(50 * RAD)]);

  /* ---------- Petits outils de vecteurs ---------- */
  function plus(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function moins(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function fois(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function scalaire(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vectoriel(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function normaliser(a) { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
  function centre(pts) { return fois(pts.reduce(plus, [0, 0, 0]), 1 / pts.length); }

  /* ---------- 1. La maison en polygones 3D ---------- */

  // Repère de la maison : eu le long des façades A/C (vers la façade B), ev vers la façade A.
  function repere(azimutA) {
    const a = azimutA * RAD;
    return { eu: [Math.cos(a), -Math.sin(a), 0], ev: [Math.sin(a), Math.cos(a), 0] };
  }

  // Normale extérieure d'un polygone : produit vectoriel de deux arêtes, tournée vers l'extérieur
  // (à l'opposé du centre de la maison).
  function normaleExterieure(pts, centreMaison) {
    let n = normaliser(vectoriel(moins(pts[1], pts[0]), moins(pts[2], pts[0])));
    if (scalaire(n, moins(centre(pts), centreMaison)) < 0) n = fois(n, -1);
    return n;
  }

  function construire(projet) {
    const g = projet.geometrie;
    const L = Number(g.longueur), l = Number(g.largeur), Hm = B.hauteurMurs(g), h = B.hauteurToit(g);
    const R = repere(Number(g.orientation));
    const P = function (u, v, z) { return plus(plus(fois(R.eu, u), fois(R.ev, v)), [0, 0, z]); };
    const c = [0, 0, (Hm + h) / 2];
    const faces = [];
    const ajouter = function (type, id, pts) { faces.push({ type: type, id: id, pts: pts, n: normaleExterieure(pts, c) }); };

    // Les quatre murs (les pignons B et D sont des pentagones pour un toit à 2 pans).
    const sommet = g.toit === 'deux-pans' ? h : 0;
    ajouter('mur', 'A', [P(-L / 2, l / 2, 0), P(L / 2, l / 2, 0), P(L / 2, l / 2, Hm), P(-L / 2, l / 2, Hm)]);
    ajouter('mur', 'C', [P(L / 2, -l / 2, 0), P(-L / 2, -l / 2, 0), P(-L / 2, -l / 2, Hm), P(L / 2, -l / 2, Hm)]);
    const pignon = function (u, sens) {
      const pts = [P(u, sens * l / 2, 0), P(u, -sens * l / 2, 0), P(u, -sens * l / 2, Hm)];
      if (sommet > 0) pts.push(P(u, 0, Hm + sommet));
      pts.push(P(u, sens * l / 2, Hm));
      return pts;
    };
    ajouter('mur', 'B', pignon(L / 2, 1));
    ajouter('mur', 'D', pignon(-L / 2, -1));

    // La toiture.
    const z = Hm, zt = Hm + h;
    if (g.toit === 'plat' || h <= 0) {
      ajouter('toit', 'T', [P(-L / 2, -l / 2, z), P(L / 2, -l / 2, z), P(L / 2, l / 2, z), P(-L / 2, l / 2, z)]);
    } else if (g.toit === 'deux-pans') {
      ajouter('toit', 'T', [P(-L / 2, l / 2, z), P(L / 2, l / 2, z), P(L / 2, 0, zt), P(-L / 2, 0, zt)]);
      ajouter('toit', 'T', [P(L / 2, -l / 2, z), P(-L / 2, -l / 2, z), P(-L / 2, 0, zt), P(L / 2, 0, zt)]);
    } else if (L >= l) {
      const r = (L - l) / 2;
      ajouter('toit', 'T', [P(-L / 2, l / 2, z), P(L / 2, l / 2, z), P(r, 0, zt), P(-r, 0, zt)]);
      ajouter('toit', 'T', [P(L / 2, -l / 2, z), P(-L / 2, -l / 2, z), P(-r, 0, zt), P(r, 0, zt)]);
      ajouter('toit', 'T', [P(L / 2, l / 2, z), P(L / 2, -l / 2, z), P(r, 0, zt)]);
      ajouter('toit', 'T', [P(-L / 2, -l / 2, z), P(-L / 2, l / 2, z), P(-r, 0, zt)]);
    } else {
      const r = (l - L) / 2;
      ajouter('toit', 'T', [P(L / 2, l / 2, z), P(L / 2, -l / 2, z), P(0, -r, zt), P(0, r, zt)]);
      ajouter('toit', 'T', [P(-L / 2, -l / 2, z), P(-L / 2, l / 2, z), P(0, r, zt), P(0, -r, zt)]);
      ajouter('toit', 'T', [P(-L / 2, l / 2, z), P(L / 2, l / 2, z), P(0, r, zt)]);
      ajouter('toit', 'T', [P(L / 2, -l / 2, z), P(-L / 2, -l / 2, z), P(0, -r, zt)]);
    }

    // Les fenêtres de chaque façade (dessin seulement : leur surface vient de la saisie).
    const fenetres = [];
    const cadres = {
      A: { o: P(0, l / 2, 0), t: R.eu, n: R.ev, W: L },
      C: { o: P(0, -l / 2, 0), t: fois(R.eu, -1), n: fois(R.ev, -1), W: L },
      B: { o: P(L / 2, 0, 0), t: fois(R.ev, -1), n: R.eu, W: l },
      D: { o: P(-L / 2, 0, 0), t: R.ev, n: fois(R.eu, -1), W: l }
    };
    Object.keys(cadres).forEach(function (f) {
      const fa = projet.facades[f] || {};
      dispositionFenetres(Number(fa.vitrage) || 0, cadres[f].W, g).forEach(function (w) {
        const k = cadres[f];
        const decale = fois(k.n, 0.03);
        const pt = function (x, zz) { return plus(plus(plus(k.o, fois(k.t, x)), [0, 0, zz]), decale); };
        fenetres.push({ facade: f, n: k.n, protection: fa.protection || 'aucune', w: w, pt: pt, avant: k.n });
      });
    });

    const empreinte = [P(-L / 2, l / 2, 0), P(L / 2, l / 2, 0), P(L / 2, -l / 2, 0), P(-L / 2, -l / 2, 0)];
    return { faces: faces, fenetres: fenetres, empreinte: empreinte, rayonSol: Math.hypot(L, l) / 2 + 2.5, hauteur: Hm + h, Hm: Hm };
  }

  // Répartit la surface vitrée d'une façade en fenêtres régulières, niveau par niveau.
  // Fenêtres de 1,35 m de haut (allège 0,9 m) ; si la façade est très vitrée : baies de (he − 0,5) m.
  function dispositionFenetres(surface, W, g) {
    if (!(surface > 0) || !(W > 0)) return [];
    const he = Number(g.hauteurEtage), n = Number(g.niveaux);
    const parNiveau = surface / n;
    let hw = Math.min(1.35, he - 0.6), allege = 0.9;
    if (parNiveau / hw > 0.6 * W) { hw = he - 0.5; allege = 0.1; }
    const largeurTotale = Math.min(parNiveau / hw, 0.9 * W);
    const k = Math.max(1, Math.round(largeurTotale / 1.6));
    const w = largeurTotale / k;
    const liste = [];
    for (let niv = 0; niv < n; niv++) {
      for (let i = 0; i < k; i++) {
        const x = -W / 2 + W * (i + 0.5) / k;
        liste.push({ x0: x - w / 2, x1: x + w / 2, z0: niv * he + allege, z1: niv * he + allege + hw });
      }
    }
    return liste;
  }

  /* ---------- 2. La caméra ---------- */

  function camera(theta, phi) {
    const t = theta * RAD, p = phi * RAD;
    return {
      c: [Math.sin(t) * Math.cos(p), Math.cos(t) * Math.cos(p), Math.sin(p)],
      r: [-Math.cos(t), Math.sin(t), 0],
      h: [-Math.sin(p) * Math.sin(t), -Math.sin(p) * Math.cos(t), Math.cos(p)]
    };
  }

  /* ---------- 3. Le dessin ---------- */

  function nb(v, d) { return global.BAO ? global.BAO.nombre(v, d) : String(v); }

  function rendreSVG(projet, vue, selection) {
    const m = construire(projet);
    const cam = camera(vue.theta, vue.phi);
    const R = m.rayonSol;
    // Échelle : le sol (cercle de rayon R) et la hauteur de la maison doivent tenir dans le cadre.
    const s = vue.zoom * Math.min(LARGEUR * 0.92 / (2 * R), HAUTEUR * 0.86 / (2 * R * Math.sin(vue.phi * RAD) + m.hauteur * Math.cos(vue.phi * RAD)));
    const yMilieu = (m.hauteur * Math.cos(vue.phi * RAD)) / 2;
    const ecran = function (p) { return [LARGEUR / 2 + s * scalaire(p, cam.r), HAUTEUR / 2 - s * (scalaire(p, cam.h) - yMilieu)]; };
    const chemin = function (pts) { return pts.map(function (p) { const e = ecran(p); return e[0].toFixed(1) + ',' + e[1].toFixed(1); }).join(' '); };

    let svg = '<svg class="maison3d" viewBox="0 0 ' + LARGEUR + ' ' + HAUTEUR + '" role="img" aria-label="Maquette 3D de la maison. Glisse pour tourner, clique sur une façade pour la modifier.">';
    svg += '<defs><linearGradient id="m-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-ciel-haut"/><stop offset="1" class="m-ciel-bas"/></linearGradient></defs>';
    svg += '<rect width="' + LARGEUR + '" height="' + HAUTEUR + '" fill="url(#m-ciel)"/>';

    // Le sol et la rose des vents.
    const cercle = [];
    for (let i = 0; i < 64; i++) cercle.push([R * Math.sin(i / 64 * 2 * Math.PI), R * Math.cos(i / 64 * 2 * Math.PI), 0]);
    svg += '<polygon points="' + chemin(cercle) + '" class="m-sol"/>';
    const anneau = [];
    for (let i = 0; i < 64; i++) anneau.push([(R - 0.6) * Math.sin(i / 64 * 2 * Math.PI), (R - 0.6) * Math.cos(i / 64 * 2 * Math.PI), 0]);
    svg += '<polygon points="' + chemin(anneau) + '" class="m-anneau"/>';
    [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(function (x) {
      const a = x[1] * RAD;
      const tete = ecran([(R + 0.1) * Math.sin(a), (R + 0.1) * Math.cos(a), 0]);
      const ext = ecran([(R + 1.3) * Math.sin(a), (R + 1.3) * Math.cos(a), 0]);
      const dedans = ecran([(R - 1.2) * Math.sin(a), (R - 1.2) * Math.cos(a), 0]);
      svg += '<line x1="' + tete[0].toFixed(1) + '" y1="' + tete[1].toFixed(1) + '" x2="' + dedans[0].toFixed(1) + '" y2="' + dedans[1].toFixed(1) + '" class="m-rose' + (x[0] === 'N' ? ' m-nord' : '') + '"/>';
      svg += '<text x="' + ext[0].toFixed(1) + '" y="' + (ext[1] + 4).toFixed(1) + '" class="m-cardinal' + (x[0] === 'N' ? ' m-nord' : '') + '" text-anchor="middle">' + x[0] + '</text>';
    });

    // Ombre portée simple sous la maison (projection verticale de l'emprise, décalée).
    svg += '<polygon points="' + chemin(m.empreinte.map(function (p) { return plus(p, [0.35, -0.35, 0]); })) + '" class="m-ombre"/>';

    // Les faces visibles, de la plus lointaine à la plus proche.
    const visibles = m.faces.filter(function (f) { return scalaire(f.n, cam.c) > 1e-6; })
      .sort(function (a, b) { return scalaire(centre(a.pts), cam.c) - scalaire(centre(b.pts), cam.c); });
    const facadesVisibles = {};
    visibles.forEach(function (f) {
      const sombre = 0.3 * (1 - Math.max(0, scalaire(f.n, LUMIERE)));
      const cible = f.type === 'mur' ? f.id : 'toiture';
      const choisi = selection === cible;
      if (f.type === 'mur') facadesVisibles[f.id] = f;
      svg += '<g class="m-face m-' + f.type + (choisi ? ' m-choisi' : '') + '" data-cible="' + cible + '">' +
        '<polygon points="' + chemin(f.pts) + '" class="m-fond-' + f.type + '"/>' +
        '<polygon points="' + chemin(f.pts) + '" class="m-ombrage" fill-opacity="' + sombre.toFixed(3) + '"/>' +
        (f.type === 'toit' ? tuiles(f, chemin) : '') +
        '<polygon points="' + chemin(f.pts) + '" class="m-contour"/></g>';
      if (f.type === 'mur') svg += dessinerFenetres(m.fenetres.filter(function (w) { return w.facade === f.id; }), chemin, f.id);
    });

    // Étiquettes des façades visibles.
    const az = B.azimutsFacades(projet.geometrie.orientation);
    Object.keys(facadesVisibles).forEach(function (id) {
      const f = facadesVisibles[id];
      const haut = f.pts.reduce(function (m2, p) { return Math.max(m2, p[2]); }, 0);
      const milieu = centre(f.pts.filter(function (p) { return p[2] === 0; }));
      const e = ecran([milieu[0], milieu[1], Math.min(haut, m.Hm) + 0.15]);
      svg += '<g class="m-etiquette' + (selection === id ? ' m-choisi' : '') + '" data-cible="' + id + '"><rect x="' + (e[0] - 34).toFixed(1) + '" y="' + (e[1] - 26).toFixed(1) + '" width="68" height="20" rx="10"/>' +
        '<text x="' + e[0].toFixed(1) + '" y="' + (e[1] - 12).toFixed(1) + '" text-anchor="middle">' + id + ' · ' + B.orientation(az[id]).court + '</text></g>';
    });
    svg += '</svg>';
    return svg;
  }

  // Quelques lignes parallèles à l'égout sur chaque pan : l'effet « tuiles ».
  function tuiles(f, chemin) {
    const bas = f.pts.filter(function (p) { return p[2] === Math.min.apply(null, f.pts.map(function (q) { return q[2]; })); });
    if (bas.length < 2 || f.pts.length < 3) return '';
    const zMax = Math.max.apply(null, f.pts.map(function (p) { return p[2]; }));
    const zMin = bas[0][2];
    if (zMax - zMin < 0.2) return '';
    let d = '';
    for (let k = 1; k < 6; k++) {
      const z = zMin + (zMax - zMin) * k / 6;
      const seg = coupe(f.pts, z);
      if (seg) d += '<polyline points="' + chemin(seg) + '" class="m-tuiles"/>';
    }
    return d;
  }

  // Intersection d'un polygone convexe avec le plan horizontal de hauteur z (2 points).
  function coupe(pts, z) {
    const res = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[2] - z) * (b[2] - z) < 0) {
        const t = (z - a[2]) / (b[2] - a[2]);
        res.push(plus(a, fois(moins(b, a), t)));
      }
    }
    return res.length === 2 ? res : null;
  }

  function dessinerFenetres(liste, chemin, facade) {
    let svg = '';
    liste.forEach(function (w) {
      const r = w.w, pt = w.pt;
      const rect = [pt(r.x0, r.z0), pt(r.x1, r.z0), pt(r.x1, r.z1), pt(r.x0, r.z1)];
      svg += '<g class="m-fenetre" data-cible="' + facade + '">';
      svg += '<polygon points="' + chemin(rect) + '" class="m-vitre"/>';
      // Reflet : un petit triangle clair dans le coin.
      svg += '<polygon points="' + chemin([pt(r.x0 + (r.x1 - r.x0) * 0.1, r.z1 - 0.1), pt(r.x0 + (r.x1 - r.x0) * 0.45, r.z1 - 0.1), pt(r.x0 + (r.x1 - r.x0) * 0.1, r.z0 + (r.z1 - r.z0) * 0.45)]) + '" class="m-reflet"/>';
      svg += '<polygon points="' + chemin(rect) + '" class="m-cadre"/>';
      const milieu = (r.x0 + r.x1) / 2;
      if (r.x1 - r.x0 > 0.8) svg += '<polyline points="' + chemin([pt(milieu, r.z0), pt(milieu, r.z1)]) + '" class="m-cadre"/>';
      svg += protection(w, chemin);
      svg += '</g>';
    });
    return svg;
  }

  function protection(w, chemin) {
    const r = w.w, pt = w.pt, p = w.protection;
    if (p === 'volet-roulant' || p === 'bso') {
      let s = '<polygon points="' + chemin([pt(r.x0 - 0.05, r.z1), pt(r.x1 + 0.05, r.z1), pt(r.x1 + 0.05, r.z1 + 0.2), pt(r.x0 - 0.05, r.z1 + 0.2)]) + '" class="m-coffre"/>';
      if (p === 'bso') {
        for (let z = r.z1 - 0.12; z > r.z0 + (r.z1 - r.z0) * 0.45; z -= 0.12) s += '<polyline points="' + chemin([pt(r.x0, z), pt(r.x1, z)]) + '" class="m-lames"/>';
      }
      return s;
    }
    if (p === 'volet-battant') {
      const d = (r.x1 - r.x0) / 2;
      return '<polygon points="' + chemin([pt(r.x0 - d, r.z0), pt(r.x0, r.z0), pt(r.x0, r.z1), pt(r.x0 - d, r.z1)]) + '" class="m-volet"/>' +
        '<polygon points="' + chemin([pt(r.x1, r.z0), pt(r.x1 + d, r.z0), pt(r.x1 + d, r.z1), pt(r.x1, r.z1)]) + '" class="m-volet"/>';
    }
    if (p === 'store-exterieur') {
      const sortie = fois(w.avant, 0.7);
      const a = pt(r.x0, r.z1 + 0.1), b = pt(r.x1, r.z1 + 0.1);
      return '<polygon points="' + chemin([a, b, plus(pt(r.x1, r.z1 - 0.45), sortie), plus(pt(r.x0, r.z1 - 0.45), sortie)]) + '" class="m-store"/>';
    }
    if (p === 'store-interieur') {
      return '<polygon points="' + chemin([pt(r.x0 + 0.04, r.z0 + (r.z1 - r.z0) * 0.5), pt(r.x1 - 0.04, r.z0 + (r.z1 - r.z0) * 0.5), pt(r.x1 - 0.04, r.z1 - 0.04), pt(r.x0 + 0.04, r.z1 - 0.04)]) + '" class="m-store-int"/>';
    }
    return '';
  }

  /* ---------- 4. Le composant : rotation à la souris, sélection ---------- */

  // options.surSelection(cible) : 'A' | 'B' | 'C' | 'D' | 'toiture'
  function creer(element, options) {
    const etat = { projet: null, selection: null, vue: vueInitiale(0) };
    let glisse = null;

    function vueInitiale(azimutA) { return { theta: Number(azimutA) - 35, phi: 26, zoom: 1 }; }
    function dessiner() { if (etat.projet) element.querySelector('.m-scene').innerHTML = rendreSVG(etat.projet, etat.vue, etat.selection); }

    element.innerHTML = '<div class="m-scene" tabindex="0"></div>' +
      '<div class="m-outils">' +
      '<button type="button" class="m-bouton" data-vue="3d" title="Vue 3D">3D</button>' +
      '<button type="button" class="m-bouton" data-vue="dessus" title="Vue de dessus">Dessus</button>' +
      '<button type="button" class="m-bouton" data-vue="A" title="Face à la façade A">Façade A</button>' +
      '<span class="m-sep"></span>' +
      '<button type="button" class="m-bouton" data-zoom="1.15" title="Zoomer" aria-label="Zoomer">+</button>' +
      '<button type="button" class="m-bouton" data-zoom="0.87" title="Dézoomer" aria-label="Dézoomer">−</button></div>' +
      '<div class="m-aide">Glisse pour tourner · clique sur une façade ou le toit</div>';
    const scene = element.querySelector('.m-scene');

    scene.addEventListener('pointerdown', function (e) {
      glisse = { x: e.clientX, y: e.clientY, theta: etat.vue.theta, phi: etat.vue.phi, bouge: false };
      scene.setPointerCapture(e.pointerId);
    });
    scene.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      const dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) glisse.bouge = true;
      if (!glisse.bouge) return;
      etat.vue.theta = glisse.theta - dx * 0.45;
      etat.vue.phi = Math.max(6, Math.min(88, glisse.phi + dy * 0.3));
      dessiner();
    });
    scene.addEventListener('pointerup', function (e) {
      const etaitClic = glisse && !glisse.bouge;
      glisse = null;
      if (!etaitClic) return;
      const cible = document.elementFromPoint(e.clientX, e.clientY);
      const c = cible && cible.closest('[data-cible]');
      if (c && options.surSelection) options.surSelection(c.dataset.cible);
    });
    scene.addEventListener('keydown', function (e) {
      const pas = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
      if (!pas) return;
      e.preventDefault();
      etat.vue.theta += pas[0];
      etat.vue.phi = Math.max(6, Math.min(88, etat.vue.phi + pas[1]));
      dessiner();
    });
    element.querySelector('.m-outils').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      const az = Number(etat.projet.geometrie.orientation);
      if (b.dataset.vue === '3d') etat.vue = vueInitiale(az);
      if (b.dataset.vue === 'dessus') { etat.vue.phi = 88; }
      if (b.dataset.vue === 'A') { etat.vue.theta = az; etat.vue.phi = 8; }
      if (b.dataset.zoom) etat.vue.zoom = Math.max(0.5, Math.min(2.5, etat.vue.zoom * Number(b.dataset.zoom)));
      dessiner();
    });

    return {
      mettreAJour: function (projet, selection) {
        const premier = !etat.projet;
        etat.projet = projet;
        etat.selection = selection;
        if (premier) etat.vue = vueInitiale(projet.geometrie.orientation);
        dessiner();
      },
      vue: function () { return etat.vue; }
    };
  }

  const ConfortMaison3D = { creer: creer, construire: construire, camera: camera, dispositionFenetres: dispositionFenetres, rendreSVG: rendreSVG };
  global.ConfortMaison3D = ConfortMaison3D;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortMaison3D;
})(typeof window !== 'undefined' ? window : globalThis);
