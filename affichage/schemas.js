/* ==========================================================
   CONFORT D'ÉTÉ — SCHÉMA DE LA PAROI (SVG)
   ----------------------------------------------------------
   Dessin seulement : AUCUN calcul. Reçoit l'analyse de calcul-parois.js.
   Coupe horizontale : intérieur à gauche, extérieur (soleil, chaleur) à droite.
   Par-dessus, la courbe de l'amplitude de l'onde de température dans l'épaisseur.
   ========================================================== */
(function (global) {
  'use strict';

  const L = 460, H = 230;
  const MARGE_G = 64, MARGE_D = 64;      // air intérieur / air extérieur
  const HAUT = 34, BAS = 176;           // la paroi en hauteur
  const MIN_LARGEUR = 7;                 // une couche fine reste visible (px)

  const CLASSE_FAMILLE = {
    beton: 'sch-beton', maconnerie: 'sch-maconnerie-fond', isolant: 'sch-isolant-fond',
    bois: 'sch-sol', revetement: 'sch-plaque'
  };

  function nb(v, d) { return global.BAO ? global.BAO.nombre(v, d) : String(Math.round(v * 10) / 10); }

  // Largeur dessinée de chaque couche : proportionnelle à l'épaisseur, avec un minimum.
  function largeurs(couches) {
    const dispo = L - MARGE_G - MARGE_D;
    const total = couches.reduce(function (s, c) { return s + c.e; }, 0);
    let l = couches.map(function (c) { return Math.max(MIN_LARGEUR, c.e / total * dispo); });
    const somme = l.reduce(function (s, x) { return s + x; }, 0);
    return l.map(function (x) { return x * dispo / somme; });
  }

  function coupeParoi(analyse, familles) {
    if (!analyse || !analyse.ok) return '';
    const couches = analyse.couches;
    const l = largeurs(couches);
    const bords = [MARGE_G];
    l.forEach(function (x) { bords.push(bords[bords.length - 1] + x); });
    let svg = '<svg class="schema-svg schema-paroi" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Coupe de la paroi et amplitude de l\'onde de température">';
    svg += '<rect x="0" y="0" width="' + MARGE_G + '" height="' + H + '" class="sch-interieur"/>';
    svg += '<rect x="' + (L - MARGE_D) + '" y="0" width="' + MARGE_D + '" height="' + H + '" class="sch-zone-chaude"/>';
    svg += '<text x="8" y="20" class="sch-texte">Intérieur</text>';
    svg += '<text x="' + (L - 8) + '" y="20" class="sch-texte" text-anchor="end">Extérieur</text>';

    // Les couches
    couches.forEach(function (c, i) {
      const fam = (familles && familles[i]) || 'revetement';
      svg += '<rect x="' + bords[i].toFixed(1) + '" y="' + HAUT + '" width="' + l[i].toFixed(1) + '" height="' + (BAS - HAUT) + '" class="' + (CLASSE_FAMILLE[fam] || 'sch-plaque') + ' sch-couche"/>';
      if (fam === 'isolant' && l[i] > 12) {
        let d = '';
        for (let y = HAUT + 6; y < BAS - 6; y += 12) {
          d += 'M' + (bords[i] + 3).toFixed(1) + ' ' + y + ' Q ' + (bords[i] + l[i] / 2).toFixed(1) + ' ' + (y + 8) + ' ' + (bords[i + 1] - 3).toFixed(1) + ' ' + y + ' ';
        }
        svg += '<path d="' + d + '" class="sch-isolant-trait" fill="none"/>';
      }
      svg += '<text x="' + (bords[i] + l[i] / 2).toFixed(1) + '" y="' + (BAS + 16) + '" class="sch-texte" text-anchor="middle">' + (i + 1) + '</text>';
    });

    // L'amplitude de l'onde : 1 K dehors → |θ| dans l'épaisseur (échelle : 1 K = toute la hauteur)
    const pts = analyse.profil || [];
    if (pts.length) {
      const total = analyse.epaisseur;
      const xDe = function (x) {
        // On replace chaque x réel dans la couche dessinée correspondante.
        let cumul = 0;
        for (let i = 0; i < couches.length; i++) {
          if (x <= cumul + couches[i].e + 1e-12) return bords[i] + (x - cumul) / couches[i].e * l[i];
          cumul += couches[i].e;
        }
        return bords[bords.length - 1] * x / total;
      };
      const yDe = function (a) { return BAS - a * (BAS - HAUT); };
      let d = 'M' + (L - 4) + ' ' + yDe(1).toFixed(1) + ' L' + (L - MARGE_D) + ' ' + yDe(1).toFixed(1);
      for (let i = pts.length - 1; i >= 0; i--) d += ' L' + xDe(pts[i].x).toFixed(1) + ' ' + yDe(pts[i].amplitude).toFixed(1);
      d += ' L4 ' + yDe(0).toFixed(1);
      svg += '<path d="' + d + '" class="sch-onde"/>';
      const ai = pts[0].amplitude;
      svg += '<text x="' + (L - 8) + '" y="' + (yDe(1) + 16).toFixed(1) + '" class="sch-texte" text-anchor="end">± 1 K</text>';
      svg += '<text x="8" y="' + (BAS - 8) + '" class="sch-texte">± ' + nb(ai, 2) + ' K</text>';
    }
    svg += '<text x="' + (L / 2) + '" y="' + (H - 10) + '" class="sch-texte" text-anchor="middle">Courbe : amplitude de l\'onde pour ± 1 K dehors (air intérieur fixe)</text>';
    svg += '</svg>';
    return svg;
  }

  const ConfortSchemas = { coupeParoi: coupeParoi };
  global.ConfortSchemas = ConfortSchemas;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfortSchemas;
})(typeof window !== 'undefined' ? window : globalThis);
