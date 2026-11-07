/* ==========================================================
   CONFORT D'ÉTÉ — CHAPITRE 2 : LA MÉTÉO, LE SOLEIL ET LES APPORTS DE CHALEUR
   ----------------------------------------------------------
   Fonctions pures. Elles répondent, heure par heure, à trois questions :
     1) Où est le soleil ?                      (hauteur h, azimut a)
     2) Combien de W/m² reçoit chaque paroi ?   (direct + diffus + réfléchi)
     3) Combien de watts entrent dans la maison ? (fenêtres, parois opaques, occupants…)

   Repère (le même que la maquette 3D) : x = Est, y = Nord, z = haut.
   Azimut compté depuis le Nord, dans le sens des aiguilles d'une montre
   (N = 0°, E = 90°, S = 180°, O = 270°), comme l'orientation des façades.

   La météo (PVGIS, Commission européenne) donne pour chaque heure :
     T    température de l'air à 2 m (°C)
     HR   humidité relative (%)
     Gbn  rayonnement DIRECT reçu par un plan face au soleil (« normal ») (W/m²)
     Gdh  rayonnement DIFFUS reçu par un plan horizontal (W/m²)
     V    vitesse du vent à 10 m (m/s)
   Les heures sont en temps universel (UTC). Le rayonnement d'une heure k est
   mesuré (satellite) à k + decalage heures (≈ 10 min) : c'est à cet instant
   qu'on place le soleil.
   ========================================================== */
