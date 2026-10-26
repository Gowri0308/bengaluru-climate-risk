// Bengaluru Climate Risk Scanner (mini): one map, four views, every layer and query served by GeoServer.

const CFG = { gateway: 'api/gs.php', ws: 'climaterisk', ns: 'http://climaterisk' };
const VALIDATION = { auc: 0.81, fr: { Low: 0.01, Medium: 2.48, High: 1.43 }, patches: 6, hits: 6, landPct: 45, km2: 0.49 };
const LEVELS = { 1: 'Low', 2: 'Medium', 3: 'High' };
const COLORS = { Low: '#1a9850', Medium: '#f39c12', High: '#d7301f', Unscored: '#8c959f' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const crore = (r) => `₹${(r / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`;
const pct = (x) => `${(x || 0).toFixed(1)}%`;
const pill = (level) => `<span class="pill" style="--c:${COLORS[level]}">${level}</span>`;
const status = (view, text, kind = 'info') => Object.assign($(`status-${view}`), { textContent: text, className: `status status-${kind}`, hidden: !text });

// ---------------------------------------------------------------- OGC requests (WMS, WFS, GML, WFS-T)
const WMS = `${CFG.gateway}/${CFG.ws}/wms`;
const WFS = `${CFG.gateway}/${CFG.ws}/wfs`;
const NS = `xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" xmlns:${CFG.ws}="${CFG.ns}"`;

// A GML point. With WFS 1.1.0 and EPSG:4326, GeoServer reads "longitude latitude".
const gmlPoint = (lon, lat) => `<gml:Point srsName="EPSG:4326"><gml:pos>${lon} ${lat}</gml:pos></gml:Point>`;
const equals = (prop, value) => `<ogc:PropertyIsEqualTo><ogc:PropertyName>${prop}</ogc:PropertyName><ogc:Literal>${esc(value)}</ogc:Literal></ogc:PropertyIsEqualTo>`;

async function postXml(xml) {
  const res = await fetch(WFS, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
  const text = await res.text();
  const err = text.match(/ExceptionText>([\s\S]*?)</);
  if (!res.ok || err) throw new Error(err ? err[1] : `HTTP ${res.status}`);
  return text;
}

// WFS GetFeature: one or more queries in a single XML request, answered as GeoJSON.
const query = (type, filter = '', props = []) => `<wfs:Query typeName="${CFG.ws}:${type}" srsName="EPSG:4326">${
  props.map((p) => `<ogc:PropertyName>${p}</ogc:PropertyName>`).join('')}${filter ? `<ogc:Filter>${filter}</ogc:Filter>` : ''}</wfs:Query>`;
const getFeature = async (...queries) => JSON.parse(await postXml(
  `<wfs:GetFeature service="WFS" version="1.1.0" outputFormat="application/json" ${NS}>${queries.join('')}</wfs:GetFeature>`));

// Flood and heat zone at a point: two queries, each an ogc:Intersects filter with a GML point.
async function zonesAt(lon, lat) {
  const hit = `<ogc:Intersects><ogc:PropertyName>geom</ogc:PropertyName>${gmlPoint(lon, lat)}</ogc:Intersects>`;
  const gj = await getFeature(query('flood_zones', hit, ['risk_class']), query('heat_zones', hit, ['risk_class']));
  const z = { flood: null, heat: null };
  for (const f of gj.features) {                    // on a zone edge keep the higher class (cautious)
    const k = String(f.id).startsWith('flood') ? 'flood' : 'heat';
    z[k] = Math.max(z[k] || 0, f.properties.risk_class);
  }
  return z;
}

// Property score = 0.6 x flood class + 0.4 x heat class; a High flood zone is always High.
function score(flood, heat) {
  if (!flood || !heat) return { score: null, level: 'Unscored' };
  const s = Math.round((0.6 * flood + 0.4 * heat) * 100) / 100;
  return { score: s, level: flood === 3 || s >= 2.4 ? 'High' : s >= 1.6 ? 'Medium' : 'Low' };
}

// WFS-T: a Transaction of GML features. The PHP gateway adds the GeoServer login on the server.
async function transaction(actions, counter) {
  const text = await postXml(`<wfs:Transaction service="WFS" version="1.1.0" ${NS}>${actions}</wfs:Transaction>`);
  return Number((text.match(new RegExp(`${counter}>(\\d+)<`)) || [0, 0])[1]);
}
const insertXml = (rows, id) => `<wfs:Insert>${rows.map((r) => `<${CFG.ws}:properties>
  <${CFG.ws}:geom>${gmlPoint(r.longitude, r.latitude)}</${CFG.ws}:geom>
  <${CFG.ws}:portfolio_id>${id}</${CFG.ws}:portfolio_id><${CFG.ws}:property_id>${esc(r.property_id)}</${CFG.ws}:property_id>
  <${CFG.ws}:loan_value>${r.loan_value}</${CFG.ws}:loan_value><${CFG.ws}:flood_class>${r.flood}</${CFG.ws}:flood_class>
  <${CFG.ws}:heat_class>${r.heat}</${CFG.ws}:heat_class><${CFG.ws}:risk_score>${r.score}</${CFG.ws}:risk_score>
  <${CFG.ws}:risk_level>${r.level}</${CFG.ws}:risk_level></${CFG.ws}:properties>`).join('')}</wfs:Insert>`;
const deleteXml = (id) => `<wfs:Delete typeName="${CFG.ws}:properties"><ogc:Filter>${equals('portfolio_id', id)}</ogc:Filter></wfs:Delete>`;

// WMS GetFeatureInfo: raster values (band order) at a point.
async function valuesAt(layer, lon, lat) {
  const d = 0.0005;
  const p = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', SRS: 'EPSG:4326',
    LAYERS: `${CFG.ws}:${layer}`, QUERY_LAYERS: `${CFG.ws}:${layer}`, STYLES: '', BBOX: [lon - d, lat - d, lon + d, lat + d].join(','),
    WIDTH: 101, HEIGHT: 101, X: 50, Y: 50, INFO_FORMAT: 'application/json' });
  const gj = await (await fetch(`${WMS}?${p}`)).json();
  return gj.features && gj.features.length ? Object.values(gj.features[0].properties) : [];
}
const legend = (layer) => `<img alt="${layer} legend" src="${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png` +
  `&LAYER=${CFG.ws}:${layer}&LEGEND_OPTIONS=fontName:Arial;fontSize:11;fontAntiAliasing:true;forceLabels:on">`;

