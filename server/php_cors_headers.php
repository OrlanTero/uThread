<?php
// CORS headers for PHP fallback solution
header("Access-Control-Allow-Origin: https://uthread.site");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, x-auth-token");
header("Access-Control-Allow-Credentials: true");

// Handle OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    // Return 200 OK for preflight requests
    header("HTTP/1.1 200 OK");
    exit;
}
?> 