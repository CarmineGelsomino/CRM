<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

$manifestPath = __DIR__ . '/manifest.json';
$manifestRaw = file_get_contents($manifestPath);

if ($manifestRaw === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Unable to load manifest'
    ]);
    exit;
}

$manifest = json_decode($manifestRaw, true);

if (!is_array($manifest)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid manifest format'
    ]);
    exit;
}

$isAuthorized = !empty($_SESSION['crm_user']);

if (!$isAuthorized) {
    $routes = $manifest['sap.ui5']['routing']['routes'] ?? [];
    $manifest['sap.ui5']['routing']['routes'] = array_values(array_filter($routes, static function ($route) {
        return ($route['name'] ?? '') === 'login';
    }));

    $targets = $manifest['sap.ui5']['routing']['targets'] ?? [];
    $manifest['sap.ui5']['routing']['targets'] = array_intersect_key($targets, ['login' => true]);
}

echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
