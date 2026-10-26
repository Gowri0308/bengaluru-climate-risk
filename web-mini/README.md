# Bengaluru Climate Risk Scanner (mini)

The same app as `web/` (risk map, portfolio scoring, dashboard, validation) in four small files:

| File | What it does |
| --- | --- |
| `index.html` | The page: header, four views in the sidebar, one map |
| `style.css` | The look (white, navy accents, green/amber/red risk colours) |
| `app.js` | Everything else: WMS layers, WFS queries with a GML point, WFS-T saves as GML, scoring, charts |
| `api/gs.php` | One gateway to GeoServer: passes reads through, checks WFS-T writes and adds the password |

## Run it (XAMPP + GeoServer)

1. Start GeoServer (`C:\geoserver\bin\startup.bat`) with the `climaterisk` layers already published.
2. Copy this folder to `C:\xampp\htdocs\climaterisk-mini`.
3. Copy `api\config.example.php` to `api\config.php` and set the `climate_api` password.
4. Copy `sample_portfolio.csv` (from `C:\climaterisk\data`) next to `index.html`.
5. Start Apache in XAMPP and open `http://localhost/climaterisk-mini/`.
