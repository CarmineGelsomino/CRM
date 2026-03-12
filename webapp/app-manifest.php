<?php
declare(strict_types=1);

header('Content-Type: application/manifest+json; charset=utf-8');

$manifest = [
    'id' => '/webapp/',
    'name' => 'Trade Immobiliare CRM',
    'short_name' => 'Trade CRM',
    'description' => 'CRM per la gestione di contatti e immobili di Trade Immobiliare.',
    'lang' => 'it',
    'dir' => 'ltr',
    'start_url' => './index.php',
    'scope' => './',
    'display' => 'standalone',
    'orientation' => 'portrait',
    'background_color' => '#F5F6F7',
    'theme_color' => '#b68b60',
    'icons' => [
        [
            'src' => './img/logo.webp',
            'sizes' => '512x512',
            'type' => 'image/webp',
            'purpose' => 'any'
        ]
    ]
];

echo json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
