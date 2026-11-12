/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 3 : LE MODÈLE HORAIRE 5R1C
   ----------------------------------------------------------
   Fonctions pures. On connaît (chapitre 2) la chaleur qui entre heure par heure ;
   on cherche maintenant la température qu'il fait DEDANS, heure par heure,
   quand rien ne chauffe ni ne refroidit (« évolution libre »).

   La maison est ramenée à un petit circuit, celui de la NF EN ISO 13790:2008,
   annexe C (H : repris dans la NF EN ISO 52016-1 comme méthode simplifiée ;
   les coefficients 3,45 ; 9,1 ; 4,5 et 0,3/0,7 sont ceux de l'annexe C, à vérifier
   dans le texte) : 5 résistances (conductances H, en W/K) et 1 capacité (Cm, en J/K).

                 θe (dehors)                 θsup (air soufflé = dehors)
                  │       │                        │
              Htr,em    Htr,w                     Hve
                  │       │                        │
   Cm ── θm ──Htr,ms── θs ─────────Htr,is──────── θair
        (masse)      (surfaces)                   (air)
          ↑ Φm          ↑ Φst                       ↑ Φia

   Trois températures inconnues :
     θair  l'air de la maison, celui que la ventilation renouvelle ;
     θs    la température moyenne des surfaces intérieures (murs, plafond, sol, vitres) ;
     θm    la température au cœur de la masse (le béton des dalles, les murs lourds).
   Les conductances, en W/K (« des watts par degré d'écart ») :
     Hve    la ventilation et les infiltrations : ρ·c·débit ;
     Htr,w  les fenêtres (pas de masse : elles relient directement dehors et surfaces) ;
     Htr,op les parois opaques, coupées en deux : Htr,ms entre la masse et les surfaces
            (grande : 9,1 W/(m²·K) × Am) et Htr,em entre la masse et dehors (le reste) ;
     Htr,is l'échange entre les surfaces et l'air : 3,45 W/(m²·K) × Atot, Atot = 4,5 × Af.
   La capacité Cm (J/K) et la surface de masse Am (m²) viennent du chapitre 1 bis.

   À chaque heure, on écrit le bilan de chaque nœud (ce qui entre = ce qui sort, plus ce qui
   se stocke dans Cm) et on résout. C'est un schéma de Crank-Nicolson : la masse est prise à sa
   température MOYENNE sur l'heure, (θm,t + θm,t−1)/2, ce qui rend le calcul stable et exact
   à l'ordre 2, même avec un pas d'une heure.
   ========================================================== */
(function (global) {
  'use strict';

  const S = global.ConfortSoleil || (typeof require === 'function' ? require('./calcul-soleil.js') : null);

  /* ---------- Les constantes de l'annexe C (H : à vérifier dans le texte) ---------- */
  const H_IS = 3.45;         // W/(m²·K) : échange surfaces ↔ air (convection + un peu de rayonnement), par m² de surface intérieure
  const H_MS = 9.1;          // W/(m²·K) : échange masse ↔ surfaces, par m² de surface de masse Am
  const LAMBDA_AT = 4.5;     // Atot = 4,5 × Af : surface intérieure totale (sol + plafond + murs + cloisons) par m² de plancher
  const PART_AIR_OPERATIVE = 0.3;   // θop = 0,3 θair + 0,7 θs (annexe C ; en toute rigueur ½ – ½ pour un occupant assis au calme, NF EN ISO 7726)
  // Chaleur de l'air : ρ·c = 1,2 kg/m³ × 1 000 J/(kg·K) = 1 200 J/(m³·K), soit 0,333 Wh/(m³·K).
  // Un débit de n vol/h dans V m³ emporte Hve = 1200/3600 × n × V watts par degré.
  const RHO_C_AIR = 1200 / 3600;    // W par (m³/h) et par K
  const SECONDES_PAR_HEURE = 3600;

  /* ==========================================================
     1. LES CONDUCTANCES DU CIRCUIT
     e = { Af (m² de plancher), Am (m² de masse), Cm (J/K), Htr_w (W/K : Σ Uw·Aw),
           opaques: [{ nom, UA (W/K), vers: 'exterieur' | 'sol' }], ventilation n (vol/h), V (m³) }
     ========================================================== */
  function conductances(e) {
    const Atot = LAMBDA_AT * e.Af;
    const Htr_is = H_IS * Atot;
    const Htr_ms = H_MS * e.Am;
    const Htr_op = e.opaques.reduce(function (s, o) { return s + o.UA; }, 0);
    // Les deux résistances en série (masse ↔ surfaces, puis masse ↔ dehors) doivent redonner la
    // résistance totale des parois opaques : 1/Htr_op = 1/Htr_ms + 1/Htr_em.
    const Htr_em = Htr_op > 0 && Htr_op < Htr_ms ? 1 / (1 / Htr_op - 1 / Htr_ms) : Htr_op;
    return {
      Af: e.Af, Am: e.Am, Atot: Atot, Cm: e.Cm, V: e.V,
      Htr_is: Htr_is, Htr_ms: Htr_ms, Htr_op: Htr_op, Htr_em: Htr_em, Htr_w: e.Htr_w,
      opaques: e.opaques,
      // Part de chaque parois opaque dans Htr_op : sert à la température extérieure « vue » par la masse (le sol est plus frais).
      partSol: Htr_op > 0 ? e.opaques.filter(function (o) { return o.vers === 'sol'; }).reduce(function (s, o) { return s + o.UA; }, 0) / Htr_op : 0,
      avertissement: Htr_op >= Htr_ms ? 'Htr,op ≥ Htr,ms : la masse est trop petite pour les déperditions ; Htr,em pris égal à Htr,op (H).' : null
    };
  }

  // Ventilation : Hve = ρ·c × n × V  (n en vol/h, V en m³) → W/K.
  function conductanceVentilation(n, V) { return RHO_C_AIR * n * V; }

  /* ==========================================================
     2. OÙ VA LA CHALEUR QUI ENTRE ? (annexe C, § C.2)
     Les apports internes Φint : moitié dans l'air (convection : l'air chauffé par une lampe, un corps),
       moitié rayonnée vers les surfaces.
     Le soleil Φsol : tout va sur les surfaces (il tape le sol, les murs), rien dans l'air.
     Puis la part « surfaces » est elle-même répartie : une part Am/Atot va directement dans la masse
       (les surfaces lourdes), une part Htr_w/(9,1·Atot) est perdue vers les vitres (sans masse), le reste
       reste sur le nœud des surfaces.
     ========================================================== */
  function repartirApports(phiInt, phiSol, c) {
    const ia = 0.5 * phiInt;
    const surSurfaces = 0.5 * phiInt + phiSol;
    const m = c.Am / c.Atot * surSurfaces;
    const st = (1 - c.Am / c.Atot - c.Htr_w / (H_MS * c.Atot)) * surSurfaces;
    return { ia: ia, st: st, m: m, total: phiInt + phiSol };
  }

  /* ==========================================================
     3. UNE HEURE DE CALCUL (annexe C, § C.3) : le schéma de Crank-Nicolson
     h = { thetaE (air dehors), thetaEop (dehors « vu » par les parois opaques : mélange air / sol),
           thetaSup (air soufflé), Hve, phi: { ia, st, m } }
     Les conductances combinées :
       H1 = 1/(1/Hve + 1/Htr_is)   dehors → air → surfaces, en série
       H2 = H1 + Htr_w              + les fenêtres, en parallèle
       H3 = 1/(1/H2 + 1/Htr_ms)     puis jusqu'à la masse
     Tout le circuit à droite de la masse se ramène à UNE conductance H3 vers une température
     équivalente ; la masse ne voit plus que Htr_em (vers dehors) et H3. D'où le pas :
       θm,t = [θm,t−1 (Cm/3600 − ½(H3 + Htr_em)) + Φmtot] / [Cm/3600 + ½(H3 + Htr_em)]
     Si Hve = 0 (aucun air), H1 = 0 et le terme Φia/Hve disparaît : on l'écrit H1/Hve = Htr_is/(Htr_is + Hve).
     ========================================================== */
  function pasHoraire(thetaMAvant, c, h) {
    const Hve = h.Hve;
    const H1 = Hve + c.Htr_is > 0 ? 1 / (1 / Math.max(Hve, 1e-12) + 1 / c.Htr_is) : 0;
    const H1surHve = c.Htr_is / (c.Htr_is + Hve);     // = H1 / Hve, sans diviser par zéro
    const H2 = H1 + c.Htr_w;
    const H3 = 1 / (1 / H2 + 1 / c.Htr_ms);
    const phi = h.phi;
    // Ce que « voient » les surfaces depuis la droite du circuit : fenêtres + air (soufflé et chauffé).
    const versSurfaces = phi.st + c.Htr_w * h.thetaE + H1 * h.thetaSup + H1surHve * phi.ia;
    const phiMtot = phi.m + c.Htr_em * h.thetaEop + H3 * versSurfaces / H2;
    const C = c.Cm / SECONDES_PAR_HEURE;   // J/K → Wh/K : la capacité « par heure »
    const thetaM = (thetaMAvant * (C - 0.5 * (H3 + c.Htr_em)) + phiMtot) / (C + 0.5 * (H3 + c.Htr_em));
    const thetaMMoy = 0.5 * (thetaM + thetaMAvant);
    const thetaS = (c.Htr_ms * thetaMMoy + versSurfaces) / (c.Htr_ms + c.Htr_w + H1);
    const thetaAir = (c.Htr_is * thetaS + Hve * h.thetaSup + phi.ia) / (c.Htr_is + Hve);
    const thetaOp = PART_AIR_OPERATIVE * thetaAir + (1 - PART_AIR_OPERATIVE) * thetaS;
    // Les flux (W, positifs quand ils ENTRENT dans la maison), pour le dessin et le contrôle.
    const flux = {
      ventilation: Hve * (h.thetaSup - thetaAir),
      fenetres: c.Htr_w * (h.thetaE - thetaS),
      opaques: c.Htr_em * (h.thetaEop - thetaMMoy),
      versMasse: c.Htr_ms * (thetaS - thetaMMoy),         // ce que les surfaces donnent à la masse
      versAir: c.Htr_is * (thetaS - thetaAir),            // ce que les surfaces donnent à l'air
      stockage: C * (thetaM - thetaMAvant)                 // ce que la masse garde pendant l'heure
    };
    // Bilan de chaque nœud : doit valoir 0 (à l'arrondi près).
    const bilan = {
      air: flux.versAir + flux.ventilation + phi.ia,
      surfaces: -flux.versMasse - flux.versAir + flux.fenetres + phi.st,
      masse: phi.m + flux.opaques + flux.versMasse - flux.stockage
    };
    return { thetaM: thetaM, thetaMMoy: thetaMMoy, thetaS: thetaS, thetaAir: thetaAir, thetaOp: thetaOp, H1: H1, H2: H2, H3: H3, flux: flux, bilan: bilan };
  }

  /* ==========================================================
     4. LE SOL SOUS LA DALLE (H)
     Le sol est un gros volant thermique : sous une dalle, il reste proche de la MOYENNE ANNUELLE
     de l'air extérieur, et ne suit les saisons qu'à moitié et avec un mois de retard (la chaleur de
     l'été met des semaines à descendre dans la terre). Hypothèse (H) inspirée de la NF EN ISO 13370 :
       θsol(k) = Tmoy,an + amortissement × (Tmoy,30 j(k − retard) − Tmoy,an)
     ========================================================== */
  const SOL = { amortissement: 0.5, retardJours: 30, fenetreJours: 30 };

  function temperatureSol(T, reglage) {
    const r = Object.assign({}, SOL, reglage || {});
    const N = T.length;
    let somme = 0;
    for (let k = 0; k < N; k++) somme += T[k];
    const moyenne = somme / N;
    const L = r.fenetreJours * 24, retard = r.retardJours * 24;
    // Sommes cumulées pour les moyennes glissantes (l'année se referme sur elle-même).
    const cumul = new Float64Array(N + 1);
    for (let k = 0; k < N; k++) cumul[k + 1] = cumul[k] + T[k];
    const moyenneGlissante = function (fin) {     // moyenne des L heures qui précèdent l'heure « fin » (modulo l'année)
      let s = 0, debut = fin - L;
      while (debut < 0) { debut += N; fin += N; }
      // [debut, fin[ peut déborder de l'année : on coupe en deux.
      if (fin <= N) s = cumul[fin] - cumul[debut];
      else s = cumul[N] - cumul[debut] + cumul[fin - N];
      return s / L;
    };
    const sol = new Float64Array(N);
    for (let k = 0; k < N; k++) sol[k] = moyenne + r.amortissement * (moyenneGlissante(k - retard) - moyenne);
    return { serie: sol, moyenneAnnuelle: moyenne };
  }

  /* ==========================================================
     5. LA VENTILATION, HEURE PAR HEURE
     v = { base (vol/h : VMC + infiltrations), nuit: { active, debit (vol/h), debut, fin (heures légales),
           ecart (K : il faut dehors plus frais que dedans d'au moins ça), seuil (°C : on n'ouvre pas si la maison
           est déjà fraîche) } }
     Règle (H) : la surventilation nocturne (fenêtres ouvertes) s'ajoute à la base entre debut et fin
     si, à l'heure précédente, l'air de la maison dépassait le seuil ET dehors était plus frais de « ecart ».
     ========================================================== */
  function dansLaPlage(heure, debut, fin) {
    return debut <= fin ? (heure >= debut && heure < fin) : (heure >= debut || heure < fin);
  }
  function debitVentilation(v, heureLegale, thetaAirAvant, thetaE) {
    const nuit = v.nuit;
    const ouvert = !!(nuit && nuit.active && Number(nuit.debit) > 0 && dansLaPlage(heureLegale, Number(nuit.debut), Number(nuit.fin)) &&
      thetaAirAvant > Number(nuit.seuil) && thetaE < thetaAirAvant - Number(nuit.ecart));
    return { n: Number(v.base) + (ouvert ? Number(nuit.debit) : 0), ouvert: ouvert };
  }

  // Infiltrations (H) : la « règle du 1/20 » (Sherman, 1987) : débit moyen ≈ n50 / 20.
  const DIVISEUR_N50 = 20;
  function infiltrations(n50) { return Math.max(0, Number(n50) || 0) / DIVISEUR_N50; }

  /* ==========================================================
     6. TOUTE LA PÉRIODE, HEURE PAR HEURE
     e = { Af, Am, Cm, V, Htr_w, opaques, T (8 760 h), Tsol (série ou null → calculée),
           apports: { internes, solaires } (tableaux indexés depuis k0, en W),
           ventilation: { base, nuit }, heures: [k0, k1[, thetaInitiale (défaut : T[k0]) }
     Rend des tableaux d'une valeur par heure, indexés comme les apports (i = k − k0) :
     Tm = température moyenne de la masse sur l'heure (celle du bilan), TmFin = sa valeur à la fin de l'heure.
     ========================================================== */
  function simuler(e) {
    const c = conductances(e);
    const k0 = e.heures ? e.heures[0] : 0, k1 = e.heures ? e.heures[1] : e.T.length;
    const N = k1 - k0;
    const tab = function () { return new Float64Array(N); };
    const sol = e.Tsol ? { serie: e.Tsol } : temperatureSol(e.T, e.sol);
    const r = {
      k0: k0, N: N, conductances: c, Tsol: sol.serie,
      Text: tab(), Tair: tab(), Ts: tab(), Tm: tab(), TmFin: tab(), Top: tab(), Hve: tab(), n: tab(), nuit: new Uint8Array(N),
      flux: { ventilation: tab(), fenetres: tab(), opaques: tab(), versMasse: tab(), versAir: tab(), stockage: tab(), apports: tab() },
      bilanMax: 0
    };
    let thetaM = e.thetaInitiale !== undefined ? e.thetaInitiale : e.T[k0];
    let thetaAirAvant = thetaM;
    for (let i = 0; i < N; i++) {
      const k = k0 + i;
      const thetaE = e.T[k];
      const n = Math.floor(k / 24) % 365 + 1;
      const heureLegale = (k % 24 + (S ? S.decalageLegal(n) : 1)) % 24;
      const vent = debitVentilation(e.ventilation, heureLegale, thetaAirAvant, thetaE);
      const Hve = conductanceVentilation(vent.n, e.V);
      const phi = repartirApports(e.apports.internes[i], e.apports.solaires[i], c);
      const p = pasHoraire(thetaM, c, {
        thetaE: thetaE, thetaEop: (1 - c.partSol) * thetaE + c.partSol * sol.serie[k], thetaSup: thetaE, Hve: Hve, phi: phi
      });
      r.Text[i] = thetaE; r.Tair[i] = p.thetaAir; r.Ts[i] = p.thetaS; r.Tm[i] = p.thetaMMoy; r.TmFin[i] = p.thetaM; r.Top[i] = p.thetaOp;
      r.Hve[i] = Hve; r.n[i] = vent.n; r.nuit[i] = vent.ouvert ? 1 : 0;
      Object.keys(p.flux).forEach(function (f) { r.flux[f][i] = p.flux[f]; });
      r.flux.apports[i] = phi.total;
      r.bilanMax = Math.max(r.bilanMax, Math.abs(p.bilan.air), Math.abs(p.bilan.surfaces), Math.abs(p.bilan.masse));
      thetaM = p.thetaM;
      thetaAirAvant = p.thetaAir;
    }
    return r;
  }

  /* ==========================================================
     7. DEUX RÉSULTATS QU'ON PEUT VÉRIFIER À LA MAIN
     ========================================================== */
  // Régime permanent : tout est constant depuis longtemps, la masse ne stocke plus rien.
  // Si dehors, le sol et l'air soufflé sont à la même température θe :
  //   θ (partout) = θe + Φ / (Htr_op + Htr_w + Hve)       — comme un seul « H » en hiver, à l'envers.
  // (Les trois nœuds ne sont pas exactement égaux : l'air et les surfaces sont un peu plus chauds que la masse,
  //  selon où la chaleur arrive ; cette formule donne la moyenne pondérée. Les tests résolvent le circuit complet.)
  function regimePermanent(c, thetaE, Hve, phiTotal) {
    const H = c.Htr_op + c.Htr_w + Hve;
    return { H: H, theta: thetaE + phiTotal / H };
  }

  // Constante de temps τ (h) : le temps pour que la masse « oublie » les 2/3 d'un écart avec dehors.
  // Sans apport, la masse ne voit que Htr_em et H3 vers dehors : τ = (Cm/3600) / (Htr_em + H3).
  // Une maison légère : quelques heures ; une maison lourde et isolée : plusieurs jours.
  function constanteDeTemps(c, Hve) {
    const H1 = 1 / (1 / Math.max(Hve, 1e-12) + 1 / c.Htr_is);
    const H3 = 1 / (1 / (H1 + c.Htr_w) + 1 / c.Htr_ms);
    return c.Cm / SECONDES_PAR_HEURE / (c.Htr_em + H3);
  }

  /* ==========================================================
     8. LES ENTRÉES DEPUIS LA MAISON DU CHAPITRE 1 BIS ET LES APPORTS DU CHAPITRE 2
     m = { synthese (ConfortBatiment.syntheseProjet), apports (ConfortSoleil.apportsHoraires),
           meteo { T }, ventilation { vmc, n50, nuit }, heures [k0, k1[ }
     ========================================================== */
  function entreesMaison(m) {
    const s = m.synthese, d = s.deperditions.lignes;
    const ligne = function (id) { return d.find(function (l) { return l.id === id; }); };
    const a = m.apports;
    const solaires = new Float64Array(a.N), internes = new Float64Array(a.N);
    for (let i = 0; i < a.N; i++) { solaires[i] = a.fenetres[i] + a.murs[i] + a.toiture[i]; internes[i] = a.internes[i]; }
    const v = m.ventilation;
    return {
      Af: s.surfacePlancher, Am: s.inertie.am, Cm: s.inertie.cm, V: s.volume,
      Htr_w: ligne('vitrages').UA,
      opaques: [
        { nom: 'Murs', UA: ligne('murs').UA, vers: 'exterieur' },
        { nom: ligne('toiture').nom, UA: ligne('toiture').UA, vers: 'exterieur' },
        { nom: 'Plancher bas', UA: ligne('plancherBas').UA, vers: 'sol' }
      ],
      T: m.meteo.T, sol: m.sol,
      apports: { internes: internes, solaires: solaires },
      ventilation: { base: Number(v.vmc) + infiltrations(v.n50), nuit: v.nuit },
      heures: m.heures || [a.k0, a.k0 + a.N]
    };
  }

  /* ---------- Quelques résumés d'une série (sans jugement : les indicateurs sont l'étape 4) ---------- */
  function resumer(serie, debut, fin) {
    let max = -Infinity, min = Infinity, s = 0, iMax = -1;
    const d = debut || 0, f = fin === undefined ? serie.length : fin;
    for (let i = d; i < f; i++) { const v = serie[i]; s += v; if (v > max) { max = v; iMax = i; } if (v < min) min = v; }
    return { max: max, min: min, moyenne: s / (f - d), iMax: iMax };
  }

  const ConfortCinqR1C = {
    H_IS: H_IS, H_MS: H_MS, LAMBDA_AT: LAMBDA_AT, PART_AIR_OPERATIVE: PART_AIR_OPERATIVE, RHO_C_AIR: RHO_C_AIR,
    SOL: SOL, DIVISEUR_N50: DIVISEUR_N50,
    conductances: conductances, conductanceVentilation: conductanceVentilation, repartirApports: repartirApports,
    pasHoraire: pasHoraire, temperatureSol: temperatureSol, dansLaPlage: dansLaPlage, debitVentilation: debitVentilation,
    infiltrations: infiltrations, simuler: simuler, regimePermanent: regimePermanent, constanteDeTemps: constanteDeTemps,
    entreesMaison: entreesMaison, resumer: resumer
  };

  global.ConfortCinqR1C = ConfortCinqR1C;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortCinqR1C;
})(typeof window !== 'undefined' ? window : globalThis);
