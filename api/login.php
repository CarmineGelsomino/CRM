<?php

declare(strict_types=1);

use CRM\Api\Core\Database;

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/bootstrap.php';

$payload = json_decode(file_get_contents('php://input'), true);
$username = trim((string) ($payload['username'] ?? ''));
$password = trim((string) ($payload['password'] ?? ''));

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['authorized' => false, 'message' => 'Username e password sono obbligatori.']);
    exit;
}

try {
    $config = require __DIR__ . '/src/Config/database.php';
    $pdo = Database::connection($config);

    $statement = $pdo->prepare(
        'SELECT id, email, password_hash, is_active
         FROM users
         WHERE email = :identifier
            OR CONCAT(COALESCE(first_name, ""), " ", COALESCE(last_name, "")) = :identifier
         LIMIT 1'
    );
    $statement->execute(['identifier' => $username]);
    $user = $statement->fetch();

    $isAuthorized = is_array($user)
        && !empty($user['is_active'])
        && isset($user['password_hash'])
        && password_verify($password, (string) $user['password_hash']);

    if ($isAuthorized) {
        $_SESSION['crm_user'] = [
            'id' => (int) $user['id'],
            'email' => (string) $user['email'],
        ];
        echo json_encode(['authorized' => true]);
        exit;
    }

    unset($_SESSION['crm_user']);
    http_response_code(401);
    echo json_encode(['authorized' => false]);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode(['authorized' => false, 'message' => 'Errore interno durante il login.']);
}
