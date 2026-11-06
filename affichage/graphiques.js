/* ==========================================================
   CONFORT D'ÉTÉ — GRAPHIQUES (SVG faits main, sans bibliothèque)
   ----------------------------------------------------------
   Dessin seulement : AUCUN calcul physique. Les valeurs viennent de calcul-*.js.
   Une seule échelle verticale par graphique (jamais deux axes).
   Couleurs : variables --gr-1, --gr-2 (vérifiées pour le daltonisme, clair et sombre),
   la référence en gris pointillé (--encre-3).
   ========================================================== */
(function (global) {
  'use strict';

  const L = 560, H = 250;
  const M = { g: 46, d: 14, h: 14, b: 34 };

  function nb(v, d) { return global.BAO ? global.BAO.nombre(v, d) : String(v); }

  // Graduations « rondes » entre min et max (environ n traits).
  function graduations(min, max, n) {
    const brut = (max - min) / (n || 5);
    const p = Math.pow(10, Math.floor(Math.log10(brut)));
    const pas = [1, 2, 2.5, 5, 10].map(function (k) { return k * p; }).find(function (s) { return s >= brut; });
    const liste = [];
    for (let v = Math.ceil(min / pas) * pas; v <= max + pas * 1e-9; v += pas) liste.push(Math.round(v / pas) * pas);
    return { pas: pas, liste: liste };
  }

  /* options = {
       id, titre (aria), unite, x: { min, max, pas, format(v) },
       series: [{ nom, classe: 'gr-1' | 'gr-2' | 'gr-ref', points: [{ x, y }] }],
       reperes: [{ x, texte }]   (traits verticaux discrets, ex. pic)
     } */
  function courbes(o) {
    let ymin = Infinity, ymax = -Infinity;
    o.series.forEach(function (s) { s.points.forEach(function (p) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }); });
    if (o.y && isFinite(o.y.min)) ymin = Math.min(ymin, o.y.min);
    if (o.y && isFinite(o.y.max)) ymax = Math.max(ymax, o.y.max);
    if (ymax - ymin < 1e-9) { ymin -= 1; ymax += 1; }
    const marge = (ymax - ymin) * 0.08;
    const gy = graduations(ymin - marge, ymax + marge, 5);
    const y0 = gy.liste[0] - (gy.liste[0] > ymin - marge ? gy.pas : 0);
    const y1 = gy.liste[gy.liste.length - 1] + (gy.liste[gy.liste.length - 1] < ymax + marge ? gy.pas : 0);
    const X = function (x) { return M.g + (x - o.x.min) / (o.x.max - o.x.min) * (L - M.g - M.d); };
    const Y = function (y) { return H - M.b - (y - y0) / (y1 - y0) * (H - M.h - M.b); };
    const fmtX = o.x.format || function (v) { return nb(v); };

    let svg = '<svg class="graphique" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="' + (o.titre || '') + '" data-graphique="' + (o.id || '') + '">';
    // Grille et axes (discrets)
    const lignesY = gy.liste.filter(function (v) { return v >= y0 && v <= y1; });
    lignesY.forEach(function (v) {
      svg += '<line x1="' + M.g + '" x2="' + (L - M.d) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr-grille"/>';
      svg += '<text x="' + (M.g - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" class="gr-texte" text-anchor="end">' + nb(v, gy.pas < 1 ? 1 : 0) + '</text>';
    });
    if (y0 < 0 && y1 > 0) svg += '<line x1="' + M.g + '" x2="' + (L - M.d) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="gr-zero"/>';
    for (let x = o.x.min; x <= o.x.max + 1e-9; x += o.x.pas) {
      svg += '<text x="' + X(x).toFixed(1) + '" y="' + (H - M.b + 16) + '" class="gr-texte" text-anchor="middle">' + fmtX(x) + '</text>';
    }
    svg += '<text x="' + (M.g - 6) + '" y="' + (M.h - 2) + '" class="gr-texte" text-anchor="end">' + (o.unite || '') + '</text>';
    (o.reperes || []).forEach(function (r) {
      svg += '<line x1="' + X(r.x).toFixed(1) + '" x2="' + X(r.x).toFixed(1) + '" y1="' + M.h + '" y2="' + (H - M.b) + '" class="gr-repere"/>';
      svg += '<text x="' + (X(r.x) + 4).toFixed(1) + '" y="' + (M.h + 10) + '" class="gr-texte">' + r.texte + '</text>';
    });
    // Courbes
    o.series.forEach(function (s) {
      const d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
      svg += '<path d="' + d + '" class="gr-ligne ' + s.classe + '"/>';
    });
    // Survol : réticule + points (placés par attacherSurvol)
    svg += '<line class="gr-reticule" x1="0" x2="0" y1="' + M.h + '" y2="' + (H - M.b) + '" visibility="hidden"/>';
    o.series.forEach(function (s, i) { svg += '<circle class="gr-point ' + s.classe + '" data-serie="' + i + '" r="4" visibility="hidden"/>'; });
    svg += '<rect class="gr-zone" x="' + M.g + '" y="' + M.h + '" width="' + (L - M.g - M.d) + '" height="' + (H - M.h - M.b) + '" fill="transparent"/>';
    svg += '</svg>';

    const legende = '<div class="legende">' + o.series.map(function (s) {
      return '<span><i class="gr-cle ' + s.classe + '"></i>' + s.nom + '</span>';
    }).join('') + '</div>';
    return { html: '<div class="graphique-boite">' + svg + '<div class="gr-bulle" hidden></div></div>' + legende, X: X, Y: Y };
  }

  // Branche le réticule et la bulle d'information sur un graphique déjà dans la page.
  function attacherSurvol(boite, o, rendu) {
    const svg = boite.querySelector('svg.graphique');
    if (!svg) return;
    const zone = svg.querySelector('.gr-zone');
    const reticule = svg.querySelector('.gr-reticule');
    const points = svg.querySelectorAll('.gr-point');
    const bulle = boite.querySelector('.gr-bulle');
    const fmtX = o.x.formatBulle || o.x.format || function (v) { return nb(v); };
    const n = o.series[0].points.length;

    function montrer(ev) {
      const r = svg.getBoundingClientRect();
      const xSvg = (ev.clientX - r.left) / r.width * L;
      const xVal = o.x.min + (xSvg - M.g) / (L - M.g - M.d) * (o.x.max - o.x.min);
      let i = 0, ecart = Infinity;
      for (let k = 0; k < n; k++) {
        const e = Math.abs(o.series[0].points[k].x - xVal);
        if (e < ecart) { ecart = e; i = k; }
      }
      const px = rendu.X(o.series[0].points[i].x);
      reticule.setAttribute('x1', px); reticule.setAttribute('x2', px); reticule.setAttribute('visibility', 'visible');
      let html = '<b>' + fmtX(o.series[0].points[i].x) + '</b>';
      o.series.forEach(function (s, j) {
        const p = s.points[i];
        points[j].setAttribute('cx', px); points[j].setAttribute('cy', rendu.Y(p.y)); points[j].setAttribute('visibility', 'visible');
        html += '<div><i class="gr-cle ' + s.classe + '"></i>' + s.nom + ' : <b>' + nb(p.y, o.decimales === undefined ? 1 : o.decimales) + ' ' + (o.unite || '') + '</b></div>';
      });
      bulle.innerHTML = html;
      bulle.hidden = false;
      const gauche = px / L * r.width;
      bulle.style.left = Math.min(Math.max(gauche + 12, 0), r.width - bulle.offsetWidth) + 'px';
    }
    function cacher() {
      reticule.setAttribute('visibility', 'hidden');
      points.forEach(function (p) { p.setAttribute('visibility', 'hidden'); });
      bulle.hidden = true;
    }
    zone.addEventListener('pointermove', montrer);
    zone.addEventListener('pointerdown', montrer);
    zone.addEventListener('pointerleave', cacher);
  }

  // Place un graphique dans un élément de la page, avec son survol.
  function dessiner(element, o) {
    const rendu = courbes(o);
    element.innerHTML = rendu.html;
    attacherSurvol(element.querySelector('.graphique-boite'), o, rendu);
  }

  const ConfortGraphiques = { courbes: courbes, dessiner: dessiner, graduations: graduations };
  global.ConfortGraphiques = ConfortGraphiques;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortGraphiques;
})(typeof window !== 'undefined' ? window : globalThis);
