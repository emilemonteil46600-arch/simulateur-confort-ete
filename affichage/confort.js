/* ==========================================================
   CONFORT D'ÉTÉ — LA TEMPÉRATURE DEDANS (onglet Projet, étape 3)
   ----------------------------------------------------------
   Affichage seulement : AUCUN calcul physique ici. Tout vient de
   ConfortCinqR1C (calcul/calcul-5r1c.js), nourri par les apports du
   chapitre 2 (window.ConfortApports, rempli par affichage/soleil.js).
   Ce fichier :
     - lance la simulation horaire quand les apports changent (événement « confort:apports ») ;
     - donne à la maquette et à la barre jour · heure la température dedans (window.ConfortTemperatures) ;
     - dessine les tuiles, la carte « La température dedans » (semaine la plus chaude, labo des réservoirs,
       « et si la maison était plus lourde ? », l'heure calculée pas à pas) et la carte de droite ;
     - remplit le tableau des constantes du chapitre 3 dans l'onglet Données.
   ========================================================== */
(function () {
  'use strict';

  const R = window.ConfortCinqR1C;
  const S = window.ConfortSoleil;
  const G = window.ConfortGraphiques;
  const X = window.CONFORT_PROJET;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (q) { return document.querySelector(q); };
  if (!R || !S || !$('#confort-projet')) return;

  // « Et si la maison était… » : on multiplie Cm (la masse seulement, pas U ni les fenêtres) pour voir ce que fait l'inertie.
  const PALIERS = [
    { id: 0.5, nom: '2 × plus légère' }, { id: 1, nom: 'Telle quelle' }, { id: 2, nom: '2 × plus lourde' }, { id: 4, nom: '4 × plus lourde' }
  ];
  let sim = null, essai = null, facteurCm = 1, rendu = null, semaine = null;

  /* ==========================================================
     LE CALCUL (appel au chapitre 3, rien de plus)
     ========================================================== */
  function entrees(facteur) {
    const A = window.ConfortApports, c = A.calc();
    const projet = window.ConfortProjet.projet();
    const e = R.entreesMaison({ synthese: c.entrees.synthese, apports: c.serie, meteo: c.meteo, ventilation: projet.ventilation, sol: X.sol });
    if (facteur !== 1) e.Cm = e.Cm * facteur;
    return e;
  }

  function calculer() {
    const A = window.ConfortApports;
    if (!A || !A.calc()) { sim = null; essai = null; toutDessiner(); return; }
    const e = entrees(1);
    sim = R.simuler(e);
    sim.entrees = e;
    sim.resume = resumes(sim);
    essai = null;
    if (facteurCm !== 1) { essai = R.simuler(entrees(facteurCm)); essai.resume = resumes(essai); }
    semaine = A.calc().semaine;
    toutDessiner();
    A.redessinerHeure();   // la maquette et la barre prennent la température dedans
  }

  // Résumés de juin → septembre (des chiffres bruts : les indicateurs et la note sont l'étape 4).
  function resumes(r) {
    const A = window.ConfortApports, de = A.K_ETE - A.K0;
    const top = R.resumer(r.Top, de), air = R.resumer(r.Tair, de), ext = R.resumer(r.Text, de);
    let nuits = 0, dernierJour = -1;
    for (let i = de; i < r.N; i++) if (r.nuit[i]) { const j = Math.floor((A.K0 + i + 2) / 24); if (j !== dernierJour) { nuits++; dernierJour = j; } }
    // Répartition des heures par tranche de 2 °C (pour la petite distribution de la carte de droite).
    const tranches = {};
    for (let i = de; i < r.N; i++) { const t = Math.floor(r.Top[i] / 2) * 2; tranches[t] = (tranches[t] || 0) + 1; }
    return { top: top, air: air, ext: ext, nuits: nuits, tranches: tranches, heures: r.N - de };
  }

  /* ==========================================================
     LA COULEUR D'UNE TEMPÉRATURE (bleu frais → neutre → rouge chaud), la même palette que le labo
     ========================================================== */
  let palette = null;
  function hexVersRvb(h) { const v = parseInt(String(h).replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function couleur(t) {
    if (!palette) {
      const css = getComputedStyle(document.documentElement);
      palette = ['--chaleur-froid', '--chaleur-neutre', '--chaleur-chaud'].map(function (n) { return hexVersRvb(css.getPropertyValue(n).trim() || '#888888'); });
    }
    const f = Math.max(0, Math.min(1, (t - 19) / 12));   // 19 °C → bleu, 25 °C → neutre, 31 °C → rouge
    const a = f < 0.5 ? palette[0] : palette[1], b = f < 0.5 ? palette[1] : palette[2], x = f < 0.5 ? f * 2 : (f - 0.5) * 2;
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * x); }).join(',') + ')';
  }

  // Ce que la maquette et la barre jour · heure lisent (affichage/soleil.js).
  window.ConfortTemperatures = {
    interieur: function (i) {
      if (!sim || i < 0 || i >= sim.N) return null;
      return { Top: sim.Top[i], Tair: sim.Tair[i], Ts: sim.Ts[i], Tm: sim.Tm[i], nuit: !!sim.nuit[i], couleur: couleur(sim.Top[i]) };
    },
    simulation: function () { return sim; }
  };

  /* ==========================================================
     DESSIN
     ========================================================== */
  function toutDessiner() {
    const tuiles = $('#chiffres-confort'), carte = $('#confort-projet'), droite = $('#carte-temperatures');
    if (!sim) { tuiles.innerHTML = ''; carte.innerHTML = ''; if (droite) droite.innerHTML = ''; return; }
    dessinerTuiles();
    dessinerCarte();
    dessinerDroite();
    dessinerHeure();
  }

  function tuile(nom, val, unite, dit) {
    return '<div class="tuile"><span class="tuile-nom">' + nom + '</span><span class="tuile-val">' + val + (unite ? ' <small>' + unite + '</small>' : '') + '</span>' + (dit ? '<span class="tuile-dit">' + dit + '</span>' : '') + '</div>';
  }
  function dateHeure(i) {
    const k = window.ConfortApports.K0 + i, n = Math.floor(k / 24) % 365 + 1;
    return S.dateDuJour(n).nom + ' ' + (k % 24 + S.decalageLegal(n)) % 24 + ' h';
  }

  function dessinerTuiles() {
    const z = sim.resume, c = sim.conductances;
    const tau = R.constanteDeTemps(c, R.conductanceVentilation(sim.entrees.ventilation.base, c.V));
    const v = sim.entrees.ventilation;
    $('#chiffres-confort').innerHTML =
      tuile('Dedans, au plus chaud', nb(z.top.max, 1), '°C', 'opérative, le ' + dateHeure(z.top.iMax) + (essai ? ' · essai ' + nb(essai.resume.top.max, 1) + ' °C' : '')) +
      tuile('Moyenne juin → sept.', nb(z.top.moyenne, 1), '°C', 'dehors ' + nb(z.ext.moyenne, 1) + ' °C en moyenne') +
      tuile('Constante de temps', nb(tau, tau < 10 ? 1 : 0), 'h', 'la maison « oublie » une chaleur en ≈ 3 τ') +
      tuile('Nuits fenêtres ouvertes', v.nuit && v.nuit.active ? nb(z.nuits) : '–', '', v.nuit && v.nuit.active ? 'sur ' + Math.round(z.heures / 24) + ' · ' + nb(v.nuit.debit) + ' vol/h, ' + nb(v.nuit.debut) + ' h → ' + nb(v.nuit.fin) + ' h' : 'surventilation nocturne désactivée');
  }

  /* ---------- La carte du centre : la semaine la plus chaude, le labo, l'heure pas à pas ---------- */
  function dessinerCarte() {
    const A = window.ConfortApports;
    const d0 = semaine.debut / 24 + 1;
    let html = '<div class="carte confort-carte"><div class="carte-titre"><h2>La température dedans, heure par heure</h2><span class="aide">modèle 5R1C · NF EN ISO 13790 annexe C (H)</span></div>';
    html += '<p class="aide" style="margin:-2px 0 10px">La chaleur qui entre (étape 2) chauffe l\'air, les surfaces et la masse de la maison ; les parois, les fenêtres et l\'air renouvelé l\'évacuent. Le calcul tourne du 1er mai au 30 septembre, les bilans portent sur juin → septembre. <b>Rien ne chauffe ni ne climatise</b> : c\'est la maison livrée à elle-même.</p>';
    html += '<h3 class="soleil-h3">La semaine la plus chaude <small>du ' + S.dateDuJour(d0).nom + ' au ' + S.dateDuJour(d0 + 6).nom + ' · T opérative = 0,3 air + 0,7 surfaces</small></h3><div id="graphe-temperatures-semaine"></div>';
    html += '<div class="confort-essai"><span class="etiquette">Et si la maison était…</span><div class="segments" id="confort-paliers" role="group" aria-label="Masse de la maison">' +
      PALIERS.map(function (p) { return '<button type="button" data-palier="' + p.id + '" aria-pressed="' + (p.id === facteurCm) + '">' + esc(p.nom) + '</button>'; }).join('') + '</div>' +
      '<span class="aide" id="confort-essai-texte"></span></div>';
    html += '<h3 class="soleil-h3">Le labo : la masse qui respire <small>à l\'heure affichée · les niveaux sont des températures, les tuyaux des conductances H</small></h3>';
    html += '<div class="confort-labo" id="confort-labo"></div>';
    html += '<p class="aide" style="margin:6px 0 0">Le jour, le soleil et les occupants remplissent les surfaces et la masse ; l\'air suit. La nuit, la masse rend sa chaleur, et les fenêtres ouvertes la vident vers dehors. Plus le réservoir de masse est large (Cm), moins son niveau bouge.</p>';
    html += '<details class="detail-calcul soleil-pas"><summary id="confort-detail-titre">L\'heure affichée calculée pas à pas</summary><div class="formule" id="confort-detail"></div></details>';
    html += '<p class="aide" style="margin:10px 0 0">Les coefficients 3,45 · 9,1 · 4,5 et le partage 0,3 / 0,7 sont ceux de l\'annexe C (H : à vérifier dans le texte). Sol sous la dalle, infiltrations n50/20 et gestion des fenêtres la nuit : hypothèses (H), voir Méthode § 28 à 35. Validation : bilan nul à chaque heure, cas analytiques, BESTEST 600FF / 900FF (indicatif).</p></div>';
    $('#confort-projet').innerHTML = html;

    // Le graphique de la semaine : T ext en référence pointillée, air et opérative, l'essai en tirets.
    const i0 = semaine.debut - A.K0;
    const pts = function (serie) { const t = []; for (let i = 0; i < 168; i++) t.push({ x: i / 24, y: serie[i0 + i] }); return t; };
    const series = [
      { nom: 'Dehors', classe: 'gr-ref', points: pts(sim.Text) },
      { nom: 'Air dedans', classe: 'gr-2', points: pts(sim.Tair) },
      { nom: 'Opérative (ressentie)', classe: 'gr-1', points: pts(sim.Top) }
    ];
    if (essai) series.push({ nom: 'Opérative, maison ' + PALIERS.find(function (p) { return p.id === facteurCm; }).nom.toLowerCase(), classe: 'gr-essai', points: pts(essai.Top) });
    const options = {
      id: 'temperatures-semaine', titre: 'Températures pendant la semaine la plus chaude', unite: '°C', decimales: 1,
      x: { min: 0, max: 7, pas: 1, format: function (j) { return j < 7 ? 'J' + (j + 1) : ''; }, formatBulle: function (j) { const h = Math.round(j * 24); return 'J' + (Math.floor(h / 24) + 1) + ' · ' + (h % 24 + S.decalageLegal(d0)) % 24 + ' h'; } },
      series: series
    };
    rendu = G.dessiner($('#graphe-temperatures-semaine'), options);
    const svg = $('#graphe-temperatures-semaine svg.graphique');
    if (svg) svg.insertAdjacentHTML('beforeend', '<line class="confort-curseur" x1="0" x2="0" y1="14" y2="216" visibility="hidden"/>');
    $('#confort-essai-texte').textContent = essai
      ? 'Pic ' + nb(essai.resume.top.max, 1) + ' °C au lieu de ' + nb(sim.resume.top.max, 1) + ' °C ; moyenne ' + nb(essai.resume.top.moyenne, 1) + ' au lieu de ' + nb(sim.resume.top.moyenne, 1) + ' °C. Cm × ' + nb(facteurCm, 1) + ', tout le reste pareil.'
      : 'Clique pour changer seulement la masse Cm (chapitre 1 bis) et voir l\'inertie agir.';
  }

  /* ---------- La carte de droite : le résumé de l'été ---------- */
  function dessinerDroite() {
    const boite = $('#carte-temperatures');
    if (!boite) return;
    const z = sim.resume, iMax = z.top.iMax, v = sim.entrees.ventilation;
    const cles = Object.keys(z.tranches).map(Number).sort(function (a, b) { return a - b; });
    const maxH = Math.max.apply(null, cles.map(function (k) { return z.tranches[k]; }));
    let html = '<div class="carte"><div class="carte-titre"><h2>Températures d\'été</h2><span class="aide">juin → septembre · évolution libre</span></div>' +
      '<div class="chiffre-cle">' + nb(z.top.max, 1) + ' <small>°C</small></div><div class="aide" style="margin-bottom:10px">opérative au plus chaud (' + dateHeure(iMax) + ', dehors ' + nb(sim.Text[iMax], 1) + ' °C)</div>' +
      '<div class="confort-noeuds">' + [['Air', sim.Tair[iMax]], ['Surfaces', sim.Ts[iMax]], ['Masse', sim.Tm[iMax]]].map(function (x) {
        return '<div class="confort-noeud"><i style="background:' + couleur(x[1]) + '"></i><span>' + x[0] + '</span><b>' + nb(x[1], 1) + ' °C</b></div>';
      }).join('') + '</div>';
    html += '<h3 class="soleil-h3" style="margin-top:12px">Les ' + nb(z.heures) + ' heures de l\'été <small>température opérative, par tranche de 2 °C</small></h3><div class="confort-histo">' +
      cles.map(function (k) {
        return '<div class="confort-barre" title="' + nb(k) + ' à ' + nb(k + 2) + ' °C : ' + nb(z.tranches[k]) + ' h"><i style="height:' + (z.tranches[k] / maxH * 100).toFixed(1) + '%;background:' + couleur(k + 1) + '"></i><span>' + nb(k) + '</span></div>';
      }).join('') + '</div>';
    html += '<p class="aide" style="margin:10px 0 0">Air renouvelé : ' + nb(v.base, 2) + ' vol/h (VMC + infiltrations n50/20)' +
      (v.nuit && v.nuit.active ? ', + ' + nb(v.nuit.debit) + ' vol/h les nuits où il fait plus frais dehors (' + nb(z.nuits) + ' nuits)' : ', fenêtres fermées la nuit') +
      '. Les indicateurs (heures > 28 °C, degrés-heures, adaptatif…) et la note arrivent à l\'étape 4.</p></div>';
    boite.innerHTML = html;
  }

  /* ---------- Ce qui change à chaque heure : le curseur du graphique, le labo, le détail ---------- */
  function dessinerHeure() {
    if (!sim) return;
    const A = window.ConfortApports, ins = A.instant(), i = ins.i;
    const curseur = $('#graphe-temperatures-semaine .confort-curseur');
    if (curseur && rendu) {
      const x = (ins.k - semaine.debut) / 24;
      if (x >= 0 && x <= 7) { curseur.setAttribute('x1', rendu.X(x)); curseur.setAttribute('x2', rendu.X(x)); curseur.setAttribute('visibility', 'visible'); }
      else curseur.setAttribute('visibility', 'hidden');
    }
    if (i < 0 || i >= sim.N) return;
    $('#confort-labo').innerHTML = labo(i);
    const titre = $('#confort-detail-titre');
    if (titre) titre.textContent = 'L\'heure affichée calculée pas à pas (' + S.dateDuJour(A.vue().jour).nom + ', ' + A.hhmm(Math.floor(A.vue().heure)) + ')';
    const det = $('#confort-detail');
    if (det && det.closest('details').open) det.textContent = detailHeure(i);
  }

  /* ==========================================================
     LE LABO : quatre réservoirs (dehors, air, surfaces, masse) reliés par des tuyaux
     Le NIVEAU d'un réservoir = sa température. Sa LARGEUR = sa capacité : la masse est large (Cm),
     l'air est un tube étroit (ρ·c·V ≈ 0,3 % de Cm), les surfaces n'ont pas de réserve du tout dans
     le 5R1C (c'est un simple nœud de passage). Les tuyaux = les conductances H : plus H est grand,
     plus le tuyau est gros. L'eau coule dans le sens du flux, d'autant plus vite que le flux est fort.
     ========================================================== */
  const LB = { L: 640, H: 336, haut: 72, bas: 290 };
  function labo(i) {
    const c = sim.conductances, f = sim.flux, A = window.ConfortApports;
    const T = { e: sim.Text[i], air: sim.Tair[i], s: sim.Ts[i], m: sim.Tm[i], sol: sim.Tsol[A.K0 + i] };
    // Échelle commune des niveaux : les extrêmes de tout l'été, arrondis.
    const z = sim.resume;
    const tMin = Math.floor(Math.min(z.ext.min, z.top.min, R.resumer(sim.Tm).min) - 1), tMax = Math.ceil(Math.max(z.ext.max, z.top.max) + 1);
    const y = function (t) { return LB.bas - (Math.max(tMin, Math.min(tMax, t)) - tMin) / (tMax - tMin) * (LB.bas - LB.haut); };
    const cuves = [
      { id: 'dehors', nom: 'Dehors', x: 52, l: 70, t: T.e },
      { id: 'air', nom: 'Air', x: 202, l: 22, t: T.air },
      { id: 's', nom: 'Surfaces', x: 322, l: 14, t: T.s },
      { id: 'm', nom: 'Masse', x: 432, l: 170, t: T.m }
    ];
    const cx = {}; cuves.forEach(function (q) { cx[q.id] = q.x + q.l / 2; });
    const gap = [162, 273, 384];   // le milieu des trois intervalles entre cuves : là où on écrit les étiquettes des tuyaux
    let svg = '<svg class="labo-svg confort-labo-svg" viewBox="0 0 ' + LB.L + ' ' + LB.H + '" role="img" aria-label="Le circuit 5R1C vu comme des réservoirs">';
    // Graduations de température, à gauche.
    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5) svg += '<line x1="46" x2="' + (LB.L - 20) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '" class="cl-grad"/><text x="42" y="' + (y(t) + 3).toFixed(1) + '" text-anchor="end" class="cl-grad-txt">' + nb(t) + '°</text>';
    // Les tuyaux (conductances) : épaisseur selon H, sens et vitesse selon le flux (dessinés avant les cuves : ils passent derrière).
    const etiquettes = [];
    const tuyau = function (x1, x2, yy, H, flux, nom, xTexte, dessous) {
      const ep = Math.max(2, Math.min(14, 2 + 10 * Math.log10(1 + H / 20)));
      const vitesse = Math.min(40, Math.abs(flux) / 40);           // W → longueur de tirets par seconde
      const d = 'M' + x1 + ' ' + yy + ' L' + x2 + ' ' + yy;
      const duree = vitesse > 0.2 ? (24 / vitesse).toFixed(2) : 0;
      etiquettes.push({ x: xTexte, y: dessous ? yy + ep / 2 + 13 : yy - ep / 2 - 14, nom: nom, val: nb(H) + ' W/K · ' + (flux >= 0 ? '+' : '−') + nb(Math.abs(flux)) + ' W' });
      return '<path d="' + d + '" class="cl-tuyau" style="stroke-width:' + ep.toFixed(1) + '"/>' +
        (duree ? '<path d="' + d + '" class="cl-eau" style="stroke-width:' + Math.max(1, ep - 2).toFixed(1) + ';animation-duration:' + duree + 's;animation-direction:' + (flux >= 0 ? 'normal' : 'reverse') + '"/>' : '');
    };
    const yh = LB.haut + 22, ym = LB.bas - 22, ymi = 176, yia = 214;
    svg += tuyau(cuves[0].x + cuves[0].l, cuves[1].x, yh, sim.Hve[i], f.ventilation[i], sim.nuit[i] ? 'Air neuf (fenêtres ouvertes)' : 'Air neuf', gap[0], false);
    svg += tuyau(cuves[0].x + cuves[0].l, cuves[2].x, ymi, c.Htr_w, f.fenetres[i], 'Vitres', gap[0], false);
    svg += tuyau(cuves[0].x + cuves[0].l, cuves[3].x, ym, c.Htr_em, f.opaques[i], 'Murs, toit, sol', gap[0], true);
    svg += tuyau(cuves[1].x + cuves[1].l, cuves[2].x, yia, c.Htr_is, -f.versAir[i], 'Surfaces → air', gap[1], true);
    svg += tuyau(cuves[2].x + cuves[2].l, cuves[3].x, ymi, c.Htr_ms, f.versMasse[i], 'Surfaces → masse', gap[2], false);
    // Les cuves, avec leur niveau coloré par la température.
    cuves.forEach(function (q) {
      const niveau = y(q.t);
      svg += '<g class="cl-cuve" data-cuve="' + q.id + '">';
      svg += '<rect x="' + q.x + '" y="' + (LB.haut - 6) + '" width="' + q.l + '" height="' + (LB.bas - LB.haut + 6) + '" class="cl-cuve-fond"/>';
      svg += '<rect x="' + q.x + '" y="' + niveau.toFixed(1) + '" width="' + q.l + '" height="' + (LB.bas - niveau).toFixed(1) + '" style="fill:' + couleur(q.t) + '" class="cl-niveau"/>';
      svg += '<path d="M' + q.x + ' ' + (LB.haut - 6) + ' V' + LB.bas + ' H' + (q.x + q.l) + ' V' + (LB.haut - 6) + '" class="cl-cuve-bord"/>';
      svg += '<text x="' + cx[q.id].toFixed(1) + '" y="' + (LB.bas + 18) + '" text-anchor="middle" class="cl-nom">' + q.nom + '</text>';
      svg += '<text x="' + cx[q.id].toFixed(1) + '" y="' + (LB.haut - 13) + '" text-anchor="middle" class="cl-temp">' + nb(q.t, 1) + ' °C</text>';
      svg += '</g>';
    });
    // Les étiquettes des tuyaux, par-dessus tout : le nom, puis « H · flux ».
    etiquettes.forEach(function (t) {
      svg += '<text x="' + t.x + '" y="' + t.y.toFixed(1) + '" text-anchor="middle" class="cl-tuyau-txt">' + t.nom + '</text>' +
        '<text x="' + t.x + '" y="' + (t.y + 11).toFixed(1) + '" text-anchor="middle" class="cl-tuyau-val">' + t.val + '</text>';
    });
    // Les apports : le soleil et les occupants qui « pleuvent » dans les réservoirs.
    const ap = A.calc().serie, phi = R.repartirApports(ap.internes[i], ap.fenetres[i] + ap.murs[i] + ap.toiture[i], c);
    const pluie = function (x, w, nom, classe) {
      if (!(w > 1)) return '';
      const n = Math.min(6, 1 + Math.floor(w / 300));
      let s = '<g class="cl-pluie ' + classe + '">';
      for (let k = 0; k < n; k++) { const xx = x - (n - 1) * 5 + k * 10; s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + (LB.haut - 38) + '" y2="' + (LB.haut - 28) + '" style="animation-delay:' + (k * 0.17).toFixed(2) + 's"/>'; }
      return s + '<text x="' + x + '" y="' + (LB.haut - 44) + '" text-anchor="middle" class="cl-pluie-txt">' + nom + ' ' + nb(w) + ' W</text></g>';
    };
    svg += pluie(cx.air, phi.ia, '👤 air', 'cl-int') + pluie(cx.s, phi.st, '☀ 👤 surfaces', 'cl-sol') + pluie(cx.m, phi.m, '☀ 👤 masse', 'cl-sol');
    // Le sol sous la dalle et le stockage, en bas.
    svg += '<text x="52" y="' + (LB.H - 8) + '" class="cl-grad-txt">Sol sous la dalle ' + nb(T.sol, 1) + ' °C (H) · la masse ' + (f.stockage[i] >= 0 ? 'stocke ' : 'rend ') + nb(Math.abs(f.stockage[i])) + ' W · niveaux = températures, largeur = capacité</text>';
    svg += '</svg>';
    return svg;
  }

  /* ---------- Le détail de l'heure : tout le calcul, nombre par nombre ---------- */
  function detailHeure(i) {
    const A = window.ConfortApports, c = sim.conductances, e = sim.entrees, ap = A.calc().serie;
    const d = function (x, k) { return nb(x, k === undefined ? 2 : k); };
    const k = A.K0 + i, n = Math.floor(k / 24) % 365 + 1;
    const thetaE = sim.Text[i], thetaSol = sim.Tsol[k], Hve = sim.Hve[i];
    const phiInt = ap.internes[i], phiSol = ap.fenetres[i] + ap.murs[i] + ap.toiture[i];
    const phi = R.repartirApports(phiInt, phiSol, c);
    const H1 = 1 / (1 / Math.max(Hve, 1e-12) + 1 / c.Htr_is), H2 = H1 + c.Htr_w, H3 = 1 / (1 / H2 + 1 / c.Htr_ms);
    const thetaAvant = i > 0 ? sim.TmFin[i - 1] : e.T[A.K0];
    const thetaEop = (1 - c.partSol) * thetaE + c.partSol * thetaSol;
    const C = c.Cm / 3600;
    let t = '1. Le circuit de la maison (W/K)\n';
    t += '  Atot = 4,5 × Af = 4,5 × ' + d(c.Af, 1) + ' = ' + d(c.Atot, 1) + ' m²      Am = ' + d(c.Am, 1) + ' m²      Cm = ' + d(c.Cm / 1e6, 2) + ' MJ/K → ' + d(C) + ' Wh/K\n';
    t += '  Htr,is = 3,45 × Atot = ' + d(c.Htr_is, 1) + '      Htr,ms = 9,1 × Am = ' + d(c.Htr_ms, 1) + '\n';
    t += '  Htr,op = ' + c.opaques.map(function (o) { return o.nom + ' ' + d(o.UA); }).join(' + ') + ' = ' + d(c.Htr_op) + '   →   Htr,em = 1/(1/' + d(c.Htr_op) + ' − 1/' + d(c.Htr_ms, 1) + ') = ' + d(c.Htr_em) + '\n';
    t += '  Htr,w = ' + d(c.Htr_w) + '      Hve = 1200/3600 × ' + d(sim.n[i], 2) + ' vol/h × ' + d(c.V, 1) + ' m³ = ' + d(Hve) + (sim.nuit[i] ? '   (fenêtres ouvertes : + ' + d(e.ventilation.nuit.debit) + ' vol/h)' : '') + '\n';
    t += '  H1 = 1/(1/Hve + 1/Htr,is) = ' + d(H1) + '      H2 = H1 + Htr,w = ' + d(H2) + '      H3 = 1/(1/H2 + 1/Htr,ms) = ' + d(H3) + '\n\n';
    t += '2. Cette heure (jour ' + n + ', ' + S.dateDuJour(n).nom + ')\n';
    t += '  θe = ' + d(thetaE, 1) + ' °C      sol sous la dalle θsol = ' + d(thetaSol, 1) + ' °C (H)      dehors « vu » par les parois opaques : ' + d(1 - c.partSol, 3) + ' × θe + ' + d(c.partSol, 3) + ' × θsol = ' + d(thetaEop) + ' °C\n';
    t += '  Φint = ' + d(phiInt) + ' W      Φsol = fenêtres ' + d(ap.fenetres[i]) + ' + murs ' + d(ap.murs[i]) + ' + toit ' + d(ap.toiture[i]) + ' = ' + d(phiSol) + ' W\n';
    t += '  Φia = 0,5 × Φint = ' + d(phi.ia) + '      Φm = Am/Atot × (0,5 Φint + Φsol) = ' + d(c.Am / c.Atot, 3) + ' × ' + d(0.5 * phiInt + phiSol) + ' = ' + d(phi.m) + '\n';
    t += '  Φst = (1 − Am/Atot − Htr,w/(9,1 Atot)) × (0,5 Φint + Φsol) = ' + d(1 - c.Am / c.Atot - c.Htr_w / (9.1 * c.Atot), 3) + ' × ' + d(0.5 * phiInt + phiSol) + ' = ' + d(phi.st) + '\n\n';
    t += '3. Le pas de temps (Crank-Nicolson), θm à la fin de l\'heure précédente = ' + d(thetaAvant, 3) + ' °C\n';
    const versS = phi.st + c.Htr_w * thetaE + H1 * thetaE + c.Htr_is / (c.Htr_is + Hve) * phi.ia;
    const phiMtot = phi.m + c.Htr_em * thetaEop + H3 * versS / H2;
    t += '  Φmtot = Φm + Htr,em × θe,op + H3 × [Φst + Htr,w θe + H1 (θe + Φia/Hve)] / H2\n';
    t += '        = ' + d(phi.m) + ' + ' + d(c.Htr_em) + ' × ' + d(thetaEop) + ' + ' + d(H3) + ' × ' + d(versS) + ' / ' + d(H2) + ' = ' + d(phiMtot) + ' W\n';
    t += '  θm,t = [θm,t−1 × (Cm/3600 − ½(H3 + Htr,em)) + Φmtot] / [Cm/3600 + ½(H3 + Htr,em)]\n';
    t += '       = [' + d(thetaAvant, 3) + ' × ' + d(C - 0.5 * (H3 + c.Htr_em)) + ' + ' + d(phiMtot) + '] / ' + d(C + 0.5 * (H3 + c.Htr_em)) + ' = ' + d(sim.TmFin[i], 3) + ' °C\n';
    t += '  θm (moyenne de l\'heure) = ' + d(sim.Tm[i], 3) + ' °C\n';
    t += '  θs = (Htr,ms θm + Φst + Htr,w θe + H1 (θe + Φia/Hve)) / (Htr,ms + Htr,w + H1) = ' + d(sim.Ts[i], 3) + ' °C\n';
    t += '  θair = (Htr,is θs + Hve θe + Φia) / (Htr,is + Hve) = ' + d(sim.Tair[i], 3) + ' °C\n';
    t += '  θop = 0,3 θair + 0,7 θs = ' + d(sim.Top[i], 2) + ' °C\n\n';
    t += '4. Le bilan de l\'heure (W, + = entre dans la maison)\n';
    const f = sim.flux;
    t += '  apports ' + d(f.apports[i]) + '  ventilation ' + d(f.ventilation[i]) + '  vitres ' + d(f.fenetres[i]) + '  parois opaques ' + d(f.opaques[i]) + '  →  stocké dans la masse ' + d(f.stockage[i]) + '\n';
    t += '  (apports + ventilation + vitres + opaques − stockage = ' + d(f.apports[i] + f.ventilation[i] + f.fenetres[i] + f.opaques[i] - f.stockage[i], 6) + ' : le bilan boucle)';
    return t;
  }

  /* ==========================================================
     ÉVÉNEMENTS
     ========================================================== */
  document.addEventListener('confort:apports', calculer);
  document.addEventListener('confort:heure', dessinerHeure);
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('#confort-paliers button');
    if (!b) return;
    facteurCm = Number(b.dataset.palier);
    calculer();
  });
  document.addEventListener('toggle', function (ev) {
    if (ev.target && ev.target.querySelector && ev.target.querySelector('#confort-detail') && ev.target.open) dessinerHeure();
  }, true);

  /* ==========================================================
     ONGLET DONNÉES : les constantes du chapitre 3
     ========================================================== */
  function dessinerDonnees() {
    const t = $('#table-5r1c');
    if (!t) return;
    const v = X.ventilation.defaut;
    t.innerHTML = '<thead><tr><th>Grandeur</th><th class="num">Valeur</th><th>Origine</th></tr></thead><tbody>' + [
      ['Échange surfaces ↔ air h_is', nb(R.H_IS, 2) + ' W/(m²·K)', 'NF EN ISO 13790 annexe C (H)'],
      ['Échange masse ↔ surfaces h_ms', nb(R.H_MS, 1) + ' W/(m²·K)', 'NF EN ISO 13790 annexe C (H)'],
      ['Surface intérieure totale Atot / Af', nb(R.LAMBDA_AT, 1), 'NF EN ISO 13790 § 7.2.2.2 (H)'],
      ['Température opérative', nb(R.PART_AIR_OPERATIVE, 1) + ' air + ' + nb(1 - R.PART_AIR_OPERATIVE, 1) + ' surfaces', 'NF EN ISO 13790 annexe C (H)'],
      ['Chaleur de l\'air ρ·c', nb(R.RHO_C_AIR * 3600) + ' J/(m³·K)', 'NF EN ISO 13790 § 9.3 (H)'],
      ['VMC (hygiénique)', nb(v.vmc, 2) + ' vol/h', X.ventilation.source],
      ['Perméabilité n50 → infiltrations', nb(v.n50, 1) + ' vol/h → n50 / ' + nb(R.DIVISEUR_N50), 'Règle de Sherman (1987) (H)'],
      ['Surventilation nocturne', nb(v.nuit.debit) + ' vol/h, ' + nb(v.nuit.debut) + ' h → ' + nb(v.nuit.fin) + ' h, si dedans > ' + nb(v.nuit.seuil) + ' °C et dehors plus frais de ' + nb(v.nuit.ecart) + ' °C', 'Hypothèse (H)'],
      ['Sol sous la dalle', 'moyenne annuelle + ' + nb(X.sol.amortissement, 1) + ' × écart mensuel, retard ' + nb(X.sol.retardJours) + ' j', X.sol.source]
    ].map(function (l) { return '<tr><td>' + l[0] + '</td><td class="num">' + l[1] + '</td><td>' + esc(l[2]) + '</td></tr>'; }).join('') + '</tbody>';
  }

  dessinerDonnees();
  calculer();
})();
