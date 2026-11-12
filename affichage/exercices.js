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
  const Tr = global.ConfortTransitoire || (typeof require === 'function' ? require('../calcul/calcul-transitoire.js') : null);
  const So = global.ConfortSoleil || (typeof require === 'function' ? require('../calcul/calcul-soleil.js') : null);
  const R5 = global.ConfortCinqR1C || (typeof require === 'function' ? require('../calcul/calcul-5r1c.js') : null);
  // Un soleil « à la main » (hauteur, azimut) avec son vecteur s, pour les exercices.
  const soleilA = function (hauteur, azimut) {
    const r = Math.PI / 180;
    return { hauteur: hauteur, azimut: azimut, s: [Math.cos(hauteur * r) * Math.sin(azimut * r), Math.cos(hauteur * r) * Math.cos(azimut * r), Math.sin(hauteur * r)] };
  };
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

  QUESTIONS.push(
    {
      enonce: 'Même fenêtre, même soleil : store <b>intérieur</b> ou store <b>extérieur</b>, lequel garde la maison la plus fraîche ?',
      choix: ['l\'extérieur', 'l\'intérieur', 'pareil, ils arrêtent la même lumière'], bonne: 0,
      correction: 'Le store intérieur arrête la lumière APRÈS la vitre : le rayonnement est déjà entré, il chauffe le store, qui chauffe l\'air de la pièce.\nLe store extérieur l\'arrête AVANT : la chaleur reste dehors. Ordres de grandeur (H) : Fc ≈ 0,65 à l\'intérieur, 0,15 à 0,30 à l\'extérieur.'
    },
    {
      enonce: 'En juillet, à Toulouse, quelle façade verticale reçoit le plus de soleil sur la journée ?',
      choix: ['l\'Ouest (ou l\'Est)', 'le Sud', 'le Nord'], bonne: 0,
      correction: 'En été, à midi, le soleil est très haut (≈ 68° fin juin) : il arrive en biais sur une façade Sud (cos θ petit).\nLe matin et l\'après-midi, il est bas et presque en face des façades Est et Ouest : cos θ grand, pendant des heures.\nRésultat de l\'année type : en juillet, l\'Ouest reçoit nettement plus que le Sud. Et l\'Ouest prend son soleil au moment le plus chaud.'
    },
    {
      enonce: 'Dans le circuit 5R1C, lequel de ces trois nœuds a une capacité (un « réservoir » de chaleur) ?',
      choix: ['la masse θm seulement', 'l\'air θair seulement', 'les trois'], bonne: 0,
      correction: 'Un seul condensateur, Cm, sur le nœud de masse. L\'air (ρ·c·V ≈ 0,3 MJ/K, 3 % de Cm) et les surfaces sont traités sans capacité :\nleurs bilans se résolvent à chaque heure sans mémoire. Seule la masse « se souvient » de l\'heure d\'avant (schéma de Crank-Nicolson).'
    },
    {
      enonce: 'Une maison lourde (Cm × 4) contre la même maison légère, même ventilation, même soleil. Sur l\'été, qu\'est-ce qui change ?',
      choix: ['le pic baisse, la moyenne ne bouge presque pas', 'le pic et la moyenne baissent de la même façon', 'rien : l\'énergie qui entre est la même'], bonne: 0,
      correction: 'L\'inertie écrête : elle étale la chaleur du jour sur la nuit, donc le pic descend (− 3 °C pour la maison d\'exemple).\nMais elle n\'évacue rien : sur une saison, le bilan entrées − sorties ne dépend que des H et des températures, donc la moyenne ne bouge pas.\nPour baisser la moyenne, il faut évacuer : ventiler la nuit, protéger du soleil.'
    },
    {
      enonce: 'Pourquoi la température <b>opérative</b> plutôt que celle de l\'air pour juger du confort ?',
      choix: ['parce qu\'on échange aussi par rayonnement avec les murs', 'parce que l\'air est impossible à mesurer', 'parce qu\'elle est toujours plus basse'], bonne: 0,
      correction: 'Assis dans une pièce, on perd (ou gagne) de la chaleur par convection avec l\'air ET par rayonnement infrarouge avec les surfaces autour.\nθop ≈ 0,3 θair + 0,7 θs dans l\'annexe C (½ – ½ dans la NF EN ISO 7726 pour un air calme). Un mur en pierre frais rafraîchit même si l\'air est chaud.'
    },
    {
      enonce: 'Une casquette de 60 cm au-dessus d\'une fenêtre : où est-elle la plus efficace en été ?',
      choix: ['au Sud', 'à l\'Ouest', 'au Nord'], bonne: 0,
      correction: 'L\'ombre d\'une casquette descend de d × tan Ω (Ω, angle de profil). Au Sud, l\'été, le soleil est haut et en face : Ω grand, ombre longue.\nÀ l\'Ouest, le soleil est bas en fin de journée : tan Ω petit, il passe sous la casquette. À l\'Ouest, il faut des protections verticales ou mobiles.'
    }
  );

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
      titre: 'Le temps de traversée (t ≈ e²/a)',
      generer: function (h) {
        const m = choisir(h, MURS.concat(ISOLANTS));
        const e = BAO.tirer(h, 8, 30, 2) / 100;
        const a = P.diffusivite(m);
        const reponse = Tr.tempsDiffusion(e, a) / 3600;
        return {
          type: 'nombre', unite: 'h', tolerance: Math.max(0.2, reponse * 0.03), reponse: reponse,
          enonce: '<b>' + nb(e * 100) + ' cm de ' + m.nom + '</b> (λ = ' + nb(m.lambda, 3) + ', ρ = ' + nb(m.rho) + ', c = ' + nb(m.c) + '). Ordre de grandeur du temps que met une variation de température à traverser cette épaisseur (t ≈ e²/a), en heures ?',
          correction: 'a = λ / (ρ·c) = ' + nb(m.lambda, 3) + ' / (' + nb(m.rho) + ' × ' + nb(m.c) + ') = ' + nb(a * 1e6, 3) + '·10⁻⁶ m²/s\n' +
            't ≈ e² / a = ' + nb(e, 2) + '² / ' + nb(a * 1e6, 3) + '·10⁻⁶ = ' + nb(reponse * 3600) + ' s = ' + nb(reponse, 1) + ' h'
        };
      }
    },
    {
      titre: 'Hauteur du soleil à midi',
      generer: function (h) {
        const lat = BAO.tirer(h, 42, 51, 0.5);
        const jour = choisir(h, [[3, 21], [5, 15], [6, 21], [7, 21], [8, 15], [9, 22]]);
        const n = So.jourDeLAnnee(jour[0], jour[1]);
        const delta = So.declinaison(n);
        const reponse = 90 - lat + delta;
        return {
          type: 'nombre', unite: '°', tolerance: 0.5, reponse: reponse,
          enonce: 'Latitude <b>' + nb(lat, 1) + '° N</b>, le <b>' + So.dateDuJour(n).nom + '</b> : la déclinaison vaut δ = ' + nb(delta, 2) + '°. Quelle est la hauteur du soleil à midi solaire ?',
          correction: 'À midi solaire, ω = 0 : sin h = sin φ·sin δ + cos φ·cos δ = cos(φ − δ), donc h = 90° − φ + δ.\n' +
            'h = 90 − ' + nb(lat, 1) + ' + ' + nb(delta, 2) + ' = ' + nb(reponse, 1) + '°'
        };
      }
    },
    {
      titre: 'Le soleil direct sur une façade',
      generer: function (h) {
        const haut = BAO.tirer(h, 20, 60, 5), Gbn = BAO.tirer(h, 500, 850, 50);
        const fac = choisir(h, [{ nom: 'Sud', a: 180 }, { nom: 'Ouest', a: 270 }, { nom: 'Sud-Ouest', a: 225 }]);
        const az = fac.a + BAO.tirer(h, -60, 60, 10);   // soleil devant la façade (à 60° au plus de sa normale)
        const ecl = So.eclairementParoi({ Gbn: Gbn, Gdh: 0 }, soleilA(haut, az), 90, fac.a, 0);
        const reponse = ecl.direct;
        return {
          type: 'nombre', unite: 'W/m²', tolerance: Math.max(5, reponse * 0.02), reponse: reponse,
          enonce: 'Soleil à <b>' + nb(haut) + '°</b> de hauteur, azimut <b>' + nb(az) + '°</b> ; rayonnement direct normal Gbn = <b>' + nb(Gbn) + ' W/m²</b>. Combien de W/m² de <b>direct</b> reçoit une façade verticale <b>' + fac.nom + '</b> (azimut ' + fac.a + '°) ?',
          correction: 'Façade verticale : cos θ = cos h × cos(a − γ) (le produit scalaire s·n avec n horizontal).\n' +
            'cos θ = cos ' + nb(haut) + '° × cos(' + nb(az) + ' − ' + fac.a + ')° = ' + nb(Math.cos(haut * Math.PI / 180), 3) + ' × ' + nb(Math.cos((az - fac.a) * Math.PI / 180), 3) + ' = ' + nb(ecl.cosIncidence, 3) + '\n' +
            'Direct = Gbn × cos θ = ' + nb(Gbn) + ' × ' + nb(ecl.cosIncidence, 3) + ' = ' + nb(reponse) + ' W/m²' + (ecl.cosIncidence <= 0 ? ' (soleil derrière la façade : 0)' : '')
        };
      }
    },
    {
      titre: 'La chaleur qui entre par une fenêtre',
      generer: function (h) {
        const I = BAO.tirer(h, 300, 700, 50), A = BAO.tirer(h, 1, 6, 0.5), g = choisir(h, [0.5, 0.6, 0.75]);
        const prot = choisir(h, [{ nom: 'aucune', Fc: 1 }, { nom: 'un store extérieur (Fc = 0,3)', Fc: 0.3 }, { nom: 'un store intérieur (Fc = 0,65)', Fc: 0.65 }]);
        const a = So.apportFenetre({ direct: I, diffus: 0, reflechi: 0, total: I }, { surface: A, g: g, partCadre: So.PART_CADRE, Fw: So.FACTEUR_INCIDENCE, protection: prot.Fc < 1 ? { Fc: prot.Fc } : null, seuil: 0 });
        return {
          type: 'nombre', unite: 'W', tolerance: Math.max(5, a.flux * 0.02), reponse: a.flux,
          enonce: 'Une baie de <b>' + nb(A, 1) + ' m²</b> (cadre 30 %, Fw = 0,9), vitrage <b>g = ' + nb(g, 2) + '</b>, reçoit <b>' + nb(I) + ' W/m²</b> ; protection : ' + prot.nom + ', baissée. Combien de watts entrent ?',
          correction: 'Φ = I × A × (1 − Ff) × g × Fw × Fc\n= ' + nb(I) + ' × ' + nb(A, 1) + ' × 0,7 × ' + nb(g, 2) + ' × 0,9 × ' + nb(prot.Fc, 2) + ' = ' + nb(a.flux) + ' W\n' +
            '(soit l\'équivalent de ' + nb(a.flux / 75, 1) + ' personnes au repos, à 75 W chacune)'
        };
      }
    },
    {
      titre: 'L\'air renouvelé : Hve = ρ·c·n·V',
      generer: function (h) {
        const n = BAO.tirer(h, 0.3, 1.5, 0.1), V = BAO.tirer(h, 100, 400, 10);
        const reponse = R5.conductanceVentilation(n, V);
        return {
          type: 'nombre', unite: 'W/K', tolerance: Math.max(0.5, reponse * 0.02), reponse: reponse,
          enonce: 'Une maison de <b>' + nb(V) + ' m³</b> renouvelle son air <b>' + nb(n, 1) + ' fois par heure</b> (ρ·c de l\'air = 1 200 J/(m³·K)). Quelle conductance Hve cela fait-il ?',
          correction: 'Hve = ρ·c × n × V = 1 200 J/(m³·K) × ' + nb(n, 1) + ' vol/h × ' + nb(V) + ' m³ / 3 600 s/h\n    = ' + nb(n * V) + ' m³/h / 3 = ' + nb(reponse, 1) + ' W/K\n(À comparer au H des parois : souvent du même ordre. L\'air compte autant que les murs.)'
        };
      }
    },
    {
      titre: 'Régime permanent : θ = θe + Φ / H',
      generer: function (h) {
        const te = BAO.tirer(h, 24, 34, 1), H = BAO.tirer(h, 60, 200, 10), phi = BAO.tirer(h, 500, 3000, 100);
        const c = { Htr_op: H * 0.6, Htr_w: H * 0.15 };
        const reponse = R5.regimePermanent(c, te, H * 0.25, phi).theta;
        return {
          type: 'nombre', unite: '°C', tolerance: 0.2, reponse: reponse,
          enonce: 'Dehors il fait <b>' + nb(te) + ' °C</b> depuis des jours. La maison perd <b>' + nb(H) + ' W/K</b> en tout (parois + vitres + air) et reçoit <b>' + nb(phi) + ' W</b> d\'apports constants. Vers quelle température se stabilise-t-elle ?',
          correction: 'En régime permanent, la masse ne stocke plus rien : ce qui entre (Φ) = ce qui sort (H × (θ − θe)).\nθ = θe + Φ / H = ' + nb(te) + ' + ' + nb(phi) + ' / ' + nb(H) + ' = ' + nb(te) + ' + ' + nb(phi / H, 2) + ' = ' + nb(reponse, 1) + ' °C\n(Le 5R1C donne la même chose en moyenne ; l\'air est un peu au-dessus, la masse un peu en dessous.)'
        };
      }
    },
    {
      titre: 'La constante de temps τ = Cm / (3 600 × H)',
      generer: function (h) {
        const Cm = BAO.tirer(h, 3, 40, 1), H = BAO.tirer(h, 50, 250, 10);
        const reponse = Cm * 1e6 / 3600 / H;
        return {
          type: 'nombre', unite: 'h', tolerance: Math.max(0.3, reponse * 0.02), reponse: reponse,
          enonce: 'Capacité <b>Cm = ' + nb(Cm) + ' MJ/K</b>, conductance totale vers dehors <b>' + nb(H) + ' W/K</b>. Quelle est la constante de temps τ (en heures) ? Au bout de 3 τ, il reste 5 % d\'un écart.',
          correction: 'τ = Cm / H = ' + nb(Cm) + '·10⁶ J/K / ' + nb(H) + ' W/K = ' + nb(Cm * 1e6 / H) + ' s = ' + nb(reponse, 1) + ' h\n[J/K] / [W/K] = [J/W] = [s].  Après 3 τ ≈ ' + nb(3 * reponse) + ' h, la maison a oublié 95 % d\'un coup de chaud.'
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
