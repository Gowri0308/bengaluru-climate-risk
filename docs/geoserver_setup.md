# Phase 6: Publishing the layers with GeoServer

This guide publishes every map layer from the Colab notebooks as OGC web services (WMS, WFS, WFS-T) on your own computer. Most of the work is done by one script, `geoserver/setup_geoserver.py`, which talks to GeoServer's REST API. It was tested on GeoServer **2.28.6** and **3.0.2**.

**Time:** about 20 minutes.

## What you need

| Item | Check |
| --- | --- |
| GeoServer, running | Open http://localhost:8080/geoserver and log in (default `admin` / `geoserver`) |
| Python 3 | In Command Prompt: `python --version`. If missing, install from python.org and tick **Add Python to PATH** |
| `geoserver_bundle.zip` | Made by Notebook 06, in `MyDrive/bengaluru-climate-risk/` |
| This repository on your computer | **Code → Download ZIP** on GitHub, then unzip, or `git clone` |
| XAMPP (for step 5) | Apache can start from the XAMPP Control Panel |

Keep XAMPP's **Tomcat switched off**: it also uses port 8080.

## Step 1. Put the data in place

1. Download `geoserver_bundle.zip` from Google Drive.
2. Unzip it to `C:\climaterisk\data`. You should see `bengaluru.gpkg`, nine `.tif` files and `sample_portfolio.csv` directly in that folder.

Don't open `bengaluru.gpkg` in QGIS while GeoServer is using it: two programs writing to one GeoPackage can lock it.

## Step 2. Set your passwords in the script

Open `geoserver/setup_geoserver.py` in a text editor and check the **SETTINGS** block at the top:

| Setting | Change it when |
| --- | --- |
| `GEOSERVER` | GeoServer runs on a different port |
| `ADMIN_PASSWORD` | You changed the admin password (you should, see step 4) |
| `DATA_DIR` | You unzipped the data somewhere other than `C:\climaterisk\data` |
| `API_PASSWORD` | Always: pick your own. The web app (Phase 7) logs in with it to save properties |

## Step 3. Run the script

In Command Prompt:

```
cd path\to\bengaluru-climate-risk\geoserver
python setup_geoserver.py
```

It prints one line per action. A successful run ends with `All done.` It does this:

1. **Workspace:** creates `climaterisk` with namespace URI `http://climaterisk` (the `xmlns:climaterisk` used in the WFS XML).
2. **Styles:** uploads the 12 SLD files from `geoserver/styles/`.
3. **Vector layers:** connects `bengaluru.gpkg` as a GeoPackage store and publishes 10 layers.
4. **Raster layers:** publishes each GeoTIFF as its own layer.
5. **Default styles:** gives each layer its style.
6. **WFS-T security:** creates the role `ROLE_EDITOR` and the user `climate_api` with that role, and adds the data rule `climaterisk.properties.w = ROLE_EDITOR`. Only that user can edit `properties`; everyone else gets read-only.

It is safe to run again. Existing items are kept, and styles are updated, which is handy after you edit an SLD.

### The published layers

| Layer | Type | Style | Used for |
| --- | --- | --- | --- |
| `flood_risk` | raster | `flood_risk_style` | WMS: flood risk index, cream to navy |
| `flood_class` | raster | `flood_class_style` | WMS: Low / Medium / High flood |
| `heat_risk` | raster | `heat_risk_style` | WMS: heat index |
| `heat_class` | raster | `heat_class_style` | WMS: Low / Medium / High heat |
| `flood_2022_observed` | raster | `flood_2022_style` | WMS: September 2022 flood (radar) |
| `validation_result` | raster | `validation_style` | WMS: hit / miss / false alarm |
| `flood_factor_values` | raster, 6 bands | default | GetFeatureInfo: the "why is this High?" popup |
| `flood_factor_scores`, `heat_values` | raster | default | GetFeatureInfo |
| `flood_zones`, `heat_zones` | polygons | default | **WFS**: zone lookup for each property |
| `properties` | points | `properties_style` | **WFS-T**: uploaded properties; WMS dots |
| `flood_2022_reports` | points | `flood_reports_style` | WMS: news-reported floods |
| `ward_flood_summary` | polygons | `ward_flood_style` | WMS: ward view |
| `bbmp_boundary`, `lakes`, `drains` | vectors | own styles | WMS base layers |
| `ward_heat_summary`, `flood_2022_polygons` | polygons | default | Optional extras |

## Step 4. Check it in the web admin

1. Open http://localhost:8080/geoserver/web and log in.
2. **Layer Preview** → type `climaterisk` in the filter → click **OpenLayers** next to `flood_class`, `heat_class` and `properties` (empty for now). Each opens a map in the right colours.
3. **Styles:** open one style and click **Validate**. It should report no errors.
4. **Security → Users, Groups, Roles → Users:** change the `admin` password. Then update `ADMIN_PASSWORD` in the script.
5. **Security → Data:** check the rule `*.*.w`. It should be `ADMIN` (or `GROUP_ADMIN,ADMIN`), not `*`. If it is `*`, anyone can edit any layer; change it. The script prints a NOTE if it finds this.

