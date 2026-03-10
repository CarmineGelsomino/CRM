<?php

declare(strict_types=1);

namespace CRM\Api\Services;

use PDO;

final class UserService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function resetPassword(array $payload): array
    {
        $userId = isset($payload['user_id']) ? (int) $payload['user_id'] : null;
        $email = isset($payload['email']) ? trim((string) $payload['email']) : null;

        $newPassword = trim((string) ($payload['new_password'] ?? ''));
        if ($newPassword === '') {
            $newPassword = bin2hex(random_bytes(6));
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);

        if ($userId === null && $email === null) {
            return ['ok' => false, 'message' => 'Devi passare user_id o email.'];
        }

        if ($userId !== null) {
            $statement = $this->pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
            $statement->execute(['hash' => $newHash, 'id' => $userId]);
        } else {
            $statement = $this->pdo->prepare('UPDATE users SET password_hash = :hash WHERE email = :email');
            $statement->execute(['hash' => $newHash, 'email' => $email]);
        }

        if ($statement->rowCount() === 0) {
            return ['ok' => false, 'message' => 'Utente non trovato.'];
        }

        return [
            'ok' => true,
            'message' => 'Password reimpostata con successo.',
            'new_password' => $newPassword,
        ];
    }
}
