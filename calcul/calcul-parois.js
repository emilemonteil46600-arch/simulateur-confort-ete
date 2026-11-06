/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 1 : LES PAROIS
   ----------------------------------------------------------
   Ce fichier se lit comme un cours. Il ne touche jamais à la page :
   il reçoit des nombres et rend des nombres (fonctions « pures »).

   Ce qu'on calcule pour une paroi décrite couche par couche
   (couche 1 = côté intérieur, dernière couche = côté extérieur) :

   1) Le régime permanent (NF EN ISO 6946)
        R couche = e / λ                         [m] / [W/(m·K)] = [m²·K/W]
        R total  = Rsi + Σ R couches + Rse
        U        = 1 / R total                    [W/(m²·K)]

   2) Ce que la paroi peut stocker
        masse surfacique     m = Σ ρ·e            [kg/m²]
        capacité surfacique  C = Σ ρ·c·e          [J/(m²·K)]
        diffusivité          a = λ / (ρ·c)        [m²/s]
        profondeur de pénétration (onde de période T = 24 h)
                             δ = √(λ·T / (π·ρ·c)) [m]

   3) Le régime périodique (NF EN ISO 13786, matrices de transfert)
        Chaque couche transforme le couple (température, flux) d'une face
        en celui de l'autre face par une matrice 2×2 de nombres complexes :
          [θ côté ext ; q côté ext] = Z × [θ côté int ; q côté int]
        Z couche   = | cosh(k·e)          −sinh(k·e)/(λ·k) |   avec k = (1 + i)/δ
                     | −λ·k·sinh(k·e)     cosh(k·e)        |
        Z résistance R (Rsi, Rse, lame d'air) = | 1  −R |
                                                | 0   1 |
        Z paroi = Z_Rse × Z_couche n × … × Z_couche 1 × Z_Rsi

        On en tire :
          transmittance périodique  Y12 = −1 / Z12          [W/(m²·K)]
          facteur d'amortissement   f   = |Y12| / U          [–]
          déphasage                 Δt  = −arg(Y12) × T/(2π) [h]
          admittance intérieure     Y11 = −Z11 / Z12         [W/(m²·K)]
          capacité intérieure       κ1  = T/(2π) × |(Z11 − 1)/Z12|  [J/(m²·K)]
          capacité extérieure       κ2  = T/(2π) × |(Z22 − 1)/Z12|  [J/(m²·K)]

   4) L'inertie du local (NF EN ISO 13790:2008, § 12.3.1.2)
        Cm = Σ κj·Aj   (capacité « utile » de toutes les faces vues par l'air du local)
        Am = Cm² / Σ (κj²·Aj)   (surface d'échange équivalente de la masse)

   Convention de signe : q > 0 quand la chaleur va de l'intérieur vers l'extérieur.
   Les valeurs dites « (H) » sont des hypothèses ou des valeurs à vérifier sur le texte de la norme.
   ========================================================== */
(function (global) {
  'use strict';

  /* ---------- 0. Constantes ---------- */

  // La période d'étude : une journée. L'été, la température dehors et le soleil
  // reviennent à peu près chaque jour : c'est l'onde qu'on fait passer dans la paroi.
  const PERIODE = 24 * 3600;                 // T en secondes (86 400 s)
  const OMEGA = 2 * Math.PI / PERIODE;       // pulsation ω = 2π/T en rad/s

  // Résistances superficielles (NF EN ISO 6946, tableau des Rs conventionnelles).
  // Elles regroupent la convection (l'air qui lèche la paroi) et le rayonnement
  // (la paroi « voit » les autres parois). Plus l'échange est difficile, plus R est grand.
  //   - flux horizontal  (murs)                     : Rsi 0,13 ; Rse 0,04
  //   - flux ascendant   (toiture en hiver)         : Rsi 0,10 ; Rse 0,04
  //   - flux descendant  (plancher bas, toiture l'été) : Rsi 0,17 ; Rse 0,04
  // Une paroi intérieure a deux faces « intérieures » : Rsi des deux côtés.
  const RESISTANCES_SUPERFICIELLES = {
    horizontal: { nom: 'Flux horizontal (mur)', rsi: 0.13, rse: 0.04 },
    montant: { nom: 'Flux ascendant (toiture, plafond l\'hiver)', rsi: 0.10, rse: 0.04 },
    descendant: { nom: 'Flux descendant (plancher bas, toiture l\'été)', rsi: 0.17, rse: 0.04 }
  };

  /* ---------- 1. Nombres complexes ----------
     Une onde sinusoïdale a deux informations : sa taille (amplitude) et son
     retard (phase). Un nombre complexe z = re + i·im porte les deux à la fois :
       |z| = amplitude,  arg(z) = phase (en radians).
     Multiplier deux complexes multiplie les amplitudes et ajoute les phases :
     c'est exactement ce que fait une couche de mur sur une onde de chaleur. */
  function cx(re, im) { return { re: re, im: im || 0 }; }
  function cxPlus(a, b) { return cx(a.re + b.re, a.im + b.im); }
  function cxMoins(a, b) { return cx(a.re - b.re, a.im - b.im); }
  function cxFois(a, b) { return cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cxDivise(a, b) {
    const d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }
  function cxModule(a) { return Math.hypot(a.re, a.im); }
  function cxArgument(a) { return Math.atan2(a.im, a.re); }
  function cxOppose(a) { return cx(-a.re, -a.im); }
  // cosh et sinh d'un complexe x + i·y :
  //   cosh(x + iy) = cosh x · cos y + i · sinh x · sin y
  //   sinh(x + iy) = sinh x · cos y + i · cosh x · sin y
  function cxCosh(a) { return cx(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im)); }
  function cxSinh(a) { return cx(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im)); }

  /* ---------- 2. Régime permanent : R et U (NF EN ISO 6946) ---------- */

  // R = e / λ : une couche résiste d'autant plus qu'elle est épaisse et peu conductrice.
  // e en m, λ en W/(m·K) → R en m²·K/W.
  function resistanceCouche(epaisseur, lambda) {
    return Number(epaisseur) / Number(lambda);
  }

  function resistancesSuperficielles(sensFlux, interieure) {
    const rs = RESISTANCES_SUPERFICIELLES[sensFlux] || RESISTANCES_SUPERFICIELLES.horizontal;
    // Paroi intérieure : de l'autre côté, c'est encore une pièce → Rsi aussi.
    return { rsi: rs.rsi, rse: interieure ? rs.rsi : rs.rse };
  }

  // Les résistances en série s'additionnent (comme des résistances électriques) :
  // la même chaleur traverse chaque couche l'une après l'autre.
  function resistanceTotale(couches, rs) {
    return rs.rsi + couches.reduce(function (s, c) { return s + resistanceCouche(c.e, c.lambda); }, 0) + rs.rse;
  }

  function coefficientU(couches, rs) {
    return 1 / resistanceTotale(couches, rs);
  }

  /* ---------- 3. Stocker la chaleur ---------- */

  // m = ρ·e : kg de matière derrière 1 m² de paroi.
  function masseSurfacique(couches) {
    return couches.reduce(function (s, c) { return s + c.rho * c.e; }, 0);
  }

  // C = ρ·c·e : joules pour chauffer de 1 K toute l'épaisseur de 1 m² de paroi.
  // [kg/m³]·[J/(kg·K)]·[m] = [J/(m²·K)]
  function capaciteSurfacique(couche) { return couche.rho * couche.c * couche.e; }
  function capaciteTotale(couches) {
    return couches.reduce(function (s, c) { return s + capaciteSurfacique(c); }, 0);
  }

  // a = λ/(ρ·c) : la vitesse à laquelle une variation de température « diffuse ».
  // [W/(m·K)] / [J/(m³·K)] = [m²/s]. Béton ≈ 1e-6, laine minérale ≈ 1,7e-6 (l'isolant
  // diffuse aussi vite que le béton car il ne stocke presque rien, mais laisse passer peu).
  function diffusivite(couche) { return couche.lambda / (couche.rho * couche.c); }

  // b = √(λ·ρ·c) : l'effusivité, la « capacité à absorber une chaleur qui arrive en surface ».
  // Elle explique pourquoi un carrelage paraît plus froid que du bois à la même température.
  // [W·s^½/(m²·K)]
  function effusivite(couche) { return Math.sqrt(couche.lambda * couche.rho * couche.c); }

  // δ = √(a·T/π) = √(λ·T/(π·ρ·c)) : profondeur de pénétration de l'onde journalière.
  // Dans un matériau très épais, l'amplitude est divisée par e ≈ 2,72 tous les δ mètres
  // et l'onde prend un retard de 1 radian (soit T/(2π) ≈ 3,82 h) tous les δ mètres.
  function profondeurPenetration(couche) {
    return Math.sqrt(couche.lambda * PERIODE / (Math.PI * couche.rho * couche.c));
  }

  /* Approximation « mur très épais » (milieu semi-infini, sans résistances superficielles) :
     l'onde s'écrase d'un facteur e^(−x/δ) et prend un retard de x/δ radians.
       retard ≈ (e/δ) × T/(2π)  = 3,82 h par δ traversé
       amortissement ≈ e^(−e/δ)
     Utile pour sentir les ordres de grandeur ; le calcul matriciel ci-dessous est exact. */
  function retardApproche(epaisseur, delta) { return epaisseur / delta * PERIODE / (2 * Math.PI) / 3600; }
  function amortissementApproche(epaisseur, delta) { return Math.exp(-epaisseur / delta); }

  /* ---------- 4. Les matrices de transfert (NF EN ISO 13786) ---------- */

  // Matrice 2×2 = { z11, z12, z21, z22 }, chaque terme est un complexe.
  function produitMatrices(A, B) {
    return {
      z11: cxPlus(cxFois(A.z11, B.z11), cxFois(A.z12, B.z21)),
      z12: cxPlus(cxFois(A.z11, B.z12), cxFois(A.z12, B.z22)),
      z21: cxPlus(cxFois(A.z21, B.z11), cxFois(A.z22, B.z21)),
      z22: cxPlus(cxFois(A.z21, B.z12), cxFois(A.z22, B.z22))
    };
  }

  function determinant(Z) {
    return cxMoins(cxFois(Z.z11, Z.z22), cxFois(Z.z12, Z.z21));
  }

  // Une résistance pure (sans masse) : la température chute de R·q, le flux ne change pas.
  function matriceResistance(R) {
    return { z11: cx(1), z12: cx(-R), z21: cx(0), z22: cx(1) };
  }

  // Une couche homogène d'épaisseur e. Solution exacte de l'équation de la chaleur
  // pour une onde de période T : θ(x) = A·cosh(k·x) + B·sinh(k·x), avec k = (1 + i)/δ.
  // Écrit avec ξ = e/δ, on retrouve les formules de la norme :
  //   Z11 = Z22 = cosh ξ·cos ξ + i·sinh ξ·sin ξ
  //   Z12 = −δ/(2λ) · [sinh ξ·cos ξ + cosh ξ·sin ξ + i·(cosh ξ·sin ξ − sinh ξ·cos ξ)]
  //   Z21 = −λ/δ    · [sinh ξ·cos ξ − cosh ξ·sin ξ + i·(sinh ξ·cos ξ + cosh ξ·sin ξ)]
  function matriceCouche(couche) {
    const delta = profondeurPenetration(couche);
    const k = cx(1 / delta, 1 / delta);                 // k = (1 + i)/δ   [1/m]
    const ke = cx(couche.e / delta, couche.e / delta);  // k·e = ξ·(1 + i)  [–]
    const ch = cxCosh(ke);
    const sh = cxSinh(ke);
    const lk = cxFois(cx(couche.lambda), k);            // λ·k  [W/(m²·K)]
    return {
      z11: ch,
      z12: cxOppose(cxDivise(sh, lk)),
      z21: cxOppose(cxFois(lk, sh)),
      z22: ch
    };
  }

  // On part de l'air intérieur et on traverse : Rsi, couche 1, …, couche n, Rse.
  // Chaque nouvelle matrice se multiplie À GAUCHE (elle agit après les précédentes).
  function matriceParoi(couches, rs) {
    let Z = matriceResistance(rs.rsi);
    couches.forEach(function (c) { Z = produitMatrices(matriceCouche(c), Z); });
    return produitMatrices(matriceResistance(rs.rse), Z);
  }

  /* ---------- 5. Ce que dit la matrice ---------- */

  // Ramène un retard en heures dans [0 ; 24[.
  function heuresModulo(h) { return ((h % 24) + 24) % 24; }

  function caracteristiquesDynamiques(couches, rs) {
    const Z = matriceParoi(couches, rs);
    const U = coefficientU(couches, rs);
    const unSurZ12 = cxDivise(cx(1), Z.z12);

    // Y12 : on fait osciller l'air extérieur de 1 K, l'air intérieur reste fixe.
    // Flux qui ENTRE dans la pièce = −q côté intérieur = −θe/Z12.
    const Y12 = cxOppose(unSurZ12);
    // Y11 : on fait osciller l'air intérieur de 1 K, l'extérieur reste fixe.
    // Flux qui entre DANS LA PAROI côté intérieur = −Z11/Z12.
    const Y11 = cxOppose(cxFois(Z.z11, unSurZ12));
    const Y22 = cxOppose(cxFois(Z.z22, unSurZ12));

    const heuresParRadian = PERIODE / (2 * Math.PI) / 3600;   // 3,82 h par radian
    return {
      Z: Z,
      U: U,
      Y12: Y12, Y11: Y11, Y22: Y22,
      transmittancePeriodique: cxModule(Y12),
      amortissement: cxModule(Y12) / U,
      // Le flux arrive dans la pièce en retard sur la température extérieure :
      // phase de Y12 négative → retard positif.
      dephasage: heuresModulo(-cxArgument(Y12) * heuresParRadian),
      admittance: cxModule(Y11),
      // Le flux qui entre dans la paroi est EN AVANCE sur la température de la pièce
      // (la paroi absorbe tant que l'air monte) : phase positive.
      avanceAdmittance: cxArgument(Y11) * heuresParRadian,
      kappa1: PERIODE / (2 * Math.PI) * cxModule(cxDivise(cxMoins(Z.z11, cx(1)), Z.z12)),
      kappa2: PERIODE / (2 * Math.PI) * cxModule(cxDivise(cxMoins(Z.z22, cx(1)), Z.z12)),
      determinant: determinant(Z)
    };
  }

  /* Paroi intérieure dont les DEUX côtés voient de l'air qui oscille pareil
     (plancher entre deux étages semblables, refend, cloison).
     θ1 = θ2 = θ : on résout [θ ; q2] = Z·[θ ; q1] :
       q1 = (1 − Z11)·θ / Z12        (flux qui entre par la face 1)
       q2 = Z21·θ + Z22·q1           (−q2 = flux qui entre par la face 2)
     Capacité vue par chaque face : κ = T/(2π) × |flux entrant| / |θ|.
     (H) Pour une paroi symétrique, les deux faces ont la même valeur, ce qui revient
     à couper la paroi en deux par un plan adiabatique au milieu. */
  function capacitesDeuxFaces(couches, rs) {
    const Z = matriceParoi(couches, rs);
    const q1 = cxDivise(cxMoins(cx(1), Z.z11), Z.z12);
    const q2 = cxPlus(Z.z21, cxFois(Z.z22, q1));
    return {
      kappaFace1: PERIODE / (2 * Math.PI) * cxModule(q1),
      kappaFace2: PERIODE / (2 * Math.PI) * cxModule(q2)
    };
  }

  /* « Règle des 10 cm » (H) : la masse que l'onde journalière peut atteindre côté intérieur.
     On additionne ρ·c·e des couches côté intérieur, en s'arrêtant au premier des trois :
     10 cm de profondeur, la première couche isolante (λ < 0,1 W/(m·K)), le milieu de la paroi
     (paroi intérieure). Règle approchée couramment utilisée pour dire si une paroi est « lourde ».
     ATTENTION : elle ignore la résistance superficielle Rsi. Or la chaleur doit d'abord
     passer de l'air à la paroi à travers Rsi : |Y11| reste toujours sous 1/Rsi ≈ 7,7 W/(m²·K)
     et κ1 sous T/(2π)/Rsi ≈ 106 kJ/(m²·K). Le κ1 exact est donc plus petit que cette règle
     dès que la paroi est lourde : c'est Rsi, pas le béton, qui devient le goulot d'étranglement. */
  const SEUIL_ISOLANT = 0.1;   // W/(m·K) (H)
  const EPAISSEUR_UTILE = 0.10; // m (H)
  function capaciteDixCentimetres(couches, interieure) {
    const total = couches.reduce(function (s, c) { return s + c.e; }, 0);
    let reste = Math.min(EPAISSEUR_UTILE, interieure ? total / 2 : total);
    let kappa = 0;
    for (let i = 0; i < couches.length && reste > 1e-12; i++) {
      const c = couches[i];
      if (c.lambda < SEUIL_ISOLANT) break;
      const e = Math.min(c.e, reste);
      kappa += c.rho * c.c * e;
      reste -= e;
    }
    return kappa;
  }

  // Plafond physique de κ1 imposé par la résistance superficielle intérieure (voir ci-dessus).
  function plafondKappa(rsi) { return PERIODE / (2 * Math.PI) / rsi; }

  /* ---------- 6. L'onde sur 24 h ----------
     Dehors : θe(t) = θe moyenne + A·cos(ω·(t − t max)). Dedans : air fixé à θi.
     Flux qui entre dans la pièce (W/m²) :
       sans inertie (U seul)  : q(t) = U·(θe(t) − θi)
       réel (ISO 13786)       : q(t) = U·(θe moy − θi) + |Y12|·A·cos(ω·(t − t max) + arg Y12)
     Température de la face intérieure : θsi(t) = θi + Rsi·q(t). */
  function ondeJournaliere(dyn, rs, onde, pasMinutes) {
    const pas = pasMinutes || 15;
    const points = [];
    const moyen = dyn.U * (onde.tMoyenne - onde.tInterieure);
    const phase = cxArgument(dyn.Y12);
    for (let minute = 0; minute <= 24 * 60; minute += pas) {
      const h = minute / 60;
      const angle = OMEGA * (h - onde.heureMax) * 3600;
      const tExt = onde.tMoyenne + onde.amplitude * Math.cos(angle);
      const fluxSansInertie = dyn.U * (tExt - onde.tInterieure);
      const flux = moyen + dyn.transmittancePeriodique * onde.amplitude * Math.cos(angle + phase);
      points.push({ heure: h, tExt: tExt, fluxSansInertie: fluxSansInertie, flux: flux, tSurface: onde.tInterieure + rs.rsi * flux });
    }
    return {
      points: points,
      fluxMoyen: moyen,
      amplitudeFluxSansInertie: dyn.U * onde.amplitude,
      amplitudeFlux: dyn.transmittancePeriodique * onde.amplitude,
      heurePicFlux: heuresModulo(onde.heureMax + dyn.dephasage)
    };
  }

  /* L'onde DANS la paroi : on fait osciller l'air extérieur de 1 K (air intérieur fixe)
     et on suit l'oscillation de température à travers l'épaisseur.
     Au départ (air intérieur) : θ = 0 et q = 1/Z12 (car θe = Z12·q quand θi = 0).
     On applique Rsi, puis chaque couche découpée en tranches : [θ ; q] ← Z tranche × [θ ; q].
     amplitude = |θ| (en K pour 1 K dehors), retard = −arg(θ) × T/(2π) (heures).
     Les points vont de la face intérieure (x = 0) à la face extérieure. */
  function profilOnde(couches, rs, tranchesParCouche) {
    const n = tranchesParCouche || 12;
    const Z = matriceParoi(couches, rs);
    let theta = cx(0);
    let q = cxDivise(cx(1), Z.z12);
    const appliquer = function (M) {
      const t = cxPlus(cxFois(M.z11, theta), cxFois(M.z12, q));
      q = cxPlus(cxFois(M.z21, theta), cxFois(M.z22, q));
      theta = t;
    };
    const point = function (x) {
      return { x: x, amplitude: cxModule(theta), retard: heuresModulo(-cxArgument(theta) * PERIODE / (2 * Math.PI) / 3600) };
    };
    appliquer(matriceResistance(rs.rsi));
    const points = [point(0)];
    let x = 0;
    couches.forEach(function (c) {
      const tranche = matriceCouche({ lambda: c.lambda, rho: c.rho, c: c.c, e: c.e / n });
      for (let i = 0; i < n; i++) { appliquer(tranche); x += c.e / n; points.push(point(x)); }
    });
    return points;
  }

  /* ---------- 7. Analyse complète d'une paroi ---------- */

  // Chaque couche de la paroi enregistrée = { materiau: id, e: épaisseur en m }.
  // On va chercher λ, ρ, c dans la bibliothèque.
  function couchesPhysiques(paroi, materiaux) {
    return (paroi.couches || []).map(function (c) {
      const m = (materiaux || []).find(function (x) { return x.id === c.materiau; });
      if (!m) return null;
      return { materiau: m, e: Number(c.e), lambda: Number(m.lambda), rho: Number(m.rho), c: Number(m.c) };
    });
  }

  function coucheValide(c) {
    return c && c.e > 0 && c.lambda > 0 && c.rho > 0 && c.c > 0 &&
      isFinite(c.e) && isFinite(c.lambda) && isFinite(c.rho) && isFinite(c.c);
  }

  function analyserParoi(paroi, materiaux) {
    const brutes = couchesPhysiques(paroi, materiaux);
    const erreurs = [];
    brutes.forEach(function (c, i) {
      if (!c) erreurs.push('Couche ' + (i + 1) + ' : matériau introuvable dans la bibliothèque.');
      else if (!coucheValide(c)) erreurs.push('Couche ' + (i + 1) + ' (' + c.materiau.nom + ') : épaisseur, λ, ρ ou c manquant ou nul.');
    });
    if (!brutes.length) erreurs.push('La paroi n\'a aucune couche.');
    if (erreurs.length) return { ok: false, erreurs: erreurs };

    const couches = brutes;
    const interieure = paroi.type === 'interieure';
    const rs = resistancesSuperficielles(paroi.sensFlux, interieure);
    const dyn = caracteristiquesDynamiques(couches, rs);
    const detail = couches.map(function (c) {
      const delta = profondeurPenetration(c);
      return {
        nom: c.materiau.nom, statut: c.materiau.statut, e: c.e, lambda: c.lambda, rho: c.rho, c: c.c,
        R: resistanceCouche(c.e, c.lambda), masse: c.rho * c.e, capacite: capaciteSurfacique(c),
        diffusivite: diffusivite(c), effusivite: effusivite(c), delta: delta, xi: c.e / delta
      };
    });
    return {
      ok: true,
      erreurs: [],
      interieure: interieure,
      rs: rs,
      couches: detail,
      epaisseur: couches.reduce(function (s, c) { return s + c.e; }, 0),
      R: resistanceTotale(couches, rs),
      U: dyn.U,
      masse: masseSurfacique(couches),
      capacite: capaciteTotale(couches),
      dyn: dyn,
      deuxFaces: capacitesDeuxFaces(couches, rs),
      profil: profilOnde(couches, rs),
      capaciteDixCm: capaciteDixCentimetres(couches, interieure),
      plafondKappa: plafondKappa(rs.rsi),
      exemples: detail.filter(function (c) { return c.statut !== 'valide'; }).map(function (c) { return c.nom; })
        .filter(function (n, i, t) { return t.indexOf(n) === i; })
    };
  }

  /* ---------- 8. L'inertie du local (NF EN ISO 13790:2008) ----------
     Chaque élément du local = { paroi (analysée), aire (m²), contact } avec contact :
       'exterieur' : une face dans le local, l'autre dehors (ou local non chauffé) → κ1
       'voisin'    : une face dans le local, l'autre dans un local voisin semblable → κ face 1
       'deux'      : les deux faces dans le local (cloison, refend intérieur)       → κ face 1 et face 2
     Cm = Σ κ·A   ;   Am = Cm² / Σ κ²·A   (chaque face compte pour une surface). */

  // Valeurs par défaut de NF EN ISO 13790:2008, tableau 12 (H : à vérifier sur le texte),
  // ramenées au m² de plancher Af. Elles servent de repères pour nommer la classe.
  const CLASSES_INERTIE = [
    { id: 'tres-legere', nom: 'Très légère', amSurAf: 2.5, cmSurAf: 80000 },
    { id: 'legere', nom: 'Légère', amSurAf: 2.5, cmSurAf: 110000 },
    { id: 'moyenne', nom: 'Moyenne', amSurAf: 2.5, cmSurAf: 165000 },
    { id: 'lourde', nom: 'Lourde', amSurAf: 3.0, cmSurAf: 260000 },
    { id: 'tres-lourde', nom: 'Très lourde', amSurAf: 3.5, cmSurAf: 370000 }
  ];

  // (H) Règle de l'outil : on prend la classe dont la valeur Cm/Af du tableau est la plus proche.
  // La norme donne des valeurs par classe, pas de seuils : ce choix est le nôtre.
  function classeInertie(cmSurAf, classes) {
    const liste = classes || CLASSES_INERTIE;
    let meilleure = liste[0];
    liste.forEach(function (c) {
      if (Math.abs(c.cmSurAf - cmSurAf) < Math.abs(meilleure.cmSurAf - cmSurAf)) meilleure = c;
    });
    return meilleure;
  }

  function facesElement(element) {
    const a = element.analyse;
    if (element.contact === 'deux') return [a.deuxFaces.kappaFace1, a.deuxFaces.kappaFace2];
    if (element.contact === 'voisin') return [a.deuxFaces.kappaFace1];
    return [a.dyn.kappa1];
  }

  function inertieLocal(elements, surfacePlancher, classes) {
    const Af = Number(surfacePlancher);
    let cm = 0, somme2 = 0, surfaceFaces = 0;
    const lignes = elements.map(function (el) {
      const aire = Number(el.aire);
      const kappas = facesElement(el);
      const apport = kappas.reduce(function (s, k) { return s + k * aire; }, 0);
      cm += apport;
      somme2 += kappas.reduce(function (s, k) { return s + k * k * aire; }, 0);
      surfaceFaces += kappas.length * aire;
      return { nom: el.nom, aire: aire, kappas: kappas, cm: apport };
    });
    const am = somme2 > 0 ? cm * cm / somme2 : 0;
    const cmSurAf = Af > 0 ? cm / Af : null;
    return {
      lignes: lignes,
      cm: cm,
      am: am,
      surfaceFaces: surfaceFaces,
      cmSurAf: cmSurAf,
      amSurAf: Af > 0 ? am / Af : null,
      classe: cmSurAf === null ? null : classeInertie(cmSurAf, classes)
    };
  }

  /* ---------- Export ---------- */
  const ConfortParois = {
    PERIODE: PERIODE,
    OMEGA: OMEGA,
    RESISTANCES_SUPERFICIELLES: RESISTANCES_SUPERFICIELLES,
    CLASSES_INERTIE: CLASSES_INERTIE,
    SEUIL_ISOLANT: SEUIL_ISOLANT,
    EPAISSEUR_UTILE: EPAISSEUR_UTILE,
    cx: cx, cxFois: cxFois, cxDivise: cxDivise, cxModule: cxModule, cxArgument: cxArgument,
    cxCosh: cxCosh, cxSinh: cxSinh,
    resistanceCouche: resistanceCouche,
    resistancesSuperficielles: resistancesSuperficielles,
    resistanceTotale: resistanceTotale,
    coefficientU: coefficientU,
    masseSurfacique: masseSurfacique,
    capaciteSurfacique: capaciteSurfacique,
    capaciteTotale: capaciteTotale,
    diffusivite: diffusivite,
    effusivite: effusivite,
    profondeurPenetration: profondeurPenetration,
    retardApproche: retardApproche,
    amortissementApproche: amortissementApproche,
    produitMatrices: produitMatrices,
    determinant: determinant,
    matriceResistance: matriceResistance,
    matriceCouche: matriceCouche,
    matriceParoi: matriceParoi,
    caracteristiquesDynamiques: caracteristiquesDynamiques,
    capacitesDeuxFaces: capacitesDeuxFaces,
    capaciteDixCentimetres: capaciteDixCentimetres,
    plafondKappa: plafondKappa,
    ondeJournaliere: ondeJournaliere,
    profilOnde: profilOnde,
    couchesPhysiques: couchesPhysiques,
    analyserParoi: analyserParoi,
    classeInertie: classeInertie,
    inertieLocal: inertieLocal
  };

  global.ConfortParois = ConfortParois;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortParois;
})(typeof window !== 'undefined' ? window : globalThis);