// ---------------------------------------------------------------- The map and its layers per view
const map = L.map('map', { preferCanvas: true }).setView([12.97, 77.59], 11);
const esri = (name, attribution) => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18, attribution });
const basemaps = { 'Light grey': esri('Canvas/World_Light_Gray_Base', 'Basemap © Esri').addTo(map), Satellite: esri('World_Imagery', 'Imagery © Esri') };
L.control.layers(basemaps, null, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
getFeature(query('bbmp_boundary')).then((gj) => map.fitBounds(L.geoJSON(gj).getBounds())).catch(() => {});

const wmsCache = {};
const wms = (name) => (wmsCache[name] = wmsCache[name] || L.tileLayer.wms(WMS, { layers: `${CFG.ws}:${name}`, format: 'image/png',
  transparent: true, tiled: true, maxZoom: 19, opacity: /_(class|risk)$/.test(name) ? 0.8 : 1 }));
const markers = { portfolio: L.layerGroup(), dashboard: L.layerGroup() };
const checked = (name) => [...document.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value);
let view = 'map';

const LAYERS = {   // which GeoServer layers each view shows, bottom to top
  map: () => [...checked('hazard'), ...checked('overlay')],
  portfolio: () => ['lakes', 'bbmp_boundary'],
  dashboard: () => ['flood_class', 'bbmp_boundary'],
  validation: () => (checked('valmode')[0] === 'hits'
    ? ['validation_result', 'lakes', 'bbmp_boundary']
    : ['flood_class', 'flood_2022_observed', 'lakes', 'bbmp_boundary', 'flood_2022_reports']),
};

function draw() {
  const want = LAYERS[view]();
  Object.entries(wmsCache).forEach(([name, layer]) => !want.includes(name) && map.removeLayer(layer));
  want.forEach((name) => wms(name).addTo(map).bringToFront());
  Object.entries(markers).forEach(([v, group]) => (v === view ? group.addTo(map) : map.removeLayer(group)));
  $('legend-map').innerHTML = legend(checked('hazard')[0]);
  $('legend-validation').innerHTML = (checked('valmode')[0] === 'hits' ? ['validation_result']
    : ['flood_class', 'flood_2022_observed', 'flood_2022_reports']).map(legend).join('');
}

function show(next) {
  view = next;
  map.closePopup();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === next));
  document.querySelectorAll('.sidebar section').forEach((s) => { s.hidden = s.id !== `view-${next}`; });
  if (next === 'dashboard') listPortfolios();
  draw();
}
document.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => show(a.dataset.view)));
document.querySelectorAll('input[name=hazard], input[name=overlay], input[name=valmode]').forEach((i) => i.addEventListener('change', draw));

