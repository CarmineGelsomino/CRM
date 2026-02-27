<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$payload = json_decode(file_get_contents('php://input'), true);
$username = trim($payload['username'] ?? '');
$password = trim($payload['password'] ?? '');

if ($username !== '' && $password !== '') {
    $_SESSION['crm_user'] = $username;
    echo json_encode(['authorized' => true]);
    exit;
}

echo json_encode(['authorized' => false]);
