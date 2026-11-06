/* ==========================================================
   Confort d'été — le projet d'exemple et les choix de la saisie simple (PUBLIC)
   ----------------------------------------------------------
   Toutes les valeurs chiffrées sont des EXEMPLES (statut « exemple ») à remplacer
   par tes sources dans l'onglet Données.
   ========================================================== */
(function () {
// Profil horaire de 24 valeurs à partir de plages [début, fin, valeur] (heures légales, fin exclue).
// Les plages suivantes écrasent les précédentes.
function profil(plages) {
  const p = new Array(24).fill(0);
  plages.forEach(function (pl) { for (let h = pl[0]; h < pl[1]; h++) p[h] = pl[2]; });
  return p;
}

window.CONFORT_PROJET = {
  usages: [
    { id: 'logement', nom: 'Logement' },
    { id: 'bureaux', nom: 'Bureaux' },
    { id: 'enseignement', nom: 'Enseignement' },
    { id: 'petite-enfance', nom: 'Petite enfance' },
    { id: 'salle', nom: 'Salle polyvalente / ERP' }
  ],

  // Fenêtres complètes (vitrage + menuiserie). Uw : coefficient de la fenêtre ; g : facteur solaire du vitrage.
  // g ne sert qu'à partir de l'étape 2 (apports solaires).
  vitrages: [
    { id: 'simple', nom: 'Simple vitrage, menuiserie bois', Uw: 4.8, g: 0.85,
      source: 'Ordre de grandeur courant (règles Th-U, fascicule Parois vitrées) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'double-ancien', nom: 'Double vitrage ancien 4/6/4', Uw: 2.9, g: 0.75,
      source: 'Ordre de grandeur courant (règles Th-U, fascicule Parois vitrées) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'double-vir', nom: 'Double vitrage peu émissif argon 4/16/4, PVC', Uw: 1.4, g: 0.60,
      source: 'Ordre de grandeur des fiches fabricants — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'triple', nom: 'Triple vitrage', Uw: 0.9, g: 0.50,
      source: 'Ordre de grandeur des fiches fabricants — à vérifier', dateRef: '2026-11', statut: 'exemple' }
  ],

  // Protections solaires. Fc = part du rayonnement qui passe encore quand la protection est baissée
  // (1 = rien n'est arrêté). Valeurs d'EXEMPLE (H) : ordres de grandeur pour une protection
  // baissée aux trois quarts, à vérifier dans NF EN ISO 52022-1 ou les règles Th-S.
  // Une protection INTÉRIEURE arrête peu : le soleil a déjà traversé la vitre, la chaleur est dedans.
  protections: [
    { id: 'aucune', nom: 'Aucune', Fc: 1 },
    { id: 'volet-roulant', nom: 'Volet roulant', Fc: 0.25, source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 52022-1)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'volet-battant', nom: 'Volets battants', Fc: 0.25, source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 52022-1)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'bso', nom: 'Brise-soleil orientable (BSO)', Fc: 0.15, source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 52022-1)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'store-exterieur', nom: 'Store extérieur toile', Fc: 0.30, source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 52022-1)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'store-interieur', nom: 'Store intérieur', Fc: 0.65, source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 52022-1)', dateRef: '2026-11', statut: 'exemple' }
  ],

  // Gestion des protections (H) : baissées dès que la façade reçoit plus que ce seuil (W/m²).
  seuilProtection: { valeur: 200, source: 'Hypothèse (H) : gestion « automatique » ; un occupant absent ne baisse rien', statut: 'exemple' },

  // Fenêtres dessinées pour l'effet des casquettes (H) : hauteur de la vitre et écart casquette → haut de vitre (m).
  fenetre: { hauteur: 1.35, ecart: 0.2 },

  // Couleur extérieure → coefficient d'absorption du soleil α (H) : classes courantes des règles thermiques.
  couleurs: [
    { id: 'claire', nom: 'Claire', alpha: 0.4 },
    { id: 'moyenne', nom: 'Moyenne', alpha: 0.6 },
    { id: 'sombre', nom: 'Sombre', alpha: 0.8 },
    { id: 'noire', nom: 'Noire', alpha: 1.0 }
  ],
  sourceCouleurs: 'Classes clair 0,4 / moyen 0,6 / sombre 0,8 / noir 1 (H : à vérifier dans les règles Th-BCE)',

  // Apports internes par usage : puissance de pointe (W par m² de plancher) × profil horaire (0 à 1),
  // en heure légale, en semaine et le week-end. Valeurs d'EXEMPLE (H), à remplacer par des scénarios sourcés
  // (RE2020 Th-BCE, NF EN 16798-1, NF EN ISO 18523). Sensible seulement : la vapeur d'eau des occupants
  // (chaleur latente) ne réchauffe pas l'air.
  //   Repères : une personne au repos ≈ 70 à 80 W sensibles ; un enfant ≈ 50 W ; un poste de bureau ≈ 100 W.
  scenarios: {
    source: 'Valeurs d\'exemple (H) : ordres de grandeur, à remplacer par des scénarios sourcés', dateRef: '2026-11', statut: 'exemple',
    usages: {
      logement: {
        // 4 personnes × 75 W sur 80 m² ≈ 3,8 W/m² quand tout le monde est là.
        occupants: { max: 3.8,
          semaine: [1, 1, 1, 1, 1, 1, 1, 0.8, 0.5, 0.3, 0.3, 0.3, 0.4, 0.3, 0.3, 0.3, 0.4, 0.6, 0.8, 0.9, 1, 1, 1, 1],
          weekend: [1, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.7, 0.6, 0.6, 0.7, 0.6, 0.5, 0.5, 0.5, 0.6, 0.8, 0.9, 1, 1, 1, 1] },
        equipements: { max: 4,
          semaine: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.6, 0.4, 0.2, 0.2, 0.3, 0.5, 0.3, 0.2, 0.2, 0.3, 0.5, 0.8, 1, 0.8, 0.6, 0.4, 0.3],
          weekend: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 0.5, 0.4, 0.6, 0.8, 0.5, 0.4, 0.4, 0.4, 0.5, 0.8, 1, 0.8, 0.6, 0.4, 0.3] },
        eclairage: { max: 1.5,
          semaine: [0, 0, 0, 0, 0, 0, 0.2, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.6, 1, 0.8, 0.3],
          weekend: [0, 0, 0, 0, 0, 0, 0, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.6, 1, 0.8, 0.3] }
      },
      bureaux: {
        // 1 personne pour 12 m² × 80 W ≈ 6,7 W/m².
        occupants: { max: 6.7, semaine: profil([[8, 12, 1], [12, 14, 0.5], [14, 18, 1], [18, 19, 0.3]]), weekend: profil([]) },
        equipements: { max: 10, semaine: profil([[0, 24, 0.1], [8, 12, 1], [12, 14, 0.6], [14, 18, 1], [18, 19, 0.4]]), weekend: profil([[0, 24, 0.1]]) },
        eclairage: { max: 6, semaine: profil([[8, 12, 0.5], [12, 14, 0.3], [14, 18, 0.5], [18, 19, 0.3]]), weekend: profil([]) },
        fermetures: [[[8, 1], [8, 15]]]
      },
      enseignement: {
        // 25 élèves × 60 W + l'enseignant sur 60 m² ≈ 26 W/m² en classe.
        occupants: { max: 26, semaine: profil([[8, 12, 1], [12, 13, 0.3], [13, 17, 1]]), weekend: profil([]) },
        equipements: { max: 3, semaine: profil([[0, 24, 0.1], [8, 17, 1]]), weekend: profil([[0, 24, 0.1]]) },
        eclairage: { max: 6, semaine: profil([[8, 17, 0.5]]), weekend: profil([]) },
        // Grandes vacances (H) : école fermée du 7 juillet au 31 août.
        fermetures: [[[7, 7], [8, 31]]]
      },
      'petite-enfance': {
        // 20 enfants × 50 W + 5 adultes × 80 W sur 120 m² ≈ 11,7 W/m².
        occupants: { max: 11.7, semaine: profil([[7, 8, 0.5], [8, 17, 1], [17, 19, 0.5]]), weekend: profil([]) },
        equipements: { max: 4, semaine: profil([[0, 24, 0.1], [7, 19, 1]]), weekend: profil([[0, 24, 0.1]]) },
        eclairage: { max: 5, semaine: profil([[7, 19, 0.5]]), weekend: profil([]) },
        fermetures: [[[8, 1], [8, 21]]]
      },
      salle: {
        // Salle comble : 1 personne par m² × 80 W, mais rarement pleine.
        occupants: { max: 80, semaine: profil([[18, 22, 0.25]]), weekend: profil([[14, 18, 0.3], [19, 23, 0.4]]) },
        equipements: { max: 3, semaine: profil([[0, 24, 0.1], [18, 22, 1]]), weekend: profil([[0, 24, 0.1], [14, 23, 1]]) },
        eclairage: { max: 8, semaine: profil([[18, 22, 1]]), weekend: profil([[14, 18, 0.3], [19, 23, 1]]) }
      }
    }
  },

  // Cloisons : m² de cloison par m² de plancher (H) — valeur d'exemple, à mesurer sur plan.
  cloisons: { ratio: 1.0, paroi: 'cloison-ba13', source: 'Valeur d\'exemple (H) : à mesurer sur le plan', statut: 'exemple' },

  // Le lieu par défaut (voir donnees/confort-meteo.js).
  villeParDefaut: 'toulouse',

  // Maison d'exemple : plain-pied 10 × 8 m, toit 2 pans à 35°, combles perdus, façade A plein Sud.
  projet: {
    nom: 'Maison d\'exemple',
    usage: 'logement',
    geometrie: { longueur: 10, largeur: 8, niveaux: 1, hauteurEtage: 2.7, toit: 'deux-pans', pente: 35, combles: 'perdus', orientation: 180 },
    facades: {
      A: { vitrage: 6, protection: 'volet-roulant' },
      B: { vitrage: 3, protection: 'volet-roulant' },
      C: { vitrage: 1.5, protection: 'aucune' },
      D: { vitrage: 2.5, protection: 'volet-roulant' }
    },
    vitrage: 'double-vir',
    ville: 'toulouse',
    casquettes: { A: 0, B: 0, C: 0, D: 0 },
    couleurs: { murs: 'claire', toiture: 'moyenne' },
    parois: { murs: 'parpaing-iti', toiture: 'combles-laine', plancherBas: 'dallage-isole', plancherInter: 'plancher-inter', cloisons: 'cloison-ba13' },
    cloisons: { ratio: 1.0 }
  }
};
})();
