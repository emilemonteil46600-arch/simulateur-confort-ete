/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 1 BIS : LA MAISON (géométrie, surfaces, H, inertie)
   ----------------------------------------------------------
   Fonctions pures : elles reçoivent le projet et rendent des nombres.
   Elles servent la maquette 3D et les chapitres suivants (soleil, 5R1C).

   La maison est un volume rectangulaire :
     L = longueur (le long des façades A et C), l = largeur (façades B et D),
     n niveaux de hauteur d'étage he → hauteur des murs Hm = n × he.
   Orientation : azimut de la façade A, compté depuis le Nord dans le sens
   des aiguilles d'une montre (N = 0°, E = 90°, S = 180°, O = 270°).
   Les façades B, C, D suivent à +90°, +180°, +270°.

   Toiture (pente α, faîtage parallèle à la longueur L pour 2 pans) :
     hauteur du faîtage   h = (côté court / 2) × tan α
     surface des rampants = L × l / cos α   (toute face de pente α : surface au sol / cos α)
     combles perdus  → l'isolant est au plafond : paroi de toiture = L × l
     combles aménagés → l'isolant suit les rampants : paroi = L × l / cos α (+ pignons dans les murs)

   Déperditions par transmission (sans ponts thermiques ni effet du sol (H)) :
     H = Σ U × A   [W/(m²·K)] × [m²] = W/K

   Inertie de la maison (NF EN ISO 13790, voir chapitre 1) : Cm = Σ κ × A.
   ========================================================== */
