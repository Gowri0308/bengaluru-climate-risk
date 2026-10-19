// Risk Map: WMS hazard layers, overlays, and a click popup built from WFS + GetFeatureInfo.

const map = makeMap('map');
fitToCity(map);

const HAZARDS = [
  { id: 'flood_class', label: 'Flood classes (Low / Medium / High)' },
  { id: 'flood_risk', label: 'Flood risk index (1–5)' },
  { id: 'heat_class', label: 'Heat classes (Low / Medium / High)' },
  { id: 'heat_risk', label: 'Heat index (0–1)' },
  { id: 'ward_flood_summary', label: 'Wards: share in High flood risk' },
  { id: null, label: 'None' },
];
const OVERLAYS = [
  { id: 'lakes', label: 'Lakes', on: true },
  { id: 'drains', label: 'Drains and streams', on: false },
  { id: 'bbmp_boundary', label: 'City boundary', on: true },
  { id: 'flood_2022_reports', label: 'Reported floods, Sept 2022', on: false },
  { id: 'properties', label: 'Saved portfolio properties', on: false },
];

let hazardLayer = null;
const legend = document.getElementById('legend');

function setHazard(id) {
  if (hazardLayer) map.removeLayer(hazardLayer);
  hazardLayer = id ? wms(id, { opacity: 0.85 }).addTo(map) : null;
  if (hazardLayer) hazardLayer.bringToBack();
  legend.innerHTML = id ? `<img src="${OGC.legendUrl(id)}" alt="Legend for ${id}">` : '<span class="hint">No hazard layer shown.</span>';
}

const hazardsBox = document.getElementById('hazards');
HAZARDS.forEach((h, i) => {
  const row = document.createElement('label');
  row.className = 'choice';
  row.innerHTML = `<input type="radio" name="hazard" ${i === 0 ? 'checked' : ''}> ${h.label}`;
  row.querySelector('input').addEventListener('change', () => setHazard(h.id));
  hazardsBox.appendChild(row);
});
setHazard(HAZARDS[0].id);

const overlaysBox = document.getElementById('overlays');
OVERLAYS.forEach((o) => {
  const layer = wms(o.id);
  if (o.on) layer.addTo(map);
  const row = document.createElement('label');
  row.className = 'choice';
  row.innerHTML = `<input type="checkbox" ${o.on ? 'checked' : ''}> ${o.label}`;
  row.querySelector('input').addEventListener('change', (e) => (e.target.checked ? layer.addTo(map) : map.removeLayer(layer)));
  overlaysBox.appendChild(row);
});

const baseBox = document.getElementById('basemaps');
let currentBase = BASEMAPS['Light grey'];
Object.entries(BASEMAPS).forEach(([name, layer], i) => {
  const row = document.createElement('label');
  row.className = 'choice';
  row.innerHTML = `<input type="radio" name="base" ${i === 0 ? 'checked' : ''}> ${name}`;
  row.querySelector('input').addEventListener('change', () => {
    map.removeLayer(currentBase); currentBase = layer.addTo(map); layer.bringToBack();
  });
  baseBox.appendChild(row);
});

// Click: flood and heat zone (WFS, XML filter with a GML point) + factor values (WMS GetFeatureInfo).
const lvl = (c) => (c ? `<span class="pill" style="--c:${RISK_COLORS[OGC.LEVELS[c]]}">${OGC.LEVELS[c]}</span>` : '–');
const num = (v, digits, unit = '') => (v === undefined || v === null || v <= -9999 ? '–' : `${Number(v).toFixed(digits)}${unit}`);

map.on('click', async (e) => {
  const { lat, lng } = e.latlng;
  const popup = L.popup().setLatLng(e.latlng).setContent('Asking GeoServer…').openOn(map);
  try {
    const [zones, factors, heatVals] = await Promise.all([
      OGC.zonesAt(lng, lat),
      OGC.rasterValuesAt('flood_factor_values', lng, lat),
      OGC.rasterValuesAt('heat_values', lng, lat),
    ]);
    if (zones.flood === null && zones.heat === null) {
      popup.setContent('<div class="popup"><h4>Outside the scored area</h4>This point is outside the city or on a lake.</div>');
      return;
    }
    const s = OGC.score(zones.flood, zones.heat);
    // Read band values by position: GeoServer names them Band1..BandN, or RED/GREEN/BLUE_BAND for 3-band files.
    const fv = factors ? Object.values(factors) : [];
    const hv = heatVals ? Object.values(heatVals) : [];
    const f = { Band1: fv[0], Band2: fv[1], Band3: fv[2], Band4: fv[3], Band5: fv[4], Band6: fv[5] };
    const h = { Band1: hv[0], Band2: hv[1] };
    popup.setContent(`<div class="popup">
      <h4>${lat.toFixed(5)}, ${lng.toFixed(5)}</h4>
      <table>
        <tr><td>Flood class</td><td>${lvl(zones.flood)}</td></tr>
        <tr><td>Heat class</td><td>${lvl(zones.heat)}</td></tr>
        <tr><td>Property risk</td><td><span class="pill" style="--c:${RISK_COLORS[s.level]}">${s.level}</span>${s.score !== null ? ` (score ${s.score})` : ''}</td></tr>
        <tr><td colspan="2" style="color:#57606a;padding-top:8px">Why: flood factors</td></tr>
        <tr><td>Height above drainage</td><td>${num(f.Band1, 1, ' m')}</td></tr>
        <tr><td>Slope</td><td>${num(f.Band2, 1, '°')}</td></tr>
        <tr><td>Nearest lake</td><td>${num(f.Band3, 0, ' m')}</td></tr>
        <tr><td>Nearest drain</td><td>${num(f.Band4, 0, ' m')}</td></tr>
        <tr><td>Wetness index</td><td>${num(f.Band5, 1)}</td></tr>
        <tr><td>Built-up share</td><td>${f.Band6 > -9999 ? `${Math.round(f.Band6 * 100)}%` : '–'}</td></tr>
        <tr><td colspan="2" style="color:#57606a;padding-top:8px">Heat</td></tr>
        <tr><td>Summer surface temp.</td><td>${num(h.Band1, 1, ' °C')}</td></tr>
        <tr><td>Vegetation (NDVI)</td><td>${num(h.Band2, 2)}</td></tr>
      </table></div>`);
  } catch (err) {
    popup.setContent(`<div class="popup"><h4>GeoServer did not answer</h4>${OGC.esc(err.message)}</div>`);
  }
});
