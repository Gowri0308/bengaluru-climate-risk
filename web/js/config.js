// Settings shared by every page. Change these if your setup differs.
const CONFIG = {
  // GeoServer, reached through the Apache proxy (same address as the pages, so no CORS errors)
  geoserver: '/geoserver',
  workspace: 'climaterisk',
  namespaceUri: 'http://climaterisk',

  // WFS-T goes through this small PHP file, which adds the GeoServer password on the server side
  wfstProxy: 'api/wfst.php',

  // Property risk score = 0.6 x flood class + 0.4 x heat class (classes: 1 Low, 2 Medium, 3 High)
  weights: { flood: 0.6, heat: 0.4 },
  thresholds: { high: 2.4, medium: 1.6 },   // score >= 2.4 High, >= 1.6 Medium, else Low; flood High always High

  concurrency: 6,        // property lookups sent to GeoServer at the same time
  insertBatch: 100,      // properties per WFS-T Transaction
};
