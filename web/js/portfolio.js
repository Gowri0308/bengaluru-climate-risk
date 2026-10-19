// Portfolio: read a CSV, score each property with WFS, show it on the map, save it with WFS-T.

const map = makeMap('map');
fitToCity(map);
wms('lakes').addTo(map);
wms('bbmp_boundary').addTo(map);

const el = (id) => document.getElementById(id);
const statusBox = el('status');
const dots = L.layerGroup().addTo(map);
let rows = [];

// --- 1. Read and check the CSV -------------------------------------------------------------
const REQUIRED = ['property_id', 'latitude', 'longitude', 'loan_value'];

function readCsv(text, name) {
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const missing = REQUIRED.filter((c) => !parsed.meta.fields.includes(c));
  if (missing.length) {
    setStatus(statusBox, `Missing column(s): ${missing.join(', ')}. Required: ${REQUIRED.join(', ')}.`, 'error');
    return;
  }
  const bad = [];
  const seen = new Set();
  rows = [];
  parsed.data.forEach((r, i) => {
    const row = {
      property_id: String(r.property_id || '').trim(),
      latitude: Number(r.latitude), longitude: Number(r.longitude), loan_value: Number(r.loan_value),
    };
    const ok = row.property_id && !seen.has(row.property_id) &&
      Math.abs(row.latitude) <= 90 && Math.abs(row.longitude) <= 180 && row.loan_value >= 0 &&
      [row.latitude, row.longitude, row.loan_value].every(Number.isFinite);
    if (ok) { seen.add(row.property_id); rows.push(row); } else bad.push(i + 2);   // +2: header + 1-based
  });
  if (!rows.length) { setStatus(statusBox, 'No valid rows found in the file.', 'error'); return; }
  setStatus(statusBox, `${name}: ${rows.length} properties read` +
    (bad.length ? `, ${bad.length} rows skipped (line ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}: missing, duplicate or invalid values)` : ''), bad.length ? 'info' : 'ok');
  scoreAll();
}

const dz = el('dropzone');
el('file').addEventListener('change', (e) => e.target.files[0] && e.target.files[0].text().then((t) => readCsv(t, e.target.files[0].name)));
['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('drag')));
dz.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => readCsv(t, f.name)); });
el('sample').addEventListener('click', async () => {
  const res = await fetch('data/sample_portfolio.csv');
  if (!res.ok) { setStatus(statusBox, 'data/sample_portfolio.csv not found. Copy it from C:\\climaterisk\\data into the web app\'s data folder.', 'error'); return; }
  readCsv(await res.text(), 'sample_portfolio.csv');
});

// --- 2. Score every property with WFS ------------------------------------------------------
const tbody = el('rows');
const lvlCell = (level) => `<span class="pill" style="--c:${RISK_COLORS[level]}">${level}</span>`;

async function scoreAll() {
  el('save').disabled = true;
  el('to-dash').hidden = true;
  dots.clearLayers();
  tbody.innerHTML = '';
  const t0 = performance.now();
  await OGC.pool(rows, CONFIG.concurrency, async (r) => {
    try {
      const z = await OGC.zonesAt(r.longitude, r.latitude);
      Object.assign(r, { flood: z.flood, heat: z.heat }, OGC.score(z.flood, z.heat));
    } catch (err) {
      Object.assign(r, { flood: null, heat: null, score: null, level: 'Unscored', error: err.message });
    }
    L.circleMarker([r.latitude, r.longitude], { radius: 5, color: '#fff', weight: 1, fillColor: RISK_COLORS[r.level], fillOpacity: 0.95 })
      .bindPopup(`<b>${OGC.esc(r.property_id)}</b><br>Loan ${fmtCrore(r.loan_value)}<br>Flood ${OGC.LEVELS[r.flood] || '–'} · Heat ${OGC.LEVELS[r.heat] || '–'}<br>Risk ${r.level}${r.score !== null ? ` (${r.score})` : ''}`)
      .addTo(dots);
  }, (done) => {
    el('bar').style.width = `${(100 * done) / rows.length}%`;
    el('progress-text').textContent = `${done} of ${rows.length} properties scored`;
  });
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  el('progress-text').textContent = `${rows.length} properties scored in ${secs} s (${rows.length} WFS requests).`;
  renderTable();
  renderSummary();
  if (dots.getLayers().length) map.fitBounds(L.featureGroup(dots.getLayers()).getBounds(), { padding: [20, 20] });
  el('save').disabled = !rows.some((r) => r.level !== 'Unscored');
}

function renderTable() {
  const order = { High: 0, Medium: 1, Low: 2, Unscored: 3 };
  const sorted = [...rows].sort((a, b) => order[a.level] - order[b.level] || b.loan_value - a.loan_value);
  tbody.innerHTML = sorted.map((r) => `<tr>
    <td>${OGC.esc(r.property_id)}</td><td class="num">${fmtCrore(r.loan_value)}</td>
    <td>${OGC.LEVELS[r.flood] || '–'}</td><td>${OGC.LEVELS[r.heat] || '–'}</td>
    <td class="num">${r.score ?? '–'}</td><td>${lvlCell(r.level)}</td></tr>`).join('');
}

function renderSummary() {
  const total = rows.reduce((s, r) => s + r.loan_value, 0);
  const by = (lvl) => rows.filter((r) => r.level === lvl);
  const line = (lvl) => {
    const g = by(lvl); const v = g.reduce((s, r) => s + r.loan_value, 0);
    return g.length ? `<tr><td>${lvlCell(lvl)}</td><td class="num">${g.length}</td><td class="num">${fmtPct((100 * v) / total)}</td></tr>` : '';
  };
  el('summary').innerHTML = `<table><thead><tr><th>Risk</th><th class="num">Properties</th><th class="num">Loan share</th></tr></thead>
    <tbody>${['High', 'Medium', 'Low', 'Unscored'].map(line).join('')}</tbody></table>
    <p class="hint">Unscored = outside the city or on a lake; these are not saved.</p>`;
}

// --- 3. Save with WFS-T --------------------------------------------------------------------
el('save').addEventListener('click', async () => {
  const toSave = rows.filter((r) => r.level !== 'Unscored');
  const portfolioId = Math.floor(Date.now() / 1000);     // unique number: seconds since 1970
  el('save').disabled = true;
  let inserted = 0;
  try {
    for (let i = 0; i < toSave.length; i += CONFIG.insertBatch) {
      const batch = toSave.slice(i, i + CONFIG.insertBatch);
      inserted += (await OGC.transaction(OGC.insertXml(batch, portfolioId))).inserted;
      setStatus(statusBox, `Saving… ${inserted} of ${toSave.length}`, 'info');
    }
    const name = el('pname').value.trim();
    try {
      const names = JSON.parse(localStorage.getItem('portfolioNames') || '{}');
      if (name) names[portfolioId] = name;
      localStorage.setItem('portfolioNames', JSON.stringify(names));
      localStorage.setItem('lastPortfolio', String(portfolioId));
    } catch { /* names are a convenience only */ }
    setStatus(statusBox, `Saved ${inserted} properties to GeoServer as portfolio ${portfolioId}.`, 'ok');
    el('to-dash').hidden = false;
  } catch (err) {
    setStatus(statusBox, `Saving failed after ${inserted} properties: ${err.message}`, 'error');
    el('save').disabled = false;
  }
});
