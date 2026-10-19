// OGC helpers: every request the app makes to GeoServer is built here.
// WMS draws maps, WFS (XML filter + GML point) reads features, WFS-T (GML) writes them.

const OGC = (() => {
  const ws = CONFIG.workspace;
  const wmsUrl = `${CONFIG.geoserver}/${ws}/wms`;
  const wfsUrl = `${CONFIG.geoserver}/${ws}/wfs`;
  const LEVELS = { 1: 'Low', 2: 'Medium', 3: 'High' };

  const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

  // A GML point. With WFS 1.1.0 and srsName="EPSG:4326", GeoServer reads "longitude latitude".
  const gmlPoint = (lon, lat) =>
    `<gml:Point srsName="EPSG:4326"><gml:pos>${lon} ${lat}</gml:pos></gml:Point>`;

  async function postXml(url, xml) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text;
  }

  function parseJson(text) {
    try { return JSON.parse(text); }
    catch { throw new Error(owsError(text) || 'GeoServer did not return JSON'); }
  }

  function owsError(xmlText) {
    const m = xmlText.match(/<(?:ows:)?ExceptionText>([\s\S]*?)<\/(?:ows:)?ExceptionText>/);
    return m ? m[1].trim() : null;
  }

  // One WFS GetFeature with two Query elements: the flood zone AND the heat zone at a point.
  function zonesAtPointXml(lon, lat) {
    const query = (type, props) => `
    <wfs:Query typeName="${ws}:${type}">
      ${props.map((p) => `<ogc:PropertyName>${p}</ogc:PropertyName>`).join('')}
      <ogc:Filter><ogc:Intersects><ogc:PropertyName>geom</ogc:PropertyName>${gmlPoint(lon, lat)}</ogc:Intersects></ogc:Filter>
    </wfs:Query>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:GetFeature service="WFS" version="1.1.0" outputFormat="application/json"
    xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:gml="http://www.opengis.net/gml" xmlns:${ws}="${CONFIG.namespaceUri}">${
      query('flood_zones', ['risk_class', 'risk_level', 'mean_fri'])}${
      query('heat_zones', ['risk_class', 'risk_level', 'mean_lst_c'])}
</wfs:GetFeature>`;
  }

  // Returns { flood: 1-3|null, heat: 1-3|null, meanFri, meanLst }. On a zone edge two polygons can
  // match; the higher class is kept (the cautious choice for a lender).
  async function zonesAt(lon, lat) {
    const data = parseJson(await postXml(wfsUrl, zonesAtPointXml(lon, lat)));
    const out = { flood: null, heat: null, meanFri: null, meanLst: null };
    for (const f of data.features || []) {
      const p = f.properties;
      if (String(f.id).startsWith('flood_zones') && (out.flood === null || p.risk_class > out.flood)) {
        out.flood = p.risk_class; out.meanFri = p.mean_fri;
      } else if (String(f.id).startsWith('heat_zones') && (out.heat === null || p.risk_class > out.heat)) {
        out.heat = p.risk_class; out.meanLst = p.mean_lst_c;
      }
    }
    return out;
  }

  // Combined property score and level.
  function score(flood, heat) {
    if (flood === null || heat === null) return { score: null, level: 'Unscored' };
    const s = Math.round((CONFIG.weights.flood * flood + CONFIG.weights.heat * heat) * 100) / 100;
    let level = s >= CONFIG.thresholds.high ? 'High' : s >= CONFIG.thresholds.medium ? 'Medium' : 'Low';
    if (flood === 3) level = 'High';
    return { score: s, level };
  }

  // WFS-T Insert of many properties in one Transaction, geometry written as GML.
  function insertXml(rows, portfolioId) {
    const feats = rows.map((r) => `
    <${ws}:properties>
      <${ws}:geom>${gmlPoint(r.longitude, r.latitude)}</${ws}:geom>
      <${ws}:portfolio_id>${portfolioId}</${ws}:portfolio_id>
      <${ws}:property_id>${esc(r.property_id)}</${ws}:property_id>
      <${ws}:loan_value>${r.loan_value}</${ws}:loan_value>
      <${ws}:flood_class>${r.flood}</${ws}:flood_class>
      <${ws}:heat_class>${r.heat}</${ws}:heat_class>
      <${ws}:risk_score>${r.score}</${ws}:risk_score>
      <${ws}:risk_level>${r.level}</${ws}:risk_level>
    </${ws}:properties>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:gml="http://www.opengis.net/gml" xmlns:${ws}="${CONFIG.namespaceUri}">
  <wfs:Insert>${feats}
  </wfs:Insert>
</wfs:Transaction>`;
  }

  function deletePortfolioXml(portfolioId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:ogc="http://www.opengis.net/ogc" xmlns:${ws}="${CONFIG.namespaceUri}">
  <wfs:Delete typeName="${ws}:properties">
    <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>portfolio_id</ogc:PropertyName><ogc:Literal>${Number(portfolioId)}</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
  </wfs:Delete>
</wfs:Transaction>`;
  }

  // Send a Transaction through the PHP guard; returns {inserted, deleted}.
  async function transaction(xml) {
    const res = await fetch(CONFIG.wfstProxy, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml });
    const text = await res.text();
    const err = owsError(text);
    if (!res.ok || err) throw new Error(err || `HTTP ${res.status}: ${text.slice(0, 300)}`);
    const n = (tag) => Number((text.match(new RegExp(`${tag}>(\\d+)<`)) || [0, 0])[1]);
    return { inserted: n('totalInserted'), deleted: n('totalDeleted') };
  }

  // WFS GetFeature (XML POST) with an optional ogc:Filter body; returns GeoJSON.
  async function getFeatures(typeName, filterXml = '', propertyNames = []) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:GetFeature service="WFS" version="1.1.0" outputFormat="application/json"
    xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:gml="http://www.opengis.net/gml" xmlns:${ws}="${CONFIG.namespaceUri}">
  <wfs:Query typeName="${ws}:${typeName}" srsName="EPSG:4326">
    ${propertyNames.map((p) => `<ogc:PropertyName>${p}</ogc:PropertyName>`).join('')}
    ${filterXml ? `<ogc:Filter>${filterXml}</ogc:Filter>` : ''}
  </wfs:Query>
</wfs:GetFeature>`;
    return parseJson(await postXml(wfsUrl, xml));
  }

  const equals = (prop, value) =>
    `<ogc:PropertyIsEqualTo><ogc:PropertyName>${prop}</ogc:PropertyName><ogc:Literal>${esc(value)}</ogc:Literal></ogc:PropertyIsEqualTo>`;

  // WMS GetFeatureInfo for raster values at a point (a small 101 x 101 pixel window centred on it).
  async function rasterValuesAt(layer, lon, lat) {
    const d = 0.0005;
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', SRS: 'EPSG:4326',
      LAYERS: `${ws}:${layer}`, QUERY_LAYERS: `${ws}:${layer}`, STYLES: '',
      BBOX: [lon - d, lat - d, lon + d, lat + d].join(','), WIDTH: 101, HEIGHT: 101, X: 50, Y: 50,
      INFO_FORMAT: 'application/json',
    });
    const res = await fetch(`${wmsUrl}?${params}`);
    const data = parseJson(await res.text());
    return data.features && data.features.length ? data.features[0].properties : null;
  }

  const legendUrl = (layer) =>
    `${wmsUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${ws}:${layer}` +
    '&LEGEND_OPTIONS=fontName:Arial;fontSize:11;fontAntiAliasing:true;dx:4;forceLabels:on';

  // Run async jobs with a limit on how many run at once.
  async function pool(items, limit, worker, onEach) {
    let next = 0, done = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i], i);
        onEach && onEach(++done);
      }
    });
    await Promise.all(runners);
  }

  return { LEVELS, wmsUrl, wfsUrl, zonesAt, score, insertXml, deletePortfolioXml, transaction,
           getFeatures, equals, rasterValuesAt, legendUrl, pool, esc };
})();
