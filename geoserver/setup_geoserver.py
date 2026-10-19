"""
Bengaluru Climate Risk Scanner: one-shot GeoServer setup through the REST API.

Creates the `climaterisk` workspace, connects the GeoPackage and the GeoTIFFs,
publishes every layer, uploads the SLD styles, sets each layer's default style,
and gives one API user write access to `climaterisk:properties` for WFS-T.

Safe to run again: anything that already exists is kept (styles are updated).

Usage (on the computer where GeoServer runs, GeoServer started):
    1. Unzip geoserver_bundle.zip (from Notebook 06) to the DATA_DIR below.
    2. Edit the SETTINGS block if your paths or passwords differ.
    3. From this folder:  python setup_geoserver.py
Only the Python standard library is used; nothing to pip install.
"""
import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------- SETTINGS --
GEOSERVER = 'http://localhost:8080/geoserver'
ADMIN_USER = 'admin'
ADMIN_PASSWORD = 'geoserver'                 # change if you changed the admin password
DATA_DIR = r'C:\climaterisk\data'            # where geoserver_bundle.zip was unzipped
WORKSPACE = 'climaterisk'
NAMESPACE_URI = 'http://climaterisk'         # used in the WFS / WFS-T XML (xmlns:climaterisk)
API_USER = 'climate_api'                     # the Node.js app logs in as this user for WFS-T
API_PASSWORD = 'change-me-please'            # pick your own; the Node.js .env file needs the same value
STYLES_DIR = Path(__file__).resolve().parent / 'styles'
# ----------------------------------------------------------------------------

# GeoPackage layers: (published name, table in bengaluru.gpkg, default style or None)
VECTOR_LAYERS = [
    ('bbmp_boundary',       'bbmp_boundary',       'boundary_style'),
    ('lakes',               'lakes',               'lakes_style'),
    ('drains',              'drains',              'drains_style'),
    ('flood_zones',         'flood_zones',         None),
    ('heat_zones',          'heat_zones',          None),
    ('ward_flood_summary',  'ward_flood_summary',  'ward_flood_style'),
    ('ward_heat_summary',   'ward_heat_summary',   None),
    ('flood_2022_polygons', 'flood_2022_observed', None),
    ('flood_2022_reports',  'flood_2022_reports',  'flood_reports_style'),
    ('properties',          'properties',          'properties_style'),
]
# GeoTIFF layers: (published name = file name without .tif, default style or None)
RASTER_LAYERS = [
    ('flood_risk',          'flood_risk_style'),
    ('flood_class',         'flood_class_style'),
    ('heat_risk',           'heat_risk_style'),
    ('heat_class',          'heat_class_style'),
    ('flood_2022_observed', 'flood_2022_style'),
    ('validation_result',   'validation_style'),
    ('flood_factor_values', None),     # six bands, read by GetFeatureInfo for popups
    ('flood_factor_scores', None),
    ('heat_values',         None),
]

REST = GEOSERVER.rstrip('/') + '/rest'
AUTH = 'Basic ' + base64.b64encode(f'{ADMIN_USER}:{ADMIN_PASSWORD}'.encode()).decode()
problems = []


def call(method, path, body=None, ctype='application/json'):
    """Send a REST request; return (HTTP status, response text). Never raises on HTTP errors."""
    data = None
    if body is not None:
        data = (json.dumps(body) if isinstance(body, (dict, list)) else body).encode('utf-8')
    req = urllib.request.Request(REST + path, data=data, method=method)
    req.add_header('Authorization', AUTH)
    req.add_header('Accept', 'application/json')
    if data is not None:
        req.add_header('Content-Type', ctype)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')


def exists(path):
    return call('GET', path)[0] == 200


def step(ok, message, detail=''):
    print(('  OK    ' if ok else '  FAIL  ') + message)
    if not ok:
        problems.append(f'{message}: {detail[:300]}')


