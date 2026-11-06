/* ==========================================================
   Boîte à outils thermique — fonctions partagées par tous les outils
   (sauvegarde, fichiers, mise en forme des nombres, onglets,
   statuts exemple / validé, calculs enregistrés)

   COPIE de commun/commun.js de la boîte à outils thermique (06/11/2026), pour que ce site
   soit autonome. Seules différences : la liste BAO.CLES_DONNEES (clés du confort d'été)
   et le texte de la carte « Mes données ». Une correction faite ici est à reporter là-bas.
   ========================================================== */
(function (global) {
  'use strict';

  const BAO = {};
  const possede = function (objet, cle) { return Object.prototype.hasOwnProperty.call(objet, cle); };

  /* ---------- Tes données personnelles ----------
     Toutes les clés où la boîte à outils range tes données, outil par outil.
     ⚠ Ne jamais renommer une clé existante sans migration : tes données seraient perdues.
     (Les clés « onglet » ne sont pas listées : ce n'est qu'un confort d'affichage.) */
  BAO.CLES_DONNEES = {
    'bao.confort.projet.v1': 'Confort d\'été — le projet (la maison)',
    'bao.confort.paroi.v1': 'Confort d\'été — la paroi en cours',
    'bao.confort.parois.v1': 'Confort d\'été — tes parois enregistrées',
    'bao.confort.local.v1': 'Confort d\'été — le local (inertie)',
    'bao.confort.materiaux.v1': 'Confort d\'été — ta bibliothèque de matériaux',
    'bao.confort.reglages.v1': 'Confort d\'été — tes réglages (onde, seuils…)'
  };

  // Date de la dernière modification et du dernier export de chaque clé.
  const CLE_SUIVI = 'bao.sauvegarde.v1';
  BAO.FORMAT_SAUVEGARDE = 'bao-sauvegarde-complete';
  // (H) Délai avant de te rappeler de sauvegarder des données modifiées : convention de l'outil.
  BAO.DELAI_RAPPEL_JOURS = 14;
  const JOUR = 24 * 3600 * 1000;

  /* ---------- Sauvegarde dans le navigateur ----------
     Les données restent sur l'appareil (localStorage).
     Elles ne partent jamais sur GitHub ni ailleurs.
     Pour passer d'un appareil à l'autre : sauvegarde complète puis restauration. */
  function stockage() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  BAO.lire = function (cle, defaut) {
    try {
      const brut = stockage().getItem(cle);
      return brut === null ? defaut : JSON.parse(brut);
    } catch (e) {
      return defaut;
    }
  };

  function ecrireBrut(cle, valeur) {
    try {
      stockage().setItem(cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Écrit une valeur ; si c'est une de tes données, note la date de modification.
  BAO.ecrire = function (cle, valeur) {
    const ok = ecrireBrut(cle, valeur);
    if (ok && possede(BAO.CLES_DONNEES, cle)) noter('modifs', [cle]);
    return ok;
  };

  BAO.effacer = function (cle) {
    try { stockage().removeItem(cle); } catch (e) { /* rien */ }
  };

  BAO.cloner = function (objet) {
    return JSON.parse(JSON.stringify(objet));
  };

  /* ---------- Suivi des sauvegardes ---------- */
  function lireSuivi() {
    const s = BAO.lire(CLE_SUIVI, null) || {};
    return { exports: s.exports || {}, modifs: s.modifs || {} };
  }

  function noter(type, cles, dateISO) {
    const s = lireSuivi();
    const d = dateISO || new Date().toISOString();
    cles.forEach(function (c) { s[type][c] = d; });
    ecrireBrut(CLE_SUIVI, s);
  }

  // À appeler après chaque export : ces données sont maintenant dans un fichier.
  BAO.noterExport = function (cles, dateISO) { noter('exports', cles, dateISO); };

  // Les clés de données qui existent sur cet appareil.
  BAO.clesPresentes = function () {
    const st = stockage();
    if (!st) return [];
    return Object.keys(BAO.CLES_DONNEES).filter(function (c) {
      try { return st.getItem(c) !== null; } catch (e) { return false; }
    });
  };

  /* Faut-il te rappeler de sauvegarder ?
     - une donnée est « non sauvegardée » si elle n'a jamais été exportée,
       ou si elle a été modifiée après son dernier export ;
     - on te le rappelle si une donnée non sauvegardée n'a jamais été exportée,
       ou si son dernier export date de plus de DELAI_RAPPEL_JOURS jours.
     maintenant : date en millisecondes (Date.now()). */
  BAO.etatSauvegarde = function (suivi, clesPresentes, maintenant, delaiJours) {
    const delai = (delaiJours === undefined ? BAO.DELAI_RAPPEL_JOURS : delaiJours) * JOUR;
    const date = function (iso) { const t = Date.parse(iso); return isFinite(t) ? t : null; };
    const exports = suivi.exports || {}, modifs = suivi.modifs || {};

    const nonSauvegardees = clesPresentes.filter(function (c) {
      const exp = date(exports[c]), mod = date(modifs[c]);
      return exp === null || (mod !== null && mod > exp);
    });
    const rappel = nonSauvegardees.some(function (c) {
      const exp = date(exports[c]);
      return exp === null || maintenant - exp > delai;
    });
    const dates = clesPresentes.map(function (c) { return date(exports[c]); }).filter(function (t) { return t !== null; });

    return {
      nonSauvegardees: nonSauvegardees,
      rappel: rappel,
      derniere: dates.length ? Math.max.apply(null, dates) : null
    };
  };

  BAO.etatSauvegardeActuel = function () {
    return BAO.etatSauvegarde(lireSuivi(), BAO.clesPresentes(), Date.now());
  };

  // Où sont tes données ? Chaque adresse a son propre stockage.
  BAO.lieuStockage = function () {
    const loc = global.location || {};
    if (loc.protocol === 'file:') return { type: 'fichier', texte: 'un fichier ouvert depuis ton ordinateur (file://)' };
    if (/github\.io$/.test(loc.hostname || '')) return { type: 'site', texte: 'le site en ligne (' + loc.hostname + ')' };
    return { type: 'autre', texte: 'l\'adresse ' + (loc.host || 'inconnue') };
  };

  /* ---------- Sauvegarde complète (toute la boîte à outils) ---------- */
  BAO.contenuSauvegarde = function () {
    const donnees = {};
    BAO.clesPresentes().forEach(function (c) { donnees[c] = BAO.lire(c, null); });
    return { format: BAO.FORMAT_SAUVEGARDE, version: 1, exporte_le: new Date().toISOString(), donnees: donnees };
  };

  BAO.telechargerSauvegarde = function () {
    const contenu = BAO.contenuSauvegarde();
    const cles = Object.keys(contenu.donnees);
    if (!cles.length) { BAO.notifier('Rien à sauvegarder : aucune donnée personnelle sur cet appareil.'); return false; }
    BAO.telechargerJSON('sauvegarde-boite-a-outils_' + BAO.dateFichier() + '.json', contenu, cles, contenu.exporte_le);
    BAO.notifier('Sauvegarde téléchargée. Range le fichier dans un endroit sûr (OneDrive…).');
    return true;
  };

  // Vérifie un fichier de sauvegarde complète ; renvoie les clés connues qu'il contient.
  BAO.clesDeLaSauvegarde = function (contenu) {
    if (!contenu || contenu.format !== BAO.FORMAT_SAUVEGARDE || !contenu.donnees || typeof contenu.donnees !== 'object') {
      throw new Error('Ce fichier n\'est pas une sauvegarde complète de la boîte à outils.');
    }
    return Object.keys(contenu.donnees).filter(function (c) { return possede(BAO.CLES_DONNEES, c); });
  };

  // Remplace les données de cet appareil par celles de la sauvegarde (après confirmation).
  // Seules les clés connues sont écrites ; les autres données ne sont pas touchées.
  BAO.restaurerSauvegarde = function (contenu) {
    const cles = BAO.clesDeLaSauvegarde(contenu);
    if (!cles.length) throw new Error('Cette sauvegarde ne contient aucune donnée.');
    const date = isFinite(Date.parse(contenu.exporte_le)) ? contenu.exporte_le : new Date().toISOString();
    const liste = cles.map(function (c) { return '• ' + BAO.CLES_DONNEES[c]; }).join('\n');
    if (!global.confirm('Restaurer la sauvegarde du ' + BAO.dateCourte(Date.parse(date)) + ' ?\n\n' +
      'Elle remplace, sur cet appareil :\n' + liste + '\n\nLes autres données ne sont pas touchées.')) return false;
    cles.forEach(function (c) { ecrireBrut(c, contenu.donnees[c]); });
    // Ces données sont identiques au fichier : elles comptent comme sauvegardées à sa date.
    noter('modifs', cles, date);
    noter('exports', cles, date);
    return true;
  };

  /* ---------- Rappel de sauvegarde (bandeau en haut de chaque page) ---------- */
  BAO.afficherRappelSauvegarde = function () {
    const page = document.querySelector('main.page');
    if (!page || document.querySelector('.rappel-sauvegarde')) return;
    try { if (global.sessionStorage.getItem('bao.rappel.masque') === '1') return; } catch (e) { /* rien */ }
    const etat = BAO.etatSauvegardeActuel();
    if (!etat.rappel) return;

    const bandeau = document.createElement('div');
    bandeau.className = 'alerte attention rappel-sauvegarde pas-impression';
    bandeau.setAttribute('role', 'status');
    bandeau.innerHTML = '<b>Pense à sauvegarder.</b> Tes données (ratios, calculs…) ne sont que dans ce navigateur : ' +
      'effacer l\'historique ou changer d\'ordinateur les ferait disparaître. ' +
      (etat.derniere ? 'Dernière sauvegarde : ' + BAO.ilYA(etat.derniere) + '.' : 'Aucune sauvegarde pour l\'instant.') +
      '<div class="barre-boutons" style="margin-top:8px">' +
      '<button type="button" class="bouton principal" data-action="sauver">Télécharger une sauvegarde complète</button>' +
      '<button type="button" class="bouton discret" data-action="plus-tard">Plus tard</button></div>';
    bandeau.addEventListener('click', function (e) {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      if (b.dataset.action === 'sauver' && !BAO.telechargerSauvegarde()) return;
      if (b.dataset.action === 'plus-tard') {
        try { global.sessionStorage.setItem('bao.rappel.masque', '1'); } catch (err) { /* rien */ }
      }
      bandeau.remove();
    });
    page.insertBefore(bandeau, page.firstChild);
  };

  /* ---------- Carte « Mes données » (accueil) ---------- */
  BAO.carteDonnees = function (element) {
    function rendre() {
      const suivi = lireSuivi();
      const presentes = BAO.clesPresentes();
      const etat = BAO.etatSauvegarde(suivi, presentes, Date.now());
      const lieu = BAO.lieuStockage();

      let html = '<div class="carte-titre"><h2>Mes données</h2>' +
        (presentes.length
          ? (etat.nonSauvegardees.length
            ? '<span class="badge exemple">' + etat.nonSauvegardees.length + ' élément(s) pas sauvegardé(s)</span>'
            : '<span class="badge valide">tout est sauvegardé</span>')
          : '') + '</div>' +
        '<p>Tes matériaux, tes parois et tes calculs sont enregistrés <b>dans ce navigateur, sur cet appareil</b>, jamais sur GitHub. ' +
        'Tu es ici sur <b>' + BAO.echapper(lieu.texte) + '</b>.</p>' +
        '<div class="alerte info">Le site en ligne, un fichier ouvert depuis ton PC, un autre navigateur ou ton téléphone ont ' +
        '<b>chacun leurs propres données</b>, qui ne se voient pas entre elles. Pour passer de l\'un à l\'autre : ' +
        '« Télécharger une sauvegarde complète » ici, puis « Restaurer une sauvegarde » là-bas.</div>';

      if (presentes.length) {
        html += '<div class="defilement"><table><thead><tr><th>Donnée</th><th>Modifiée</th><th>Sauvegardée</th></tr></thead><tbody>' +
          presentes.map(function (c) {
            const ok = etat.nonSauvegardees.indexOf(c) === -1;
            const mod = Date.parse(suivi.modifs[c]), exp = Date.parse(suivi.exports[c]);
            return '<tr><td>' + BAO.echapper(BAO.CLES_DONNEES[c]) + '</td>' +
              '<td>' + (isFinite(mod) ? BAO.dateCourte(mod) : '<span class="muet">avant le suivi</span>') + '</td>' +
              '<td>' + (isFinite(exp) ? BAO.dateCourte(exp) : 'jamais') + ' ' +
              (ok ? '<span class="badge valide">ok</span>' : '<span class="badge exemple">à sauvegarder</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        html += '<p class="muet">Aucune donnée personnelle pour l\'instant sur cet appareil.</p>';
      }

      html += '<div class="barre-boutons" style="margin-top:12px">' +
        '<button type="button" class="bouton principal" data-action="sauver">Télécharger une sauvegarde complète</button>' +
        '<label class="bouton" style="cursor:pointer">Restaurer une sauvegarde' +
        '<input type="file" accept=".json,application/json" hidden data-action="restaurer"></label></div>' +
        '<p class="aide" style="margin:8px 0 0">(H) Un rappel s\'affiche en haut des pages si des données modifiées ne sont pas ' +
        'sauvegardées depuis plus de ' + BAO.DELAI_RAPPEL_JOURS + ' jours.</p>';
      element.innerHTML = html;
    }

    element.addEventListener('click', function (e) {
      const b = e.target.closest('[data-action="sauver"]');
      if (b && BAO.telechargerSauvegarde()) {
        rendre();
        const bandeau = document.querySelector('.rappel-sauvegarde');
        if (bandeau) bandeau.remove();
      }
    });
    element.addEventListener('change', function (e) {
      if (e.target.dataset.action !== 'restaurer') return;
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) BAO.choisirEtRestaurer(f);
    });
    rendre();
  };

  // Lit un fichier de sauvegarde complète, le restaure, puis recharge la page.
  BAO.choisirEtRestaurer = function (fichier) {
    return BAO.lireFichierJSON(fichier).then(function (contenu) {
      if (BAO.restaurerSauvegarde(contenu)) global.location.reload();
    }).catch(function (e) {
      global.alert(e.message);
    });
  };

  // Petite ligne pour l'onglet Données de chaque outil.
  BAO.noteStockage = function (element, lienAccueil) {
    element.innerHTML = 'Tes données restent <b>dans ce navigateur</b>, sur cet appareil (ici : ' + BAO.echapper(BAO.lieuStockage().texte) + '). ' +
      'Elles ne partent jamais sur GitHub. Les boutons ci-dessous sauvegardent <b>cet outil</b> ; pour <b>toute la boîte à outils</b> ' +
      '(et pour passer du PC au téléphone) : <a href="' + lienAccueil + '#mes-donnees">accueil › Mes données</a>.';
  };

  /* ---------- Dossier bâtiment (partagé par tous les outils) ----------
     Le bâtiment en cours et les prix des énergies sont saisis une fois,
     dans outils/batiment/, et lus ici par les autres outils.
     Tant que tu n'as rien saisi, ce sont les valeurs d'exemple (donnees/batiment-exemple.js). */
  BAO.CLE_BATIMENT = 'bao.batiment.v1';
  BAO.CLE_ENERGIES = 'bao.energies.v1';

  // Complète un bâtiment avec les champs d'exemple qui lui manquent (sans écraser les tiens).
  BAO.completerBatiment = function (b) {
    const base = BAO.cloner((global.BATIMENT_EXEMPLE || {}).batiment || {});
    if (!b || typeof b !== 'object') return base;
    ['climat', 'chauffage', 'consommations'].forEach(function (k) {
      b[k] = Object.assign({}, base[k] || {}, b[k] || {});
    });
    if (!b.consommations.valeurs) b.consommations.valeurs = {};
    if (b.nom === undefined) b.nom = base.nom;
    if (b.surface === undefined) b.surface = base.surface;
    return b;
  };

  BAO.lireBatiment = function () {
    return BAO.completerBatiment(BAO.lire(BAO.CLE_BATIMENT, null));
  };

  // Tes prix des énergies ; une énergie ajoutée plus tard aux exemples apparaît sans écraser les tiennes.
  BAO.completerEnergies = function (e) {
    const base = BAO.cloner((global.BATIMENT_EXEMPLE || {}).energies || { base: 'TTC', liste: [] });
    if (!e || !Array.isArray(e.liste)) return base;
    base.liste.forEach(function (x) {
      if (!e.liste.some(function (y) { return y.id === x.id; })) e.liste.push(x);
    });
    if (!e.base) e.base = base.base;
    return e;
  };

  BAO.lireEnergies = function () {
    return BAO.completerEnergies(BAO.lire(BAO.CLE_ENERGIES, null));
  };

  /* Petit bandeau « Bâtiment : … » en tête d'un outil.
     nomLie : le bâtiment pour lequel le calcul a été fait (null si aucun).
     surLier : fonction appelée quand tu lies le calcul au bâtiment ouvert. */
  BAO.resumeBatiment = function (element, lienDossier, nomLie, surLier) {
    const b = BAO.lireBatiment();
    const energies = BAO.lireEnergies();
    const e = (energies.liste || []).find(function (x) { return x.id === b.chauffage.energie; });
    const c = b.climat;
    let html = '<div class="barre-boutons" style="justify-content:space-between">' +
      '<span><span class="muet">Dossier bâtiment :</span> <b>' + BAO.echapper(b.nom || 'sans nom') + '</b>' +
      ' <span class="muet">· DJU ' + BAO.nombre(Number(c.dju)) + ' · ' + BAO.echapper(e ? e.nom : 'énergie ?') +
      ' (rendement ' + BAO.nombre(Number(b.chauffage.rendement)) + ' %) · T base ' + BAO.nombre(Number(c.tbase)) + ' °C</span></span>' +
      '<a class="bouton discret" href="' + lienDossier + '">Modifier le dossier bâtiment ›</a></div>';
    if (nomLie && nomLie !== b.nom) {
      html += '<div class="alerte attention" style="margin:8px 0 0">Ce calcul a été fait pour le bâtiment « ' + BAO.echapper(nomLie) +
        ' », mais le dossier bâtiment ouvert est « ' + BAO.echapper(b.nom) + ' ». Les kWh et les € ci-dessous utilisent le bâtiment ouvert. ' +
        '<button type="button" class="bouton discret" data-action="lier-batiment">Lier ce calcul à « ' + BAO.echapper(b.nom) + ' »</button></div>';
    }
    element.innerHTML = html;
    const bouton = element.querySelector('[data-action="lier-batiment"]');
    if (bouton && surLier) bouton.addEventListener('click', function () { surLier(b.nom); });
    return b;
  };

  /* ---------- Nombres (format français) ---------- */
  const fmt0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  BAO.nombre = function (valeur, decimales) {
    if (valeur === null || valeur === undefined || !isFinite(valeur)) return '–';
    const d = decimales === undefined ? 0 : decimales;
    if (d === 0) return fmt0.format(valeur);
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(valeur);
  };

  BAO.euros = function (valeur, decimales) {
    return BAO.nombre(valeur, decimales) + ' €';
  };

  // Lit un nombre tapé à la française ("1 250,5") ou à l'anglaise ("1250.5")
  BAO.lireNombre = function (texte) {
    if (typeof texte === 'number') return texte;
    if (texte === null || texte === undefined) return NaN;
    const propre = String(texte).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    return propre === '' ? NaN : Number(propre);
  };

  // Nombre positif ou nul tapé dans un champ ; '' si le champ est vide, invalide ou négatif.
  BAO.lirePositif = function (texte) {
    const n = BAO.lireNombre(texte);
    return isFinite(n) && n >= 0 ? n : '';
  };

  // Valeur → texte d'un champ de saisie, à la française (12.5 → "12,5").
  BAO.versChamp = function (valeur) {
    return valeur === undefined || valeur === null || valeur === '' ? '' : String(valeur).replace('.', ',');
  };

  // "2025-01" -> "janv. 2025"
  BAO.mois = function (aaaamm) {
    if (!aaaamm || !/^\d{4}-\d{2}$/.test(aaaamm)) return aaaamm || '–';
    const [a, m] = aaaamm.split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  };

  // Date en millisecondes → "29/10/2026"
  BAO.dateCourte = function (ms) {
    return isFinite(ms) ? new Date(ms).toLocaleDateString('fr-FR') : '–';
  };

  // Date en millisecondes → "aujourd'hui", "hier", "il y a 12 jours"
  BAO.ilYA = function (ms, maintenant) {
    const jours = Math.floor(((maintenant === undefined ? Date.now() : maintenant) - ms) / JOUR);
    if (jours <= 0) return 'aujourd\'hui';
    if (jours === 1) return 'hier';
    return 'il y a ' + jours + ' jours';
  };

  BAO.echapper = function (texte) {
    return String(texte === undefined || texte === null ? '' : texte)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  BAO.identifiant = function (prefixe) {
    return (prefixe || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ---------- Statut d'une valeur : exemple ou validé ---------- */
  BAO.badgeStatut = function (statut) {
    return statut === 'valide'
      ? '<span class="badge valide">validé</span>'
      : '<span class="badge exemple">exemple à valider</span>';
  };

  BAO.selectStatut = function (statut, attributs) {
    return '<select ' + attributs + ' aria-label="Statut"><option value="exemple"' + (statut !== 'valide' ? ' selected' : '') + '>exemple</option>' +
      '<option value="valide"' + (statut === 'valide' ? ' selected' : '') + '>validé</option></select>';
  };

  /* ---------- Fichiers ---------- */
  BAO.telecharger = function (nomFichier, contenu, type) {
    const blob = new Blob([contenu], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  // Télécharge un fichier JSON et note que ces clés sont sauvegardées.
  BAO.telechargerJSON = function (nomFichier, contenu, clesSauvegardees, dateISO) {
    BAO.telecharger(nomFichier, JSON.stringify(contenu, null, 2), 'application/json');
    if (clesSauvegardees && clesSauvegardees.length) BAO.noterExport(clesSauvegardees, dateISO);
  };

  // Nom de fichier sûr, sans accents ni signes ("École — état 1" → "Ecole-etat-1").
  BAO.nomFichier = function (texte, defaut) {
    const propre = String(texte || '')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 _-]+/g, ' ')
      .trim().replace(/\s+/g, '-');
    return propre || defaut;
  };

  BAO.lireFichierJSON = function (fichier) {
    return new Promise(function (resoudre, rejeter) {
      const lecteur = new FileReader();
      lecteur.onload = function () {
        try { resoudre(JSON.parse(lecteur.result)); } catch (e) { rejeter(new Error('Fichier JSON illisible.')); }
      };
      lecteur.onerror = function () { rejeter(new Error('Lecture du fichier impossible.')); };
      lecteur.readAsText(fichier);
    });
  };

  BAO.dateFichier = function () {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  /* ---------- Export Excel (CSV à point-virgule, virgule décimale) ---------- */
  BAO.celluleCSV = function (texte) {
    return '"' + String(texte === undefined || texte === null ? '' : texte).replace(/"/g, '""') + '"';
  };

  BAO.nombreCSV = function (valeur, decimales) {
    if (valeur === '' || valeur === null || valeur === undefined || !isFinite(valeur)) return '';
    return Number(valeur).toFixed(decimales === undefined ? 2 : decimales).replace('.', ',');
  };

  BAO.telechargerCSV = function (nomFichier, lignes) {
    // Le caractère invisible \ufeff (« BOM ») en tête permet à Excel de lire les accents (UTF-8).
    BAO.telecharger(nomFichier, '\ufeff' + lignes.join('\r\n'), 'text/csv;charset=utf-8');
  };

  /* ---------- Presse-papiers (copie mise en forme pour Word) ---------- */
  BAO.copierTableau = async function (html, texte) {
    try {
      if (global.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([texte], { type: 'text/plain' })
        })]);
        return true;
      }
    } catch (e) { /* on tente la méthode de secours */ }
    try {
      const zone = document.createElement('div');
      zone.innerHTML = html;
      zone.style.position = 'fixed';
      zone.style.left = '-9999px';
      document.body.appendChild(zone);
      const plage = document.createRange();
      plage.selectNodeContents(zone);
      const sel = global.getSelection();
      sel.removeAllRanges();
      sel.addRange(plage);
      const ok = document.execCommand('copy');
      sel.removeAllRanges();
      zone.remove();
      return ok;
    } catch (e) {
      return false;
    }
  };

  /* Tableau prêt à coller dans Word, + la même chose en texte (tabulations).
     colonnes : [{ titre, droite }]   (droite = aligné à droite, pour les nombres)
     lignes   : [[cellule, cellule…]]
     totaux   : [[libellé, valeur, gras]]  (le libellé occupe toutes les colonnes sauf la dernière) */
  BAO.tableauWord = function (colonnes, lignes, totaux) {
    const esc = BAO.echapper;
    const bord = 'border:1px solid #9a9a9a;padding:4px 7px;';
    const entete = bord + 'background:#e9e6df;font-weight:bold;';
    const droite = 'text-align:right;white-space:nowrap;';
    const n = colonnes.length;

    let html = '<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt"><thead><tr>' +
      colonnes.map(function (c) { return '<th style="' + entete + (c.droite ? droite : 'text-align:left') + '">' + esc(c.titre) + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    const texte = [colonnes.map(function (c) { return c.titre; }).join('\t')];

    lignes.forEach(function (l) {
      html += '<tr>' + l.map(function (cel, i) {
        return '<td style="' + bord + (colonnes[i] && colonnes[i].droite ? droite : '') + '">' + esc(cel) + '</td>';
      }).join('') + '</tr>';
      texte.push(l.join('\t'));
    });
    (totaux || []).forEach(function (t) {
      const style = bord + (t[2] ? 'font-weight:bold;background:#f3f1ec;' : '');
      html += '<tr><td colspan="' + (n - 1) + '" style="' + style + '">' + esc(t[0]) + '</td>' +
        '<td style="' + style + droite + '">' + esc(t[1]) + '</td></tr>';
      texte.push(t[0] + '\t'.repeat(n - 1) + t[1]);
    });
    html += '</tbody></table>';
    return { html: html, texte: texte.join('\n') };
  };

  BAO.copierPourWord = function (tableau) {
    BAO.copierTableau(tableau.html, tableau.texte).then(function (ok) {
      BAO.notifier(ok ? 'Tableau copié : colle-le dans Word (Ctrl+V).' : 'Copie impossible dans ce navigateur.');
    });
  };

  /* ---------- Petite notification ---------- */
  let minuterieToast = null;
  BAO.notifier = function (message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(function () { el.classList.remove('visible'); }, 2400);
  };

  /* ---------- Onglets ----------
     <div class="onglets"><button data-onglet="calcul">…</button></div>
     <section class="panneau" id="onglet-calcul">…</section> */
  BAO.initOnglets = function (cleMemoire) {
    const boutons = Array.from(document.querySelectorAll('.onglets [data-onglet]'));
    function activer(nom) {
      if (!boutons.some(function (b) { return b.dataset.onglet === nom; })) nom = boutons[0].dataset.onglet;
      boutons.forEach(function (b) {
        const actif = b.dataset.onglet === nom;
        b.setAttribute('aria-selected', actif ? 'true' : 'false');
        const panneau = document.getElementById('onglet-' + b.dataset.onglet);
        if (panneau) panneau.hidden = !actif;
      });
      if (cleMemoire) BAO.ecrire(cleMemoire, nom);
    }
    boutons.forEach(function (b) {
      b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { activer(b.dataset.onglet); });
    });
    activer(BAO.lire(cleMemoire, boutons[0].dataset.onglet));
    return activer;
  };

  /* ---------- Bouton « ▸ calcul » d'un tableau : ouvre / ferme la ligne de détail ---------- */
  BAO.basculerDetail = function (bouton, id, ouverts) {
    if (ouverts.has(id)) ouverts.delete(id); else ouverts.add(id);
    const ouvert = ouverts.has(id);
    const ligne = document.querySelector('tr[data-detail="' + CSS.escape(id) + '"]');
    if (ligne) ligne.hidden = !ouvert;
    bouton.setAttribute('aria-expanded', ouvert);
    bouton.textContent = (ouvert ? '▾' : '▸') + ' calcul';
  };

  /* ---------- Onglet Méthode : sections repliables ----------
     Chaque <h2> d'un bloc .methode devient le titre cliquable de sa section.
     Sur ordinateur tout est ouvert ; sur téléphone, seule la 1re section l'est. */
  BAO.sectionsRepliables = function (selecteur) {
    document.querySelectorAll(selecteur).forEach(function (bloc) {
      const titres = Array.from(bloc.children).filter(function (el) { return el.tagName === 'H2'; });
      if (titres.length < 2) return;
      const grandEcran = global.matchMedia ? global.matchMedia('(min-width: 900px)').matches : true;

      titres.forEach(function (h2, i) {
        const section = document.createElement('details');
        section.className = 'section-methode';
        section.open = grandEcran || i === 0;
        const titre = document.createElement('summary');
        bloc.insertBefore(section, h2);
        titre.appendChild(h2);
        section.appendChild(titre);
        let el = section.nextSibling;
        while (el && !(el.nodeType === 1 && el.tagName === 'H2')) {
          const suivant = el.nextSibling;
          section.appendChild(el);
          el = suivant;
        }
      });

      const barre = document.createElement('div');
      barre.className = 'barre-boutons pas-impression';
      barre.style.marginBottom = '6px';
      barre.innerHTML = '<button type="button" class="bouton discret" data-tout="1">Tout ouvrir</button>' +
        '<button type="button" class="bouton discret" data-tout="0">Tout fermer</button>';
      barre.addEventListener('click', function (e) {
        const b = e.target.closest('[data-tout]');
        if (!b) return;
        bloc.querySelectorAll('details.section-methode').forEach(function (d) { d.open = b.dataset.tout === '1'; });
      });
      bloc.insertBefore(barre, bloc.firstChild);
    });
  };

  /* ---------- Calculs enregistrés (« Mes chiffrages », « Mes calculs ») ----------
     options :
       cle        clé de la liste dans le navigateur (ex. 'bao.chiffrage.projets.v1')
       mot        'chiffrage' ou 'calcul' (pour les messages)
       courant()  renvoie le calcul en cours
       charger(p) remplace le calcul en cours par p (et réaffiche l'outil)
       vide()     renvoie un calcul vide
       estVide()  vrai si le calcul en cours ne contient encore rien
     La page doit avoir : #liste-projets, #nom-projet, #btn-enregistrer,
     #btn-ouvrir, #btn-nouveau, #btn-supprimer-projet. */
  BAO.calculsEnregistres = function (o) {
    const $ = function (s) { return document.querySelector(s); };
    const Mot = o.mot.charAt(0).toUpperCase() + o.mot.slice(1);
    let liste = BAO.lire(o.cle, {}) || {};

    function sauver() { BAO.ecrire(o.cle, liste); }

    function rendre() {
      const nomCourant = o.courant().nom;
      const noms = Object.keys(liste).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
      $('#liste-projets').innerHTML = noms.length
        ? noms.map(function (n) { return '<option value="' + BAO.echapper(n) + '"' + (n === nomCourant ? ' selected' : '') + '>' + BAO.echapper(n) + '</option>'; }).join('')
        : '<option value="">Aucun ' + o.mot + ' enregistré</option>';
    }

    function enregistrer() {
      const nom = (o.courant().nom || '').trim();
      if (!nom) { BAO.notifier('Donne un nom au ' + o.mot + ' avant de l\'enregistrer.'); $('#nom-projet').focus(); return; }
      if (liste[nom] && !global.confirm('Un ' + o.mot + ' « ' + nom + ' » existe déjà. Le remplacer ?')) return;
      liste[nom] = BAO.cloner(o.courant());
      sauver();
      rendre();
      BAO.notifier(Mot + ' « ' + nom + ' » enregistré.');
    }

    function ouvrir() {
      const nom = $('#liste-projets').value;
      if (!nom || !liste[nom]) return;
      o.charger(BAO.cloner(liste[nom]));
      BAO.notifier(Mot + ' « ' + nom + ' » ouvert.');
    }

    function nouveau() {
      if (!o.estVide() && !global.confirm('Commencer un nouveau ' + o.mot + ' ? (Le ' + o.mot + ' en cours n\'est gardé que s\'il a été enregistré.)')) return;
      o.charger(o.vide());
      $('#nom-projet').focus();
      $('#nom-projet').select();
    }

    function supprimer() {
      const nom = $('#liste-projets').value;
      if (!nom || !liste[nom]) return;
      if (!global.confirm('Supprimer définitivement le ' + o.mot + ' enregistré « ' + nom + ' » ?')) return;
      delete liste[nom];
      sauver();
      rendre();
      BAO.notifier(Mot + ' supprimé.');
    }

    $('#btn-enregistrer').addEventListener('click', enregistrer);
    $('#btn-ouvrir').addEventListener('click', ouvrir);
    $('#btn-nouveau').addEventListener('click', nouveau);
    $('#btn-supprimer-projet').addEventListener('click', supprimer);

    return {
      rendre: rendre,
      tous: function () { return liste; },
      remplacerTous: function (nouvelle) { liste = nouvelle || {}; sauver(); }
    };
  };

  /* ---------- « Teste-toi » : petits exercices corrigés ----------
     Un exercice = { titre, generer(hasard) } ; generer renvoie :
       { enonce (HTML), type: 'nombre', reponse, unite, tolerance, correction (texte) }
     ou { enonce, type: 'choix', choix: ['…', '…'], bonne: index, correction }.
     tolerance : écart accepté, en valeur absolue (ex. 0,5 pour « à 0,5 près »).
     La réponse est toujours calculée par le calcul.js de l'outil : l'exercice ne refait pas les formules. */

  // Tirage au hasard reproductible (même graine → mêmes exercices) : utile pour les tests.
  BAO.hasard = function (graine) {
    let a = (graine === undefined ? Math.floor(Math.random() * 4294967296) : graine) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Un nombre au hasard entre min et max, par pas de « pas » (ex. 10 à 120 m par pas de 5).
  BAO.tirer = function (hasard, min, max, pas) {
    const n = Math.floor((max - min) / pas + 1e-9) + 1;
    return Math.round((min + Math.floor(hasard() * n) * pas) * 1e6) / 1e6;
  };

  // Vrai si la réponse tapée est juste (à la tolérance près). Accepte « 19 % », « 1 250,5 »…
  BAO.verifierReponse = function (exercice, texte) {
    if (exercice.type === 'choix') return Number(texte) === exercice.bonne;
    const n = BAO.lireNombre(String(texte === undefined ? '' : texte).replace(/[^\d,.\-\s]/g, ''));
    if (!isFinite(n)) return false;
    return Math.abs(n - exercice.reponse) <= (exercice.tolerance || Math.abs(exercice.reponse) * 0.01);
  };

  BAO.testeToi = function (element, exercices) {
    if (!element || !exercices || !exercices.length) return;
    const hasard = BAO.hasard();
    const score = { justes: 0, total: 0 };
    const enCours = [];

    function carte(i) {
      const ex = exercices[i];
      const e = ex.generer(hasard);
      enCours[i] = e;
      const saisie = e.type === 'choix'
        ? '<div class="barre-boutons">' + e.choix.map(function (c, k) {
          return '<button type="button" class="bouton" data-choix="' + k + '">' + BAO.echapper(c) + '</button>';
        }).join('') + '</div>'
        : '<div class="barre-boutons"><input type="text" inputmode="decimal" class="petit-champ" data-reponse aria-label="Ta réponse" style="max-width:140px">' +
          '<span class="muet">' + BAO.echapper(e.unite || '') + '</span>' +
          '<button type="button" class="bouton principal" data-action="verifier">Vérifier</button></div>';
      return '<div class="exercice" data-index="' + i + '"><div class="exercice-titre">' + BAO.echapper(ex.titre) + '</div>' +
        '<p>' + e.enonce + '</p>' + saisie +
        '<div class="exercice-retour" aria-live="polite"></div>' +
        '<button type="button" class="bouton discret" data-action="autre">↻ Un autre</button></div>';
    }

    function rendre() {
      element.innerHTML = '<p class="aide" data-score>Les valeurs changent à chaque fois : refais-les jusqu\'à ce que ce soit automatique.</p>' +
        exercices.map(function (ex, i) { return carte(i); }).join('');
    }

    function corriger(bloc, i, reponse) {
      const e = enCours[i];
      const juste = BAO.verifierReponse(e, reponse);
      score.total++;
      if (juste) score.justes++;
      const attendu = e.type === 'choix' ? e.choix[e.bonne] : BAO.nombre(e.reponse, e.decimales || 0) + ' ' + (e.unite || '');
      bloc.querySelector('.exercice-retour').innerHTML =
        '<div class="alerte ' + (juste ? 'ok' : 'attention') + '" style="margin:8px 0">' +
        (juste ? '✅ Juste !' : '❌ Pas tout à fait : la bonne réponse est <b>' + BAO.echapper(attendu) + '</b>.') + '</div>' +
        '<div class="formule">' + BAO.echapper(e.correction) + '</div>';
      element.querySelector('[data-score]').textContent = 'Ton score : ' + score.justes + ' / ' + score.total + ' juste' + (score.justes > 1 ? 's' : '') + '.';
    }

    element.addEventListener('click', function (ev) {
      const bloc = ev.target.closest('.exercice');
      if (!bloc) return;
      const i = Number(bloc.dataset.index);
      const b = ev.target.closest('[data-action], [data-choix]');
      if (!b) return;
      if (b.dataset.action === 'autre') {
        bloc.outerHTML = carte(i);
      } else if (b.dataset.action === 'verifier') {
        corriger(bloc, i, bloc.querySelector('[data-reponse]').value);
      } else if (b.dataset.choix !== undefined) {
        corriger(bloc, i, b.dataset.choix);
      }
    });
    element.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !ev.target.matches('[data-reponse]')) return;
      const bloc = ev.target.closest('.exercice');
      corriger(bloc, Number(bloc.dataset.index), ev.target.value);
    });
    rendre();
  };

  /* ---------- Lexique (données : donnees/lexique.js) ----------
     Un bouton « Lexique » dans l'en-tête de chaque page ouvre un panneau avec recherche.
     Dans l'onglet Méthode, la 1re apparition de chaque terme d'une section devient cliquable. */
  BAO.lienLexique = function (racine) {
    const termes = (global.LEXIQUE && global.LEXIQUE.termes) || [];
    if (!termes.length || !racine) return 0;
    let liens = 0;
    const motifs = [];
    termes.forEach(function (t) {
      (t.motifs || []).forEach(function (m) { motifs.push({ id: t.id, motif: m }); });
    });
    // Les motifs les plus longs d'abord (« énergie finale » avant « énergie »).
    motifs.sort(function (a, b) { return b.motif.length - a.motif.length; });
    const echapperRegex = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

    const sections = racine.querySelectorAll('.section-methode');
    (sections.length ? Array.from(sections) : [racine]).forEach(function (section) {
      const dejaLies = {};
      motifs.forEach(function (m) {
        if (dejaLies[m.id]) return;
        const re = new RegExp('(?<![\\p{L}\\p{N}])' + echapperRegex(m.motif) + '(?![\\p{L}\\p{N}])', 'u');
        const marcheur = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            return n.parentElement.closest('.formule, .chaine, .exercice, code, a, button, summary, h2, h3, .terme, table, svg')
              ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
        });
        let noeud;
        while ((noeud = marcheur.nextNode())) {
          const r = re.exec(noeud.nodeValue);
          if (!r) continue;
          const apres = noeud.splitText(r.index);
          apres.splitText(r[0].length);
          const bouton = document.createElement('button');
          bouton.type = 'button';
          bouton.className = 'terme';
          bouton.dataset.terme = m.id;
          bouton.textContent = apres.nodeValue;
          apres.parentNode.replaceChild(bouton, apres);
          dejaLies[m.id] = true;
          liens++;
          break;
        }
      });
    });
    return liens;
  };

  BAO.initLexique = function () {
    const termes = (global.LEXIQUE && global.LEXIQUE.termes) || [];
    const entete = document.querySelector('.entete-interieur');
    if (!termes.length || !entete || document.querySelector('.lexique-panneau')) return;

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton discret bouton-lexique';
    bouton.textContent = 'Lexique';
    const version = entete.querySelector('.version');
    entete.insertBefore(bouton, version || null);
    if (!version) bouton.style.marginLeft = 'auto';

    const panneau = document.createElement('aside');
    panneau.className = 'lexique-panneau';
    panneau.hidden = true;
    panneau.setAttribute('aria-label', 'Lexique');
    const tries = termes.slice().sort(function (a, b) { return a.terme.localeCompare(b.terme, 'fr'); });
    panneau.innerHTML = '<div class="lexique-tete"><h2>Lexique</h2>' +
      '<button type="button" class="bouton discret" data-action="fermer" aria-label="Fermer le lexique">✕</button></div>' +
      '<input type="search" placeholder="Chercher un mot (ψ, DJU, fRsi…)" aria-label="Chercher dans le lexique">' +
      '<dl>' + tries.map(function (t) {
        return '<div class="lexique-terme" data-id="' + BAO.echapper(t.id) + '" data-texte="' + BAO.echapper((t.terme + ' ' + t.definition).toLowerCase()) + '">' +
          '<dt>' + BAO.echapper(t.terme) + (t.unite ? ' <span class="muet">(' + BAO.echapper(t.unite) + ')</span>' : '') + '</dt>' +
          '<dd>' + BAO.echapper(t.definition) + (t.source ? '<br><span class="aide">Source : ' + BAO.echapper(t.source) + '</span>' : '') + '</dd></div>';
      }).join('') + '</dl>';
    document.body.appendChild(panneau);

    function ouvrir(id) {
      panneau.hidden = false;
      const champ = panneau.querySelector('input');
      panneau.querySelectorAll('.lexique-terme').forEach(function (el) {
        el.hidden = false;
        el.classList.toggle('vise', el.dataset.id === id);
      });
      champ.value = '';
      const vise = id && panneau.querySelector('.lexique-terme[data-id="' + CSS.escape(id) + '"]');
      if (vise) vise.scrollIntoView({ block: 'center' });
      else champ.focus();
    }
    bouton.addEventListener('click', function () { if (panneau.hidden) ouvrir(null); else panneau.hidden = true; });
    panneau.addEventListener('click', function (e) { if (e.target.closest('[data-action="fermer"]')) panneau.hidden = true; });
    panneau.querySelector('input').addEventListener('input', function (e) {
      const q = e.target.value.trim().toLowerCase();
      panneau.querySelectorAll('.lexique-terme').forEach(function (el) { el.hidden = q && el.dataset.texte.indexOf(q) === -1; });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panneau.hidden = true; });
    document.addEventListener('click', function (e) {
      const t = e.target.closest('.terme[data-terme]');
      if (t) ouvrir(t.dataset.terme);
    });

    document.querySelectorAll('.methode').forEach(function (bloc) { BAO.lienLexique(bloc); });
  };

  /* ---------- Démarrage commun à toutes les pages ---------- */
  if (typeof document !== 'undefined') {
    const demarrer = function () { BAO.afficherRappelSauvegarde(); BAO.initLexique(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();
    if (global.addEventListener) {
      // À l'impression, toutes les sections de la Méthode sont ouvertes.
      global.addEventListener('beforeprint', function () {
        document.querySelectorAll('details.section-methode').forEach(function (d) { d.open = true; });
      });
    }
  }

  global.BAO = BAO;
  if (typeof module !== 'undefined' && module.exports) module.exports = BAO;
})(typeof window !== 'undefined' ? window : globalThis);