// ---------------------------------------------------------------- Risk map: click for the "why"
const fmt = (v, digits, unit = '') => (v == null || !isFinite(v) || v <= -9999 ? '–' : `${Number(v).toFixed(digits)}${unit}`);
map.on('click', async (e) => {
  if (view !== 'map') return;
  const { lat, lng } = e.latlng;
  const popup = L.popup().setLatLng(e.latlng).setContent('Asking GeoServer…').openOn(map);
  try {
    const [z, f, h] = await Promise.all([zonesAt(lng, lat), valuesAt('flood_factor_values', lng, lat), valuesAt('heat_values', lng, lat)]);
    if (!z.flood && !z.heat) return popup.setContent('<div class="popup"><h4>Outside the scored area</h4>Outside the city or on a lake.</div>');
    const s = score(z.flood, z.heat);
    const rows = [['Flood class', z.flood ? pill(LEVELS[z.flood]) : '–'], ['Heat class', z.heat ? pill(LEVELS[z.heat]) : '–'],
      ['Property risk', `${pill(s.level)}${s.score ? ` (${s.score})` : ''}`], ['Why: flood factors'],
      ['Height above drainage', fmt(f[0], 1, ' m')], ['Slope', fmt(f[1], 1, '°')], ['Nearest lake', fmt(f[2], 0, ' m')],
      ['Nearest drain', fmt(f[3], 0, ' m')], ['Wetness index', fmt(f[4], 1)], ['Built-up share', fmt(f[5] * 100, 0, '%')],
      ['Heat'], ['Summer surface temp.', fmt(h[0], 1, ' °C')], ['Vegetation (NDVI)', fmt(h[1], 2)]];
    popup.setContent(`<div class="popup"><h4>${lat.toFixed(5)}, ${lng.toFixed(5)}</h4><table>${rows.map(([a, b]) =>
      (b === undefined ? `<tr class="sep"><td colspan="2">${a}</td></tr>` : `<tr><td>${a}</td><td>${b}</td></tr>`)).join('')}</table></div>`);
  } catch (err) {
    popup.setContent(`<div class="popup"><h4>GeoServer did not answer</h4>${esc(err.message)}</div>`);
  }
});

// ---------------------------------------------------------------- Portfolio: CSV -> WFS scoring -> WFS-T save
let rows = [];
const dot = (r) => L.circleMarker([r.latitude, r.longitude], { radius: 5, color: '#fff', weight: 1, fillColor: COLORS[r.level], fillOpacity: 0.95 })
  .bindPopup(`<b>${esc(r.property_id)}</b><br>${crore(r.loan_value)} · ${r.level}${r.score ? ` (${r.score})` : ''}`);

function readCsv(text) {
  const data = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() }).data;
  const seen = new Set();
  rows = data.map((r) => ({ property_id: String(r.property_id || '').trim(), latitude: +r.latitude, longitude: +r.longitude, loan_value: +r.loan_value }))
    .filter((r) => r.property_id && !seen.has(r.property_id) && seen.add(r.property_id) &&
      [r.latitude, r.longitude, r.loan_value].every(Number.isFinite) && Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180);
  if (!rows.length) return status('portfolio', 'No valid rows. Columns needed: property_id, latitude, longitude, loan_value.', 'error');
  status('portfolio', `${rows.length} properties read (${data.length - rows.length} skipped).`, 'ok');
  scoreAll();
}

