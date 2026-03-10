<?php

declare(strict_types=1);

use CRM\Api\Core\CrudRepository;
use CRM\Api\Core\Database;
use CRM\Api\Core\JsonResponse;
use CRM\Api\Services\ContactService;
use CRM\Api\Services\UserService;

require_once __DIR__ . '/bootstrap.php';

$config = require __DIR__ . '/src/Config/database.php';
$entities = require __DIR__ . '/src/Config/entities.php';

try {
    $pdo = Database::connection($config);
} catch (Throwable $exception) {
    JsonResponse::send([
        'ok' => false,
        'message' => $exception->getMessage(),
    ], 500);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$entity = $_GET['entity'] ?? null;
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;
$action = $_GET['action'] ?? null;

$rawInput = file_get_contents('php://input');
$payload = $rawInput !== '' ? json_decode($rawInput, true) : [];
if (!is_array($payload)) {
    $payload = [];
}

if ($action !== null) {
    if ($entity === 'contacts' && $action === 'inactive') {
        $days = isset($_GET['days']) ? max(1, (int) $_GET['days']) : 30;
        $userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;

        $service = new ContactService($pdo);
        JsonResponse::send([
            'ok' => true,
            'data' => $service->findInactiveContacts($days, $userId),
        ]);
        exit;
    }

    if ($entity === 'users' && $action === 'reset-password' && $method === 'POST') {
        $service = new UserService($pdo);
        $result = $service->resetPassword($payload);
        JsonResponse::send($result, $result['ok'] ? 200 : 404);
        exit;
    }

    JsonResponse::send(['ok' => false, 'message' => 'Azione custom non supportata.'], 404);
    exit;
}

if ($entity === null || !isset($entities[$entity])) {
    JsonResponse::send([
        'ok' => false,
        'message' => 'Entità non valida. Usa parametro query ?entity=<nome_tabella>.',
        'allowed_entities' => array_keys($entities),
    ], 400);
    exit;
}

$definition = $entities[$entity];
$repository = new CrudRepository($pdo, $definition['table'], $definition['fields']);

try {
    if ($method === 'GET' && $id === null) {
        $filters = $_GET;
        unset($filters['entity'], $filters['id'], $filters['action']);
        JsonResponse::send(['ok' => true, 'data' => $repository->list($filters)]);
        exit;
    }

    if ($method === 'GET' && $id !== null) {
        $item = $repository->get($id);
        JsonResponse::send([
            'ok' => $item !== null,
            'data' => $item,
            'message' => $item ? null : 'Record non trovato.',
        ], $item ? 200 : 404);
        exit;
    }

    if ($method === 'POST') {
        $created = $repository->create($payload);
        JsonResponse::send(['ok' => true, 'data' => $created], 201);
        exit;
    }

    if (in_array($method, ['PUT', 'PATCH'], true)) {
        if ($id === null) {
            JsonResponse::send(['ok' => false, 'message' => 'Per update è richiesto ?id=<id>.'], 400);
            exit;
        }

        $updated = $repository->update($id, $payload);
        JsonResponse::send([
            'ok' => $updated !== null,
            'data' => $updated,
            'message' => $updated ? null : 'Record non trovato.',
        ], $updated ? 200 : 404);
        exit;
    }

    if ($method === 'DELETE') {
        if ($id === null) {
            JsonResponse::send(['ok' => false, 'message' => 'Per delete è richiesto ?id=<id>.'], 400);
            exit;
        }

        $deleted = $repository->delete($id);
        JsonResponse::send([
            'ok' => $deleted,
            'message' => $deleted ? 'Record eliminato.' : 'Record non trovato.',
        ], $deleted ? 200 : 404);
        exit;
    }

    JsonResponse::send(['ok' => false, 'message' => 'Metodo HTTP non supportato.'], 405);
} catch (Throwable $exception) {
    JsonResponse::send([
        'ok' => false,
        'message' => $exception->getMessage(),
    ], 500);
}
