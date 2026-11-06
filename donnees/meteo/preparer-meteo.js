/* ==========================================================
   Prépare les fichiers météo du site à partir des téléchargements PVGIS.
   (Outil de préparation, lancé à la main : le site, lui, n'a besoin d'aucun réseau.)

   1. Télécharger l'année type (TMY) de chaque ville, par exemple :
        curl -o tmy-toulouse.json "https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat=43.604&lon=1.444&outputformat=json"
   2. Lancer : node donnees/meteo/preparer-meteo.js <dossier des tmy-*.json>
   Chaque ville devient donnees/meteo/<ville>.js (8 760 heures).
   ========================================================== */
const fs = require('fs');
const path = require('path');

globalThis.window = globalThis;
const VILLES = require('../confort-meteo.js').villes;
const dossier = process.argv[2];
if (!dossier) { console.error('Usage : node preparer-meteo.js <dossier>'); process.exit(1); }

VILLES.forEach(function (v) {
  const brut = JSON.parse(fs.readFileSync(path.join(dossier, 'tmy-' + v.id + '.json'), 'utf8'));
  const h = brut.outputs.tmy_hourly;
  if (h.length !== 8760) throw new Error(v.id + ' : ' + h.length + ' heures au lieu de 8 760');
  const col = function (cle, dec) { return h.map(function (x) { return Number(x[cle].toFixed(dec)); }); };
  const donnees = {
    id: v.id,
    decalage: brut.inputs.location.irradiance_time_offset,
    altitude: brut.inputs.location.elevation,
    moisRetenus: brut.outputs.months_selected.map(function (m) { return m.year; }),
    base: brut.inputs.meteo_data.radiation_db + ' + ' + brut.inputs.meteo_data.meteo_db + ' (' + brut.inputs.meteo_data.year_min + '–' + brut.inputs.meteo_data.year_max + ')',
    T: col('T2m', 1), HR: col('RH', 0), Gbn: col('Gb(n)', 0), Gdh: col('Gd(h)', 0), V: col('WS10m', 1)
  };
  const texte = '/* Météo horaire, année type (TMY) — ' + v.nom + ' (' + v.lat + ', ' + v.lon + ').\n' +
    '   Source : PVGIS 5.3, Commission européenne (JRC), ' + donnees.base + '.\n' +
    '   Heures en UTC ; rayonnement mesuré à heure + ' + donnees.decalage + ' h. Fichier généré par preparer-meteo.js. */\n' +
    '(window.CONFORT_METEO = window.CONFORT_METEO || {})[' + JSON.stringify(v.id) + '] = ' + JSON.stringify(donnees) + ';\n' +
    'if (typeof module !== \'undefined\' && module.exports) module.exports = window.CONFORT_METEO[' + JSON.stringify(v.id) + '];\n';
  fs.writeFileSync(path.join(__dirname, v.id + '.js'), texte);
  console.log(v.id, (texte.length / 1024).toFixed(0) + ' ko', 'Tmax', Math.max.apply(null, donnees.T));
});
