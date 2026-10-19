// Results from Notebook 05 (validation). Update these after you re-run the notebooks.
const VALIDATION = {
  auc: 0.81,
  frequencyRatio: { Low: 0.01, Medium: 2.48, High: 1.43 },
  observedKm2: 0.49,            // radar-detected open-water flood inside the city after masking
  patches: 6,                   // independent flood patches larger than 0.01 km²
  patchesInMediumHigh: 6,       // of those, how many fell in Medium or High zones
  landShareMediumHighPct: 45,   // share of city land the model calls Medium or High
  radarDate: '5 September 2022',
  reportPoints: null,           // fill in after verifying flood_2022_reports.csv, e.g. { verified: 20, inMediumHighPct: 85 }
};