def main():
    data_dir = Path(DATA_DIR)
    print(f'GeoServer: {GEOSERVER}\nData:      {data_dir}\n')

    # 0. Can we talk to GeoServer?
    status, text = call('GET', '/about/version.json')
    if status != 200:
        sys.exit(f'Cannot reach the GeoServer REST API at {REST} (HTTP {status}). '
                 'Is GeoServer running, and are ADMIN_USER / ADMIN_PASSWORD right?')
    try:
        version = next(r['Version'] for r in json.loads(text)['about']['resource'] if r['@name'] == 'GeoServer')
    except Exception:
        version = 'unknown'
    print(f'Connected to GeoServer {version}\n')
    gpkg = data_dir / 'bengaluru.gpkg'
    if not gpkg.exists():
        sys.exit(f'{gpkg} not found. Unzip geoserver_bundle.zip into {data_dir} first.')

    # 1. Workspace and namespace URI
    print('1. Workspace')
    if not exists(f'/workspaces/{WORKSPACE}'):
        s, t = call('POST', '/workspaces', {'workspace': {'name': WORKSPACE}})
        step(s == 201, f'created workspace {WORKSPACE}', t)
    else:
        step(True, f'workspace {WORKSPACE} already exists')
    s, t = call('PUT', f'/namespaces/{WORKSPACE}', {'namespace': {'prefix': WORKSPACE, 'uri': NAMESPACE_URI}})
    step(s == 200, f'namespace URI set to {NAMESPACE_URI}', t)

    # 2. Styles (uploaded into the workspace; updated if they exist)
    print('\n2. Styles')
    for sld in sorted(STYLES_DIR.glob('*.sld')):
        name = sld.stem
        body = sld.read_text(encoding='utf-8')
        ctype = 'application/vnd.ogc.sld+xml'
        if exists(f'/workspaces/{WORKSPACE}/styles/{name}'):
            s, t = call('PUT', f'/workspaces/{WORKSPACE}/styles/{name}', body, ctype)
            step(s == 200, f'updated style {name}', t)
        else:
            s, t = call('POST', f'/workspaces/{WORKSPACE}/styles?name={name}', body, ctype)
            step(s == 201, f'uploaded style {name}', t)

    # 3. GeoPackage store and its layers
    print('\n3. GeoPackage layers')
    store = 'bengaluru'
    if not exists(f'/workspaces/{WORKSPACE}/datastores/{store}'):
        s, t = call('POST', f'/workspaces/{WORKSPACE}/datastores', {'dataStore': {
            'name': store,
            'description': 'Bengaluru Climate Risk Scanner GeoPackage',
            'connectionParameters': {'entry': [
                {'@key': 'dbtype', '$': 'geopkg'},
                {'@key': 'database', '$': gpkg.as_posix()},
            ]}}})
        step(s == 201, f'created store {store} -> {gpkg}', t)
    else:
        step(True, f'store {store} already exists')

    for name, table, style in VECTOR_LAYERS:
        path = f'/workspaces/{WORKSPACE}/datastores/{store}/featuretypes'
        if exists(f'{path}/{name}'):
            step(True, f'layer {name} already published')
        else:
            s, t = call('POST', path, {'featureType': {'name': name, 'nativeName': table, 'title': name.replace('_', ' ')}})
            step(s == 201, f'published layer {name}', t)
        if style:
            s, t = call('PUT', f'/layers/{WORKSPACE}:{name}',
                        {'layer': {'defaultStyle': {'name': style, 'workspace': WORKSPACE}}})
            step(s == 200, f'  style {style} on {name}', t)

    # 4. GeoTIFF stores and layers (one store per file)
    print('\n4. Raster layers')
    for name, style in RASTER_LAYERS:
        tif = data_dir / f'{name}.tif'
        if not tif.exists():
            step(False, f'{tif.name} missing', 'not in the data folder; run the notebook that makes it')
            continue
        if exists(f'/workspaces/{WORKSPACE}/coveragestores/{name}'):
            step(True, f'raster {name} already published')
        else:
            s, t = call('PUT', f'/workspaces/{WORKSPACE}/coveragestores/{name}/external.geotiff'
                               f'?configure=first&coverageName={name}', tif.resolve().as_posix(), 'text/plain')   # plain path; a file:// URL is rejected
            step(s in (200, 201), f'published raster {name}', t)
        if style:
            s, t = call('PUT', f'/layers/{WORKSPACE}:{name}',
                        {'layer': {'defaultStyle': {'name': style, 'workspace': WORKSPACE}}})
            step(s == 200, f'  style {style} on {name}', t)

    # 5. WFS-T: an API user that may write to climaterisk:properties only
    print('\n5. WFS-T security')
    role = 'ROLE_EDITOR'
    s, t = call('POST', f'/security/roles/role/{role}')
    step(s in (200, 201) or 'already' in t.lower() or s == 409, f'role {role} ready', t)
    s, t = call('POST', '/security/usergroup/users',
                {'user': {'userName': API_USER, 'password': API_PASSWORD, 'enabled': True}})
    if s in (200, 201):
        step(True, f'created user {API_USER}')
    else:
        s2, t2 = call('POST', f'/security/usergroup/user/{API_USER}',
                      {'user': {'userName': API_USER, 'password': API_PASSWORD, 'enabled': True}})
        step(s2 == 200, f'user {API_USER} already existed, password updated', t2 or t)
    s, t = call('POST', f'/security/roles/role/{role}/user/{API_USER}')
    step(s in (200, 201) or s == 409, f'{API_USER} has {role}', t)

    rule = f'{WORKSPACE}.properties.w'
    s, rules_text = call('GET', '/security/acl/layers')
    rules = json.loads(rules_text) if s == 200 else {}
    method = 'PUT' if rule in rules else 'POST'
    s, t = call(method, '/security/acl/layers', {rule: role})
    step(s == 200, f'data rule {rule} = {role}', t)
    if rules.get('*.*.w', '').strip() == '*':
        print('  NOTE  the default rule *.*.w lets ANYONE write to ANY layer. In the web admin go to\n'
              '        Security > Data and change *.*.w to ADMIN, so only the API user can edit properties.')

    s, t = call('GET', '/services/wfs/settings')
    if s == 200:
        level = json.loads(t).get('wfs', {}).get('serviceLevel', '?')
        ok = level in ('COMPLETE', 'TRANSACTIONAL')
        step(ok, f'WFS service level is {level}' + ('' if ok else ' (set it to Complete under Services > WFS)'), t)

    # 6. Summary
    print('\n' + ('All done. ' if not problems else f'Finished with {len(problems)} problem(s):'))
    for p in problems:
        print('  - ' + p)
    print(f'\nCheck the layers: {GEOSERVER}/web/  ->  Layer Preview  ->  filter "{WORKSPACE}"')


if __name__ == '__main__':
    main()
