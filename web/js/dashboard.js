// Dashboard: read a saved portfolio back from GeoServer (WFS) and summarise its exposure.

const el = (id) => document.getElementById(id);
const statusBox = el('status');
const map = makeMap('map', { zoomControl: true });
wms('flood_class', { opacity: 0.55 }).addTo(map);
wms('bbmp_boundary').addTo(map);
let propsLayer = null, charts = [], current = [];

const names = (() => { try { return JSON.parse(localStorage.getItem('portfolioNames') || '{}'); } catch { return {}; } })();
const label = (id, n) => `${names[id] ? names[id] + ' · ' : ''}${new Date(id * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} (${n} properties)`;

async function listPortfolios() {
  const sel = el('portfolio');
  try {
    const gj = await OGC.getFeatures('properties', '', ['portfolio_id']);
    const counts = {};
    gj.features.forEach((f) => { const id = f.properties.portfolio_id; counts[id] = (counts[id] || 0) + 1; });
    const ids = Object.keys(counts).map(Number).sort((a, b) => b - a);
    if (!ids.length) {
      sel.innerHTML = '<option>No saved portfolios</option>';
      setStatus(statusBox, 'No portfolios saved yet. Upload and save one on the Portfolio page.', 'info');
      return;
    }
    sel.innerHTML = ids.map((id) => `<option value="${id}">${OGC.esc(label(id, counts[id]))}</option>`).join('');
    let last = null;
    try { last = localStorage.getItem('lastPortfolio'); } catch { /* ignore */ }
    if (last && counts[last]) sel.value = last;
    load(Number(sel.value));
  } catch (err) {
    setStatus(statusBox, `Could not read portfolios from GeoServer: ${err.message}`, 'error');
  }
}

async function load(id) {
  setStatus(statusBox, 'Reading the portfolio from GeoServer…', 'info');
  const gj = await OGC.getFeatures('properties', OGC.equals('portfolio_id', id));
  current = gj.features.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  setStatus(statusBox, '', 'info');
  el('export').disabled = el('delete').disabled = !current.length;
  render(gj);
}

function render(gj) {
  const total = current.reduce((s, p) => s + p.loan_value, 0);
  const sum = (filter) => current.filter(filter).reduce((s, p) => s + p.loan_value, 0);
  const high = sum((p) => p.risk_level === 'High');
  const floodHigh = sum((p) => p.flood_class === 3);
  const heatHigh = sum((p) => p.heat_class === 3);

  el('kpis').innerHTML = [
    ['headline', 'Loan value in High-risk locations', fmtPct((100 * high) / total), `${fmtCrore(high)} of ${fmtCrore(total)}`],
    ['', 'Properties', fmtInt(current.length), `${current.filter((p) => p.risk_level === 'High').length} rated High`],
    ['', 'In High flood zones', fmtPct((100 * floodHigh) / total), 'share of loan value'],
    ['', 'In High heat zones', fmtPct((100 * heatHigh) / total), 'share of loan value'],
  ].map(([cls, l, v, s]) => `<div class="card kpi ${cls}"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');

  charts.forEach((c) => c.destroy());
  const levels = ['Low', 'Medium', 'High'];
  const crore = (v) => Math.round(v / 1e5) / 100;      // rupees -> crore, 2 decimals
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#4a423b';
  charts = [
    new Chart(el('donut'), {
      type: 'doughnut',
      data: { labels: levels, datasets: [{ data: levels.map((l) => crore(sum((p) => p.risk_level === l))),
        backgroundColor: levels.map((l) => RISK_COLORS[l]), borderColor: '#fbf6ee', borderWidth: 3 }] },
      options: { maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'right' },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ₹${c.raw} Cr (${fmtPct((100 * c.raw * 1e7) / total)})` } } } },
    }),
    new Chart(el('bars'), {
      type: 'bar',
      data: { labels: levels.map((l) => `${l}`), datasets: [
        { label: 'By flood class', data: [1, 2, 3].map((c) => crore(sum((p) => p.flood_class === c))), backgroundColor: '#12335b', borderRadius: 0 },
        { label: 'By heat class', data: [1, 2, 3].map((c) => crore(sum((p) => p.heat_class === c))), backgroundColor: '#8c2131', borderRadius: 0 },
      ] },
      options: { maintainAspectRatio: false,
        scales: { y: { title: { display: true, text: 'Loan value (₹ crore)' }, grid: { color: '#e2d6c6' } }, x: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ₹${c.raw} Cr` } } } },
    }),
  ];

  const top = current.filter((p) => p.risk_level === 'High').sort((a, b) => b.loan_value - a.loan_value).slice(0, 10);
  el('top').innerHTML = top.length ? top.map((p) => `<tr><td>${OGC.esc(p.property_id)}</td><td class="num">${fmtCrore(p.loan_value)}</td>
    <td>${OGC.LEVELS[p.flood_class]}</td><td>${OGC.LEVELS[p.heat_class]}</td><td class="num">${p.risk_score}</td></tr>`).join('')
    : '<tr><td colspan="5" class="hint">No High-risk properties in this portfolio.</td></tr>';

  if (propsLayer) map.removeLayer(propsLayer);
  propsLayer = L.geoJSON(gj, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, color: '#fff', weight: 1, fillColor: RISK_COLORS[f.properties.risk_level], fillOpacity: 0.95 }),
    onEachFeature: (f, layer) => layer.bindPopup(`<b>${OGC.esc(f.properties.property_id)}</b><br>${fmtCrore(f.properties.loan_value)} · ${f.properties.risk_level}`),
  }).addTo(map);
  if (current.length) map.fitBounds(propsLayer.getBounds(), { padding: [20, 20] });
}

el('portfolio').addEventListener('change', (e) => load(Number(e.target.value)));

el('export').addEventListener('click', () => {
  const cols = ['property_id', 'lat', 'lon', 'loan_value', 'flood_class', 'heat_class', 'risk_score', 'risk_level'];
  const csv = [cols.join(',')].concat(current.map((p) => cols.map((c) => `"${String(p[c]).replace(/"/g, '""')}"`).join(','))).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `portfolio_${el('portfolio').value}_scored.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

el('delete').addEventListener('click', async () => {
  const id = el('portfolio').value;
  if (!confirm(`Delete portfolio ${id} and all its properties from GeoServer?`)) return;
  try {
    const r = await OGC.transaction(OGC.deletePortfolioXml(id));
    setStatus(statusBox, `Deleted ${r.deleted} properties (WFS-T Delete).`, 'ok');
    listPortfolios();
  } catch (err) {
    setStatus(statusBox, `Delete failed: ${err.message}`, 'error');
  }
});

listPortfolios();
