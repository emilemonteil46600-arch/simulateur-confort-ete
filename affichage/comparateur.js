/* ==========================================================
   CONFORT D'ÉTÉ — LE COMPARATEUR DE PAROIS (onglet Paroi)
   ----------------------------------------------------------
   Affichage seulement : AUCUN calcul ici. Tout vient de ConfortComparaison
   (calcul/calcul-comparaison.js). Le geste : je compose la paroi existante, je l'ajoute ;
   je modifie une couche, j'ajoute la variante ; je lis les écarts et j'exporte la preuve.
   Les parois comparées sont des COPIES figées (clé bao.confort.comparaison.v1) : modifier
   l'éditeur ne les change pas. Les conditions (ville, période, orientation, pente, couleur)
   sont celles des réglages de la coupe animée (window.ConfortLabo).
   ========================================================== */
(function () {
  'use strict';

  const K = window.ConfortComparaison;
  const A = window.ConfortAtelier;
  const G = window.ConfortGraphiques;
  const S = window.ConfortSoleil;
  const M = window.CONFORT_MATERIAUX;
  const esc = BAO.echapper;
  const nb = BAO.nombre;
  const $ = function (q) { return document.querySelector(q); };
  if (!K || !A || !$('#comparateur')) return;

  const CLE = 'bao.confort.comparaison.v1';
  const MAX = 4;
  const COULEURS = ['gr-1', 'gr-2', 'gr-3'];           // les variantes ; l'existant est en gris foncé (gr-exist)
  const COURBES = [{ id: 'tSi', nom: 'Température de la face intérieure' }, { id: 'flux', nom: 'Flux entrant' }];
  const EXEMPLE = [
    { nom: 'Béton 18 cm non isolé', paroi: { nature: 'mur', couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'beton-arme', e: 0.18 }] } },
    { nom: 'Isolation par l\'intérieur, PSE 14 cm', paroi: { nature: 'mur', couches: [{ materiau: 'plaque-platre', e: 0.013 }, { materiau: 'pse', e: 0.14 }, { materiau: 'beton-arme', e: 0.18 }] } },
    { nom: 'Isolation par l\'extérieur, PSE 14 cm', paroi: { nature: 'mur', couches: [{ materiau: 'enduit-platre', e: 0.01 }, { materiau: 'beton-arme', e: 0.18 }, { materiau: 'pse', e: 0.14 }, { materiau: 'enduit-ciment', e: 0.01 }] } }
  ];

  let etat = Object.assign({ parois: [], reference: 0, courbe: 'tSi' }, BAO.lire(CLE, null) || {});
  let conditions = null, scenario = null, evaluations = [], rendu = null;

  function sauver() { BAO.ecrire(CLE, etat); }
  function role(i) {
    if (i === etat.reference) return { nom: 'Existant', classe: 'gr-exist', court: 'Existant' };
    const rang = etat.parois.slice(0, i).filter(function (_, j) { return j !== etat.reference; }).length;
    return { nom: 'Variante ' + 'ABC'[rang], classe: COULEURS[rang % COULEURS.length], court: 'Var. ' + 'ABC'[rang] };
  }
  function materiau(id) { return A.materiaux().find(function (m) { return m.id === id; }) || null; }

  /* ==========================================================
     LE CALCUL (appel au chapitre « comparer », rien de plus)
     ========================================================== */
  function recalculer() {
    if (!etat.parois.length) { evaluations = []; dessiner(); return; }
    window.ConfortLabo.conditions(function (c) {
      conditions = c;
      scenario = K.scenarioMeteoParoi(c);
      evaluations = etat.parois.map(function (p) { return K.evaluerParoi(p.paroi, A.materiaux(), c.nature, scenario); });
      dessiner();
    });
  }
  let attente = null;
  function recalculerBientot() { clearTimeout(attente); attente = setTimeout(recalculer, 150); }

  /* ==========================================================
     DESSIN
     ========================================================== */
  // La paroi en coupe, en petit : une bande par couche, large comme son épaisseur (intérieur à gauche).
  function coupe(paroi, largeur) {
    const L = largeur || 220, H = 46, total = paroi.couches.reduce(function (s, c) { return s + c.e; }, 0) || 1;
    let l = paroi.couches.map(function (c) { return Math.max(5, c.e / total * L); });
    const somme = l.reduce(function (s, x) { return s + x; }, 0);
    l = l.map(function (x) { return x * L / somme; });
    let x = 0, svg = '<svg class="coupe-mini" viewBox="0 0 ' + L + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Coupe de la paroi, intérieur à gauche">';
    paroi.couches.forEach(function (c, k) {
      const m = materiau(c.materiau), fam = m ? m.famille : 'revetement';
      svg += '<rect x="' + x.toFixed(1) + '" y="0" width="' + l[k].toFixed(1) + '" height="' + H + '" class="mini-' + fam + ' coupe-couche"><title>' + esc(m ? m.nom : c.materiau) + ' · ' + nb(c.e * 100, 1) + ' cm</title></rect>';
      x += l[k];
    });
    return svg + '</svg>';
  }
  function listeCouches(paroi) {
    return '<ol class="cmp-couches">' + paroi.couches.map(function (c) {
      const m = materiau(c.materiau);
      return '<li>' + esc(m ? m.nom : c.materiau + ' (inconnu)') + ' <b>' + nb(c.e * 100, c.e < 0.02 ? 1 : 0) + ' cm</b></li>';
    }).join('') + '</ol>';
  }

  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dateCourte(n) { const d = S.dateDuJour(n); return d.jour + ' ' + MOIS_COURTS[d.mois - 1]; }
  function texteConditions(court) {
    if (!conditions) return '';
    const c = conditions, d0 = scenario.jourDebut;
    const orient = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'][Math.round(c.orientation / 45) % 8];
    const ext = c.nature === 'plancher' ? 'plancher bas sur sol (H)' : (c.nature === 'toiture' ? 'toiture à ' + nb(c.pente) + '° vers le ' + orient : 'façade ' + orient) + ', α = ' + nb(c.alpha, 1);
    return esc(c.ville.nom) + ' (année type PVGIS) · ' + ext + ' · du ' + S.dateDuJour(d0).nom + ' au ' + S.dateDuJour(d0 + c.jours - 1).nom +
      ' · pièce maintenue à ' + nb(K.CONDITIONS.tPiece) + ' °C (H)' + (court ? '' : ' · hiver : ' + nb(K.CONDITIONS.hiver.tExt) + ' °C dehors, ' + nb(K.CONDITIONS.hiver.tInt) + ' °C dedans (H)');
  }

  function dessiner() {
    const boite = $('#comparateur'), n = etat.parois.length;
    $('#btn-comparer-ajouter').disabled = n >= MAX;
    $('#comparer-compte').textContent = n ? n + ' / ' + MAX + ' dans la comparaison' : '';
    if (!n) {
      boite.innerHTML = '<div class="cmp-vide"><ol><li>Compose la paroi <b>existante</b> ci-dessus, puis « Ajouter à la comparaison ».</li>' +
        '<li>Modifie une couche (isolant, épaisseur, ordre), puis ajoute la <b>variante</b>. Jusqu\'à ' + MAX + ' parois.</li>' +
        '<li>Lis les écarts, été et hiver, dans les mêmes conditions, et exporte le graphe ou la fiche.</li></ol>' +
        '<button type="button" class="bouton" id="btn-comparer-exemple">Charger un exemple : béton nu, isolation intérieure, isolation extérieure</button></div>';
      return;
    }
    if (!scenario || evaluations.length !== n) { boite.innerHTML = '<p class="aide">Calcul en cours…</p>'; return; }
    let html = '<div class="cmp-colonnes" style="--n:' + n + '">' + etat.parois.map(function (p, i) {
      const r = role(i), e = evaluations[i];
      return '<div class="cmp-colonne' + (i === etat.reference ? ' reference' : '') + '" data-index="' + i + '">' +
        '<div class="cmp-role"><i class="gr-cle ' + r.classe + '"></i>' + r.nom + '</div>' +
        '<input type="text" class="cmp-nom" value="' + esc(p.nom) + '" aria-label="Nom de la paroi" autocomplete="off">' +
        coupe(p.paroi) + listeCouches(p.paroi) +
        (e && !e.ok ? '<div class="alerte attention" style="margin:6px 0 0">' + esc(e.erreurs.join(' ')) + '</div>' : '') +
        '<div class="cmp-actions pas-impression">' + (i === etat.reference ? '' : '<button type="button" class="bouton discret" data-cmp="reference" title="Comparer les autres à celle-ci">Définir comme existant</button>') +
        '<button type="button" class="bouton discret" data-cmp="reprendre" title="La recopier dans l\'éditeur pour en faire une variante">Reprendre</button>' +
        '<button type="button" class="bouton discret danger" data-cmp="retirer">Retirer</button></div></div>';
    }).join('') + '</div>';
    html += '<p class="aide cmp-conditions">' + texteConditions() + '. <span class="pas-impression">Conditions modifiables dans les réglages de la coupe animée.</span></p>';
    html += '<div class="cmp-barre pas-impression"><div class="segments" id="cmp-courbes" role="group" aria-label="Courbe affichée">' + COURBES.map(function (c) {
      return '<button type="button" data-courbe="' + c.id + '" aria-pressed="' + (c.id === etat.courbe) + '">' + esc(c.nom) + '</button>';
    }).join('') + '</div><span class="cmp-export"><button type="button" class="bouton" id="btn-cmp-png">Télécharger le graphe (PNG)</button>' +
      '<button type="button" class="bouton principal" id="btn-cmp-fiche">Fiche d\'une page (imprimer / PDF)</button></span></div>';
    html += '<div class="cmp-resultats"><div id="cmp-graphe"></div><div>' + tableau() + '</div></div>';
    const exemples = [];
    evaluations.forEach(function (e) { if (e && e.ok) e.exemples.forEach(function (x) { if (exemples.indexOf(x) === -1) exemples.push(x); }); });
    if (exemples.length) html += '<p class="alerte attention" style="margin:12px 0 0"><b>Valeurs d\'exemple</b> pour : ' + esc(exemples.join(', ')) + '. Remplace-les par des valeurs sourcées (ACERMI, fiche fabricant, règles Th-U) dans Matériaux &amp; climat avant de t\'en servir dans un rapport.</p>';
    boite.innerHTML = html;
    dessinerGraphe($('#cmp-graphe'));
  }

  function optionsGraphe() {
    const flux = etat.courbe === 'flux', d0 = scenario.jourDebut, duree = scenario.duree;
    const series = [];
    etat.parois.forEach(function (p, i) {
      const e = evaluations[i];
      if (!e || !e.ok) return;
      const v = flux ? e.serie.flux : e.serie.tSi;
      series.push({ nom: role(i).court + ' · ' + p.nom, classe: role(i).classe, points: e.serie.temps.map(function (t, k) { return { x: t / 24, y: v[k] }; }) });
    });
    return {
      id: 'comparaison', titre: flux ? 'Flux entrant par la paroi' : 'Température de la face intérieure', unite: flux ? 'W/m²' : '°C', decimales: flux ? 1 : 2,
      x: { min: 0, max: duree / 24, pas: 1, format: function (j) { return j < duree / 24 ? dateCourte(d0 + j) : ''; },
        formatBulle: function (j) { const h = Math.round(j * 24); return S.dateDuJour(d0 + Math.floor(h / 24)).nom + ' · ' + (h % 24) + ' h'; } },
      series: series
    };
  }
  function dessinerGraphe(element) {
    const o = optionsGraphe();
    if (!o.series.length) { element.innerHTML = ''; rendu = null; return; }
    rendu = G.dessiner(element, o);
  }

  function tableau() {
    const lignes = K.comparer(evaluations, etat.reference);
    let html = '<div class="defilement"><table class="cmp-table"><thead><tr><th></th>' + etat.parois.map(function (p, i) {
      return '<th class="num"><i class="gr-cle ' + role(i).classe + '"></i>' + role(i).court + '</th>';
    }).join('') + '</tr></thead><tbody>';
    let groupe = null;
    lignes.forEach(function (l) {
      if (l.groupe !== groupe) { groupe = l.groupe; html += '<tr class="cmp-groupe"><th colspan="' + (etat.parois.length + 1) + '">' + esc(groupe) + '</th></tr>'; }
      html += '<tr><td>' + esc(l.nom) + (l.unite ? ' <span class="muet">' + esc(l.unite) + '</span>' : '') + '</td>' + l.cases.map(function (c) {
        if (c.valeur === null || c.valeur === undefined) return '<td class="num">–</td>';
        let ecart = '';
        if (c.ecart !== undefined) {
          ecart = c.jugement === 'egal' ? '<em class="delta nul">=</em>'
            : '<em class="delta ' + ({ mieux: 'mieux', pire: 'pire', neutre: 'nul' }[c.jugement]) + '">' + (c.ecart > 0 ? '+' : '−') + nb(Math.abs(c.ecart), l.dec) + '</em>';
        }
        return '<td class="num"><b>' + nb(c.valeur, l.dec) + '</b>' + ecart + '</td>';
      }).join('') + '</tr>';
    });
    return html + '</tbody></table></div><p class="aide" style="margin:6px 0 0">Écarts par rapport à l\'existant : <em class="delta mieux">vert</em> = mieux, <em class="delta pire">rouge</em> = moins bien, gris = ni l\'un ni l\'autre (épaisseur, masse). Été : indicateurs NF EN ISO 13786 (période 24 h) et simulation instationnaire 1D sur la période ; hiver : régime permanent.</p>';
  }

  /* ==========================================================
     EXPORTS : l'image du graphe, la fiche d'une page
     ========================================================== */
  // Un SVG autonome : on recopie dans chaque élément le style calculé (les classes et les variables CSS ne suivent pas hors de la page).
  const PROPRIETES = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'visibility'];
  function svgAutonome() {
    const source = $('#cmp-graphe svg.graphique');
    if (!source) return null;
    const clone = source.cloneNode(true);
    const a = source.querySelectorAll('*'), b = clone.querySelectorAll('*');
    for (let i = 0; i < a.length; i++) {
      const cs = getComputedStyle(a[i]);
      PROPRIETES.forEach(function (p) { b[i].style.setProperty(p, cs.getPropertyValue(p)); });
    }
    clone.querySelectorAll('.gr-reticule, .gr-point, .gr-zone').forEach(function (x) { x.remove(); });
    const css = getComputedStyle(document.documentElement);
    const fond = css.getPropertyValue('--surface').trim() || '#ffffff', encre = css.getPropertyValue('--encre').trim() || '#111111', police = css.getPropertyValue('--police') || 'sans-serif';
    const o = optionsGraphe(), L = 560, HAUT = 44, H = 250, ligne = 18;
    const hauteur = HAUT + H + 12 + o.series.length * ligne + 34;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L + ' ' + hauteur + '" width="' + L * 3 + '" height="' + hauteur * 3 + '" font-family="' + esc(police) + '">' +
      '<rect width="' + L + '" height="' + hauteur + '" fill="' + fond + '"/>' +
      '<text x="14" y="20" font-size="14" font-weight="700" fill="' + encre + '">' + esc(o.titre) + '</text>' +
      '<text x="14" y="36" font-size="9.5" fill="' + encre + '" opacity=".7">' + texteConditions(true) + '</text>' +
      '<g transform="translate(0 ' + HAUT + ')">' + clone.innerHTML + '</g>';
    o.series.forEach(function (s, i) {
      const y = HAUT + H + 18 + i * ligne, trait = getComputedStyle(source.querySelectorAll('.gr-ligne')[i]);
      svg += '<line x1="46" x2="76" y1="' + (y - 4) + '" y2="' + (y - 4) + '" stroke="' + trait.stroke + '" stroke-width="2.4" stroke-dasharray="' + trait.strokeDasharray + '"/>' +
        '<text x="84" y="' + y + '" font-size="11" fill="' + encre + '">' + esc(s.nom) + '</text>';
    });
    svg += '<text x="14" y="' + (hauteur - 10) + '" font-size="8.5" fill="' + encre + '" opacity=".6">Simulateur de confort d\'été · NF EN ISO 13786, simulation instationnaire 1D · hypothèses (H) dans la Notice</text></svg>';
    return { svg: svg, largeur: L * 3, hauteur: hauteur * 3 };
  }
  function telechargerPNG() {
    const x = svgAutonome();
    if (!x) return;
    const image = new Image();
    image.onload = function () {
      const toile = document.createElement('canvas');
      toile.width = x.largeur; toile.height = x.hauteur;
      toile.getContext('2d').drawImage(image, 0, 0, x.largeur, x.hauteur);
      toile.toBlob(function (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'comparaison-parois-' + (etat.courbe === 'flux' ? 'flux' : 'face-interieure') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x.svg);
  }

  // La fiche : une page autonome (coupes, les deux graphes, tableau, matériaux et sources, méthode et limites).
  function remplirFiche() {
    const fiche = $('#fiche-impression');
    const utilises = [];
    etat.parois.forEach(function (p) { p.paroi.couches.forEach(function (c) { if (utilises.indexOf(c.materiau) === -1) utilises.push(c.materiau); }); });
    const courbe = etat.courbe;
    const graphe = function (id) { etat.courbe = id; const o = optionsGraphe(); const r = G.courbes(o); return '<h3>' + esc(o.titre) + ' <small>' + esc(o.unite) + '</small></h3>' + r.html; };
    let html = '<header><div><h1>Comparaison de parois</h1><p>Confort d\'été et performance d\'hiver · ' + esc(A.NATURES[conditions.nature].nom) + '</p></div>' +
      '<p class="fiche-date">' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p></header>';
    html += '<p class="fiche-conditions"><b>Conditions communes.</b> ' + texteConditions() + '.</p>';
    html += '<div class="cmp-colonnes" style="--n:' + etat.parois.length + '">' + etat.parois.map(function (p, i) {
      return '<div class="cmp-colonne"><div class="cmp-role"><i class="gr-cle ' + role(i).classe + '"></i>' + role(i).nom + '</div><b>' + esc(p.nom) + '</b>' + coupe(p.paroi) + listeCouches(p.paroi) + '</div>';
    }).join('') + '</div>';
    html += '<div class="fiche-graphes"><div>' + graphe('tSi') + '</div><div>' + graphe('flux') + '</div></div>';
    etat.courbe = courbe;
    html += tableau();
    html += '<h3>Matériaux</h3><table class="cmp-table fiche-materiaux"><thead><tr><th>Matériau</th><th class="num">λ W/(m·K)</th><th class="num">ρ kg/m³</th><th class="num">c J/(kg·K)</th><th>Source</th><th>Statut</th></tr></thead><tbody>' +
      utilises.map(function (id) {
        const m = materiau(id);
        return m ? '<tr><td>' + esc(m.nom) + '</td><td class="num">' + nb(m.lambda, 3) + '</td><td class="num">' + nb(m.rho) + '</td><td class="num">' + nb(m.c) + '</td><td>' + esc(m.source || '') + '</td><td>' + (m.statut === 'valide' ? 'validé' : 'exemple (H)') + '</td></tr>' : '';
      }).join('') + '</tbody></table>';
    html += '<p class="fiche-methode"><b>Méthode.</b> Δt, f, κ1 : matrices de transfert NF EN ISO 13786 (onde de 24 h). Face intérieure et flux : simulation instationnaire 1D par différences finies (tranches de 5 mm, pas de 60 s, schéma implicite), face extérieure à la température sol-air. Les deux méthodes se recoupent à moins de 1 % sur une onde sinusoïdale. Hiver : régime permanent, θsi = θi − U × Rsi × (θi − θe). ' +
      '<b>Limites.</b> Paroi seule, flux 1D, sans pont thermique ni humidité ; pièce à température fixe ; année météo type (été normal) ; (H) = hypothèse. Ce n\'est pas une étude du confort du bâtiment.</p>';
    html += '<footer>Simulateur de confort d\'été · emilemonteil46600-arch.github.io/simulateur-confort-ete</footer>';
    fiche.innerHTML = html;
  }
  function imprimerFiche() {
    if (!conditions || !evaluations.some(function (e) { return e && e.ok; })) return;
    remplirFiche();
    document.body.classList.add('imprime-fiche');
    const fin = function () { document.body.classList.remove('imprime-fiche'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }

  /* ==========================================================
     ÉVÉNEMENTS
     ========================================================== */
  function ajouter() {
    if (etat.parois.length >= MAX) { BAO.notifier('Quatre parois au plus : retires-en une.'); return; }
    const p = BAO.cloner(A.paroi());
    if (!A.analyser().ok) { BAO.notifier('Complète d\'abord les couches de la paroi.'); return; }
    const noms = etat.parois.map(function (x) { return x.nom; });
    let nom = p.nom || 'Paroi', k = 2;
    while (noms.indexOf(nom) !== -1) nom = (p.nom || 'Paroi') + ' (' + k++ + ')';
    etat.parois.push({ nom: nom, paroi: { nature: A.nature(), couches: p.couches } });
    sauver();
    BAO.notifier(etat.parois.length === 1 ? 'Ajoutée comme existant. Modifie une couche, puis ajoute la variante.' : 'Variante ajoutée à la comparaison.');
    recalculer();
    $('#comparateur-carte').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#btn-comparer-ajouter').addEventListener('click', ajouter);
  $('#comparateur').addEventListener('click', function (e) {
    if (e.target.closest('#btn-comparer-exemple')) {
      etat.parois = BAO.cloner(EXEMPLE); etat.reference = 0; sauver();
      if (A.nature() !== 'mur') A.choisirNature('mur');
      recalculer(); return;
    }
    if (e.target.closest('#btn-cmp-png')) { telechargerPNG(); return; }
    if (e.target.closest('#btn-cmp-fiche')) { imprimerFiche(); return; }
    const c = e.target.closest('[data-courbe]');
    if (c) { etat.courbe = c.dataset.courbe; sauver(); dessiner(); return; }
    const b = e.target.closest('[data-cmp]');
    if (!b) return;
    const i = Number(b.closest('[data-index]').dataset.index);
    if (b.dataset.cmp === 'reference') etat.reference = i;
    else if (b.dataset.cmp === 'retirer') {
      etat.parois.splice(i, 1);
      etat.reference = i === etat.reference ? 0 : (i < etat.reference ? etat.reference - 1 : etat.reference);
    } else if (b.dataset.cmp === 'reprendre') {
      const p = etat.parois[i];
      A.remplacer({ nom: p.nom, type: 'exterieure', nature: p.paroi.nature || A.nature(), sensFlux: K.SENS_FLUX[p.paroi.nature || A.nature()], couches: p.paroi.couches });
      BAO.notifier('« ' + p.nom + ' » est dans l\'éditeur : modifie-la, puis ajoute-la comme variante.');
      $('#onglet-paroi').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    sauver();
    recalculer();
  });
  $('#comparateur').addEventListener('change', function (e) {
    if (!e.target.classList.contains('cmp-nom')) return;
    const i = Number(e.target.closest('[data-index]').dataset.index);
    etat.parois[i].nom = e.target.value.trim() || 'Paroi ' + (i + 1);
    sauver(); dessiner();
  });
  // Les conditions (réglages de la coupe animée, nature) ou les matériaux ont changé : on recalcule tout.
  document.addEventListener('confort:labo', recalculerBientot);
  document.addEventListener('confort:donnees', recalculerBientot);
  document.querySelectorAll('.onglets [data-onglet="paroi"]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(dessiner, 0); }); });

  window.ConfortComparateur = { etat: function () { return etat; }, svgAutonome: svgAutonome, remplirFiche: remplirFiche };
  recalculer();
})();
