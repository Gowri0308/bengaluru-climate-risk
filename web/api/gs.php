<?php
/*
 * GeoServer forwarder for the Bengaluru Climate Risk Scanner.
 *
 * The web pages call  api/gs.php/climaterisk/wms?...  and  api/gs.php/climaterisk/wfs
 * and this file passes each request on to GeoServer and returns the answer. The pages
 * and the map services then share one address, so the browser never hits cross-origin
 * (CORS) errors, and no Apache proxy configuration is needed.
 *
 * Read-only: WFS Transactions (writes) are refused here; they go through api/wfst.php.
 */
$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
$base = rtrim($cfg['geoserver'] ?? 'http://localhost:8080/geoserver', '/');
$ws = $cfg['workspace'] ?? 'climaterisk';

function stop(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

// Only the workspace's OGC endpoints may be reached.
$path = $_SERVER['PATH_INFO'] ?? '';
if (!preg_match('#^/' . preg_quote($ws, '#') . '/(wms|wfs|ows)$#', $path)) stop(404, 'Only /' . $ws . '/wms, /wfs and /ows are forwarded.');

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') stop(405, 'GET or POST only.');
$body = $method === 'POST' ? file_get_contents('php://input') : '';
if ($body !== '' && preg_match('/<\s*([\w-]+:)?Transaction\b/', $body)) stop(403, 'Transactions go through api/wfst.php.');

$url = $base . $path . (($_SERVER['QUERY_STRING'] ?? '') !== '' ? '?' . $_SERVER['QUERY_STRING'] : '');
$ctx = stream_context_create(['http' => [
    'method' => $method,
    'header' => 'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'text/xml') . "\r\n",
    'content' => $body,
    'timeout' => 60,
    'ignore_errors' => true,      // pass GeoServer's own error messages through
]]);
$response = @file_get_contents($url, false, $ctx);
if ($response === false) stop(502, 'Could not reach GeoServer at ' . $base . '. Is it running?');

foreach ($http_response_header as $h) {
    if (preg_match('#^HTTP/\S+\s(\d{3})#', $h, $m)) http_response_code((int)$m[1]);
    elseif (preg_match('#^(Content-Type|Cache-Control|Expires):#i', $h)) header($h);
}
echo $response;