async function scoreAll() {
  $('save').disabled = true; $('to-dash').hidden = true;
  markers.portfolio.clearLayers();
  const t0 = performance.now();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < rows.length) {
      const r = rows[next++];
      try { Object.assign(r, await zonesAt(r.longitude, r.latitude)); } catch { Object.assign(r, { flood: null, heat: null }); }
      Object.assign(r, score(r.flood, r.heat));
      dot(r).addTo(markers.portfolio);
      $('bar').style.width = `${(100 * ++done) / rows.length}%`;
      $('progress').textContent = `${done} of ${rows.length} properties scored`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));          // 6 WFS requests at a time
  $('progress').textContent = `${rows.length} properties scored in ${((performance.now() - t0) / 1000).toFixed(1)} s with WFS.`;
  map.fitBounds(L.featureGroup(markers.portfolio.getLayers()).getBounds(), { padding: [20, 20] });
  const total = rows.reduce((s, r) => s + r.loan_value, 0);
  $('summary').innerHTML = `<table><tr><th>Risk</th><th class="num">Properties</th><th class="num">Loan share</th></tr>${
    ['High', 'Medium', 'Low', 'Unscored'].map((l) => { const g = rows.filter((r) => r.level === l); return g.length
      ? `<tr><td>${pill(l)}</td><td class="num">${g.length}</td><td class="num">${pct((100 * g.reduce((s, r) => s + r.loan_value, 0)) / total)}</td></tr>` : ''; }).join('')
  }</table><p class="hint">Unscored = outside the city or on a lake; not saved.</p>`;
  $('save').disabled = !rows.some((r) => r.score);
}

$('file').addEventListener('change', (e) => e.target.files[0] && e.target.files[0].text().then(readCsv));
['dragover', 'dragleave', 'drop'].forEach((ev) => $('dropzone').addEventListener(ev, (e) => {
  e.preventDefault();
  $('dropzone').classList.toggle('drag', ev === 'dragover');
  if (ev === 'drop' && e.dataTransfer.files[0]) e.dataTransfer.files[0].text().then(readCsv);
}));
$('sample').addEventListener('click', async () => {
  const res = await fetch('sample_portfolio.csv');
  res.ok ? readCsv(await res.text()) : status('portfolio', 'sample_portfolio.csv not found next to index.html.', 'error');
});

$('save').addEventListener('click', async () => {
  const toSave = rows.filter((r) => r.score);
  const id = Math.floor(Date.now() / 1000);                       // portfolio id = seconds since 1970
  $('save').disabled = true;
  try {
    let n = 0;
    for (let i = 0; i < toSave.length; i += 100) n += await transaction(insertXml(toSave.slice(i, i + 100), id), 'totalInserted');
    status('portfolio', `Saved ${n} properties to GeoServer as GML (WFS-T).`, 'ok');
    $('to-dash').hidden = false;
  } catch (err) {
    status('portfolio', `Saving failed: ${err.message}`, 'error');
    $('save').disabled = false;
  }
});
$('to-dash').addEventListener('click', () => show('dashboard'));

// ---------------------------------------------------------------- Dashboard: read the saved portfolio back with WFS
let charts = [];
const label = (id, n) => `${new Date(id * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} (${n})`;

async function listPortfolios() {
  try {
    const gj = await getFeature(query('properties', '', ['portfolio_id']));
    const counts = {};
    gj.features.forEach((f) => { counts[f.properties.portfolio_id] = (counts[f.properties.portfolio_id] || 0) + 1; });
    const ids = Object.keys(counts).sort((a, b) => b - a);
    $('portfolios').innerHTML = ids.length ? ids.map((id) => `<option value="${id}">${label(id, counts[id])}</option>`).join('') : '<option>No saved portfolios</option>';
    $('delete').disabled = !ids.length;
    if (ids.length) return loadPortfolio(ids[0]);
    charts.forEach((c) => c.destroy()); markers.dashboard.clearLayers();
    $('kpis').innerHTML = $('top').innerHTML = '';
    status('dashboard', 'Nothing saved yet: score and save a portfolio first.');
  } catch (err) { status('dashboard', `Could not read from GeoServer: ${err.message}`, 'error'); }
}

