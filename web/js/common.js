// Shared map setup: base maps, the city boundary, and number formatting.

const BASEMAPS = {
  'Light grey': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 16, attribution: 'Basemap © Esri' }),
  'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 18, attribution: 'Imagery © Esri' }),
  'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' }),
};

// A WMS overlay from the climaterisk workspace, drawn by GeoServer with the layer's SLD style.
function wms(layer, extra = {}) {
  return L.tileLayer.wms(OGC.wmsUrl, {
    layers: `${CONFIG.workspace}:${layer}`, format: 'image/png', transparent: true,
    tiled: true, maxZoom: 19, ...extra,
  });
}

function makeMap(id, { basemap = 'Light grey', zoomControl = true } = {}) {
  const map = L.map(id, { zoomControl, preferCanvas: true }).setView([12.97, 77.59], 11);
  BASEMAPS[basemap].addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  return map;
}

// Fit the map to the city boundary, read live from GeoServer with WFS.
async function fitToCity(map) {
  try {
    const gj = await OGC.getFeatures('bbmp_boundary');
    const layer = L.geoJSON(gj);
    map.fitBounds(layer.getBounds(), { padding: [10, 10] });
    return layer.getBounds();
  } catch (e) {
    console.warn('Could not read the city boundary:', e);
    return null;
  }
}

const RISK_COLORS = { Low: '#1a9850', Medium: '#f39c12', High: '#d7301f', Unscored: '#8c959f' };
const fmtInt = (n) => Number(n).toLocaleString('en-IN');
const fmtCrore = (rupees) => `₹${(rupees / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`;
const fmtPct = (x) => `${x.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;

function setStatus(el, text, kind = 'info') {
  el.textContent = text;
  el.className = `status status-${kind}`;
  el.hidden = !text;
}
