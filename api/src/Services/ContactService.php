<?php

declare(strict_types=1);

namespace CRM\Api\Services;

use PDO;

final class ContactService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function listContactsWithPrimaryPhone(array $filters = []): array
    {
        $where = [];
        $params = [];

        foreach ($filters as $field => $value) {
            if (in_array($field, ['id', 'user_id', 'first_name', 'last_name', 'email', 'pec_email', 'category', 'status', 'generic_info'], true)) {
                $where[] = "c.`{$field}` = :{$field}";
                $params[$field] = $value;
            }
        }

        $sql = <<<'SQL'
SELECT
    c.*,
    (
        SELECT cp.phone
        FROM contact_phones cp
        WHERE cp.contact_id = c.id
        ORDER BY cp.is_primary DESC, cp.id ASC
        LIMIT 1
    ) AS primary_phone
FROM contacts c
SQL;

        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY c.id DESC';

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll() ?: [];
    }

    public function getContactWithPrimaryPhone(int $id): ?array
    {
        $sql = <<<'SQL'
SELECT
    c.*,
    (
        SELECT cp.phone
        FROM contact_phones cp
        WHERE cp.contact_id = c.id
        ORDER BY cp.is_primary DESC, cp.id ASC
        LIMIT 1
    ) AS primary_phone
FROM contacts c
WHERE c.id = :id
LIMIT 1
SQL;

        $statement = $this->pdo->prepare($sql);
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row ?: null;
    }

    public function findInactiveContacts(int $days, ?int $userId = null): array
    {
        $sql = <<<'SQL'
SELECT
    c.id,
    c.user_id,
    c.first_name,
    c.last_name,
    c.email,
    c.category,
    c.status,
    COALESCE(MAX(a.created_at), MAX(n.created_at), c.updated_at, c.created_at) AS last_interaction_at,
    DATEDIFF(CURDATE(), DATE(COALESCE(MAX(a.created_at), MAX(n.created_at), c.updated_at, c.created_at))) AS inactive_days
FROM contacts c
LEFT JOIN activities a ON a.contact_id = c.id
LEFT JOIN notes n ON n.contact_id = c.id
WHERE c.status = 'attivo'
SQL;

        $params = [];
        if ($userId !== null) {
            $sql .= ' AND c.user_id = :user_id';
            $params['user_id'] = $userId;
        }

        $sql .= ' GROUP BY c.id HAVING inactive_days >= :days ORDER BY inactive_days DESC';
        $params['days'] = $days;

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll() ?: [];
    }
}
