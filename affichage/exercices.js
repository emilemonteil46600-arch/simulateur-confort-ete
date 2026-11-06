/* ==========================================================
   CONFORT D'ÉTÉ — EXERCICES « TESTE-TOI » (étape 1 : les parois)
   ----------------------------------------------------------
   Des valeurs tirées au hasard ; la bonne réponse est toujours
   calculée par ConfortParois (calcul-parois.js).
   ========================================================== */
(function (global) {
  'use strict';

  const P = global.ConfortParois || (typeof require === 'function' ? require('../calcul/calcul-parois.js') : null);
  const B = global.ConfortBatiment || (typeof require === 'function' ? require('../calcul/calcul-batiment.js') : null);
  const BAO = global.BAO;
  const nb = BAO.nombre;
  const choisir = function (h, liste) { return liste[Math.floor(h() * liste.length)]; };
  const RS = P.resistancesSuperficielles('horizontal', false);

  const MURS = [
    { nom: 'béton', lambda: 2.3, rho: 2300, c: 1000 },
    { nom: 'brique pleine', lambda: 0.9, rho: 1800, c: 1000 },
    { nom: 'pierre calcaire', lambda: 1.4, rho: 2000, c: 1000 }
  ];
  const ISOLANTS = [
    { nom: 'laine de verre', lambda: 0.035, rho: 20, c: 1030 },
    { nom: 'PSE', lambda: 0.038, rho: 20, c: 1450 },
    { nom: 'fibre de bois', lambda: 0.038, rho: 55, c: 2100 }
  ];

  const QUESTIONS = [
    {
      enonce: 'Même béton 20 cm, même isolant 12 cm : une fois en ITI, une fois en ITE. Laquelle stocke le plus de chaleur côté pièce (κ1) ?',
      choix: ['l\'ITE', 'l\'ITI', 'les deux pareil, U est le même'], bonne: 0,
      correction: 'U ne dépend pas de l\'ordre des couches (les R s\'additionnent).\nκ1 dépend de ce que l\'air de la pièce « touche » : en ITE, il touche le béton (κ1 ≈ 85 kJ/(m²·K)) ;\nen ITI, l\'isolant le coupe du béton (κ1 ≈ 14 kJ/(m²·K)). L\'ITE garde la masse côté pièce.'
    },
    {
      enonce: 'Un mur a un déphasage de 12 h mais un facteur d\'amortissement f = 0,03. Le déphasage compte-t-il beaucoup pour le confort ?',
      choix: ['peu : l\'onde qui arrive est déjà minuscule', 'beaucoup : 12 h, c\'est le pic à minuit', 'on ne peut pas savoir sans U'], bonne: 0,
      correction: 'Amplitude du flux qui arrive = f × U × amplitude dehors. Avec f = 0,03, il ne reste que 3 % de l\'onde « sans inertie ».\nUn retard sur une onde presque nulle ne change presque rien : regarde toujours f (ou |Y12|) avant Δt.'
    },
    {
      enonce: 'On passe un refend béton de 15 à 30 cm d\'épaisseur. Sa capacité vue par une face (κ) sur une journée…',
      choix: ['augmente à peine', 'double', 'diminue'], bonne: 0,
      correction: 'L\'onde journalière ne pénètre que de quelques centimètres (δ ≈ 17 cm dans le béton, et elle s\'écrase vite).\nEt la chaleur doit d\'abord passer Rsi : κ ne dépasse jamais T/(2π)/Rsi ≈ 106 kJ/(m²·K).\nLe béton du fond ne « voit » presque pas l\'onde : κ augmente à peine.'
    }
  ];

  const ConfortExercices = [
    {
      titre: 'U d\'un mur isolé (régime permanent)',
      generer: function (h) {
        const mur = choisir(h, MURS), iso = choisir(h, ISOLANTS);
        const e1 = BAO.tirer(h, 15, 30, 5) / 100, e2 = BAO.tirer(h, 8, 20, 2) / 100;
        const couches = [{ e: e1, lambda: mur.lambda }, { e: e2, lambda: iso.lambda }];
        const R1 = P.resistanceCouche(e1, mur.lambda), R2 = P.resistanceCouche(e2, iso.lambda);
        const Rt = P.resistanceTotale(couches, RS);
        const reponse = P.coefficientU(couches, RS);
        return {
          type: 'nombre', unite: 'W/(m²·K)', tolerance: Math.max(0.005, reponse * 0.02), reponse: reponse,
          enonce: 'Mur : <b>' + nb(e1 * 100) + ' cm de ' + mur.nom + '</b> (λ = ' + nb(mur.lambda, 2) + ') + <b>' + nb(e2 * 100) + ' cm de ' + iso.nom + '</b> (λ = ' + nb(iso.lambda, 3) + '). Rsi = 0,13, Rse = 0,04. Quel est U ?',
          correction: 'R ' + mur.nom + ' = ' + nb(e1, 2) + ' / ' + nb(mur.lambda, 2) + ' = ' + nb(R1, 3) + ' m²·K/W\n' +
            'R ' + iso.nom + ' = ' + nb(e2, 2) + ' / ' + nb(iso.lambda, 3) + ' = ' + nb(R2, 3) + ' m²·K/W\n' +
            'R total = 0,13 + ' + nb(R1, 3) + ' + ' + nb(R2, 3) + ' + 0,04 = ' + nb(Rt, 3) + ' m²·K/W\n' +
            'U = 1 / ' + nb(Rt, 3) + ' = ' + nb(reponse, 3) + ' W/(m²·K)'
        };
      }
    },
    {
      titre: 'Masse surfacique',
      generer: function (h) {
        const mur = choisir(h, MURS), iso = choisir(h, ISOLANTS);
        const e1 = BAO.tirer(h, 10, 30, 2) / 100, e2 = BAO.tirer(h, 8, 20, 2) / 100;
        const reponse = P.masseSurfacique([{ e: e1, rho: mur.rho }, { e: e2, rho: iso.rho }]);
        return {
          type: 'nombre', unite: 'kg/m²', tolerance: Math.max(1, reponse * 0.01), reponse: reponse,
          enonce: '<b>' + nb(e1 * 100) + ' cm de ' + mur.nom + '</b> (ρ = ' + nb(mur.rho) + ' kg/m³) + <b>' + nb(e2 * 100) + ' cm de ' + iso.nom + '</b> (ρ = ' + nb(iso.rho) + ' kg/m³). Quelle est la masse surfacique ?',
          correction: 'm = Σ ρ × e = ' + nb(mur.rho) + ' × ' + nb(e1, 2) + ' + ' + nb(iso.rho) + ' × ' + nb(e2, 2) + '\n  = ' +
            nb(mur.rho * e1, 1) + ' + ' + nb(iso.rho * e2, 1) + ' = ' + nb(reponse, 1) + ' kg/m²\nL\'isolant ne pèse presque rien : la masse vient du mur.'
        };
      }
    },
    {
      titre: 'Profondeur de pénétration de l\'onde journalière',
      generer: function (h) {
        const m = choisir(h, MURS.concat(ISOLANTS));
        const d = P.profondeurPenetration(m);
        const reponse = d * 100;
        return {
          type: 'nombre', unite: 'cm', tolerance: Math.max(0.3, reponse * 0.02), reponse: reponse,
          enonce: '<b>' + m.nom + '</b> : λ = ' + nb(m.lambda, 3) + ' W/(m·K), ρ = ' + nb(m.rho) + ' kg/m³, c = ' + nb(m.c) + ' J/(kg·K). Période T = 86 400 s. Quelle est la profondeur de pénétration δ (en cm) ?',
          correction: 'δ = √(λ × T / (π × ρ × c))\n  = √(' + nb(m.lambda, 3) + ' × 86 400 / (π × ' + nb(m.rho) + ' × ' + nb(m.c) + '))\n  = √' + nb(d * d, 5) + ' = ' + nb(d, 4) + ' m = ' + nb(reponse, 1) + ' cm'
        };
      }
    },
    {
      titre: 'Retard approché dans un mur épais',
      generer: function (h) {
        const delta = BAO.tirer(h, 8, 20, 1) / 100;
        const e = BAO.tirer(h, 20, 60, 5) / 100;
        const reponse = P.retardApproche(e, delta);
        const f = P.amortissementApproche(e, delta);
        return {
          type: 'nombre', unite: 'h', tolerance: Math.max(0.2, reponse * 0.03), reponse: reponse,
          enonce: 'Un mur homogène très épais : δ = <b>' + nb(delta * 100) + ' cm</b>. Avec l\'approximation « milieu semi-infini », quel retard prend l\'onde après <b>' + nb(e * 100) + ' cm</b> ?',
          correction: 'Retard ≈ (e / δ) × T / (2π) = (' + nb(e, 2) + ' / ' + nb(delta, 2) + ') × 3,82 h\n       = ' + nb(e / delta, 3) + ' × 3,82 = ' + nb(reponse, 1) + ' h\n' +
            'Et l\'amplitude restante ≈ e^(−' + nb(e / delta, 2) + ') = ' + nb(f, 3) + '.\n(Le calcul matriciel de l\'outil est exact ; cette règle donne l\'ordre de grandeur.)'
        };
      }
    },
    {
      titre: 'Surface des rampants (combles aménagés)',
      generer: function (h) {
        const L = BAO.tirer(h, 8, 16, 1), l = BAO.tirer(h, 6, 10, 1), pente = BAO.tirer(h, 20, 45, 5);
        const g = { longueur: L, largeur: l, toit: 'deux-pans', pente: pente, combles: 'amenages', niveaux: 1, hauteurEtage: 2.7 };
        const reponse = B.surfaceToiture(g);
        return {
          type: 'nombre', unite: 'm²', tolerance: Math.max(0.5, reponse * 0.01), reponse: reponse,
          enonce: 'Maison de <b>' + nb(L) + ' × ' + nb(l) + ' m</b>, toit 2 pans à <b>' + nb(pente) + '°</b>, combles aménagés. Quelle surface de rampants faut-il isoler ?',
          correction: 'Surface d\'un pan incliné = surface au sol / cos α\n= ' + nb(L) + ' × ' + nb(l) + ' / cos ' + nb(pente) + '° = ' + nb(L * l) + ' / ' + nb(Math.cos(pente * Math.PI / 180), 3) + ' = ' + nb(reponse, 1) + ' m²'
        };
      }
    },
    {
      titre: 'Déperditions H = Σ U·A',
      generer: function (h) {
        const Am = BAO.tirer(h, 60, 140, 5), Um = BAO.tirer(h, 0.2, 0.6, 0.05);
        const Af = BAO.tirer(h, 8, 30, 1), Uw = choisir(h, [1.4, 2.9, 4.8]);
        const At = BAO.tirer(h, 60, 120, 5), Ut = BAO.tirer(h, 0.1, 0.4, 0.05);
        const reponse = Um * Am + Uw * Af + Ut * At;
        return {
          type: 'nombre', unite: 'W/K', tolerance: Math.max(0.5, reponse * 0.01), reponse: reponse,
          enonce: 'Murs <b>' + nb(Am) + ' m²</b> (U = ' + nb(Um, 2) + '), fenêtres <b>' + nb(Af) + ' m²</b> (Uw = ' + nb(Uw, 1) + '), toiture <b>' + nb(At) + ' m²</b> (U = ' + nb(Ut, 2) + '). Quel est H, sans le plancher bas ?',
          correction: 'H = Σ U × A = ' + nb(Um, 2) + ' × ' + nb(Am) + ' + ' + nb(Uw, 1) + ' × ' + nb(Af) + ' + ' + nb(Ut, 2) + ' × ' + nb(At) + '\n  = ' +
            nb(Um * Am, 1) + ' + ' + nb(Uw * Af, 1) + ' + ' + nb(Ut * At, 1) + ' = ' + nb(reponse, 1) + ' W/K'
        };
      }
    },
    {
      titre: 'Ce qui compte pour l\'été',
      generer: function (h) {
        const q = choisir(h, QUESTIONS);
        return { type: 'choix', enonce: q.enonce, choix: q.choix, bonne: q.bonne, correction: q.correction };
      }
    }
  ];

  global.ConfortExercices = ConfortExercices;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortExercices;
})(typeof window !== 'undefined' ? window : globalThis);
