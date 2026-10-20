// September 2022 story: as each step scrolls into view, the map flies to a place and shows its layers.

const map = makeMap('map');
let cityBounds = null;
fitToCity(map).then((b) => { cityBounds = b; });

// Each step: where the map goes and which GeoServer layers it shows (drawn bottom to top).
const STEPS = {
  city:    { view: 'city', layers: ['lakes', 'bbmp_boundary'] },
  lakes:   { view: 'city', layers: ['drains', 'lakes', 'bbmp_boundary'] },
  orr:     { center: [12.940, 77.690], zoom: 13, layers: ['flood_class', 'lakes', 'bbmp_boundary', 'flood_2022_reports'] },
  varthur: { center: [12.945, 77.735], zoom: 13, layers: ['flood_class', 'drains', 'lakes', 'bbmp_boundary', 'flood_2022_reports'] },
  radar:   { center: [12.970, 77.720], zoom: 12, layers: ['validation_result', 'flood_2022_observed', 'lakes', 'bbmp_boundary'] },
  model:   { view: 'city', layers: ['flood_class', 'lakes', 'bbmp_boundary'] },
};

const cache = {};
const layer = (id) => (cache[id] = cache[id] || wms(id, { opacity: id === 'flood_class' ? 0.8 : 1 }));
let shown = [];

function show(stepId) {
  const step = STEPS[stepId];
  if (!step) return;
  shown.filter((id) => !step.layers.includes(id)).forEach((id) => map.removeLayer(layer(id)));
  step.layers.forEach((id) => layer(id).addTo(map).bringToFront());
  shown = step.layers;
  if (step.view === 'city') {
    if (cityBounds) map.flyToBounds(cityBounds, { padding: [20, 20], duration: 1.2 });
  } else {
    map.flyTo(step.center, step.zoom, { duration: 1.4 });
  }
}

// Activate the step that crosses the middle of the screen.
const steps = document.querySelectorAll('.step');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    steps.forEach((s) => s.classList.toggle('active', s === e.target));
    show(e.target.dataset.step);
  });
}, { rootMargin: '-45% 0px -45% 0px' });
steps.forEach((s) => observer.observe(s));
show('city');
steps[0].classList.add('active');

// Fill the last step from the validation results (js/validation_numbers.js).
const V = VALIDATION;
document.getElementById('story-patches').textContent = `${V.patchesInMediumHigh} of ${V.patches}`;
const chance = (100 * Math.pow(V.landShareMediumHighPct / 100, V.patches)).toFixed(1);
document.getElementById('story-chance').textContent =
  `Those zones cover ${V.landShareMediumHighPct}% of the city, so landing there by chance would happen about ${chance}% of the time. ` +
  `Across every 30 m cell the model scores an AUC of ${V.auc.toFixed(2)}, and observed flooding was almost absent from its Low zones ` +
  `(frequency ratio ${V.frequencyRatio.Low}).`;
