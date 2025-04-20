<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Allow from any origin
header("Access-Control-Allow-Origin: https://uthread.site");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, x-auth-token");
header("Access-Control-Allow-Credentials: true");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Parse request path
$requestUri = $_SERVER['REQUEST_URI'];
$baseDir = dirname($_SERVER['SCRIPT_NAME']);
$apiPath = substr($requestUri, strlen($baseDir));

// Make sure we have a leading slash
if (strpos($apiPath, '/') !== 0) {
    $apiPath = '/' . $apiPath;
}

// Get request method and headers
$method = $_SERVER['REQUEST_METHOD'];
$headers = getallheaders();

// Remove some headers that might cause issues
unset($headers['Host']);
unset($headers['Content-Length']);

// Convert headers to format needed for curl
$curlHeaders = [];
foreach ($headers as $key => $value) {
    if ($key !== 'Host' && $key !== 'Content-Length') {
        $curlHeaders[] = "$key: $value";
    }
}

// Get request body for POST, PUT, etc.
$body = file_get_contents('php://input');

// Set up curl options
$ch = curl_init();

// Internal API URL - since this PHP file is in your server's root directory,
// we'll forward to your Node.js server running on the same server
// Here we're assuming your Node.js server is running on port 5000 on the same machine
$apiUrl = 'http://127.0.0.1:5000' . $apiPath;

// Log the request for debugging
error_log("Proxying request to: " . $apiUrl);
error_log("Method: " . $method);
error_log("Headers: " . json_encode($curlHeaders));
error_log("Body: " . $body);

curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

if (!empty($curlHeaders)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
}

if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

// Execute the request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

// Check for curl errors
if (curl_errno($ch)) {
    error_log("Curl error: " . curl_error($ch));
    http_response_code(500);
    echo json_encode([
        'error' => 'Proxy error: ' . curl_error($ch),
        'code' => curl_errno($ch)
    ]);
    exit();
}

curl_close($ch);

// Forward the response
http_response_code($httpCode);
if ($contentType) {
    header("Content-Type: $contentType");
}
echo $response;
?> 