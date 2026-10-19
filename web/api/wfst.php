<?php
/*
 * WFS-T guard for the Bengaluru Climate Risk Scanner.
 *
 * The browser sends a WFS Transaction here instead of straight to GeoServer.
 * This file checks that it only touches climaterisk:properties, then forwards it
 * to GeoServer with the API user's password (HTTP Basic auth). The password stays
 * on the server and never reaches the browser.
 *
 * Settings live in config.php (copy config.example.php to config.php and edit it).
 */
header('Content-Type: application/xml; charset=utf-8');

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo '<?xml version="1.0"?><ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows"><ows:Exception><ows:ExceptionText>'
        . htmlspecialchars($msg, ENT_XML1) . '</ows:ExceptionText></ows:Exception></ows:ExceptionReport>';
    exit;
}

if (!is_file(__DIR__ . '/config.php')) fail(500, 'api/config.php is missing: copy config.example.php to config.php and set the password.');
$cfg = require __DIR__ . '/config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Use POST with a WFS Transaction body.');

$body = file_get_contents('php://input');
if ($body === '' || strlen($body) > 5 * 1024 * 1024) fail(400, 'Empty or too large request (5 MB max).');

// Parse without network access; reject anything that is not a well-formed WFS Transaction.
$doc = new DOMDocument();
if (!@$doc->loadXML($body, LIBXML_NONET)) fail(400, 'The request is not well-formed XML.');
$wfs = 'http://www.opengis.net/wfs';
$root = $doc->documentElement;
if ($root->namespaceURI !== $wfs || $root->localName !== 'Transaction') fail(400, 'Only wfs:Transaction requests are accepted.');

// Every action must target climaterisk:properties and nothing else.
$allowedType = $cfg['workspace'] . ':properties';
foreach ($root->childNodes as $action) {
    if ($action->nodeType !== XML_ELEMENT_NODE) continue;
    if ($action->namespaceURI !== $wfs) fail(403, 'Unexpected element in the Transaction.');
    switch ($action->localName) {
        case 'Insert':
            foreach ($action->childNodes as $feature) {
                if ($feature->nodeType !== XML_ELEMENT_NODE) continue;
                if ($feature->namespaceURI !== $cfg['namespace_uri'] || $feature->localName !== 'properties')
                    fail(403, 'Inserts are only allowed into ' . $allowedType . '.');
            }
            break;
        case 'Update':
        case 'Delete':
            if ($action->getAttribute('typeName') !== $allowedType)
                fail(403, ucfirst($action->localName) . 's are only allowed on ' . $allowedType . '.');
            break;
        default:
            fail(403, 'Transaction action ' . $action->localName . ' is not allowed.');
    }
}

// Forward to GeoServer with the API user's credentials.
$ctx = stream_context_create(['http' => [
    'method' => 'POST',
    'header' => "Content-Type: text/xml\r\nAuthorization: Basic " . base64_encode($cfg['user'] . ':' . $cfg['password']) . "\r\n",
    'content' => $body,
    'timeout' => 120,
    'ignore_errors' => true,      // also return GeoServer's error documents
]]);
$response = @file_get_contents($cfg['geoserver_wfs'], false, $ctx);
if ($response === false) fail(502, 'Could not reach GeoServer at ' . $cfg['geoserver_wfs'] . '. Is it running?');

if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) http_response_code((int)$m[1]);
echo $response;
