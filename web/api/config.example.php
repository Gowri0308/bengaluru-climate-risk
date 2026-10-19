<?php
// Copy this file to config.php (same folder) and set the password you chose in setup_geoserver.py.
// config.php is listed in .gitignore, so the password never goes to GitHub.
return [
    'geoserver'     => 'http://localhost:8080/geoserver',   // where GeoServer runs (server side)
    'workspace'     => 'climaterisk',
    'namespace_uri' => 'http://climaterisk',
    'user'          => 'climate_api',                       // the WFS-T user made by setup_geoserver.py
    'password'      => 'change-me-please',
];