async function loadPortfolio(id) {
  const props = (await getFeature(query('properties', equals('portfolio_id', id)))).features
    .map((f) => ({ ...f.properties, latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0], level: f.properties.risk_level, score: f.properties.risk_score }));
  status('dashboard', '');
  const sum = (test) => props.filter(test).reduce((s, p) => s + p.loan_value, 0);
  const total = sum(() => true);
  const high = sum((p) => p.level === 'High');
  $('kpis').innerHTML = [
    ['headline', 'Loan value in High-risk locations', pct((100 * high) / total),
      `${crore(high)} of ${crore(total)} · ${props.filter((p) => p.level === 'High').length} of ${props.length} properties`],
    ['', 'In High flood zones', pct((100 * sum((p) => p.flood_class === 3)) / total), 'of loan value'],
    ['', 'In High heat zones', pct((100 * sum((p) => p.heat_class === 3)) / total), 'of loan value'],
  ].map(([c, l, v, s]) => `<div class="kpi ${c}"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');

  const lv = ['Low', 'Medium', 'High'], cr = (v) => Math.round(v / 1e5) / 100;
  charts.forEach((c) => c.destroy());
  charts = [
    new Chart($('donut'), { type: 'doughnut', data: { labels: lv, datasets: [{ data: lv.map((l) => cr(sum((p) => p.level === l))), backgroundColor: lv.map((l) => COLORS[l]) }] },
      options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right' } } } }),
    new Chart($('bars'), { type: 'bar', data: { labels: lv, datasets: [
      { label: 'Flood class', data: [1, 2, 3].map((c) => cr(sum((p) => p.flood_class === c))), backgroundColor: '#2b7bb3', borderRadius: 4 },
      { label: 'Heat class', data: [1, 2, 3].map((c) => cr(sum((p) => p.heat_class === c))), backgroundColor: '#e2412b', borderRadius: 4 }] },
    options: { maintainAspectRatio: false, scales: { y: { title: { display: true, text: '₹ crore' } } } } }),
  ];

  const top = props.filter((p) => p.level === 'High').sort((a, b) => b.loan_value - a.loan_value).slice(0, 5);
  $('top').innerHTML = top.length ? `<table><tr><th>Property</th><th class="num">Loan</th><th>Flood</th><th>Heat</th></tr>${top.map((p) =>
    `<tr><td>${esc(p.property_id)}</td><td class="num">${crore(p.loan_value)}</td><td>${LEVELS[p.flood_class]}</td><td>${LEVELS[p.heat_class]}</td></tr>`).join('')}</table>`
    : 'No High-risk properties in this portfolio.';

  markers.dashboard.clearLayers();
  props.forEach((p) => dot(p).addTo(markers.dashboard));
  if (props.length) map.fitBounds(L.featureGroup(markers.dashboard.getLayers()).getBounds(), { padding: [20, 20] });
}

$('portfolios').addEventListener('change', (e) => loadPortfolio(e.target.value));
$('delete').addEventListener('click', async () => {
  if (!confirm('Delete this portfolio from GeoServer?')) return;
  try {
    const n = await transaction(deleteXml($('portfolios').value), 'totalDeleted');
    await listPortfolios();
    status('dashboard', `Deleted ${n} properties (WFS-T Delete).`, 'ok');
  } catch (err) { status('dashboard', `Delete failed: ${err.message}`, 'error'); }
});

// ---------------------------------------------------------------- Validation: the September 2022 flood
const V = VALIDATION;
$('val-kpis').innerHTML = [
  ['AUC', V.auc.toFixed(2), '0.5 random, 1 perfect'],
  ['Flood patches caught', `${V.hits} of ${V.patches}`, `in Medium/High zones (${V.landPct}% of city)`],
  ['Frequency ratio, High / Medium', `${V.fr.High} / ${V.fr.Medium}`, 'times more flooding than chance'],
  ['Frequency ratio, Low', V.fr.Low, 'almost no flooding'],
].map(([l, v, s]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');
$('val-notes').textContent = `Sentinel-1 radar on 5 September 2022 saw about ${V.km2} km² of open floodwater (water between buildings is hidden by ` +
  `radar double-bounce). All ${V.hits} flood patches fell in zones covering ${V.landPct}% of the city; by chance that happens ` +
  `${(100 * V.landPct ** V.patches / 100 ** V.patches).toFixed(1)}% of the time.`;

show('map');
