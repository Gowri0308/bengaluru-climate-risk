<?php
// Copy this file to config.php (same folder) and set the password you chose in setup_geoserver.py.
// config.php is listed in .gitignore, so the password never goes to GitHub.
return [
    'geoserver_wfs' => 'http://localhost:8080/geoserver/climaterisk/wfs',   // direct to GeoServer, server side
    'workspace'     => 'climaterisk',
    'namespace_uri' => 'http://climaterisk',
    'user'          => 'climate_api',
    'password'      => 'change-me-please',
];
