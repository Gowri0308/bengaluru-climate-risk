# Phase 7: Running the web app

The web app is four static pages (HTML, CSS, JavaScript with Leaflet) that talk to GeoServer with OGC standards, plus two small PHP files: `api/gs.php` forwards map and feature requests to GeoServer (so the browser sees one address and no CORS errors), and `api/wfst.php` guards WFS-T writes. XAMPP's Apache hosts it, with no Apache configuration changes. No database and no Node.js.

| Page | What it does | OGC requests |
| --- | --- | --- |
| **Risk map** (`index.html`) | Hazard layers with legends, overlays, base maps; click anywhere for flood and heat class plus the factor values | WMS GetMap (SLD styles), GetLegendGraphic; WFS GetFeature with an XML filter and a GML point; WMS GetFeatureInfo |
| **Portfolio** (`portfolio.html`) | Upload a CSV, score every property, see it on the map, save it | WFS GetFeature per property (flood and heat zone in one request); **WFS-T Insert** in GML, sent through the PHP guard |
| **Dashboard** (`dashboard.html`) | Share of loan value by risk level, charts, top High-risk loans, CSV download, delete | WFS GetFeature with `ogc:PropertyIsEqualTo` on `portfolio_id`; **WFS-T Delete** |
| **Validation** (`validation.html`) | Predicted flood classes vs the September 2022 flood, side by side | WMS |

## Before you start
- GeoServer running, with the layers published by `geoserver/setup_geoserver.py` (Phase 6). If you published them before this update, **run the script again**: it updates the styles (cleaner legends).
- XAMPP installed (only Apache is used).

## Steps

**1. Copy the app into XAMPP.** Copy the `web` folder to `C:\xampp\htdocs\` and rename it `climaterisk`, so you have `C:\xampp\htdocs\climaterisk\index.html`.

**2. Set the WFS-T password.** In `C:\xampp\htdocs\climaterisk\api\`, copy `config.example.php` to `config.php`. Open `config.php` in Notepad and set `'password'` to the `API_PASSWORD` you chose in `setup_geoserver.py`.

**3. Add the sample portfolio.** Copy `C:\climaterisk\data\sample_portfolio.csv` into `C:\xampp\htdocs\climaterisk\data\`.

**4. Start Apache** in the XAMPP Control Panel (keep Tomcat off), then open **http://localhost/climaterisk/**

That's all: `api/gs.php` forwards the WMS and WFS requests to GeoServer at `http://localhost:8080/geoserver` (change `'geoserver'` in `config.php` if yours runs elsewhere). An Apache reverse proxy (`geoserver/apache/climaterisk-proxy.conf`) is an optional alternative; if you set it up, change `geoserver` in `js/config.js` to `'/geoserver'`.

## Try it
1. **Risk map:** switch hazard layers; click a spot in Bellandur; the popup shows its classes and why.
2. **Portfolio:** click **Use the sample portfolio**. 500 properties are scored live (about 20 seconds), then click **Save to GeoServer**.
3. **Dashboard:** the saved portfolio opens with its headline number: the share of loan value in High-risk locations.
4. **Validation:** the two linked maps and your accuracy numbers.

## Updating the validation numbers
The Validation page reads its numbers from `js/validation_numbers.js`. Edit it after re-running Notebook 05, and add the news-report result once you have verified the points, for example:
```js
reportPoints: { verified: 20, inMediumHighPct: 85 },
```

## How the security works
The browser never holds the GeoServer password. WFS-T requests go to `api/wfst.php`, which:
1. accepts only a well-formed `wfs:Transaction`;
2. rejects any Insert, Update or Delete that targets a layer other than `climaterisk:properties` (HTTP 403);
3. forwards the request to GeoServer with the `climate_api` user's Basic auth, read from `config.php` (which is git-ignored).

GeoServer's own data rule (`climaterisk.properties.w = ROLE_EDITOR`) is a second layer of protection.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Maps are empty; `api/gs.php/...` requests fail with 502 | GeoServer isn't running, or `'geoserver'` in `config.php` points to the wrong address |
| Maps are empty; `api/gs.php/...` returns 404 | The folder isn't served by Apache (open `http://localhost/climaterisk/`, not the file directly) |
| Map works, saving fails: `api/config.php is missing` | Do step 2 |
| Saving fails: `properties is read-only` | The password in `config.php` doesn't match `API_PASSWORD`; or rerun `setup_geoserver.py` |
| Saving fails: `Could not reach GeoServer` | GeoServer isn't running on port 8080, or `'geoserver'` in `config.php` is wrong |
| PHP code shows up as text | You opened the file directly (`file:///...`): use `http://localhost/climaterisk/` |
| "Use the sample portfolio" says not found | Do step 3 |
| Every property is "Unscored" | The CSV's latitude and longitude columns are swapped, or the points are outside Bengaluru |
