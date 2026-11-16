/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 4 (début) : LES INDICATEURS DE SYNTHÈSE
   ----------------------------------------------------------
   Fonctions pures. À partir des températures opératives horaires du chapitre 3 :
     - les DEGRÉS-HEURES d'inconfort (DH) : la somme, heure par heure, de ce qui dépasse un seuil ;
       1 DH = 1 heure passée 1 °C au-dessus du seuil. Durée × intensité, en °C·h ;
     - le pic opératif, et le pic de nuit (le sommeil) ;
     - d'où vient la chaleur (vitrages, parois opaques au soleil, apports internes, air extérieur chaud).

   (H) Les DH affichés sont INDICATIFS : ils reprennent l'idée de l'indicateur de la RE2020 mais pas sa méthode.
   La RE2020 (Th-BCE) calcule les DH sur une météo caniculaire conventionnelle, en occupation, avec un seuil
   adaptatif (26 à 28 °C le jour selon les jours précédents, 26 °C la nuit) ; ici : année type PVGIS (été normal),
   toutes les heures de juin à septembre, seuils fixes 28 °C le jour et 26 °C la nuit. Les repères 350 et 1 250 °C·h
   sont ceux qu'on cite pour la RE2020 (H : à vérifier dans l'arrêté) ; ils servent à situer, pas à déclarer conforme.
   ========================================================== */
(function (global) {
  'use strict';

  const S = global.ConfortSoleil || (typeof require === 'function' ? require('./calcul-soleil.js') : null);

  const SEUILS_DH = { jour: 28, nuit: 26, debutNuit: 22, finNuit: 7 };                 // (H)
  const REPERES_DH = [{ max: 350, id: 'confortable', nom: 'Confortable' }, { max: 1250, id: 'tolerable', nom: 'Tolérable' }, { max: Infinity, id: 'inconfort', nom: 'Inconfort marqué' }];   // (H)

  // Heure légale (0 à 23) de l'heure météo k (UTC, depuis le 1er janvier).
  function heureLegale(k) { const n = Math.floor(k / 24) % 365 + 1; return (k % 24 + S.decalageLegal(n)) % 24; }
  function estNuit(h, s) { return s.debutNuit <= s.finNuit ? (h >= s.debutNuit && h < s.finNuit) : (h >= s.debutNuit || h < s.finNuit); }

  // Top : températures opératives horaires, indexées depuis k0 ; on résume les indices [debut, fin[.
  //   DH = Σ max(0, Top − seuil)      seuil = 28 °C le jour, 26 °C la nuit (H)
  function indicateurs(Top, k0, debut, fin, seuils) {
    const s = Object.assign({}, SEUILS_DH, seuils || {});
    const f = fin === undefined ? Top.length : fin;
    const r = { dh: 0, dhJour: 0, dhNuit: 0, heuresAuDessus: 0, topMax: -Infinity, iMax: -1, topNuitMax: -Infinity, iNuitMax: -1, heures: f - debut, seuils: s };
    for (let i = debut; i < f; i++) {
      const nuit = estNuit(heureLegale(k0 + i), s);
      const exces = Top[i] - (nuit ? s.nuit : s.jour);
      if (exces > 0) { r.dh += exces; r.heuresAuDessus++; if (nuit) r.dhNuit += exces; else r.dhJour += exces; }
      if (Top[i] > r.topMax) { r.topMax = Top[i]; r.iMax = i; }
      if (nuit && Top[i] > r.topNuitMax) { r.topNuitMax = Top[i]; r.iNuitMax = i; }
    }
    r.repere = REPERES_DH.find(function (x) { return r.dh < x.max; }) || REPERES_DH[REPERES_DH.length - 1];
    return r;
  }

  // D'où vient la chaleur (kWh sur [debut, fin[) : ce qui ENTRE seulement.
  //   vitrages : soleil transmis par les fenêtres ; opaques : soleil absorbé par murs et toit (part positive, « sol-air ») ;
  //   internes : occupants, appareils, éclairage ; air : ventilation, infiltrations et transmission quand dehors est plus chaud que dedans.
  function originesChaleur(apports, sim, debut, fin) {
    const f = fin === undefined ? apports.N : fin;
    const r = { vitrages: 0, opaques: 0, internes: 0, air: 0 };
    for (let i = debut; i < f; i++) {
      r.vitrages += apports.fenetres[i];
      r.opaques += Math.max(0, apports.murs[i] + apports.toiture[i]);
      r.internes += apports.internes[i];
      r.air += Math.max(0, sim.flux.ventilation[i]) + Math.max(0, sim.flux.fenetres[i]) + Math.max(0, sim.flux.opaques[i]);
    }
    Object.keys(r).forEach(function (k) { r[k] /= 1000; });
    r.total = r.vitrages + r.opaques + r.internes + r.air;
    return r;
  }

  const ConfortIndicateurs = { SEUILS_DH: SEUILS_DH, REPERES_DH: REPERES_DH, heureLegale: heureLegale, estNuit: estNuit, indicateurs: indicateurs, originesChaleur: originesChaleur };
  global.ConfortIndicateurs = ConfortIndicateurs;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortIndicateurs;
})(typeof window !== 'undefined' ? window : globalThis);
