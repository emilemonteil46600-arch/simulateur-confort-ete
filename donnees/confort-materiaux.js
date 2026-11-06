/* ==========================================================
   Confort d'été — bibliothèque de matériaux et parois d'exemple (PUBLIC)
   ----------------------------------------------------------
   λ  conductivité thermique   W/(m·K)
   ρ  masse volumique          kg/m³
   c  capacité thermique massique J/(kg·K)

   TOUTES les valeurs sont en statut « exemple » : ce sont des ordres de grandeur
   courants, à vérifier sur NF EN ISO 10456 (tableau des valeurs de calcul),
   les règles Th-U (fascicule Matériaux) ou la fiche du fabricant (ACERMI pour λ).
   Émile les remplace par ses sources dans l'onglet Données.

   Matériaux creux (parpaing, brique creuse, monomur) : on les traite comme une
   couche HOMOGÈNE ÉQUIVALENTE (H). Le λ équivalent reproduit leur résistance R,
   le ρ équivalent leur masse ; le déphasage obtenu est approché.
   ========================================================== */
window.CONFORT_MATERIAUX = {
  familles: [
    { id: 'beton', nom: 'Béton et pierre' },
    { id: 'maconnerie', nom: 'Maçonnerie' },
    { id: 'isolant', nom: 'Isolants' },
    { id: 'bois', nom: 'Bois et dérivés' },
    { id: 'revetement', nom: 'Enduits et revêtements' }
  ],

  materiaux: [
    // --- Béton et pierre ---
    { id: 'beton-arme', nom: 'Béton armé', famille: 'beton', lambda: 2.3, rho: 2300, c: 1000,
      source: 'Ordre de grandeur courant (béton armé 1 % d\'acier, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'pierre-calcaire', nom: 'Pierre calcaire mi-dure', famille: 'beton', lambda: 1.4, rho: 2000, c: 1000,
      source: 'Ordre de grandeur courant (pierres naturelles, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'granit', nom: 'Granit', famille: 'beton', lambda: 2.8, rho: 2600, c: 1000,
      source: 'Ordre de grandeur courant (pierres naturelles, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },

    // --- Maçonnerie (équivalents homogènes pour les blocs creux) ---
    { id: 'parpaing', nom: 'Parpaing creux (équivalent homogène)', famille: 'maconnerie', lambda: 0.95, rho: 1100, c: 1000,
      source: 'Équivalent homogène (H) : R ≈ 0,21 m²·K/W pour 20 cm, ≈ 220 kg/m² — à vérifier (règles Th-U, fabricant)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'brique-creuse', nom: 'Brique creuse terre cuite (équivalent homogène)', famille: 'maconnerie', lambda: 0.40, rho: 750, c: 1000,
      source: 'Équivalent homogène (H) : R ≈ 0,5 m²·K/W pour 20 cm — à vérifier (fabricant)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'brique-pleine', nom: 'Brique pleine terre cuite', famille: 'maconnerie', lambda: 0.90, rho: 1800, c: 1000,
      source: 'Ordre de grandeur courant (NF EN 1745, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'monomur', nom: 'Brique alvéolaire type monomur (équivalent homogène)', famille: 'maconnerie', lambda: 0.12, rho: 650, c: 1000,
      source: 'Équivalent homogène (H) : R ≈ 3,1 m²·K/W pour 37,5 cm — à vérifier (avis technique du fabricant)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'beton-cellulaire', nom: 'Béton cellulaire', famille: 'maconnerie', lambda: 0.11, rho: 450, c: 1000,
      source: 'Ordre de grandeur courant (NF EN ISO 10456, fabricant) — à vérifier', dateRef: '2026-11', statut: 'exemple' },

    // --- Isolants ---
    { id: 'laine-verre', nom: 'Laine de verre', famille: 'isolant', lambda: 0.035, rho: 20, c: 1030,
      source: 'Ordre de grandeur courant (λ : certificat ACERMI du produit ; c : NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'laine-roche', nom: 'Laine de roche (panneau d\'ITE)', famille: 'isolant', lambda: 0.036, rho: 110, c: 1030,
      source: 'Ordre de grandeur courant (λ : ACERMI ; c : NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'pse', nom: 'Polystyrène expansé (PSE)', famille: 'isolant', lambda: 0.038, rho: 20, c: 1450,
      source: 'Ordre de grandeur courant (λ : ACERMI ; c : NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'pu', nom: 'Polyuréthane (PU / PIR)', famille: 'isolant', lambda: 0.022, rho: 32, c: 1400,
      source: 'Ordre de grandeur courant (λ : ACERMI ; c : NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'fibre-bois-souple', nom: 'Fibre de bois souple', famille: 'isolant', lambda: 0.038, rho: 55, c: 2100,
      source: 'Ordre de grandeur des fiches fabricants (c ≈ 2 100 J/(kg·K)) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'fibre-bois-rigide', nom: 'Fibre de bois rigide (panneau)', famille: 'isolant', lambda: 0.046, rho: 160, c: 2100,
      source: 'Ordre de grandeur des fiches fabricants — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'ouate-cellulose', nom: 'Ouate de cellulose (soufflée)', famille: 'isolant', lambda: 0.040, rho: 45, c: 1900,
      source: 'Ordre de grandeur des fiches fabricants — à vérifier', dateRef: '2026-11', statut: 'exemple' },

    // --- Bois et dérivés ---
    { id: 'bois-resineux', nom: 'Bois résineux (sapin, épicéa)', famille: 'bois', lambda: 0.13, rho: 500, c: 1600,
      source: 'Ordre de grandeur courant (bois 500 kg/m³, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'osb', nom: 'Panneau OSB', famille: 'bois', lambda: 0.13, rho: 650, c: 1700,
      source: 'Ordre de grandeur courant (NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },

    // --- Enduits et revêtements ---
    { id: 'plaque-platre', nom: 'Plaque de plâtre (BA13)', famille: 'revetement', lambda: 0.25, rho: 900, c: 1000,
      source: 'Ordre de grandeur courant (NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'enduit-platre', nom: 'Enduit plâtre', famille: 'revetement', lambda: 0.40, rho: 1000, c: 1000,
      source: 'Ordre de grandeur courant (NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'enduit-ciment', nom: 'Enduit ciment / mortier', famille: 'revetement', lambda: 1.0, rho: 1800, c: 1000,
      source: 'Ordre de grandeur courant (mortier, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' },
    { id: 'enduit-chaux', nom: 'Enduit chaux', famille: 'revetement', lambda: 0.80, rho: 1600, c: 1000,
      source: 'Ordre de grandeur (H) — à vérifier (fabricant)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'chape', nom: 'Chape ciment', famille: 'revetement', lambda: 1.4, rho: 2000, c: 1000,
      source: 'Ordre de grandeur (H) — à vérifier (NF EN ISO 10456)', dateRef: '2026-11', statut: 'exemple' },
    { id: 'carrelage', nom: 'Carrelage (céramique)', famille: 'revetement', lambda: 1.3, rho: 2300, c: 840,
      source: 'Ordre de grandeur courant (céramique, NF EN ISO 10456) — à vérifier', dateRef: '2026-11', statut: 'exemple' }
  ],

  // Parois toutes faites pour démarrer vite. Couches de l'INTÉRIEUR vers l'EXTÉRIEUR, e en mètres.
  // type : 'exterieure' (un côté dehors) ou 'interieure' (deux côtés dans des pièces).
  parois: [
    { id: 'parpaing-iti', nom: 'Parpaing 20 + ITI laine de verre 10 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'laine-verre', e: 0.10 }, { materiau: 'parpaing', e: 0.20 }, { materiau: 'enduit-ciment', e: 0.015 }] },
    { id: 'parpaing-ite', nom: 'Parpaing 20 + ITE laine de roche 10 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'parpaing', e: 0.20 }, { materiau: 'laine-roche', e: 0.10 }, { materiau: 'enduit-ciment', e: 0.01 }] },
    { id: 'beton-ite', nom: 'Béton 18 + ITE PSE 14 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'beton-arme', e: 0.18 }, { materiau: 'pse', e: 0.14 }, { materiau: 'enduit-ciment', e: 0.01 }] },
    { id: 'beton-iti', nom: 'Béton 18 + ITI PSE 10 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'pse', e: 0.10 }, { materiau: 'beton-arme', e: 0.18 }] },
    { id: 'ossature-bois', nom: 'Ossature bois 14,5 cm + fibre de bois 6 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'laine-verre', e: 0.145 }, { materiau: 'osb', e: 0.012 }, { materiau: 'fibre-bois-rigide', e: 0.06 }, { materiau: 'enduit-chaux', e: 0.01 }] },
    { id: 'monomur', nom: 'Monomur 37,5 cm', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'monomur', e: 0.375 }, { materiau: 'enduit-chaux', e: 0.015 }] },
    { id: 'pierre-50', nom: 'Pierre calcaire 50 cm, non isolée', type: 'exterieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'enduit-chaux', e: 0.02 }, { materiau: 'pierre-calcaire', e: 0.50 }, { materiau: 'enduit-chaux', e: 0.02 }] },
    { id: 'combles-laine', nom: 'Plafond sous combles : BA13 + laine soufflée 30 cm', type: 'exterieure', sensFlux: 'descendant',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'laine-verre', e: 0.30 }] },
    { id: 'combles-ouate', nom: 'Plafond sous combles : BA13 + ouate de cellulose 30 cm', type: 'exterieure', sensFlux: 'descendant',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'ouate-cellulose', e: 0.30 }] },
    { id: 'plancher-inter', nom: 'Plancher intermédiaire béton 20 + chape + carrelage', type: 'interieure', sensFlux: 'descendant',
      couches: [{ materiau: 'carrelage', e: 0.01 }, { materiau: 'chape', e: 0.05 }, { materiau: 'beton-arme', e: 0.20 }, { materiau: 'enduit-platre', e: 0.01 }] },
    { id: 'refend-beton', nom: 'Refend béton 16 cm', type: 'interieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'beton-arme', e: 0.16 }, { materiau: 'enduit-platre', e: 0.01 }] },
    { id: 'cloison-ba13', nom: 'Cloison plaques de plâtre 72/48', type: 'interieure', sensFlux: 'horizontal',
      couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'laine-verre', e: 0.045 }, { materiau: 'plaque-platre', e: 0.013 }] }
  ],

  // L'onde de température extérieure par défaut (exemple : une journée chaude, 16 → 32 °C).
  onde: {
    tMoyenne: 24, amplitude: 8, heureMax: 15, tInterieure: 26,
    source: 'Valeurs d\'exemple (journée chaude type) — l\'étape 2 utilisera la vraie météo', statut: 'exemple'
  },

  // Local d'exemple pour la classe d'inertie : bureau de 20 m², 2,5 m sous plafond,
  // une façade de 4 m de large (dont 2 m² vitrés, sans masse), plancher et plafond béton, cloisons légères.
  local: {
    nom: 'Bureau d\'exemple (20 m²)',
    surfacePlancher: 20,
    elements: [
      { nom: 'Façade', paroi: 'beton-ite', contact: 'exterieur', aire: 8 },
      { nom: 'Plancher (dessus de dalle)', paroi: 'plancher-inter', contact: 'voisin', aire: 20 },
      { nom: 'Plafond (sous-face de dalle)', paroi: 'plancher-inter-retourne', contact: 'voisin', aire: 20 },
      { nom: 'Cloisons', paroi: 'cloison-ba13', contact: 'voisin', aire: 27.5 }
    ]
  },

  sources: {
    rs: 'NF EN ISO 6946 (résistances superficielles conventionnelles)',
    matrices: 'NF EN ISO 13786 (caractéristiques thermiques dynamiques, matrices de transfert)',
    inertie: 'NF EN ISO 13790:2008, § 12.3.1.2 et tableau 12 (H : valeurs à vérifier sur le texte)'
  }
};

// Le plafond du local d'exemple = le même plancher vu par en dessous (couches retournées).
(function (M) {
  const p = M.parois.find(function (x) { return x.id === 'plancher-inter'; });
  M.parois.push({ id: 'plancher-inter-retourne', nom: 'Plafond : sous-face du plancher intermédiaire', type: 'interieure', sensFlux: 'montant',
    couches: p.couches.slice().reverse() });
})(window.CONFORT_MATERIAUX);
