/* ==========================================================
   Confort d'été — le projet d'exemple et les choix de la saisie simple (PUBLIC)
   ----------------------------------------------------------
   Toutes les valeurs chiffrées sont des EXEMPLES (statut « exemple ») à remplacer
   par tes sources dans l'onglet Données.
   ========================================================== */
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

  // Protections solaires : seulement le choix pour l'instant. Leur effet (facteur Fc) sera chiffré
  // et sourcé à l'étape 2, quand le soleil entrera dans le calcul.
  protections: [
    { id: 'aucune', nom: 'Aucune' },
    { id: 'volet-roulant', nom: 'Volet roulant' },
    { id: 'volet-battant', nom: 'Volets battants' },
    { id: 'bso', nom: 'Brise-soleil orientable (BSO)' },
    { id: 'store-exterieur', nom: 'Store extérieur toile' },
    { id: 'store-interieur', nom: 'Store intérieur' }
  ],

  // Cloisons : m² de cloison par m² de plancher (H) — valeur d'exemple, à mesurer sur plan.
  cloisons: { ratio: 1.0, paroi: 'cloison-ba13', source: 'Valeur d\'exemple (H) : à mesurer sur le plan', statut: 'exemple' },

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
    parois: { murs: 'parpaing-iti', toiture: 'combles-laine', plancherBas: 'dallage-isole', plancherInter: 'plancher-inter', cloisons: 'cloison-ba13' },
    cloisons: { ratio: 1.0 }
  }
};