(function (global) {
  'use strict';

  const P = global.ConfortParois || (typeof require === 'function' ? require('./calcul-parois.js') : null);

  const FACADES = ['A', 'B', 'C', 'D'];
  const ORIENTATIONS = [
    { court: 'N', nom: 'Nord' }, { court: 'NE', nom: 'Nord-Est' }, { court: 'E', nom: 'Est' }, { court: 'SE', nom: 'Sud-Est' },
    { court: 'S', nom: 'Sud' }, { court: 'SO', nom: 'Sud-Ouest' }, { court: 'O', nom: 'Ouest' }, { court: 'NO', nom: 'Nord-Ouest' }
  ];
  const RAD = Math.PI / 180;

  /* ---------- 1. Orientation ---------- */

  function normaliserAzimut(a) { return ((Number(a) % 360) + 360) % 360; }

  // Le secteur de 45° le plus proche : 0° → Nord, 100° → Est, 200° → Sud…
  function orientation(azimut) { return ORIENTATIONS[Math.round(normaliserAzimut(azimut) / 45) % 8]; }

  function azimutsFacades(azimutA) {
    const a = normaliserAzimut(azimutA);
    return { A: a, B: normaliserAzimut(a + 90), C: normaliserAzimut(a + 180), D: normaliserAzimut(a + 270) };
  }

  /* ---------- 2. Le volume ---------- */

  function hauteurMurs(g) { return Number(g.niveaux) * Number(g.hauteurEtage); }

  // Côté de la façade : A et C portent la longueur, B et D la largeur.
  function largeurFacade(g, f) { return f === 'A' || f === 'C' ? Number(g.longueur) : Number(g.largeur); }

  // Hauteur du faîtage au-dessus des murs. Toit plat : 0.
  // 2 pans : le faîtage suit la longueur, les pans descendent vers A et C → h = (l/2)·tan α.
  // 4 pans : les 4 pans ont la même pente → h = (côté court / 2)·tan α.
  function hauteurToit(g) {
    if (g.toit === 'plat') return 0;
    const cote = g.toit === 'deux-pans' ? Number(g.largeur) : Math.min(Number(g.longueur), Number(g.largeur));
    return cote / 2 * Math.tan(Number(g.pente) * RAD);
  }

  function combleChauffe(g) { return g.toit !== 'plat' && g.combles === 'amenages'; }

  // Pignon (triangle sous le toit à 2 pans, sur les façades B et D) : l × h / 2.
  function surfacePignon(g) { return g.toit === 'deux-pans' ? Number(g.largeur) * hauteurToit(g) / 2 : 0; }

  // Surface brute d'une façade dans l'enveloppe chauffée.
  // Le pignon n'en fait partie que si les combles sont aménagés (sinon il est au-dessus de l'isolant).
  function surfaceFacade(g, f) {
    const rect = largeurFacade(g, f) * hauteurMurs(g);
    const pignon = (f === 'B' || f === 'D') && combleChauffe(g) ? surfacePignon(g) : 0;
    return rect + pignon;
  }

  function surfaceSol(g) { return Number(g.longueur) * Number(g.largeur); }

  // Paroi « toiture » de l'enveloppe : le plafond des combles perdus ou la terrasse (L × l),
  // ou les rampants des combles aménagés (L × l / cos α).
  function surfaceToiture(g) {
    if (combleChauffe(g)) return surfaceSol(g) / Math.cos(Number(g.pente) * RAD);
    return surfaceSol(g);
  }

  // Surface de plancher Af (H) : L × l par niveau, en dimensions extérieures (épaisseur des murs négligée),
  // combles aménagés non comptés.
  function surfacePlancher(g) { return surfaceSol(g) * Number(g.niveaux); }

  // Volume chauffé : le parallélépipède, plus les combles s'ils sont aménagés.
  //   2 pans : prisme  V = L × l × h / 2
  //   4 pans : V = h × s × (3·Lg − s) / 6  (Lg grand côté, s petit côté ; s = Lg donne la pyramide s²·h/3)
  function volumeCombles(g) {
    if (!combleChauffe(g)) return 0;
    const h = hauteurToit(g);
    if (g.toit === 'deux-pans') return surfaceSol(g) * h / 2;
    const Lg = Math.max(Number(g.longueur), Number(g.largeur)), s = Math.min(Number(g.longueur), Number(g.largeur));
    return h * s * (3 * Lg - s) / 6;
  }

  function volume(g) { return surfaceSol(g) * hauteurMurs(g) + volumeCombles(g); }

  /* ---------- 3. Les façades : brut, vitré, opaque ---------- */

  function bilanFacades(projet) {
    const g = projet.geometrie;
    const az = azimutsFacades(g.orientation);
    return FACADES.map(function (f) {
      const brute = surfaceFacade(g, f);
      const vitrage = Math.max(0, Number((projet.facades[f] || {}).vitrage) || 0);
      return {
        id: f, azimut: az[f], orientation: orientation(az[f]),
        brute: brute, vitrage: vitrage, opaque: Math.max(0, brute - vitrage),
        tauxVitrage: brute > 0 ? vitrage / brute : 0,
        trop: vitrage > 0.8 * brute     // (H) au-delà de 80 % de la façade, la saisie est suspecte
      };
    });
  }

  /* ---------- 4. Déperditions par transmission ---------- */

  // analyses = { murs, toiture, plancherBas } : résultats de ConfortParois.analyserParoi.
  // vitrage = { Uw } : coefficient de la fenêtre entière (vitrage + menuiserie).
  function deperditions(projet, analyses, vitrage) {
    const g = projet.geometrie;
    const facades = bilanFacades(projet);
    const opaque = facades.reduce(function (s, f) { return s + f.opaque; }, 0);
    const vitre = facades.reduce(function (s, f) { return s + f.vitrage; }, 0);
    const lignes = [
      { id: 'murs', nom: 'Murs', U: analyses.murs.U, A: opaque },
      { id: 'vitrages', nom: 'Fenêtres', U: Number(vitrage.Uw), A: vitre },
      { id: 'toiture', nom: combleChauffe(g) ? 'Rampants' : (g.toit === 'plat' ? 'Toiture-terrasse' : 'Plafond sous combles'), U: analyses.toiture.U, A: surfaceToiture(g) },
      { id: 'plancherBas', nom: 'Plancher bas', U: analyses.plancherBas.U, A: surfaceSol(g) }
    ].map(function (l) { return Object.assign(l, { UA: l.U * l.A }); });
    const H = lignes.reduce(function (s, l) { return s + l.UA; }, 0);
    lignes.forEach(function (l) { l.part = H > 0 ? l.UA / H : 0; });
    return { lignes: lignes, H: H, parM2: surfacePlancher(g) > 0 ? H / surfacePlancher(g) : null };
  }

  /* ---------- 5. Inertie de toute la maison ---------- */

  // Éléments vus par l'air de la maison (une seule zone) :
  //   murs extérieurs (partie opaque), toiture, plancher bas : une face (κ1) ;
  //   planchers intermédiaires (n − 1 niveaux) : les deux faces sont dans la maison ;
  //   cloisons : surface = ratio × Af (H), les deux faces dans la maison.
  function elementsInertie(projet, analyses) {
    const g = projet.geometrie;
    const opaque = bilanFacades(projet).reduce(function (s, f) { return s + f.opaque; }, 0);
    const els = [
      { nom: 'Murs extérieurs', aire: opaque, contact: 'exterieur', analyse: analyses.murs },
      { nom: 'Toiture / plafond', aire: surfaceToiture(g), contact: 'exterieur', analyse: analyses.toiture },
      { nom: 'Plancher bas', aire: surfaceSol(g), contact: 'exterieur', analyse: analyses.plancherBas }
    ];
    if (Number(g.niveaux) > 1 && analyses.plancherInter) {
      els.push({ nom: 'Planchers intermédiaires', aire: surfaceSol(g) * (Number(g.niveaux) - 1), contact: 'deux', analyse: analyses.plancherInter });
    }
    const ratio = Number(projet.cloisons && projet.cloisons.ratio) || 0;
    if (ratio > 0 && analyses.cloisons) {
      els.push({ nom: 'Cloisons', aire: ratio * surfacePlancher(g), contact: 'deux', analyse: analyses.cloisons });
    }
    return els.filter(function (e) { return e.aire > 0; });
  }

  function inertieMaison(projet, analyses) {
    return P.inertieLocal(elementsInertie(projet, analyses), surfacePlancher(projet.geometrie));
  }

  /* ---------- 6. Synthèse ---------- */

  function syntheseProjet(projet, analyses, vitrage) {
    const g = projet.geometrie;
    const facades = bilanFacades(projet);
    const vitre = facades.reduce(function (s, f) { return s + f.vitrage; }, 0);
    return {
      hauteurMurs: hauteurMurs(g),
      hauteurToit: hauteurToit(g),
      surfaceSol: surfaceSol(g),
      surfacePlancher: surfacePlancher(g),
      surfaceToiture: surfaceToiture(g),
      volume: volume(g),
      facades: facades,
      vitrageTotal: vitre,
      // Rapport surface vitrée / surface de plancher : repère courant en confort d'été (H : seuils à sourcer à l'étape 4).
      vitrageSurPlancher: surfacePlancher(g) > 0 ? vitre / surfacePlancher(g) : null,
      deperditions: deperditions(projet, analyses, vitrage),
      inertie: inertieMaison(projet, analyses)
    };
  }

  /* ---------- 7. Contrôle de la saisie ---------- */

  function erreursGeometrie(g) {
    const e = [];
    if (!(Number(g.longueur) > 0 && Number(g.largeur) > 0)) e.push('Longueur et largeur doivent être positives.');
    if (!(Number(g.niveaux) >= 1)) e.push('Au moins 1 niveau.');
    if (!(Number(g.hauteurEtage) > 1.5)) e.push('Hauteur d\'étage trop faible.');
    if (g.toit !== 'plat' && !(Number(g.pente) > 0 && Number(g.pente) < 70)) e.push('Pente du toit entre 0 et 70°.');
    return e;
  }

  const ConfortBatiment = {
    FACADES: FACADES,
    ORIENTATIONS: ORIENTATIONS,
    normaliserAzimut: normaliserAzimut,
    orientation: orientation,
    azimutsFacades: azimutsFacades,
    hauteurMurs: hauteurMurs,
    largeurFacade: largeurFacade,
    hauteurToit: hauteurToit,
    combleChauffe: combleChauffe,
    surfacePignon: surfacePignon,
    surfaceFacade: surfaceFacade,
    surfaceSol: surfaceSol,
    surfaceToiture: surfaceToiture,
    surfacePlancher: surfacePlancher,
    volumeCombles: volumeCombles,
    volume: volume,
    bilanFacades: bilanFacades,
    deperditions: deperditions,
    elementsInertie: elementsInertie,
    inertieMaison: inertieMaison,
    syntheseProjet: syntheseProjet,
    erreursGeometrie: erreursGeometrie
  };

  global.ConfortBatiment = ConfortBatiment;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortBatiment;
})(typeof window !== 'undefined' ? window : globalThis);
