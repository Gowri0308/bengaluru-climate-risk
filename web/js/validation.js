// Validation: two linked maps (prediction + observation, and hit/miss/false alarm) and the key numbers.

const V = VALIDATION;
const cards = [
  ['AUC', V.auc.toFixed(2), '0.5 = random, 1 = perfect'],
  ['Frequency ratio, High / Medium', `${V.frequencyRatio.High} / ${V.frequencyRatio.Medium}`, 'times more flooding than chance'],
  ['Frequency ratio, Low', V.frequencyRatio.Low, 'observed flooding almost absent'],
  ['Flood patches in Medium/High', `${V.patchesInMediumHigh} of ${V.patches}`, `these zones cover ${V.landShareMediumHighPct}% of the city`],
];
if (V.reportPoints) cards.push(['Reported floods in Medium/High', `${V.reportPoints.inMediumHighPct}%`, `${V.reportPoints.verified} verified locations`]);
document.getElementById('numbers').innerHTML = cards.map(([l, v, s]) =>
  `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');

const chance = (100 * Math.pow(V.landShareMediumHighPct / 100, V.patches)).toFixed(1);
document.getElementById('notes').innerHTML =
  `Sentinel-1 imaged Bengaluru at the flood peak (${V.radarDate}) but detected only about ${V.observedKm2} km² of open water: ` +
  `street flooding between buildings brightens radar (double bounce) instead of darkening it. All ${V.patchesInMediumHigh} main flood ` +
  `patches fell in Medium or High zones, which cover ${V.landShareMediumHighPct}% of the city; by chance that would happen about ` +
  `${chance}% of the time. News-reported flood locations give a second, independent check.`;

const left = makeMap('map-left');
const right = makeMap('map-right');
wms('flood_class', { opacity: 0.8 }).addTo(left);
wms('flood_2022_observed').addTo(left);
wms('flood_2022_reports').addTo(left);
wms('validation_result').addTo(right);
[left, right].forEach((m) => { wms('lakes').addTo(m); wms('bbmp_boundary').addTo(m); });

// Keep the two maps on the same view.
let syncing = false;
const sync = (from, to) => from.on('moveend', () => {
  if (syncing) return;
  syncing = true; to.setView(from.getCenter(), from.getZoom(), { animate: false }); syncing = false;
});
sync(left, right); sync(right, left);
fitToCity(left);

document.getElementById('legend-left').innerHTML =
  ['flood_class', 'flood_2022_observed', 'flood_2022_reports'].map((l) => `<img src="${OGC.legendUrl(l)}" alt="${l} legend">`).join('');
document.getElementById('legend-right').innerHTML = `<img src="${OGC.legendUrl('validation_result')}" alt="validation legend">`;
