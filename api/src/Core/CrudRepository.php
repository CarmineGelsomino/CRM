<?php

declare(strict_types=1);

namespace CRM\Api\Core;

use PDO;
use InvalidArgumentException;

final class CrudRepository
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $table,
        private readonly array $fillableFields
    ) {
    }

    public function list(array $filters = []): array
    {
        $where = [];
        $params = [];

        foreach ($filters as $field => $value) {
            if (in_array($field, $this->fillableFields, true) || $field === 'id') {
                $where[] = "`{$field}` = :{$field}";
                $params[$field] = $value;
            }
        }

        $sql = "SELECT * FROM `{$this->table}`";
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY id DESC';

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll();
    }

    public function get(int $id): ?array
    {
        $statement = $this->pdo->prepare("SELECT * FROM `{$this->table}` WHERE id = :id LIMIT 1");
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row ?: null;
    }

    public function create(array $payload): array
    {
        $data = $this->sanitizePayload($payload);

        if ($data === []) {
            throw new InvalidArgumentException('Nessun campo valido passato in input.');
        }

        $fields = array_keys($data);
        $columns = implode(', ', array_map(static fn ($field) => "`{$field}`", $fields));
        $placeholders = implode(', ', array_map(static fn ($field) => ":{$field}", $fields));

        $sql = "INSERT INTO `{$this->table}` ({$columns}) VALUES ({$placeholders})";
        $statement = $this->pdo->prepare($sql);
        $statement->execute($data);

        return $this->get((int) $this->pdo->lastInsertId()) ?? [];
    }

    public function update(int $id, array $payload): ?array
    {
        $data = $this->sanitizePayload($payload);

        if ($data === []) {
            throw new InvalidArgumentException('Nessun campo aggiornabile passato in input.');
        }

        $set = implode(', ', array_map(static fn ($field) => "`{$field}` = :{$field}", array_keys($data)));
        $data['id'] = $id;

        $sql = "UPDATE `{$this->table}` SET {$set} WHERE id = :id";
        $statement = $this->pdo->prepare($sql);
        $statement->execute($data);

        if ($statement->rowCount() === 0 && $this->get($id) === null) {
            return null;
        }

        return $this->get($id);
    }

    public function delete(int $id): bool
    {
        $statement = $this->pdo->prepare("DELETE FROM `{$this->table}` WHERE id = :id");
        $statement->execute(['id' => $id]);

        return $statement->rowCount() > 0;
    }

    private function sanitizePayload(array $payload): array
    {
        $allowed = array_flip($this->fillableFields);

        return array_intersect_key($payload, $allowed);
    }
}
