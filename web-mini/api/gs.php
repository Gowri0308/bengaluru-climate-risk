<?php
/*
 * The one gateway between the web page and GeoServer. The page and the map services then share
 * one address, so the browser never hits cross-origin (CORS) errors.
 *  - Reads (WMS, WFS GetFeature) pass straight through.
 *  - Writes (WFS-T Transactions) are checked: they may only touch climaterisk:properties.
 *    Only then is the GeoServer login from config.php added, so the password never reaches the browser.
 */
$cfg = (is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : []) + [
    'geoserver' => 'http://localhost:8080/geoserver', 'workspace' => 'climaterisk',
    'namespace_uri' => 'http://climaterisk', 'user' => '', 'password' => '',
];
$ws = $cfg['workspace'];

function fail(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/xml');
    exit('<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows"><ows:Exception><ows:ExceptionText>'
        . htmlspecialchars($msg, ENT_XML1) . '</ows:ExceptionText></ows:Exception></ows:ExceptionReport>');
}

$path = $_SERVER['PATH_INFO'] ?? '';
if (!preg_match('#^/' . preg_quote($ws, '#') . '/(wms|wfs|ows)$#', $path)) fail(404, "Only /$ws/wms and /$ws/wfs are forwarded.");
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') fail(405, 'GET or POST only.');
$body = $method === 'POST' ? file_get_contents('php://input') : '';
$headers = "Content-Type: text/xml\r\n";

if (preg_match('/<\s*([\w-]+:)?Transaction\b/', $body)) {
    if (strlen($body) > 5 * 1024 * 1024) fail(400, 'Request too large (5 MB max).');
    if ($cfg['password'] === '') fail(500, 'Copy api/config.example.php to api/config.php and set the GeoServer password.');
    $doc = new DOMDocument();
    if (!@$doc->loadXML($body, LIBXML_NONET)) fail(400, 'The request is not well-formed XML.');
    $wfs = 'http://www.opengis.net/wfs';
    $root = $doc->documentElement;
    if ($root->namespaceURI !== $wfs || $root->localName !== 'Transaction') fail(400, 'Only wfs:Transaction requests are accepted.');
    foreach ($root->childNodes as $action) {
        if ($action->nodeType !== XML_ELEMENT_NODE) continue;
        $ok = $action->namespaceURI === $wfs;
        if ($action->localName === 'Insert') {
            foreach ($action->childNodes as $f) {
                if ($f->nodeType === XML_ELEMENT_NODE) $ok = $ok && $f->namespaceURI === $cfg['namespace_uri'] && $f->localName === 'properties';
            }
        } elseif ($action->localName === 'Delete' || $action->localName === 'Update') {
            $ok = $ok && $action->getAttribute('typeName') === "$ws:properties";
        } else {
            $ok = false;
        }
        if (!$ok) fail(403, "Only $ws:properties may be changed.");
    }
    $headers .= 'Authorization: Basic ' . base64_encode($cfg['user'] . ':' . $cfg['password']) . "\r\n";
}

$url = rtrim($cfg['geoserver'], '/') . $path . (($_SERVER['QUERY_STRING'] ?? '') !== '' ? '?' . $_SERVER['QUERY_STRING'] : '');
$response = @file_get_contents($url, false, stream_context_create(['http' => [
    'method' => $method, 'header' => $headers, 'content' => $body, 'timeout' => 120,
    'ignore_errors' => true,                  // pass GeoServer's own error messages through
]]));
if ($response === false) fail(502, 'Could not reach GeoServer at ' . $cfg['geoserver'] . '. Is it running?');

foreach ($http_response_header as $h) {
    if (preg_match('#^HTTP/\S+\s(\d{3})#', $h, $m)) http_response_code((int)$m[1]);
    elseif (preg_match('#^Content-Type:#i', $h)) header($h);
}
echo $response;
