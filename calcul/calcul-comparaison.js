/* ==========================================================
   CONFORT D'ÉTÉ — COMPARER DES PAROIS (l'existant et ses variantes)
   ----------------------------------------------------------
   Fonctions pures. On met plusieurs parois dans LES MÊMES conditions et on lit les écarts :
     - ce que voit la face extérieure : la météo réelle (chapitre 2 : température sol-air,
       ou le sol sous la dalle pour un plancher bas, chapitre 3) ;
     - la pièce est MAINTENUE à une température fixe (26 °C (H)) : on isole ainsi le comportement
       de la paroi seule. La face intérieure monte alors de Rsi × q au-dessus de l'air :
       θsi = θpièce + Rsi × q   — plus le flux q qui traverse est fort, plus la face est chaude ;
     - la simulation est celle du chapitre 1 ter (différences finies), les indicateurs périodiques
       ceux du chapitre 1 (matrices NF EN ISO 13786).
   Hiver (régime permanent) : U, R = 1/U, et la température de la face intérieure par temps froid :
       θsi = θi − U × Rsi × (θi − θe)      [W/(m²·K)] × [m²·K/W] × [K] = K
     Une paroi mal isolée a une face intérieure froide : « l'effet de paroi froide ».
   ========================================================== */
(function (global) {
  'use strict';

  const req = function (nom, fichier) { return global[nom] || (typeof require === 'function' ? require(fichier) : null); };
  const P = req('ConfortParois', './calcul-parois.js');
  const T = req('ConfortTransitoire', './calcul-transitoire.js');
  const S = req('ConfortSoleil', './calcul-soleil.js');
  const R5 = req('ConfortCinqR1C', './calcul-5r1c.js');

  const PRECHAUFFAGE_JOURS = 4;
  // Conditions conventionnelles de la comparaison (H).
  const CONDITIONS = { tPiece: 26, hiver: { tInt: 20, tExt: -5 } };
  const SENS_FLUX = { mur: 'horizontal', toiture: 'descendant', plancher: 'descendant' };

  // Premier jour de la période : la semaine la plus chaude de juin → septembre, ou un jour donné (1 à 365).
  function jourDebutPeriode(meteo, debut) {
    if (debut === 'semaine' || debut === undefined) {
      return S.semaineLaPlusChaude(meteo.T, (S.jourDeLAnnee(6, 1) - 1) * 24, S.jourDeLAnnee(9, 30) * 24).debut / 24 + 1;
    }
    return Number(debut);
  }

  // Ce que voit la face extérieure, heure par heure (heure légale), 4 jours de préchauffage compris.
  //   c = { meteo, lieu {lat, lon}, nature 'mur' | 'toiture' | 'plancher', orientation (azimut), pente (toiture), alpha, debut, jours, sol }
  function scenarioMeteoParoi(c) {
    const m = c.meteo, j0 = jourDebutPeriode(m, c.debut), jours = Number(c.jours);
    const decal = S.decalageLegal(j0);
    const k0 = (j0 - 1) * 24 - decal - PRECHAUFFAGE_JOURS * 24, k1 = k0 + PRECHAUFFAGE_JOURS * 24 + jours * 24 + 1;
    const boucle = function (k) { return ((k % 8760) + 8760) % 8760; };
    let valeurs;
    if (c.nature === 'plancher') {
      const sol = R5.temperatureSol(m.T, c.sol).serie;
      valeurs = new Float64Array(k1 - k0);
      for (let i = 0; i < valeurs.length; i++) valeurs[i] = sol[boucle(k0 + i)];
    } else {
      valeurs = S.serieSolAir(m, c.lieu, c.nature === 'toiture' ? Number(c.pente) : 90, Number(c.orientation), c.alpha, k0, k1);
    }
    const air = new Float64Array(k1 - k0);
    for (let i = 0; i < air.length; i++) air[i] = m.T[boucle(k0 + i)];
    const origine = -PRECHAUFFAGE_JOURS * 24;
    return { type: 'serie', origine: origine, valeurs: valeurs, air: { type: 'serie', origine: origine, valeurs: air },
      jourDebut: j0, nature: c.nature, alpha: c.alpha, duree: jours * 24 };
  }

  // Hiver, régime permanent : U, R et la température de la face intérieure.
  function hiver(U, rsi, cond) {
    const h = cond || CONDITIONS.hiver;
    return { U: U, R: 1 / U, tSi: h.tInt - U * rsi * (h.tInt - h.tExt), tInt: h.tInt, tExt: h.tExt };
  }

  // Une paroi dans les conditions communes. paroi = { couches: [{ materiau, e }] }, materiaux = la bibliothèque.
  // Rend null si la paroi est incomplète.
  function evaluerParoi(paroi, materiaux, nature, scenario, conditions) {
    const cond = Object.assign({}, CONDITIONS, conditions || {});
    const p = { type: 'exterieure', sensFlux: SENS_FLUX[nature] || 'horizontal', couches: paroi.couches };
    const analyse = P.analyserParoi(p, materiaux);
    if (!analyse.ok) return { ok: false, erreurs: analyse.erreurs };
    const couches = P.couchesPhysiques(p, materiaux);
    const sim = T.simuler({
      couches: couches, rs: analyse.rs, scenario: scenario, prechauffageJours: PRECHAUFFAGE_JOURS,
      piece: { mode: 'fixe', tInterieure: cond.tPiece }, dureeHeures: scenario.duree, pasSecondes: 60, sortieMinutes: 60
    });
    const r = T.resumerSimulation(sim, 0);
    const jours = scenario.duree / 24;
    return {
      ok: true, analyse: analyse, couches: couches,
      serie: { temps: sim.temps, tSi: sim.tSi, flux: sim.fluxInt, tExt: sim.tExt },
      valeurs: {
        dephasage: analyse.dyn.dephasage, amortissement: analyse.dyn.amortissement, kappa1: analyse.dyn.kappa1 / 1000,
        tSiMax: r.tSi.max, fluxMax: r.flux.max, energie: r.energie / jours,            // Wh/m² entrés par jour
        U: analyse.U, R: 1 / analyse.U, tSiHiver: hiver(analyse.U, analyse.rs.rsi, cond.hiver).tSi,
        epaisseur: analyse.epaisseur * 100, masse: analyse.masse
      },
      exemples: analyse.exemples
    };
  }

  // Les lignes du tableau : sens = 'haut' (plus c'est grand, mieux c'est), 'bas', ou null (ni mieux ni pire : une contrainte).
  const LIGNES = [
    { groupe: 'Été', id: 'dephasage', nom: 'Déphasage Δt', unite: 'h', dec: 1, sens: 'haut' },
    { groupe: 'Été', id: 'amortissement', nom: 'Amortissement f', unite: '', dec: 3, sens: 'bas' },
    { groupe: 'Été', id: 'kappa1', nom: 'Capacité côté pièce κ1', unite: 'kJ/(m²·K)', dec: 1, sens: 'haut' },
    { groupe: 'Été', id: 'tSiMax', nom: 'Face intérieure, maximum', unite: '°C', dec: 1, sens: 'bas' },
    { groupe: 'Été', id: 'fluxMax', nom: 'Flux de pointe entrant', unite: 'W/m²', dec: 1, sens: 'bas' },
    { groupe: 'Été', id: 'energie', nom: 'Chaleur entrée par jour', unite: 'Wh/m²', dec: 0, sens: 'bas' },
    { groupe: 'Hiver', id: 'U', nom: 'Transmission U', unite: 'W/(m²·K)', dec: 3, sens: 'bas' },
    { groupe: 'Hiver', id: 'R', nom: 'Résistance R = 1/U', unite: 'm²·K/W', dec: 2, sens: 'haut' },
    { groupe: 'Hiver', id: 'tSiHiver', nom: 'Face intérieure par temps froid', unite: '°C', dec: 1, sens: 'haut' },
    { groupe: 'Mise en œuvre', id: 'epaisseur', nom: 'Épaisseur totale', unite: 'cm', dec: 1, sens: null },
    { groupe: 'Mise en œuvre', id: 'masse', nom: 'Masse surfacique', unite: 'kg/m²', dec: 0, sens: null }
  ];

  // Compare des parois évaluées à une référence (l'existant). Rend, pour chaque ligne et chaque paroi,
  // la valeur, l'écart à la référence et s'il va dans le bon sens ('mieux' | 'pire' | 'egal' | 'neutre').
  function comparer(evaluations, indexReference) {
    const ref = evaluations[indexReference];
    return LIGNES.map(function (l) {
      return Object.assign({}, l, {
        cases: evaluations.map(function (e, i) {
          if (!e || !e.ok) return { valeur: null };
          const v = e.valeurs[l.id];
          if (i === indexReference || !ref || !ref.ok) return { valeur: v, reference: i === indexReference };
          const ecart = v - ref.valeurs[l.id];
          const seuil = Math.pow(10, -l.dec) / 2;
          const jugement = Math.abs(ecart) < seuil ? 'egal' : (l.sens === null ? 'neutre' : ((l.sens === 'haut') === (ecart > 0) ? 'mieux' : 'pire'));
          return { valeur: v, ecart: ecart, jugement: jugement };
        })
      });
    });
  }

  const ConfortComparaison = {
    PRECHAUFFAGE_JOURS: PRECHAUFFAGE_JOURS, CONDITIONS: CONDITIONS, SENS_FLUX: SENS_FLUX, LIGNES: LIGNES,
    jourDebutPeriode: jourDebutPeriode, scenarioMeteoParoi: scenarioMeteoParoi, hiver: hiver, evaluerParoi: evaluerParoi, comparer: comparer
  };
  global.ConfortComparaison = ConfortComparaison;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortComparaison;
})(typeof window !== 'undefined' ? window : globalThis);
