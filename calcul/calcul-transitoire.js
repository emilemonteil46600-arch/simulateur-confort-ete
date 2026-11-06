/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 1 TER : LA CHALEUR QUI AVANCE (régime variable)
   ----------------------------------------------------------
   Le labo de l'atelier : on suit, minute par minute, la température dans le mur
   et dans la pièce. Méthode des DIFFÉRENCES FINIES (volumes finis) :

   1) On découpe le mur en tranches fines (≤ 5 mm). Chaque tranche i a :
        une capacité      Ci = ρ·c·dx            [J/(m²·K)]
        une température   Ti (au milieu de la tranche)
   2) Entre deux tranches voisines, la chaleur passe à travers une conductance
        G = 1 / (dx1/(2λ1) + dx2/(2λ2))            [W/(m²·K)]
      (deux demi-tranches en série : c'est la loi de Fourier écrite pour deux points voisins).
      Côté air : G = 1 / (Rs + dx/(2λ)).
   3) Bilan d'énergie de chaque tranche pendant un pas de temps Δt :
        Ci × (Ti' − Ti) / Δt = Σ G × (T voisin' − Ti')
      « ce qui s'accumule = ce qui entre − ce qui sort ». C'est l'équation de la chaleur
      ∂θ/∂t = a·∂²θ/∂x², écrite tranche par tranche.
   4) Schéma IMPLICITE (les températures de droite sont celles de la fin du pas, notées ') :
      toujours stable, quel que soit Δt. On résout à chaque pas un système « tridiagonal »
      (chaque tranche ne parle qu'à ses 2 voisines) par l'algorithme de Thomas.

   La pièce (option « libre ») est un nœud de plus, ramené au m² de mur étudié :
        Cp × (Ta' − Ta)/Δt = G0 × (T1' − Ta') + Hv × (Te' − Ta')
        Cp = (ρc air × V + C mobilier) / A mur     Hv = ρc air × n × V / 3600 / A mur
   (H) Les autres parois de la pièce sont adiabatiques et sans masse : seul le mur étudié échange.

   Flux qui entre dans la pièce (W/m²) :  q = G0 × (T1 − Ta)
   Température de la face intérieure :    θsi = Ta + Rsi × q
   ========================================================== */
(function (global) {
  'use strict';

  const RHO_C_AIR = 1200;       // J/(m³·K) : ρ ≈ 1,2 kg/m³ × c ≈ 1 000 J/(kg·K) (H : air à ~20 °C)
  const DX_MAX = 0.005;         // m : tranches de 5 mm au plus
  const TRANCHES_MIN = 2;       // au moins 2 tranches par couche, même très fine

  /* ---------- 1. Le maillage ---------- */

  function mailler(couches, dxMax) {
    const pas = dxMax || DX_MAX;
    const cellules = [];
    let x = 0;
    couches.forEach(function (c, k) {
      const n = Math.max(TRANCHES_MIN, Math.ceil(c.e / pas - 1e-9));
      const dx = c.e / n;
      for (let i = 0; i < n; i++) {
        cellules.push({ couche: k, x0: x, x1: x + dx, xc: x + dx / 2, dx: dx, lambda: c.lambda, C: c.rho * c.c * dx });
        x += dx;
      }
    });
    return cellules;
  }

  // G[0] : air intérieur → tranche 1 ; G[i] : tranche i → tranche i+1 ; G[N] : dernière tranche → air extérieur.
  function conductances(cellules, rs) {
    const N = cellules.length;
    const G = [1 / (rs.rsi + cellules[0].dx / (2 * cellules[0].lambda))];
    for (let i = 0; i < N - 1; i++) {
      G.push(1 / (cellules[i].dx / (2 * cellules[i].lambda) + cellules[i + 1].dx / (2 * cellules[i + 1].lambda)));
    }
    G.push(1 / (rs.rse + cellules[N - 1].dx / (2 * cellules[N - 1].lambda)));
    return G;
  }

  /* ---------- 2. La température dehors ---------- */

  // 'echelon' : un « coup de chaud » brutal à t = 0 (de tAvant à tApres) — pour voir le front avancer.
  // 'journee' : sinusoïde de 24 h (moyenne ± amplitude, maximum à heureMax) — la vraie vie, en simplifié.
  function temperatureExterieure(scenario, heures) {
    if (scenario.type === 'echelon') return heures < 0 ? scenario.tAvant : scenario.tApres;
    const w = 2 * Math.PI / 24;
    return scenario.tMoyenne + scenario.amplitude * Math.cos(w * (heures - scenario.heureMax));
  }

  /* ---------- 3. Algorithme de Thomas (système tridiagonal) ----------
     a[i]·x[i−1] + b[i]·x[i] + c[i]·x[i+1] = d[i]. Une descente qui élimine a[i], puis une remontée. */
  function thomas(a, b, c, d) {
    const n = b.length;
    const cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
    for (let i = 1; i < n; i++) {
      const m = b[i] - a[i] * cp[i - 1];
      cp[i] = c[i] / m;
      dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
    }
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  }

  /* ---------- 4. La pièce, ramenée au m² de mur ---------- */

  function pieceParM2(piece) {
    if (!piece || piece.mode !== 'libre') return null;
    const A = Number(piece.aireMur), V = Number(piece.volume);
    return {
      C: (RHO_C_AIR * V + Number(piece.capaciteMobilier || 0)) / A,       // J/(K·m² de mur)
      Hv: RHO_C_AIR * Number(piece.renouvellement || 0) * V / 3600 / A     // W/(K·m² de mur)
    };
  }

  /* ---------- 5. La simulation ----------
     options = { couches, rs, scenario, piece: { mode: 'fixe' | 'libre', tInterieure, … },
                 dureeHeures, pasSecondes (60), sortieMinutes (10), prechauffageJours (journée : 4),
                 schema: 1 (implicite) | 0.5 (Crank-Nicolson) } */
  function simuler(o) {
    const cellules = mailler(o.couches, o.dxMax);
    const G = conductances(cellules, o.rs);
    const N = cellules.length;
    const pas = o.pasSecondes || 60;
    const theta = o.schema || 1;
    const pp = pieceParM2(o.piece);
    const libre = !!pp;
    const tInt0 = Number(o.piece.tInterieure);
    const sortie = Math.max(1, Math.round((o.sortieMinutes || 10) * 60 / pas));
    const tInit = o.scenario.type === 'echelon' ? Number(o.tInitiale !== undefined ? o.tInitiale : tInt0) : tInt0;
    const debut = o.scenario.type === 'journee' ? -24 * (o.prechauffageJours === undefined ? 4 : o.prechauffageJours) : 0;
    const etapes = Math.round((o.dureeHeures * 3600 - debut * 3600) / pas);

    // Inconnues : [pièce (si libre)] + tranches. Indice de la tranche i = i + decal.
    const decal = libre ? 1 : 0;
    const n = N + decal;
    let T = new Float64Array(n).fill(tInit);
    const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);

    const res = { cellules: cellules, conductances: G, temps: [], profils: [], tExt: [], tPiece: [], tSi: [], tSe: [], fluxInt: [], fluxExt: [], energieInt: [], bilan: null };
    let energieInt = 0, entreeTotale = 0;
    const stockInitial = energieStockee(T);

    function energieStockee(V) {
      let e = 0;
      for (let i = 0; i < N; i++) e += cellules[i].C * V[i + decal];
      if (libre) e += pp.C * V[0];
      return e;
    }
    function airInterieur(V) { return libre ? V[0] : tInt0; }
    function enregistrer(h, V, te) {
      const ta = airInterieur(V);
      const q = G[0] * (V[decal] - ta);
      const qe = G[N] * (te - V[N - 1 + decal]);
      res.temps.push(h);
      res.profils.push(Array.from(V.subarray(decal)));
      res.tExt.push(te); res.tPiece.push(ta);
      res.tSi.push(ta + o.rs.rsi * q); res.tSe.push(te - o.rs.rse * qe);
      res.fluxInt.push(q); res.fluxExt.push(qe);
      res.energieInt.push(energieInt / 3600);
    }

    if (debut === 0) enregistrer(0, T, temperatureExterieure(o.scenario, 0));
    for (let s = 1; s <= etapes; s++) {
      const h0 = debut + (s - 1) * pas / 3600, h1 = debut + s * pas / 3600;
      const te0 = temperatureExterieure(o.scenario, h0), te1 = temperatureExterieure(o.scenario, h1);
      const taFixe = tInt0;
      // Tranches : Ci/Δt·(Ti' − Ti) = θ·[flux en fin de pas] + (1 − θ)·[flux en début de pas]
      for (let i = 0; i < N; i++) {
        const k = i + decal;
        const gl = G[i], gr = G[i + 1];
        const Ti = T[k];
        const Tl = i === 0 ? (libre ? T[0] : taFixe) : T[k - 1];
        const Tr = i === N - 1 ? te0 : T[k + 1];
        a[k] = (i === 0 && !libre) ? 0 : -theta * gl;
        c[k] = i === N - 1 ? 0 : -theta * gr;
        b[k] = cellules[i].C / pas + theta * (gl + gr);
        d[k] = cellules[i].C / pas * Ti + (1 - theta) * (gl * (Tl - Ti) + gr * (Tr - Ti));
        if (i === 0 && !libre) d[k] += theta * gl * taFixe;
        if (i === N - 1) d[k] += theta * gr * te1;
      }
      if (libre) {
        const Ta = T[0];
        a[0] = 0;
        c[0] = -theta * G[0];
        b[0] = pp.C / pas + theta * (G[0] + pp.Hv);
        d[0] = pp.C / pas * Ta + (1 - theta) * (G[0] * (T[1] - Ta) + pp.Hv * (te0 - Ta)) + theta * pp.Hv * te1;
      }
      const avant = T;
      T = thomas(a, b, c, d);
      // Énergie qui entre dans la pièce par le mur, et énergie qui entre dans le système (mur + pièce) depuis dehors.
      const qMoy = theta * G[0] * (T[decal] - airInterieur(T)) + (1 - theta) * G[0] * (avant[decal] - airInterieur(avant));
      const qeMoy = theta * G[N] * (te1 - T[N - 1 + decal]) + (1 - theta) * G[N] * (te0 - avant[N - 1 + decal]);
      const qvMoy = libre ? theta * pp.Hv * (te1 - T[0]) + (1 - theta) * pp.Hv * (te0 - avant[0]) : -qMoy;
      if (h1 > 1e-9) {
        energieInt += qMoy * pas;
        entreeTotale += (qeMoy + qvMoy) * pas;
      }
      if (h1 >= -1e-9 && Math.round(h1 * 3600 / pas) % sortie === 0) enregistrer(h1, T, te1);
      if (debut < 0 && Math.abs(h1) < 1e-9) entreeTotale = 0;
    }
    // Contrôle : la variation d'énergie stockée doit égaler ce qui est entré (conservation de l'énergie).
    if (debut === 0) {
      const variation = energieStockee(T) - stockInitial;
      res.bilan = { variation: variation, entree: entreeTotale, ecartRelatif: Math.abs(variation - entreeTotale) / Math.max(1, Math.abs(entreeTotale)) };
    }
    return res;
  }

  /* ---------- 6. Ce qu'on en lit ---------- */

  // Premier instant où une grandeur a fait « fraction » du chemin entre sa valeur de départ et sa valeur finale.
  function tempsDeReponse(temps, serie, fraction) {
    const depart = serie[0], fin = serie[serie.length - 1];
    const cible = depart + fraction * (fin - depart);
    for (let i = 1; i < serie.length; i++) {
      if ((fin - depart) >= 0 ? serie[i] >= cible : serie[i] <= cible) return temps[i];
    }
    return null;
  }

  // Ordre de grandeur du temps que met une variation de température à traverser une épaisseur e :
  // t ≈ e² / a  (a = λ/(ρc), la diffusivité). [m²] / [m²/s] = s. Béton 20 cm : 0,04 / 1e-6 = 40 000 s ≈ 11 h.
  function tempsDiffusion(epaisseur, diffusivite) { return epaisseur * epaisseur / diffusivite; }

  // Nombre de Fourier d'un pas : Fo = a·Δt/dx². Un schéma explicite exige Fo ≤ 1/2 ; l'implicite, non.
  function nombreFourier(diffusivite, pas, dx) { return diffusivite * pas / (dx * dx); }

  const ConfortTransitoire = {
    RHO_C_AIR: RHO_C_AIR,
    DX_MAX: DX_MAX,
    mailler: mailler,
    conductances: conductances,
    temperatureExterieure: temperatureExterieure,
    thomas: thomas,
    pieceParM2: pieceParM2,
    simuler: simuler,
    tempsDeReponse: tempsDeReponse,
    tempsDiffusion: tempsDiffusion,
    nombreFourier: nombreFourier
  };
  global.ConfortTransitoire = ConfortTransitoire;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortTransitoire;
})(typeof window !== 'undefined' ? window : globalThis);