## Step 5. Apache proxy (XAMPP)

The browser must reach GeoServer and the Node.js API through one address, `http://localhost`. Otherwise the web pages hit cross-origin (CORS) errors.

1. Open `C:\xampp\apache\conf\httpd.conf` and make sure these two lines have **no** `#` in front:
   ```
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   ```
2. Copy `geoserver/apache/climaterisk-proxy.conf` to `C:\xampp\apache\conf\extra\`.
3. Add this line at the end of `httpd.conf`:
   ```
   Include conf/extra/climaterisk-proxy.conf
   ```
4. Restart Apache in the XAMPP Control Panel.
5. In GeoServer: **Settings → Global → Proxy Base URL** = `http://localhost/geoserver`, then **Save**. Capabilities documents then point at the Apache address.

Test: http://localhost/geoserver/web should open GeoServer through Apache (port 80, no `:8080`).

## Step 6. Test the services

Run these in Command Prompt from the `geoserver\requests` folder. Each XML file explains itself in a comment at the top.

**WMS (a map image).** Paste into the browser:
```
http://localhost/geoserver/climaterisk/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=climaterisk:flood_class,climaterisk:lakes,climaterisk:bbmp_boundary&STYLES=&SRS=EPSG:4326&BBOX=77.45,12.83,77.80,13.15&WIDTH=700&HEIGHT=640&FORMAT=image/png
```

**WFS (which flood zone is Bellandur in?)**
```
curl -H "Content-Type: text/xml" --data @01_getfeature_flood_zone_at_point.xml http://localhost/geoserver/climaterisk/wfs
```
Expect JSON with `risk_class` and `risk_level`. An empty `features` list means the point is outside every zone; check that the coordinates are `longitude latitude`.

**WFS-T insert, without login (must be refused):**
```
curl -H "Content-Type: text/xml" --data @03_transaction_insert_property.xml http://localhost/geoserver/climaterisk/wfs
```
Expect `properties is read-only`.

**WFS-T insert as the API user (must work):**
```
curl -u climate_api:YOUR_API_PASSWORD -H "Content-Type: text/xml" --data @03_transaction_insert_property.xml http://localhost/geoserver/climaterisk/wfs
```
Expect `<wfs:totalInserted>1</wfs:totalInserted>`. Layer Preview of `properties` now shows one red dot at Bellandur.

**WFS-T delete (clean up):**
```
curl -u climate_api:YOUR_API_PASSWORD -H "Content-Type: text/xml" --data @04_transaction_delete_portfolio.xml http://localhost/geoserver/climaterisk/wfs
```
Expect `<wfs:totalDeleted>1</wfs:totalDeleted>`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot reach the GeoServer REST API` | GeoServer isn't running, or the port, admin user or password in SETTINGS is wrong |
| Port 8080 already in use | XAMPP Tomcat or another program is on 8080: stop it, or change `GEOSERVER` in the script |
| `bengaluru.gpkg not found` | Unzip the bundle so the files sit directly in `DATA_DIR`, not in a subfolder |
| A raster fails with `Failed to locate the input file` | The `.tif` is missing from `DATA_DIR`, or GeoServer can't read that folder |
| Layer Preview is blank | Zoom to the layer; for a raster, check its style was set (step 3 output) |
| WFS returns no features | The coordinates are in the wrong order: use `longitude latitude` with `srsName="EPSG:4326"` |
| WFS-T: `read-only` even with `-u` | Wrong API password, or the data rule from step 3 is missing (Security → Data) |
| WFS-T: `database is locked` | Close QGIS or any other program that has `bengaluru.gpkg` open |
| Apache won't start | Port 80 is taken (often Skype or IIS). Free it, or change Apache's `Listen` port |

## Doing it by hand instead of the script

Everything the script does can also be done in the web admin. This is useful to understand what happened, or for an interview walkthrough:

1. **Workspaces → Add new workspace:** name `climaterisk`, namespace URI `http://climaterisk`.
2. **Stores → Add new store → GeoPackage:** workspace `climaterisk`, name `bengaluru`, database `C:\climaterisk\data\bengaluru.gpkg`. **Publish** each layer listed above; on each, click **Compute from data** and **Compute from native bounds**, then **Save**.
3. **Stores → Add new store → GeoTIFF:** one store per `.tif`, with the store name the same as the file name. Publish each.
4. **Styles → Add a new style:** workspace `climaterisk`, **Upload a style file** → choose the SLD → **Validate** → **Submit**. Repeat for all 12.
5. **Layers → (layer) → Publishing tab → Default style:** pick its style from the table above.
6. **Security → Users, Groups, Roles:** add role `ROLE_EDITOR`; add user `climate_api` with that role.
7. **Security → Data → Add new rule:** workspace `climaterisk`, layer `properties`, access mode **Write**, role `ROLE_EDITOR`.
8. **Services → WFS:** service level **Complete** (allows transactions).
