<?php

declare(strict_types=1);

return [
    'host' => getenv('CRM_DB_HOST') ?: '31.11.39.172',
    'port' => (int) (getenv('CRM_DB_PORT') ?: 3306),
    'dbname' => getenv('CRM_DB_NAME') ?: 'Sql1922580_1',
    'user' => getenv('CRM_DB_USER') ?: 'Sql1922580',
    'password' => getenv('CRM_DB_PASSWORD') ?: 'Giornatainterminabile10+',
    'charset' => 'utf8mb4',
];