(function (global) {
  'use strict';

  const RAD = Math.PI / 180;
  const HEURES_AN = 8760;

  /* ==========================================================
     1. LE TEMPS
     ========================================================== */

  // Année météo type (TMY) : 365 jours, sans 29 février. L'heure k (0 à 8 759) commence
  // le jour n = floor(k / 24) + 1, à (k mod 24) h UTC.
  const MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Jour de l'année (1 à 365) d'une date (mois 1 à 12).
  function jourDeLAnnee(mois, jour) {
    let n = jour;
    for (let m = 0; m < mois - 1; m++) n += MOIS[m];
    return n;
  }
  function dateDuJour(n) {
    let m = 0;
    while (m < 11 && n > MOIS[m]) { n -= MOIS[m]; m++; }
    return { mois: m + 1, jour: n, nom: n + (n === 1 ? 'er' : '') + ' ' + NOMS_MOIS[m] };
  }

  // Heure légale française (H) : UTC + 2 en heure d'été, UTC + 1 sinon.
  // L'heure d'été va du dernier dimanche de mars au dernier dimanche d'octobre ;
  // l'année type n'ayant pas de vrais dimanches, on prend du 1er avril au 31 octobre (à quelques jours près).
  const DEBUT_ETE = jourDeLAnnee(4, 1), FIN_ETE = jourDeLAnnee(10, 31);
  function decalageLegal(n) { return n >= DEBUT_ETE && n <= FIN_ETE ? 2 : 1; }

  // Jour de la semaine (H) : l'année type commence un lundi (0 = lundi … 6 = dimanche).
  function jourSemaine(n) { return (n - 1) % 7; }

  /* ==========================================================
     2. OÙ EST LE SOLEIL ?
     Formules de Spencer (1971), reprises par Duffie & Beckman,
     « Solar Engineering of Thermal Processes », chapitre 1. Précision ≈ 0,5°.
     ========================================================== */

  // Angle du jour B (rad) : la position de la Terre sur son orbite, de 0 à 2π sur l'année.
  // n peut être fractionnaire : n = 202,5 le 21 juillet à midi (on tient compte de l'heure,
  // car près des équinoxes la déclinaison change de 0,4° par jour).
  function angleDuJour(n) { return 2 * Math.PI * (n - 1) / 365; }

  // Déclinaison δ (°) : l'angle entre le soleil et le plan de l'équateur.
  // +23,45° au solstice d'été (21 juin), 0° aux équinoxes, −23,45° en hiver.
  // Elle vient de l'inclinaison de l'axe de la Terre (23,44°) sur son orbite.
  function declinaison(n) {
    const B = angleDuJour(n);
    return (0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B) +
      0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B)) / RAD;
  }

  // Équation du temps E (minutes) : l'avance ou le retard du « vrai » soleil sur un soleil
  // qui tournerait parfaitement régulièrement. Entre −14 et +16 min selon la date, à cause
  // de l'orbite elliptique et de l'inclinaison de l'axe.
  function equationDuTemps(n) {
    const B = angleDuJour(n);
    return 229.2 * (0.000075 + 0.001868 * Math.cos(B) - 0.032077 * Math.sin(B) - 0.014615 * Math.cos(2 * B) - 0.04089 * Math.sin(2 * B));
  }

  // Heure solaire vraie (h) : 12 h = le soleil au plus haut (plein Sud).
  // La Terre tourne de 360° en 24 h, soit 15° par heure, donc 4 min par degré de longitude.
  // À l'est de Greenwich, le soleil passe plus tôt : on ajoute 4 min × longitude (°E).
  function heureSolaire(heureUTC, n, longitude) {
    return heureUTC + longitude / 15 + equationDuTemps(n) / 60;
  }

  // Angle horaire ω (°) : 15° par heure d'écart avec midi solaire (négatif le matin).
  function angleHoraire(hSolaire) { return 15 * (hSolaire - 12); }

  // Position du soleil à l'instant t (heures UTC depuis le 1er janvier 0 h) pour un lieu (latitude φ, longitude).
  //   sin h = sin φ · sin δ + cos φ · cos δ · cos ω                 (hauteur au-dessus de l'horizon)
  //   azimut a = 180° + atan2( sin ω , cos ω · sin φ − tan δ · cos φ )  (depuis le Nord, sens horaire)
  // Démonstration : ce sont les coordonnées du soleil dans le repère local (Est, Nord, haut),
  // obtenues en tournant le repère de l'équateur d'un angle (90° − φ) autour de l'axe Est–Ouest.
  function positionSoleil(t, lieu) {
    const n = Math.floor(t / 24) % 365 + 1;
    const heureUTC = t - Math.floor(t / 24) * 24;
    const phi = lieu.lat * RAD;
    const nf = n + (heureUTC - 12) / 24;               // jour fractionnaire (forme de la NOAA)
    const delta = declinaison(nf) * RAD;
    const hs = heureUTC + lieu.lon / 15 + equationDuTemps(nf) / 60;
    const omega = angleHoraire(hs) * RAD;
    const sinH = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
    const hauteur = Math.asin(Math.max(-1, Math.min(1, sinH)));
    let azimut = 180 + Math.atan2(Math.sin(omega), Math.cos(omega) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi)) / RAD;
    azimut = ((azimut % 360) + 360) % 360;
    return {
      jour: n, heureUTC: heureUTC, heureSolaire: hs,
      declinaison: delta / RAD, equationTemps: equationDuTemps(nf), angleHoraire: omega / RAD,
      hauteur: hauteur / RAD, azimut: azimut,
      // Vecteur unitaire « vers le soleil » (Est, Nord, haut) : il sert pour les parois et pour les ombres.
      s: [Math.cos(hauteur) * Math.sin(azimut * RAD), Math.cos(hauteur) * Math.cos(azimut * RAD), Math.sin(hauteur)]
    };
  }

  /* ==========================================================
     3. COMBIEN REÇOIT UNE PAROI ?
     Modèle « ciel isotrope » de Liu et Jordan (1963) (H : le plus simple ;
     PVGIS utilise un modèle plus fin, celui de Muneer, d'où de petits écarts sur le diffus).
     ========================================================== */

  // Normale extérieure d'une paroi d'inclinaison β (0° = horizontale vers le ciel, 90° = verticale)
  // et d'azimut γ (vers où elle regarde).
  function normaleParoi(inclinaison, azimut) {
    const b = inclinaison * RAD, g = azimut * RAD;
    return [Math.sin(b) * Math.sin(g), Math.sin(b) * Math.cos(g), Math.cos(b)];
  }

  // cos θ : cosinus de l'angle d'incidence entre le soleil et la normale. C'est un produit scalaire :
  // cos θ = s · n. Le direct reçu par la paroi est Gbn × cos θ (un faisceau qui arrive de biais
  // s'étale sur une plus grande surface : c'est la même raison qui fait l'hiver).
  function cosIncidence(soleil, normale) {
    return soleil.s[0] * normale[0] + soleil.s[1] * normale[1] + soleil.s[2] * normale[2];
  }

  // Éclairement d'une paroi (W/m²) :
  //   direct   Ib = Gbn × max(0, cos θ)                   (0 si le soleil est derrière la paroi ou sous l'horizon)
  //   diffus   Id = Gdh × (1 + cos β) / 2                  (la part de ciel vue par la paroi : 1 à plat, ½ debout)
  //   réfléchi Ir = ρ × Gh × (1 − cos β) / 2               (la part de sol vue ; ρ = albédo du sol (H) 0,2)
  //   avec Gh = Gbn × sin h + Gdh, le rayonnement global horizontal.
  function eclairementParoi(meteoHeure, soleil, inclinaison, azimut, albedo) {
    const rho = albedo === undefined ? ALBEDO : albedo;
    const cb = Math.cos(inclinaison * RAD);
    const leve = soleil.hauteur > 0;
    const Gbn = leve ? Math.max(0, meteoHeure.Gbn) : 0;
    const Gdh = Math.max(0, meteoHeure.Gdh);
    const cosT = leve ? cosIncidence(soleil, normaleParoi(inclinaison, azimut)) : 0;
    const direct = Gbn * Math.max(0, cosT);
    const diffus = Gdh * (1 + cb) / 2;
    const Gh = Gbn * Math.max(0, Math.sin(soleil.hauteur * RAD)) + Gdh;
    const reflechi = rho * Gh * (1 - cb) / 2;
    return { direct: direct, diffus: diffus, reflechi: reflechi, total: direct + diffus + reflechi, cosIncidence: cosT, Gh: Gh };
  }
  const ALBEDO = 0.2;   // (H) sol ordinaire (herbe, terre) ; 0,1 à 0,3 selon le sol, plus pour un sol clair

  /* ==========================================================
     4. CE QUI ENTRE PAR UNE FENÊTRE
     Inspiré de NF EN ISO 13790:2008 § 11.3 (H : coefficients à vérifier dans le texte).
       Φ = I_vitre × A × (1 − Ff) × g × Fw × Fc
       I_vitre = direct × fraction ensoleillée (casquette) + diffus + réfléchi
       A   surface de la baie (m²), Ff part du cadre (H 0,3) : le cadre ne laisse pas passer le soleil
       g   facteur solaire du vitrage (sous incidence normale) : part de l'énergie qui entre
       Fw  (H 0,9) : le vitrage laisse moins passer quand le soleil arrive de biais (moyenne sur la journée)
       Fc  facteur de la protection (1 = pas de protection, ou protection relevée)
     ========================================================== */
  const PART_CADRE = 0.3;     // (H) NF EN ISO 13790 propose 0,3 par défaut
  const FACTEUR_INCIDENCE = 0.9; // (H) NF EN ISO 13790 propose 0,9

  // Casquette (débord) au-dessus d'une fenêtre : quelle part de la hauteur de la vitre reste au soleil ?
  // Le soleil « vu » dans le plan vertical perpendiculaire à la façade fait l'angle de profil Ω :
  //   tan Ω = tan h / cos(a − γ)
  // L'ombre de la casquette (profondeur d, posée à e au-dessus de la vitre de hauteur H) descend de d × tan Ω :
  //   part au soleil = 1 − (d × tan Ω − e) / H, bornée entre 0 et 1.
  // (H) Casquette infiniment longue (pas de soleil qui passe par les côtés), diffus non réduit.
  function fractionEnsoleillee(soleil, azimutFacade, casquette) {
    if (!casquette || !(casquette.profondeur > 0)) return 1;
    const c = Math.cos((soleil.azimut - azimutFacade) * RAD);
    if (soleil.hauteur <= 0 || c <= 1e-6) return 1;   // soleil derrière la façade : pas de direct de toute façon
    const tanOmega = Math.tan(soleil.hauteur * RAD) / c;
    const ombre = casquette.profondeur * tanOmega - (casquette.ecart || 0);
    return Math.max(0, Math.min(1, 1 - ombre / casquette.hauteurFenetre));
  }

  // La protection est-elle baissée ? Gestion « automatique » (H) : oui dès que la façade reçoit
  // plus que le seuil (W/m²). Sans protection, Fc = 1.
  function facteurProtection(protection, eclairement, seuil) {
    if (!protection || !(protection.Fc < 1)) return { Fc: 1, baissee: false };
    const baissee = eclairement >= seuil;
    return { Fc: baissee ? protection.Fc : 1, baissee: baissee };
  }

  function apportFenetre(ecl, fen) {
    const part = fen.fractionEnsoleillee === undefined ? 1 : fen.fractionEnsoleillee;
    const surVitre = ecl.direct * part + ecl.diffus + ecl.reflechi;
    const p = facteurProtection(fen.protection, ecl.total, fen.seuil);
    const coef = (1 - fen.partCadre) * fen.g * fen.Fw * p.Fc;
    return { eclairementVitre: surVitre, Fc: p.Fc, baissee: p.baissee, coef: coef, flux: surVitre * fen.surface * coef };
  }

  /* ==========================================================
     5. CE QUI ENTRE PAR UNE PAROI OPAQUE (mur, toit)
     NF EN ISO 13790 § 11.3.4 et 11.4.6 (H) :
       Φ = α × Rse × U × A × I  −  Fciel × Rse × U × A × hr × Δθer
     1er terme : le soleil chauffe la face extérieure (absorption α) ; une petite part de cette
       chaleur traverse la paroi, dans le rapport Rse × U (la résistance « côté air extérieur »
       sur la résistance totale). Très isolé (U petit) → presque rien n'entre.
     2e terme : la nuit comme le jour, la paroi rayonne vers le ciel, plus froid que l'air.
       hr = 5 ε W/(m²·K) (ε = 0,9 → 4,5), Δθer = 11 K en climat tempéré (H),
       Fciel = 1 pour un toit plat, 0,5 pour un mur.
     (H) Combles perdus : on applique la formule au plafond, avec son U ; le comble tampon
       est ignoré (en vrai, il chauffe sous les tuiles, l'étape 8 pourra le modéliser).
     ========================================================== */
  const RSE = 0.04, HR_CIEL = 4.5, DT_CIEL = 11;

  function apportOpaque(ecl, paroi) {
    const fciel = (1 + Math.cos(paroi.inclinaison * RAD)) / 2;
    const soleil = paroi.alpha * RSE * paroi.U * paroi.A * ecl.total;
    const ciel = fciel * RSE * paroi.U * paroi.A * HR_CIEL * DT_CIEL;
    return { soleil: soleil, ciel: ciel, flux: soleil - ciel };
  }

  /* ==========================================================
     6. APPORTS INTERNES (occupants, appareils, éclairage)
     Chaque usage a des puissances de pointe (W/m² de plancher) et des profils horaires
     (de 0 à 1) en semaine et le week-end, en heure légale. Valeurs d'exemple (H).
     ========================================================== */
  function apportInterne(usage, n, heureLegale, surface) {
    const we = jourSemaine(n) >= 5;
    const ferme = (usage.fermetures || []).some(function (f) { return n >= jourDeLAnnee(f[0][0], f[0][1]) && n <= jourDeLAnnee(f[1][0], f[1][1]); });
    const h = Math.floor(((heureLegale % 24) + 24) % 24);
    const postes = {};
    let total = 0;
    ['occupants', 'equipements', 'eclairage'].forEach(function (k) {
      const p = usage[k];
      const profil = ferme ? p.ferme || zeros() : (we ? p.weekend : p.semaine);
      postes[k] = p.max * profil[h] * surface;
      total += postes[k];
    });
    return { postes: postes, total: total, ferme: ferme, weekend: we };
  }
  function zeros() { return new Array(24).fill(0); }

  /* ==========================================================
     7. LES PAROIS DE LA MAISON VUES PAR LE SOLEIL
     On réutilise le chapitre 1 bis (surfaces) : chaque façade est verticale (β = 90°),
     les pans de toit ont la pente du toit. Pour l'éclairement « de la toiture », on prend
     les vrais pans (ce qui chauffe les tuiles), mais l'apport opaque passe par la paroi
     de l'enveloppe (plafond ou rampants), de surface B.surfaceToiture.
     ========================================================== */
  function pansDuToit(g, azimutA, B) {
    if (g.toit === 'plat' || !(Number(g.pente) > 0)) return [{ id: 'T', inclinaison: 0, azimut: 0, part: 1 }];
    const p = Number(g.pente);
    if (g.toit === 'deux-pans') {
      // Les pans descendent vers A et C (faîtage parallèle à A).
      return [{ id: 'TA', inclinaison: p, azimut: B.normaliserAzimut(azimutA), part: 0.5 },
        { id: 'TC', inclinaison: p, azimut: B.normaliserAzimut(azimutA + 180), part: 0.5 }];
    }
    // 4 pans de même pente : chaque pan couvre la part du plan au sol qui lui revient (H : répartition
    // simplifiée ¼ chacun ; elle est exacte pour un toit carré).
    return [0, 90, 180, 270].map(function (d, i) {
      return { id: 'T' + 'ABCD'[i], inclinaison: p, azimut: B.normaliserAzimut(azimutA + d), part: 0.25 };
    });
  }

  /* ==========================================================
     8. TOUT CE QUI ENTRE, HEURE PAR HEURE
     entrees = {
       projet, synthese (chapitre 1 bis), lieu {lat, lon}, meteo {T, HR, Gbn, Gdh, V, decalage},
       vitrage {g}, protections {id → {Fc}}, seuil (W/m²), usage (scénario d'apports internes),
       U {murs, toiture}, alpha {murs, toiture}, casquettes {A..D → profondeur m},
       fenetre {hauteur, ecart} (H), heures [k0, k1[
     }
     Rend des tableaux d'une valeur par heure, en W.
     ========================================================== */
  function apportsHoraires(e) {
    const B = global.ConfortBatiment || (typeof require === 'function' ? require('./calcul-batiment.js') : null);
    const g = e.projet.geometrie;
    const facades = e.synthese.facades;
    const pans = pansDuToit(g, Number(g.orientation), B);
    const k0 = e.heures ? e.heures[0] : 0, k1 = e.heures ? e.heures[1] : HEURES_AN;
    const N = k1 - k0;
    const tab = function () { return new Float64Array(N); };
    const r = {
      k0: k0, N: N,
      T: tab(), fenetres: tab(), murs: tab(), toiture: tab(), internes: tab(), total: tab(),
      parFacade: {}, eclairement: {}, internesPostes: { occupants: tab(), equipements: tab(), eclairage: tab() }
    };
    facades.forEach(function (f) { r.parFacade[f.id] = tab(); r.eclairement[f.id] = tab(); });
    r.eclairement.toiture = tab();
    const opaqueMurs = facades.reduce(function (s, f) { return s + f.opaque; }, 0);
    const surface = B.surfacePlancher(g);
    const decalage = e.meteo.decalage || 0;

    for (let i = 0; i < N; i++) {
      const k = k0 + i;
      const soleil = positionSoleil(k + decalage, e.lieu);
      const mh = { Gbn: e.meteo.Gbn[k], Gdh: e.meteo.Gdh[k] };
      r.T[i] = e.meteo.T[k];
      let fen = 0, murs = 0;
      facades.forEach(function (f) {
        const ecl = eclairementParoi(mh, soleil, 90, f.azimut);
        r.eclairement[f.id][i] = ecl.total;
        const fa = e.projet.facades[f.id] || {};
        if (f.vitrage > 0) {
          const a = apportFenetre(ecl, {
            surface: f.vitrage, g: e.vitrage.g, partCadre: PART_CADRE, Fw: FACTEUR_INCIDENCE,
            protection: e.protections[fa.protection], seuil: e.seuil,
            fractionEnsoleillee: fractionEnsoleillee(soleil, f.azimut, {
              profondeur: Number((e.casquettes || {})[f.id]) || 0, ecart: e.fenetre.ecart, hauteurFenetre: e.fenetre.hauteur
            })
          });
          r.parFacade[f.id][i] = a.flux;
          fen += a.flux;
        }
        if (f.opaque > 0) murs += apportOpaque(ecl, { inclinaison: 90, alpha: e.alpha.murs, U: e.U.murs, A: f.opaque }).flux;
      });
      // Toiture : éclairement moyen des pans, pondéré par leur part du toit.
      let iToit = 0;
      pans.forEach(function (p) { iToit += p.part * eclairementParoi(mh, soleil, p.inclinaison, p.azimut).total; });
      r.eclairement.toiture[i] = iToit;
      const toit = apportOpaque({ total: iToit }, { inclinaison: pans[0].inclinaison, alpha: e.alpha.toiture, U: e.U.toiture, A: B.surfaceToiture(g) }).flux;
      // Apports internes, en heure légale.
      const tl = k + decalageLegal(Math.floor(k / 24) % 365 + 1);   // heure légale depuis le 1er janvier
      const int = apportInterne(e.usage, Math.floor(tl / 24) % 365 + 1, tl % 24, surface);
      r.internesPostes.occupants[i] = int.postes.occupants;
      r.internesPostes.equipements[i] = int.postes.equipements;
      r.internesPostes.eclairage[i] = int.postes.eclairage;

      r.fenetres[i] = fen; r.murs[i] = murs; r.toiture[i] = toit; r.internes[i] = int.total;
      r.total[i] = fen + murs + toit + int.total;
    }
    return r;
  }

  // Somme d'une série horaire en kWh (1 valeur par heure, en W → W·h).
  function sommeKWh(serie, debut, fin) {
    let s = 0;
    for (let i = debut || 0; i < (fin === undefined ? serie.length : fin); i++) s += serie[i];
    return s / 1000;
  }

  // La semaine la plus chaude (7 jours de suite, moyenne de T la plus haute), entre les heures k0 et k1.
  function semaineLaPlusChaude(T, k0, k1) {
    const L = 7 * 24;
    let meilleur = k0, max = -Infinity, s = 0;
    for (let k = k0; k < k0 + L; k++) s += T[k];
    for (let d = k0; d + L <= k1; d += 24) {
      if (d > k0) { for (let k = d - 24; k < d; k++) s -= T[k]; for (let k = d + L - 24; k < d + L; k++) s += T[k]; }
      if (s > max) { max = s; meilleur = d; }
    }
    return { debut: meilleur, fin: meilleur + L, moyenne: max / L };
  }

  // Une journée de soleil : la course (toutes les 10 min) entre lever et coucher, pour le dessin.
  function courseDuJour(n, lieu) {
    const pts = [];
    for (let m = 0; m <= 24 * 6; m++) {
      const p = positionSoleil((n - 1) * 24 + m / 6, lieu);
      if (p.hauteur > 0) pts.push(p);
    }
    return pts;
  }

  const ConfortSoleil = {
    RAD: RAD, HEURES_AN: HEURES_AN, MOIS: MOIS, NOMS_MOIS: NOMS_MOIS,
    ALBEDO: ALBEDO, PART_CADRE: PART_CADRE, FACTEUR_INCIDENCE: FACTEUR_INCIDENCE,
    RSE: RSE, HR_CIEL: HR_CIEL, DT_CIEL: DT_CIEL,
    jourDeLAnnee: jourDeLAnnee, dateDuJour: dateDuJour, decalageLegal: decalageLegal, jourSemaine: jourSemaine,
    angleDuJour: angleDuJour, declinaison: declinaison, equationDuTemps: equationDuTemps,
    heureSolaire: heureSolaire, angleHoraire: angleHoraire, positionSoleil: positionSoleil,
    normaleParoi: normaleParoi, cosIncidence: cosIncidence, eclairementParoi: eclairementParoi,
    fractionEnsoleillee: fractionEnsoleillee, facteurProtection: facteurProtection, apportFenetre: apportFenetre,
    apportOpaque: apportOpaque, apportInterne: apportInterne, pansDuToit: pansDuToit,
    apportsHoraires: apportsHoraires, sommeKWh: sommeKWh, semaineLaPlusChaude: semaineLaPlusChaude, courseDuJour: courseDuJour
  };

  global.ConfortSoleil = ConfortSoleil;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortSoleil;
})(typeof window !== 'undefined' ? window : globalThis);
